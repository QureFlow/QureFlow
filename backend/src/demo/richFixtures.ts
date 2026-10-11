import { BatchWriteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, DYNAMODB_TABLE_NAME } from '../config/aws.js';
import { dynamoDbRepo as repo } from '../repositories/dynamoDbRepo.js';
import { CLINICS, DOCTORS } from '../seed.js';
import { clinicDate, clockMinutes, timeLabel } from '../lib/time.js';
import { doctorPrefix } from '../services/queueService.js';
import { readModelItems } from '../lib/readModels.js';
import { Clinic, Doctor, QueueToken, Appointment, User } from '../models/types.js';

const firstNames = [
  'Aarav',
  'Anika',
  'Rohan',
  'Ishita',
  'Kabir',
  'Meera',
  'Arjun',
  'Nandini',
  'Dev',
  'Tara',
  'Vihaan',
  'Sana',
  'Aditya',
  'Priya',
  'Ishan',
  'Kavya',
  'Rahul',
  'Aditi',
  'Kunal',
  'Sneha',
  'Vikram',
  'Riya',
  'Nikhil',
  'Pooja',
];
const lastNames = [
  'Sen',
  'Sharma',
  'Das',
  'Mukherjee',
  'Roy',
  'Banerjee',
  'Kapoor',
  'Patel',
  'Bose',
  'Mehta',
  'Chatterjee',
  'Rao',
  'Gupta',
  'Nair',
  'Ghosh',
];
const specialties = [
  ['General Medicine', 'MBBS, MD', 'Preventive care', 'Chronic condition follow-up'],
  ['Pediatrics', 'MBBS, MD (Pediatrics)', 'Child wellness', 'Routine pediatric follow-up'],
  ['Cardiology', 'MBBS, MD, DM', 'Heart health follow-up', 'Preventive cardiology'],
  ['Dermatology', 'MBBS, MD (Dermatology)', 'Skin health', 'Routine dermatology consultations'],
  ['Orthopedics', 'MBBS, MS (Orthopedics)', 'Joint mobility', 'Musculoskeletal follow-up'],
  ['Gynecology', 'MBBS, MS (OBG)', 'Women’s health', 'Routine outpatient consultations'],
  ['Ophthalmology', 'MBBS, MS (Ophthalmology)', 'Vision checks', 'Eye health follow-up'],
  ['ENT', 'MBBS, MS (ENT)', 'Ear and hearing care', 'ENT follow-up'],
  ['Neurology', 'MBBS, MD, DM (Neurology)', 'Neurology follow-up', 'Outpatient assessment'],
  ['Dentistry', 'BDS, MDS', 'Dental checks', 'Preventive dental care'],
  ['Endocrinology', 'MBBS, MD, DM', 'Metabolic health', 'Endocrine follow-up'],
  ['Pulmonology', 'MBBS, MD', 'Respiratory follow-up', 'Outpatient respiratory care'],
] as const;
const facilityNames = [
  'Evergreen Family Clinic',
  'Riverstone Medical Centre',
  'Cedar Multispecialty Clinic',
  'Willow Community Care',
  'Horizon Health Centre',
  'Maple Outpatient Centre',
];
const districts = ['Birbhum', 'Bardhaman', 'Hooghly', 'Howrah', 'Nadia', 'Kolkata'];
const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export async function expandLocalDemo() {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (
    !endpoint ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname) ||
    !/^QureFlowDemo/.test(DYNAMODB_TABLE_NAME)
  )
    throw new Error('Rich fixtures are restricted to the local demo table.');
  const marker = { pk: 'DEMO#SEED', sk: 'V3' };
  if ((await docClient.send(new GetCommand({ TableName: DYNAMODB_TABLE_NAME, Key: marker }))).Item)
    return;
  console.log('[QureFlow] Expanding synthetic directory and visit history…');
  const legacyAppointments = await repo.getAppointments();
  const legacyTokens = (
    await Promise.all(CLINICS.map((c) => repo.getRecentTokens(c.id, 90)))
  ).flat();
  const clinics: Clinic[] = facilityNames.map(
    (name, i) =>
      ({
        ...CLINICS[i % 3],
        id: `clinic-${i + 1}`,
        name,
        address: `${12 + i * 7} Wellness Avenue, ${districts[i]}`,
        district: districts[i],
        state: 'West Bengal',
        phone: `99000700${String(i + 1).padStart(2, '0')}`,
        email: `reception${i + 1}@example.invalid`,
        openingHours: '08:00 AM – 06:00 PM',
        activeDoctorsCount: 8,
        metadata: {
          synthetic: true,
          facilityCode: `DEMO-F${i + 1}`,
          timeZone: 'Asia/Kolkata',
          services: ['Outpatient consultations', 'Reception check-in', 'Scheduled follow-ups'],
          amenities: [
            'Step-free entrance',
            'Accessible waiting area',
            'Drinking water',
            'On-site reception',
          ],
          paymentMethods: ['Cash', 'UPI'],
          source: 'synthetic_fixture',
          schemaVersion: 3,
        },
      }) as Clinic,
  );
  const doctors: Doctor[] = DOCTORS.map((d, i) => ({
    ...d,
    specialization: specialties[i % 12][0],
    qualifications: specialties[i % 12][1],
  }));
  for (const clinic of clinics) {
    while (doctors.filter((d) => d.clinicId === clinic.id).length < 8) {
      const index = doctors.length,
        spec = specialties[index % 12];
      doctors.push({
        ...DOCTORS[0],
        id: `doc-${index + 1}`,
        name: `Dr. ${firstNames[index % 24]} ${lastNames[Math.floor(index / 4) % 15]}`,
        specialization: spec[0],
        qualifications: spec[1],
        clinicId: clinic.id,
      });
    }
  }
  for (const [i, doctor] of doctors.entries()) {
    const clinic = clinics.find((c) => c.id === doctor.clinicId)!;
    Object.assign(doctor, {
      clinicName: clinic.name,
      experienceYears: 5 + (i % 22),
      consultationFee: 250 + (i % 7) * 100,
      startTime: timeLabel(480 + (i % 3) * 30),
      endTime: timeLabel(1020 + (i % 2) * 30),
      slotDurationMinutes: [8, 10, 12, 15, 20, 25][i % 6],
      consultationDays: allDays,
      status: 'active',
      bio: `${doctor.name} offers ${doctor.specialization.toLowerCase()} consultations and structured follow-up care at ${clinic.name}. This profile belongs to the synthetic demonstration directory.`,
      languages: i % 3 === 0 ? ['English', 'Hindi', 'Bengali'] : ['English', 'Bengali'],
      clinicalInterests: [...specialties[i % 12].slice(2)],
      roomNumber: `${1 + Math.floor(i / 8)}${String((i % 8) + 1).padStart(2, '0')}`,
      department: doctor.specialization,
      registrationId: `DEMO-MED-${String(i + 1).padStart(4, '0')}`,
      metadata: {
        synthetic: true,
        profileSource: 'synthetic_fixture',
        profileVersion: 3,
        onboardingDate: '2026-01-15',
        appointmentModes: ['In-person'],
        followUpWindowDays: 14,
        accessibleConsultation: true,
        credentialStatus: 'Demonstration profile',
      },
    });
    await repo.saveDoctor(doctor);
  }
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
  const patients: User[] = [],
    items: Record<string, any>[] = [],
    visits: QueueToken[] = [],
    appointments: Appointment[] = [];
  const createdAt = new Date().toISOString();
  for (let i = 0; i < 720; i++) {
    const clinic = clinics[Math.floor(i / 120)],
      id = `demo-rich-patient-${i + 1}`;
    const patient: User = {
      id,
      name: `${firstNames[i % 24]} ${lastNames[Math.floor(i / 24) % 15]}`,
      phone: `9901${String(i + 1).padStart(6, '0')}`,
      email: `demo.person.${i + 1}@example.invalid`,
      role: 'patient',
      clinicId: clinic.id,
      dob: `${1960 + (i % 48)}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`,
      gender: i % 2 ? 'Female' : 'Male',
      createdAt,
      updatedAt: createdAt,
      version: 1,
      metadata: {
        synthetic: true,
        mrn: `DEMO-${String(i + 1).padStart(6, '0')}`,
        preferredLanguage: ['Bengali', 'English', 'Hindi'][i % 3],
        registrationSource: i % 3 ? 'reception' : 'self_service',
        preferredContactChannel: 'phone',
        notificationConsent: false,
        recordVersion: 3,
        homeDistrict: clinic.district,
        dataQuality: 'Synthetic; no real patient data',
        accountStatus: 'unclaimed',
      },
    };
    patients.push(patient);
    items.push(
      { pk: `USER#${id}`, sk: 'METADATA', ...patient },
      { pk: `IDENTITY#PHONE#${patient.phone}`, sk: 'METADATA', userId: id },
      { pk: `IDENTITY#EMAIL#${patient.email}`, sk: 'METADATA', userId: id },
      { pk: 'CATALOG#PATIENTS', sk: id, userId: id },
      { pk: `PATIENTS#CLINIC#${clinic.id}`, sk: id, userId: id },
    );
  }
  const states = new Map<string, { next: number; current?: string }>();
  async function allocate(doctor: Doctor, date: string) {
    const queueId = repo.getQueueId(doctor.id, date);
    if (!states.has(queueId)) {
      const tokens = await repo.getAllTokensForQueue(queueId);
      const counter = (
        await docClient.send(
          new GetCommand({
            TableName: DYNAMODB_TABLE_NAME,
            Key: { pk: `QUEUE#${queueId}`, sk: 'COUNTER' },
          }),
        )
      ).Item;
      states.set(queueId, {
        next: Math.max(
          counter?.currentNumber || 0,
          ...tokens.map((t) => t.tokenSeq || Number(t.tokenNumber.split('-').pop()) || 0),
        ),
        current: tokens.find((t) => t.status === 'current')?.id,
      });
    }
    const state = states.get(queueId)!;
    return { queueId, seq: ++state.next, state };
  }
  async function fixture(
    doctor: Doctor,
    patient: User,
    date: string,
    index: number,
    mode: 'history' | 'today' | 'future',
  ) {
    const { queueId, seq, state } = await allocate(doctor, date),
      id = `demo-v3-${mode}-${doctor.id}-${index}`,
      appointmentId = `apt-${id}`;
    const scheduledMinute = clockMinutes(doctor.startTime) + (index % 4) * 30,
      time = timeLabel(scheduledMinute);
    const historyStatus =
      index % 23 === 0 ? 'cancelled' : index % 19 === 0 ? 'skipped' : 'completed';
    const status =
      mode === 'history'
        ? historyStatus
        : mode === 'future'
          ? 'waiting'
          : index < 2
            ? 'completed'
            : index === 2 && !state.current
              ? 'current'
              : 'waiting';
    const isWalkIn = mode === 'today' || (mode === 'history' && index % 3 !== 0),
      priority = index % 17 === 0 ? 'emergency' : 'normal';
    const called =
      mode === 'today'
        ? new Date(Date.now() - (index < 2 ? 45 + index * 20 : 3) * 60000)
        : new Date(
            `${date}T${String(Math.floor(scheduledMinute / 60)).padStart(2, '0')}:${String(scheduledMinute % 60).padStart(2, '0')}:00+05:30`,
          );
    const consultationMinutes =
      6 +
      (doctors.indexOf(doctor) % 6) * 1.5 +
      (isWalkIn ? 2 : 0) +
      (priority === 'emergency' ? 3 : 0) +
      ((index % 7) - 3) * 0.35 +
      (index % 4) * 0.4;
    const actualArrival = new Date(called.getTime() - (5 + (index % 24)) * 60000).toISOString();
    const token: QueueToken = {
      id,
      appointmentId,
      tokenNumber: `${doctorPrefix(doctor.id)}-${String(seq).padStart(3, '0')}`,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      doctorId: doctor.id,
      doctorName: doctor.name,
      clinicId: doctor.clinicId,
      clinicName: doctor.clinicName,
      scheduledTime: isWalkIn ? 'Walk-in' : time,
      priority,
      isWalkIn,
      status,
      createdAt: mode === 'future' ? createdAt : actualArrival,
      ...(['current', 'completed'].includes(status) ? { calledAt: called.toISOString() } : {}),
      ...(status === 'completed'
        ? { servedAt: new Date(called.getTime() + consultationMinutes * 60000).toISOString() }
        : {}),
      queueDate: date,
      queueId,
      tokenSeq: seq,
      version: 1,
      updatedAt: createdAt,
      metadata: {
        synthetic: true,
        source: 'synthetic_fixture',
        schemaVersion: 3,
        createdBy: 'demo-fixture-generator',
        requestId: `fixture-${id}`,
        timeZone: 'Asia/Kolkata',
        arrivalChannel: isWalkIn ? 'reception' : 'online_booking',
        encounterType: index % 3 ? 'follow_up' : 'first_visit',
        language: patient.metadata?.preferredLanguage,
        department: doctor.specialization,
        roomNumber: doctor.roomNumber,
        checkInAt: mode === 'future' ? undefined : actualArrival,
        ...(status === 'completed'
          ? {
              consultationMinutes: Number(consultationMinutes.toFixed(2)),
              waitMinutes: 5 + (index % 24),
            }
          : {}),
        dataProvenance: 'Generated locally for demonstration',
      },
    };
    const appointment: Appointment = {
      id: appointmentId,
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
      status:
        mode === 'future'
          ? 'booked'
          : status === 'skipped'
            ? 'no_show'
            : status === 'current'
              ? 'in_consultation'
              : status,
      priority,
      isWalkIn,
      notes: 'Synthetic outpatient visit; no real clinical information.',
      createdAt: token.createdAt,
      updatedAt: createdAt,
      version: 1,
      metadata: {
        synthetic: true,
        source: 'synthetic_fixture',
        schemaVersion: 3,
        encounterType: token.metadata?.encounterType,
        bookingChannel: isWalkIn ? 'reception' : 'patient_portal',
        department: doctor.specialization,
        roomNumber: doctor.roomNumber,
        createdBy: 'demo-fixture-generator',
        requestId: `fixture-${id}`,
        timeZone: 'Asia/Kolkata',
      },
    };
    visits.push(token);
    appointments.push(appointment);
    const queuePk = `QUEUE#${queueId}`,
      queueSk = `TOKEN#${String(seq).padStart(8, '0')}`;
    items.push(
      { pk: queuePk, sk: queueSk, ...token },
      { pk: `TOKEN#${id}`, sk: 'METADATA', queuePk, queueSk },
      { pk: `APPOINTMENT#${appointmentId}`, sk: 'METADATA', ...appointment },
      ...readModelItems('token', token),
      ...readModelItems('appointment', appointment),
    );
    if (['waiting', 'current'].includes(status))
      items.push({ pk: `PATIENT_DAY#${date}#${patient.id}`, sk: 'ACTIVE', tokenId: id });
    if (status === 'current') {
      state.current = id;
      items.push({ pk: queuePk, sk: 'CURRENT', tokenId: id });
    }
    if (mode === 'future')
      items.push({
        pk: `SLOT#${date}#${doctor.id}#${time}`,
        sk: 'COUNTER',
        bookedCount: 1,
        capacity: Math.max(1, Math.floor(30 / (doctor.slotDurationMinutes + 2))),
      });
  }
  for (const doctor of doctors) {
    const clinicIndex = clinics.findIndex((c) => c.id === doctor.clinicId),
      localDoctorIndex = doctors
        .filter((d) => d.clinicId === doctor.clinicId)
        .findIndex((d) => d.id === doctor.id),
      offset = clinicIndex * 120;
    for (let i = 0; i < 96; i++)
      await fixture(
        doctor,
        patients[offset + ((i * 7 + localDoctorIndex * 13) % 120)],
        clinicDate(new Date(Date.now() - (1 + Math.floor(i / 4)) * 86400000)),
        i,
        'history',
      );
    for (let i = 0; i < 6; i++)
      await fixture(doctor, patients[offset + localDoctorIndex * 6 + i], clinicDate(), i, 'today');
    for (let i = 1; i <= 3; i++)
      await fixture(
        doctor,
        patients[offset + 60 + localDoctorIndex],
        clinicDate(new Date(Date.now() + i * 86400000)),
        i,
        'future',
      );
  }
  for (const [queueId, state] of states)
    items.push({ pk: `QUEUE#${queueId}`, sk: 'COUNTER', currentNumber: state.next });
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
  for (let offset = 0; offset < unique.length; offset += 100)
    await Promise.all(
      [0, 25, 50, 75]
        .filter((n) => offset + n < unique.length)
        .map((n) => writeBatch(unique.slice(offset + n, offset + n + 25))),
    );
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
        ...marker,
        createdAt,
        synthetic: true,
        clinicCount: clinics.length,
        doctorCount: doctors.length,
        patientCount: patients.length + legacyPatients.length,
        generatedVisits: visits.length,
        generatedAppointments: appointments.length,
        historyDays: 24,
        metadataSchemaVersion: 3,
      },
    }),
  );
  console.log(
    `[QureFlow] Ready: ${doctors.length} doctors, ${clinics.length} clinics, ${patients.length} additional patients, ${visits.length} additional visits, ${unique.length} indexed records.`,
  );
}
