export type UserRole = 'patient' | 'admin';

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

export type AppointmentStatus =
  | 'booked'
  | 'waiting'
  | 'in_consultation'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type TokenStatus = 'waiting' | 'current' | 'completed' | 'skipped' | 'cancelled';
export type QueuePriority = 'normal' | 'emergency';

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
  date: string; // YYYY-MM-DD
  time: string; // e.g. "10:30 AM"
  tokenNumber: string; // e.g. "A-042"
  status: AppointmentStatus;
  priority: QueuePriority;
  isWalkIn: boolean;
  notes?: string;
  createdAt: string;
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
  bufferMinutes?: number;
  allowWalkIns: boolean;
  allowEmergencyPriority: boolean;
  notifyOnTwoAhead: boolean;
  autoTokenPrefixByDoctor: boolean;
  clinicName: string;
  contactNumber: string;
}

export interface SlotAvailability {
  time: string;
  available: boolean;
  isFull: boolean;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  slotDurationMinutes: number;
  statusText: string;
}
