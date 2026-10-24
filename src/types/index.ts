export type UserRole = 'patient' | 'admin' | 'health_worker' | 'doctor';

export interface User {
  demoAllClinics?: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  id: string;
  name: string;
  phone: string;
  email: string;
  role: UserRole;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  staffId?: string;
  clinicId?: string;
  doctorId?: string;
}

export interface Clinic {
  metadata?: Record<string, unknown>;
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
  bio?: string;
  languages?: string[];
  clinicalInterests?: string[];
  roomNumber?: string;
  department?: string;
  registrationId?: string;
  metadata?: Record<string, unknown>;
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
  'booked' | 'waiting' | 'in_consultation' | 'completed' | 'cancelled' | 'no_show';

export type TokenStatus = 'waiting' | 'current' | 'completed' | 'skipped' | 'cancelled';
export type QueuePriority = 'normal' | 'emergency';

export interface Appointment {
  tokenId?: string;
  metadata?: Record<string, unknown>;
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
  queueDate?: string;
  metadata?: Record<string, unknown>;
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
export interface PatientQueueStatus {
  token: QueueToken;
  currentServingToken: string | null;
  patientsAhead: number;
  estimatedWaitMinutes: number;
  /** 80% range for the wait, in minutes. */
  estimatedWaitRange?: { low: number; high: number };
  isPaused: boolean;
  prediction?: {
    method: string;
    sampleCount: number;
    syntheticSamples: number;
    validationMaeMinutes: number | null;
    noShowRate?: number;
    learnedCorrection?: boolean;
    modelVersion: string;
    isEstimate: boolean;
  };
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
