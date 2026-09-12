import bcrypt from 'bcryptjs';
import { dynamoDbRepo } from './repositories/dynamoDbRepo.js';
import { Clinic, Doctor, User, QueueSettings } from './models/types.js';

export const CLINICS: Clinic[] = [
  {
    id: 'clinic-1',
    name: 'Bolpur Community Health Centre',
    address: 'Sriniketan Main Road, Bolpur Sub-Division',
    district: 'Birbhum',
    state: 'West Bengal',
    phone: '+91 3463 252 211',
    email: 'helpdesk@bolpurhealth.org',
    openingHours: 'Mon - Sat: 08:30 AM - 05:00 PM',
    activeDoctorsCount: 4,
    emergencyContact: '102 / +91 3463 252 999',
  },
  {
    id: 'clinic-2',
    name: 'Bishnupur Sub-Divisional Hospital',
    address: 'Hospital More, Ward 6, Bishnupur',
    district: 'Bankura',
    state: 'West Bengal',
    phone: '+91 3244 251 108',
    email: 'info@bishnupurhospital.gov.in',
    openingHours: 'Mon - Sun: 24/7 (OPD 09:00 AM - 04:00 PM)',
    activeDoctorsCount: 5,
    emergencyContact: '108 / +91 3244 251 911',
  },
  {
    id: 'clinic-3',
    name: 'Durgapur Rural Health Centre',
    address: 'Gopalpur Rural Link, Durgapur Block',
    district: 'Paschim Bardhaman',
    state: 'West Bengal',
    phone: '+91 343 258 4432',
    email: 'contact@durgapur-rhc.org',
    openingHours: 'Mon - Sat: 08:30 AM - 03:30 PM',
    activeDoctorsCount: 3,
    emergencyContact: '102 / +91 343 258 4499',
  },
];

export const DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Ananya Sharma',
    specialization: 'General Medicine',
    experienceYears: 12,
    qualifications: 'MBBS, MD (Internal Medicine)',
    clinicId: 'clinic-1',
    clinicName: 'Bolpur Community Health Centre',
    consultationDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    startTime: '09:00 AM',
    endTime: '01:30 PM',
    slotDurationMinutes: 10,
    consultationFee: 100,
    isAvailableToday: true,
    nextAvailableSlot: '10:30 AM',
    status: 'active',
  },
  {
    id: 'doc-2',
    name: 'Dr. Rahul Sen',
    specialization: 'Pediatrics & Child Care',
    experienceYears: 9,
    qualifications: 'MBBS, DCH, MD (Pediatrics)',
    clinicId: 'clinic-1',
    clinicName: 'Bolpur Community Health Centre',
    consultationDays: ['Monday', 'Wednesday', 'Friday'],
    startTime: '09:30 AM',
    endTime: '02:00 PM',
    slotDurationMinutes: 10,
    consultationFee: 120,
    isAvailableToday: true,
    nextAvailableSlot: '11:00 AM',
    status: 'active',
  },
  {
    id: 'doc-3',
    name: 'Dr. Sunita Banerjee',
    specialization: 'Obstetrics & Gynecology',
    experienceYears: 15,
    qualifications: 'MBBS, MS (OBG), DGO',
    clinicId: 'clinic-1',
    clinicName: 'Bolpur Community Health Centre',
    consultationDays: ['Tuesday', 'Thursday', 'Saturday'],
    startTime: '09:00 AM',
    endTime: '01:00 PM',
    slotDurationMinutes: 12,
    consultationFee: 150,
    isAvailableToday: true,
    nextAvailableSlot: '11:30 AM',
    status: 'active',
  },
  {
    id: 'doc-4',
    name: 'Dr. Debabrata Roy',
    specialization: 'Orthopedics',
    experienceYears: 14,
    qualifications: 'MBBS, MS (Orthopedics)',
    clinicId: 'clinic-1',
    clinicName: 'Bolpur Community Health Centre',
    consultationDays: ['Monday', 'Thursday'],
    startTime: '10:00 AM',
    endTime: '02:30 PM',
    slotDurationMinutes: 15,
    consultationFee: 150,
    isAvailableToday: true,
    nextAvailableSlot: '12:00 PM',
    status: 'active',
  },
  {
    id: 'doc-5',
    name: 'Dr. Priya Mukhopadhyay',
    specialization: 'Ophthalmology (Eye)',
    experienceYears: 8,
    qualifications: 'MBBS, DO, MS (Ophthalmology)',
    clinicId: 'clinic-2',
    clinicName: 'Bishnupur Sub-Divisional Hospital',
    consultationDays: ['Monday', 'Tuesday', 'Wednesday', 'Friday'],
    startTime: '09:00 AM',
    endTime: '01:00 PM',
    slotDurationMinutes: 10,
    consultationFee: 100,
    isAvailableToday: true,
    nextAvailableSlot: '10:15 AM',
    status: 'active',
  },
  {
    id: 'doc-6',
    name: 'Dr. Sourav Ganguly',
    specialization: 'General Surgery & OPD',
    experienceYears: 18,
    qualifications: 'MBBS, MS (General Surgery)',
    clinicId: 'clinic-2',
    clinicName: 'Bishnupur Sub-Divisional Hospital',
    consultationDays: ['Tuesday', 'Thursday', 'Saturday'],
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    slotDurationMinutes: 15,
    consultationFee: 180,
    isAvailableToday: true,
    nextAvailableSlot: '11:45 AM',
    status: 'active',
  },
  {
    id: 'doc-7',
    name: 'Dr. Mousumi Chatterjee',
    specialization: 'Dermatology & Skin Care',
    experienceYears: 11,
    qualifications: 'MBBS, MD (Dermatology)',
    clinicId: 'clinic-2',
    clinicName: 'Bishnupur Sub-Divisional Hospital',
    consultationDays: ['Monday', 'Wednesday'],
    startTime: '09:30 AM',
    endTime: '01:30 PM',
    slotDurationMinutes: 10,
    consultationFee: 120,
    isAvailableToday: true,
    nextAvailableSlot: '10:45 AM',
    status: 'active',
  },
  {
    id: 'doc-8',
    name: 'Dr. Pradeep Haldar',
    specialization: 'General Medicine',
    experienceYears: 16,
    qualifications: 'MBBS, MD',
    clinicId: 'clinic-3',
    clinicName: 'Durgapur Rural Health Centre',
    consultationDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '08:30 AM',
    endTime: '01:00 PM',
    slotDurationMinutes: 10,
    consultationFee: 80,
    isAvailableToday: true,
    nextAvailableSlot: '09:45 AM',
    status: 'active',
  },
  {
    id: 'doc-9',
    name: 'Dr. Tanusree Adhikari',
    specialization: 'Pediatrics',
    experienceYears: 7,
    qualifications: 'MBBS, DCH',
    clinicId: 'clinic-3',
    clinicName: 'Durgapur Rural Health Centre',
    consultationDays: ['Monday', 'Wednesday', 'Friday'],
    startTime: '09:00 AM',
    endTime: '01:30 PM',
    slotDurationMinutes: 10,
    consultationFee: 90,
    isAvailableToday: true,
    nextAvailableSlot: '10:50 AM',
    status: 'active',
  },
  {
    id: 'doc-10',
    name: 'Dr. Amitav Bhattacharya',
    specialization: 'Cardiology (Visiting)',
    experienceYears: 20,
    qualifications: 'MBBS, MD, DM (Cardiology)',
    clinicId: 'clinic-1',
    clinicName: 'Bolpur Community Health Centre',
    consultationDays: ['Saturday'],
    startTime: '10:00 AM',
    endTime: '02:00 PM',
    slotDurationMinutes: 15,
    consultationFee: 200,
    isAvailableToday: false,
    nextAvailableSlot: 'Saturday 10:00 AM',
    status: 'active',
  },
];

