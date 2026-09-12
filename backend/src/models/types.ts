export type UserRole = 'patient' | 'doctor' | 'health_worker' | 'admin';
export type TokenStatus = 'waiting' | 'current' | 'completed' | 'skipped' | 'cancelled';
export type QueuePriority = 'normal' | 'emergency';
export type AppointmentStatus =
  | 'booked'
  | 'waiting'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  staffId?: string;
  clinicId?: string;
  passwordHash?: string;
  createdAt?: string;
}

export interface Clinic {
  id: string;
  name: string;
  address: string;
  district: string;
  state: string;
  phone: string;
  email: string;
  openingHours: string;
  activeDoctorsCount: number;
  emergencyContact: string;
}

export interface Doctor {
  id: string;
  name: string;
  avatar?: string;
  specialization: string;
  experienceYears: number;
  qualifications: string;
  clinicId: string;
  clinicName: string;
  consultationDays: string[];
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  consultationFee: number;
  isAvailableToday: boolean;
  nextAvailableSlot: string;
  status: 'active' | 'inactive';
}

export interface QueueToken {
  id: string;
  tokenNumber: string;
  appointmentId?: string;
  patientId?: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  clinicName: string;
  scheduledTime: string;
  priority: QueuePriority;
  isWalkIn: boolean;
  status: TokenStatus;
  createdAt: string;
  calledAt?: string;
  servedAt?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization: string;
  clinicId: string;
  clinicName: string;
  date: string;
  time: string;
  tokenNumber: string;
  status: AppointmentStatus;
  priority: QueuePriority;
  isWalkIn: boolean;
  notes?: string;
  createdAt: string;
}

export interface DoctorQueueState {
  doctorId: string;
  doctorName: string;
  specialization: string;
  clinicId: string;
  currentTokenNumber: string | null;
  isPaused: boolean;
  tokens: QueueToken[];
}

export interface QueueSettings {
  averageConsultationMinutes: number;
  allowWalkIns: boolean;
  allowEmergencyPriority: boolean;
  notifyOnTwoAhead: boolean;
  autoTokenPrefixByDoctor: boolean;
  clinicName: string;
  contactNumber: string;
}

export interface PatientQueueStatus {
  token: QueueToken;
  currentServingToken: string | null;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  isPaused: boolean;
}
