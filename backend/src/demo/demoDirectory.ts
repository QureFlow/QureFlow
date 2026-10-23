import { CLINICS, DOCTORS } from '../seed.js';
import { timeLabel } from '../lib/time.js';
import type { Clinic, Doctor, User } from '../models/types.js';

// Fictional names and facilities for the synthetic directory; no real clinic or person.
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
export const facilityNames = [
  'Evergreen Family Clinic',
  'Riverstone Medical Centre',
  'Cedar Multispecialty Clinic',
  'Willow Community Care',
  'Horizon Health Centre',
  'Maple Outpatient Centre',
];
const districts = ['Birbhum', 'Bardhaman', 'Hooghly', 'Howrah', 'Nadia', 'Kolkata'];
const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const PATIENTS_PER_CLINIC = 120;

/** Six fictional clinics, 48 doctors across 12 specialties, and 720 patient profiles. */
export function buildDemoDirectory() {
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
          schemaVersion: 4,
        },
      }) as Clinic,
  );
  const doctors: Doctor[] = DOCTORS.map((d, i) => ({
    ...d,
    specialization: specialties[i % 12][0],
    qualifications: specialties[i % 12][1],
  }));
  for (const clinic of clinics)
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
        profileVersion: 4,
        onboardingDate: '2026-01-15',
        appointmentModes: ['In-person'],
        followUpWindowDays: 14,
        accessibleConsultation: true,
        credentialStatus: 'Demonstration profile',
      },
    });
  }
  const createdAt = new Date().toISOString();
  const patients: User[] = Array.from({ length: clinics.length * PATIENTS_PER_CLINIC }, (_, i) => {
    const clinic = clinics[Math.floor(i / PATIENTS_PER_CLINIC)];
    return {
      id: `demo-rich-patient-${i + 1}`,
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
        recordVersion: 4,
        homeDistrict: clinic.district,
        dataQuality: 'Synthetic; no real patient data',
        accountStatus: 'unclaimed',
      },
    } as User;
  });
  return { clinics, doctors, patients };
}