export const SETTINGS: QueueSettings = {
  averageConsultationMinutes: 7,
  allowWalkIns: true,
  allowEmergencyPriority: true,
  notifyOnTwoAhead: true,
  autoTokenPrefixByDoctor: true,
  clinicName: 'Bolpur Community Health Centre',
  contactNumber: '+91 3463 252 211',
};

async function seed() {
  console.log('[QureFlow Seeder] Starting database seed to DynamoDB table QureFlow (eu-north-1)...');

  // 1. Clinics
  for (const c of CLINICS) {
    await dynamoDbRepo.saveClinic(c);
    console.log(`  + Saved Clinic: ${c.name} (${c.id})`);
  }

  // 2. Settings
  await dynamoDbRepo.saveSettings(SETTINGS);
  console.log('  + Saved Queue Settings');

  // 3. Doctors
  for (const d of DOCTORS) {
    await dynamoDbRepo.saveDoctor(d);
    console.log(`  + Saved Doctor: ${d.name} (${d.id})`);
  }

  // 4. Default Admin & Staff
  const defaultPasswordHash = await bcrypt.hash('AdminPass123!', 10);
  const adminUser: User = {
    id: 'admin-1',
    name: 'Bishakha Roy',
    phone: '9832109876',
    email: 'admin@bolpurhealth.org',
    role: 'admin',
    staffId: 'REC-204',
    clinicId: 'clinic-1',
    passwordHash: defaultPasswordHash,
    createdAt: new Date().toISOString(),
  };
  await dynamoDbRepo.saveUser(adminUser);
  console.log('  + Saved Admin User: Bishakha Roy (admin@bolpurhealth.org / REC-204)');

  // 5. Default Patient
  const patientPasswordHash = await bcrypt.hash('PatientPass123!', 10);
  const defaultPatient: User = {
    id: 'patient-1',
    name: 'Suman Roy',
    phone: '9876543210',
    email: 'suman.roy@example.com',
    role: 'patient',
    dob: '1988-04-14',
    gender: 'Male',
    passwordHash: patientPasswordHash,
    createdAt: new Date().toISOString(),
  };
  await dynamoDbRepo.saveUser(defaultPatient);
  console.log('  + Saved Default Patient: Suman Roy (9876543210 / suman.roy@example.com)');

  console.log('[QureFlow Seeder] Successfully seeded all data into DynamoDB!');
}

seed().catch((err) => {
  console.error('[QureFlow Seeder Error]:', err);
  process.exit(1);
});
