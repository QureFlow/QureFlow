import { BatchWriteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, DYNAMODB_TABLE_NAME } from '../config/aws.js';
import { dynamoDbRepo as repo } from '../repositories/dynamoDbRepo.js';
import { CLINICS } from '../seed.js';
import { clinicDate, clockMinutes, timeLabel } from '../lib/time.js';
import { doctorPrefix } from '../services/queueService.js';
import { readModelItems } from '../lib/readModels.js';
import { Doctor, QueueToken, Appointment, User } from '../models/types.js';
import { buildDemoDirectory, facilityNames, PATIENTS_PER_CLINIC } from './demoDirectory.js';
import { doctorProfile, simulateDay } from './simulation.js';

export const HISTORY_DAYS = 14;
const MARKER = { pk: 'DEMO#SEED', sk: 'V4' };

export async function expandLocalDemo() {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (
    !endpoint ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname) ||
    !/^QureFlowDemo/.test(DYNAMODB_TABLE_NAME)
  )
    throw new Error('Rich fixtures are restricted to the local demo table.');
  const read = async (Key: Record<string, string>) =>
    (await docClient.send(new GetCommand({ TableName: DYNAMODB_TABLE_NAME, Key }))).Item;
  if (await read(MARKER)) return;
  if (await read({ pk: 'DEMO#SEED', sk: 'V3' }))
    throw new Error(
      'This local demo table was created by an older fixture version. Run `npm run demo:reset --prefix backend` to rebuild it.',
    );
  console.log('[QureFlow] Expanding synthetic directory and simulated visit history…');
  const legacyAppointments = await repo.getAppointments();
  const legacyTokens = (
    await Promise.all(CLINICS.map((c) => repo.getRecentTokens(c.id, 90)))
  ).flat();
  const { clinics, doctors, patients } = buildDemoDirectory();
  for (const doctor of doctors) await repo.saveDoctor(doctor);
  for (const clinic of clinics) {
    await repo.saveClinic(clinic);
    await repo.saveSettings(
      {
        averageConsultationMinutes: 12,
        bufferMinutes: 2,
        allowWalkIns: true,
        allowEmergencyPriority: true,
        notifyOnTwoAhead: false,
        autoTokenPrefixByDoctor: true,
        clinicName: clinic.name,
        contactNumber: clinic.phone,
      },
      clinic.id,
    );
  }
  const items: Record<string, any>[] = [],
    visits: QueueToken[] = [],
    appointments: Appointment[] = [],
    createdAt = new Date().toISOString();
  for (const patient of patients)
    items.push(
      { pk: `USER#${patient.id}`, sk: 'METADATA', ...patient },
      { pk: `IDENTITY#PHONE#${patient.phone}`, sk: 'METADATA', userId: patient.id },
      { pk: `IDENTITY#EMAIL#${patient.email}`, sk: 'METADATA', userId: patient.id },
      { pk: 'CATALOG#PATIENTS', sk: patient.id, userId: patient.id },
      { pk: `PATIENTS#CLINIC#${patient.clinicId}`, sk: patient.id, userId: patient.id },
    );
  const counters = new Map<string, number>();
  const store = (token: QueueToken, appointment?: Appointment) => {
    const queueId = `${token.queueDate}#${token.doctorId}`,
      queuePk = `QUEUE#${queueId}`,
      queueSk = `TOKEN#${String(token.tokenSeq).padStart(8, '0')}`;
    counters.set(queueId, Math.max(counters.get(queueId) || 0, token.tokenSeq!));
    visits.push(token);
    items.push(
      { pk: queuePk, sk: queueSk, ...token },
      { pk: `TOKEN#${token.id}`, sk: 'METADATA', queuePk, queueSk },
      ...readModelItems('token', token),
    );
    if (appointment) {
      appointments.push(appointment);
      items.push(
        { pk: `APPOINTMENT#${appointment.id}`, sk: 'METADATA', ...appointment },
        ...readModelItems('appointment', appointment),
      );
    }
  };
  // History: simulated sessions in which the doctor follows QureFlow's own calling rule.
  for (const doctor of doctors) {
    const clinicIndex = clinics.findIndex((c) => c.id === doctor.clinicId),
      clinicPatients = patients.slice(
        clinicIndex * PATIENTS_PER_CLINIC,
        (clinicIndex + 1) * PATIENTS_PER_CLINIC,
      ),
      seen = new Set<string>();
    for (let day = HISTORY_DAYS; day >= 1; day--) {
      const simulated = simulateDay({
        doctor,
        date: clinicDate(new Date(Date.now() - day * 86400000)),
        dayIndex: HISTORY_DAYS - day,
        patients: clinicPatients,
        seenBefore: seen,
        idPrefix: 'demo-v4',
      });
      const linked = new Map(simulated.appointments.map((a) => [a.tokenId, a]));
      for (const token of simulated.tokens)
        store({ ...token, appointmentId: linked.get(token.id)?.id }, linked.get(token.id));
    }
  }
  // Today: a live session in progress for every doctor, and three booked future days. Live
  // walk-ins from the base seed already hold the first token numbers of some queues.
  for (const doctor of doctors) {
    const queueId = `${clinicDate()}#${doctor.id}`;
    const existing = await read({ pk: `QUEUE#${queueId}`, sk: 'COUNTER' });
    if (existing) counters.set(queueId, existing.currentNumber);
  }
  for (const doctor of doctors) {
    const clinicIndex = clinics.findIndex((c) => c.id === doctor.clinicId),
      local = doctors
        .filter((d) => d.clinicId === doctor.clinicId)
        .findIndex((d) => d.id === doctor.id),
      offset = clinicIndex * PATIENTS_PER_CLINIC,
      typical = doctorProfile(doctor).baseMinutes;
    for (let i = 0; i < 6; i++)
      liveVisit(doctor, patients[offset + local * 6 + i], clinicDate(), i, 'today', typical);
    for (let i = 1; i <= 3; i++)
      liveVisit(
        doctor,
        patients[offset + 60 + local],
        clinicDate(new Date(Date.now() + i * 86400000)),
        i,
        'future',
        typical,
      );
  }
  function liveVisit(
    doctor: Doctor,
    patient: User,
    date: string,
    index: number,
    mode: 'today' | 'future',
    typical: number,
  ) {
    const queueId = `${date}#${doctor.id}`,
      seq = (counters.get(queueId) || 0) + 1,
      id = `demo-v4-${mode}-${doctor.id}-${index}`;
    const scheduledMinute = clockMinutes(doctor.startTime) + (index % 4) * 30,
      time = timeLabel(scheduledMinute),
      status =
        mode === 'future'
          ? 'waiting'
          : index < 2
            ? 'completed'
            : index === 2
              ? 'current'
              : 'waiting';
    const called = new Date(Date.now() - (index < 2 ? 45 + index * 20 : 3) * 60000);
    const arrival = new Date(called.getTime() - (5 + index * 4) * 60000).toISOString();
    const token: QueueToken = {
      id,
      appointmentId: mode === 'future' ? `apt-${id}` : undefined,
      tokenNumber: `${doctorPrefix(doctor.id)}-${String(seq).padStart(3, '0')}`,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      doctorId: doctor.id,
      doctorName: doctor.name,
      clinicId: doctor.clinicId,
      clinicName: doctor.clinicName,
      scheduledTime: mode === 'today' ? 'Walk-in' : time,
      priority: 'normal',
      isWalkIn: mode === 'today',
      status,
      createdAt: mode === 'future' ? createdAt : arrival,
      ...(['current', 'completed'].includes(status) ? { calledAt: called.toISOString() } : {}),
      ...(status === 'completed'
        ? {
            servedAt: new Date(
              called.getTime() + typical * (0.85 + index * 0.2) * 60000,
            ).toISOString(),
          }
        : {}),
      queueDate: date,
      queueId,
      tokenSeq: seq,
      version: 1,
      updatedAt: createdAt,
      metadata: {
        synthetic: true,
        source: 'synthetic_fixture',
        schemaVersion: 4,
        timeZone: 'Asia/Kolkata',
        arrivalChannel: mode === 'today' ? 'reception' : 'online_booking',
        ...(mode === 'today' ? { checkInAt: arrival } : {}),
        dataProvenance: 'Generated locally for demonstration',
      },
    };
    const appointment: Appointment | undefined =
      mode === 'future'
        ? {
            id: `apt-${id}`,
            tokenId: id,
            patientId: patient.id,
            patientName: patient.name,
            patientPhone: patient.phone,
            doctorId: doctor.id,
            doctorName: doctor.name,
            doctorSpecialization: doctor.specialization,
            clinicId: doctor.clinicId,
            clinicName: doctor.clinicName,
            date,
            time,
            tokenNumber: token.tokenNumber,
            status: 'booked',
            priority: 'normal',
            isWalkIn: false,
            notes: 'Synthetic outpatient visit; no real clinical information.',
            createdAt,
            updatedAt: createdAt,
            version: 1,
            metadata: {
              synthetic: true,
              source: 'synthetic_fixture',
              schemaVersion: 4,
              bookingChannel: 'patient_portal',
            },
          }
        : undefined;
    store(token, appointment);
    if (['waiting', 'current'].includes(status))
      items.push({ pk: `PATIENT_DAY#${date}#${patient.id}`, sk: 'ACTIVE', tokenId: id });
    if (status === 'current') items.push({ pk: `QUEUE#${queueId}`, sk: 'CURRENT', tokenId: id });
    if (appointment)
      items.push({
        pk: `SLOT#${date}#${doctor.id}#${time}`,
        sk: 'COUNTER',
        bookedCount: 1,
        capacity: Math.max(1, Math.floor(30 / (doctor.slotDurationMinutes + 2))),
      });
  }
  for (const [queueId, next] of counters)
    items.push({ pk: `QUEUE#${queueId}`, sk: 'COUNTER', currentNumber: next });
  // Index records written by the earlier, smaller fixture so read models see them too.
  for (const apt of legacyAppointments) items.push(...readModelItems('appointment', apt));
  for (const token of legacyTokens) items.push(...readModelItems('token', token));
  const legacyPatients = await repo.getPatients();
  for (const patient of legacyPatients) {
    items.push({ pk: 'CATALOG#PATIENTS', sk: patient.id, userId: patient.id });
    if (patient.clinicId)
      items.push({ pk: `PATIENTS#CLINIC#${patient.clinicId}`, sk: patient.id, userId: patient.id });
  }
  for (const token of legacyTokens)
    if (token.patientId)
      items.push({
        pk: `PATIENTS#CLINIC#${token.clinicId}`,
        sk: token.patientId,
        userId: token.patientId,
      });
  // Deduplicate membership references; a batch cannot write the same item twice.
  const unique = [...new Map(items.map((item) => [`${item.pk}|${item.sk}`, item])).values()];
  async function writeBatch(batch: Record<string, any>[]) {
    let pending = batch.map((Item) => ({ PutRequest: { Item } }));
    for (let retry = 0; pending.length && retry < 8; retry++) {
      const response = await docClient.send(
        new BatchWriteCommand({ RequestItems: { [DYNAMODB_TABLE_NAME]: pending } }),
      );
      pending = (response.UnprocessedItems?.[DYNAMODB_TABLE_NAME] || []) as any;
      if (pending.length) await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** retry));
    }
    if (pending.length) throw new Error('Incomplete synthetic fixture batch.');
  }
  for (let offset = 0; offset < unique.length; offset += 200) {
    await Promise.all(
      Array.from({ length: 8 }, (_, n) => offset + n * 25)
        .filter((start) => start < unique.length)
        .map((start) => writeBatch(unique.slice(start, Math.min(start + 25, offset + 200)))),
    );
    if (offset % 10000 === 0)
      console.log(
        `[QureFlow]   ${offset.toLocaleString()} / ${unique.length.toLocaleString()} records`,
      );
  }
  const staff = (await repo.getUserById('admin-1'))!;
  for (let i = 3; i <= 6; i++)
    await repo.saveUser({
      ...staff,
      id: `admin-${i}`,
      name: `Demo ${facilityNames[i - 1]} Administrator`,
      email: `demo.staff${i}@example.invalid`,
      phone: `99000800${String(i).padStart(2, '0')}`,
      staffId: `DEMO-ADMIN-${i}`,
      clinicId: `clinic-${i}`,
      version: undefined,
    });
  await repo.saveUser({
    ...staff,
    id: 'demo-doctor',
    name: doctors[0].name,
    email: 'demo.doctor@example.invalid',
    phone: '9900080090',
    role: 'doctor',
    doctorId: doctors[0].id,
    staffId: 'DEMO-DOCTOR',
    version: undefined,
  });
  await repo.saveUser({
    ...staff,
    id: 'demo-reception',
    name: 'Demo Reception Coordinator',
    email: 'demo.reception@example.invalid',
    phone: '9900080091',
    role: 'health_worker',
    staffId: 'DEMO-RECEPTION',
    version: undefined,
  });
  await docClient.send(
    new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: { pk: 'READ_MODELS', sk: 'V1', enabledAt: createdAt, synthetic: true },
    }),
  );
  await docClient.send(
    new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: {
        ...MARKER,
        createdAt,
        synthetic: true,
        clinicCount: clinics.length,
        doctorCount: doctors.length,
        patientCount: patients.length + legacyPatients.length,
        generatedVisits: visits.length,
        generatedAppointments: appointments.length,
        historyDays: HISTORY_DAYS,
        metadataSchemaVersion: 4,
      },
    }),
  );
  console.log(
    `[QureFlow] Ready: ${doctors.length} doctors, ${clinics.length} clinics, ${patients.length} additional patients, ${visits.length} additional visits, ${unique.length} indexed records.`,
  );
}
