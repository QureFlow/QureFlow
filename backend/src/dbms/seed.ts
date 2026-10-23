import bcrypt from 'bcryptjs';
import { CLINICS, DOCTORS } from '../seed.js';
import { mysqlRepo as repo } from '../repositories/mysqlRepo.js';
import { pool, rows, transaction } from './connection.js';
import { clinicDate, clockMinutes, timeLabel } from '../lib/time.js';
import { doctorPrefix } from '../services/queueService.js';
import type { Clinic, Doctor, User, QueueToken, Appointment } from '../models/types.js';
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

export async function seedMysqlDemo() {
  const database = process.env.MYSQL_DATABASE || 'qureflow_dbms';
  if (
    !['127.0.0.1', 'localhost'].includes(process.env.MYSQL_HOST || '127.0.0.1') ||
    !/^qureflow_(dbms|test)/.test(database)
  )
    throw new Error('Fixtures require a named local DBMS or test database.');
  if ((await rows("SELECT version FROM demo_seed WHERE version='mysql-v1'")).length) return;
  // A retry can resume an interrupted seed; fixtures use stable IDs and skip complete visits.
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
        openingHours: '08:00 AM – 10:00 PM',
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
      endTime: '10:00 PM',
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

  for (const doctor of doctors) await repo.saveDoctor(doctor);

  const passwordHash = await bcrypt.hash('DemoClinic123!', 12);
  for (let i = 1; i <= 6; i++) {
    const id = 'admin-' + i;
    if (!(await repo.getUserById(id)))
      await repo.saveUser({
        id,
        name: 'Demo ' + facilityNames[i - 1] + ' Administrator',
        role: 'admin',
        clinicId: 'clinic-' + i,
        email: i === 1 ? 'demo.staff@example.invalid' : 'demo.staff' + i + '@example.invalid',
        phone: '99000800' + String(i).padStart(2, '0'),
        staffId: 'DEMO-ADMIN-' + i,
        passwordHash,
        metadata: { synthetic: true },
        createdAt: new Date().toISOString(),
      });
  }
  const patientHash = await bcrypt.hash('DemoPatient123!', 12);
  if (!(await repo.getUserById('patient-1')))
    await repo.saveUser({
      id: 'patient-1',
      name: 'Demo Patient',
      phone: '9900000002',
      email: 'demo.patient@example.invalid',
      role: 'patient',
      clinicId: 'clinic-1',
      passwordHash: patientHash,
      metadata: { synthetic: true },
      createdAt: new Date().toISOString(),
    });
  for (const [id, role, email, phone] of [
    ['demo-doctor', 'doctor', 'demo.doctor@example.invalid', '9900080090'],
    ['demo-reception', 'health_worker', 'demo.reception@example.invalid', '9900080091'],
  ] as const)
    if (!(await repo.getUserById(id)))
      await repo.saveUser({
        id,
        role,
        email,
        phone,
        name: role === 'doctor' ? doctors[0].name : 'Demo Reception Coordinator',
        clinicId: 'clinic-1',
        ...(role === 'doctor' ? { doctorId: doctors[0].id } : {}),
        passwordHash,
        metadata: { synthetic: true },
        createdAt: new Date().toISOString(),
      });
  const patients: User[] = [];
  for (let i = 0; i < 736; i++) {
    const clinic = clinics[Math.min(5, Math.floor(i / 120))],
      id = 'mysql-patient-' + (i + 1);
    let patient = await repo.getUserById(id);
    if (!patient)
      patient = await repo.saveUser({
        id,
        name: firstNames[i % 24] + ' ' + lastNames[Math.floor(i / 24) % 15],
        phone: '9901' + String(i + 1).padStart(6, '0'),
        email: 'demo.person.' + (i + 1) + '@example.invalid',
        role: 'patient',
        clinicId: clinic.id,
        dob:
          1960 +
          (i % 48) +
          '-' +
          String(1 + (i % 12)).padStart(2, '0') +
          '-' +
          String(1 + (i % 27)).padStart(2, '0'),
        gender: i % 2 ? 'Female' : 'Male',
        metadata: {
          synthetic: true,
          mrn: 'DEMO-' + String(i + 1).padStart(6, '0'),
          preferredLanguage: ['Bengali', 'English', 'Hindi'][i % 3],
          registrationSource: 'synthetic_fixture',
          notificationConsent: false,
        },
        createdAt: new Date().toISOString(),
      });
    patients.push(patient);
  }
  patients[3] = (await repo.getUserById('patient-1'))!;
  let generated = 0;
  for (const [doctorIndex, doctor] of doctors.entries()) {
    const clinicIndex = clinics.findIndex((c) => c.id === doctor.clinicId),
      localIndex = doctors
        .filter((d) => d.clinicId === doctor.clinicId)
        .findIndex((d) => d.id === doctor.id);
    for (let day = -24; day <= 3; day++) {
      const date = clinicDate(new Date(Date.now() + day * 86400000)),
        count = day < 0 ? 3 + ((doctorIndex - day) % 5) : day === 0 ? 6 : 1;
      const queueId = repo.getQueueId(doctor.id, date);
      await transaction(async (c) => {
        let maximum = 0;
        for (let i = 0; i < count; i++) {
          const id = 'mysql-fixture-' + doctor.id + '-' + date + '-' + i;
          const [found]: any = await c.execute('SELECT id FROM queue_tokens WHERE id=?', [id]);
          maximum = Math.max(maximum, i + 1);
          if (found.length) continue;
          const patient =
            patients[
              clinicIndex * 120 +
                (day === 0
                  ? localIndex * 6 + i
                  : day > 0
                    ? 60 + localIndex
                    : (doctorIndex * 13 + i * 7 - day) % 120)
            ];
          const status =
            day > 0
              ? 'waiting'
              : day === 0
                ? i < 2
                  ? 'completed'
                  : i === 2
                    ? 'current'
                    : 'waiting'
                : (doctorIndex + i - day) % 23 === 0
                  ? 'cancelled'
                  : (doctorIndex + i - day) % 19 === 0
                    ? 'skipped'
                    : 'completed';
          const minute = clockMinutes(doctor.startTime) + (i % 4) * 30;
          const called =
            day === 0
              ? new Date(Date.now() - (i < 2 ? 50 + i * 20 : 3) * 60000)
              : new Date(
                  date +
                    'T' +
                    String(Math.floor(minute / 60)).padStart(2, '0') +
                    ':' +
                    String(minute % 60).padStart(2, '0') +
                    ':00+05:30',
                );
          const duration =
            6 + (doctorIndex % 6) * 1.5 + (i % 3 ? 2 : 0) + ((doctorIndex + i - day) % 7) * 0.35;
          const createdAt =
            day > 0
              ? new Date().toISOString()
              : new Date(called.getTime() - 10 * 60000).toISOString();
          const tokenNumber = doctorPrefix(doctor.id) + '-' + String(i + 1).padStart(3, '0'),
            appointmentId = 'apt-' + id;
          const a: Appointment = {
            id: appointmentId,
            patientId: patient.id,
            patientName: patient.name,
            patientPhone: patient.phone,
            doctorId: doctor.id,
            doctorName: doctor.name,
            doctorSpecialization: doctor.specialization,
            clinicId: doctor.clinicId,
            clinicName: doctor.clinicName,
            date,
            time: timeLabel(minute),
            tokenNumber,
            status:
              status === 'current'
                ? 'in_consultation'
                : status === 'skipped'
                  ? 'no_show'
                  : day > 0
                    ? 'booked'
                    : status,
            priority: 'normal',
            isWalkIn: day === 0,
            createdAt,
            metadata: { synthetic: true, source: 'synthetic_fixture' },
          };
          const t: QueueToken = {
            id,
            appointmentId,
            patientId: patient.id,
            patientName: patient.name,
            patientPhone: patient.phone,
            doctorId: doctor.id,
            doctorName: doctor.name,
            clinicId: doctor.clinicId,
            clinicName: doctor.clinicName,
            queueDate: date,
            queueId,
            tokenSeq: i + 1,
            tokenNumber,
            scheduledTime: day === 0 ? 'Walk-in' : a.time,
            priority: 'normal',
            isWalkIn: day === 0,
            status,
            createdAt,
            ...(['current', 'completed'].includes(status)
              ? { calledAt: called.toISOString() }
              : {}),
            ...(status === 'completed'
              ? { servedAt: new Date(called.getTime() + duration * 60000).toISOString() }
              : {}),
            metadata: { synthetic: true, source: 'synthetic_fixture', schemaVersion: 1 },
          };
          await repo.insertAppointment(c, a);
          await repo.insertToken(c, t);
          generated++;
        }
        await c.execute(
          'INSERT INTO queue_counters(doctorId,queueDate,currentNumber) VALUES (?,?,?) ON DUPLICATE KEY UPDATE currentNumber=GREATEST(currentNumber,VALUES(currentNumber))',
          [doctor.id, date, maximum],
        );
      });
    }
  }
  // Populate capacity counters from persisted appointments, rather than keeping a second source of truth.
  await pool.query(
    "INSERT IGNORE INTO appointment_slots(doctorId,slotDate,slotMinute,bookedCount,capacity) SELECT a.doctorId,a.date,a.slotMinute,COUNT(*),GREATEST(COUNT(*),FLOOR(30/(d.slotDurationMinutes+2)),1) FROM appointments a JOIN doctors d ON d.id=a.doctorId WHERE a.status NOT IN ('cancelled','no_show') GROUP BY a.doctorId,a.date,a.slotMinute,d.slotDurationMinutes",
  );
  await pool.execute("INSERT INTO demo_seed(version) VALUES ('mysql-v1')");
  console.log(
    '[QureFlow MySQL] Seeded 6 clinics, 48 doctors, 737 patients and ' +
      generated +
      ' linked visits.',
  );
}
