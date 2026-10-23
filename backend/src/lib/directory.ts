import type { Appointment, Doctor } from '../models/types.js';
import { clinicDate, clockMinutes, weekday } from './time.js';

export interface DoctorFilters {
  query?: string;
  specialization?: string;
  clinicId?: string;
  language?: string;
  availableTodayOnly?: boolean;
  status?: string;
  sort?: 'name' | 'fee' | 'experience';
}
export interface AppointmentFilters {
  patientId?: string;
  doctorId?: string;
  date?: string;
  clinicId?: string;
  status?: string;
  query?: string;
}

export const withAvailability = (doctor: Doctor, date = clinicDate()): Doctor => ({
  ...doctor,
  isAvailableToday: doctor.status === 'active' && doctor.consultationDays.includes(weekday(date)),
});

const byName = (a: Doctor, b: Doctor) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
const orderings: Record<NonNullable<DoctorFilters['sort']>, (a: Doctor, b: Doctor) => number> = {
  name: byName,
  fee: (a, b) => a.consultationFee - b.consultationFee || byName(a, b),
  experience: (a, b) => b.experienceYears - a.experienceYears || byName(a, b),
};
const selected = (value?: string) => (value && value !== 'all' ? value : undefined);

/** Filters and orders the doctor catalog; the catalog is one DynamoDB partition read. */
export function filterDoctors(doctors: Doctor[], f: DoctorFilters): Doctor[] {
  const q = f.query?.trim().toLowerCase();
  return doctors
    .map((d) => withAvailability(d))
    .filter(
      (d) =>
        (!q ||
          [d.name, d.specialization, d.clinicName, d.bio || '', ...(d.clinicalInterests || [])]
            .join(' ')
            .toLowerCase()
            .includes(q)) &&
        (!selected(f.specialization) || d.specialization === f.specialization) &&
        (!selected(f.clinicId) || d.clinicId === f.clinicId) &&
        (!selected(f.status) || d.status === f.status) &&
        (!selected(f.language) || (d.languages || []).includes(f.language!)) &&
        (!f.availableTodayOnly || d.isAvailableToday),
    )
    .sort(orderings[f.sort || 'name'] || byName);
}

export function filterAppointments(list: Appointment[], f: AppointmentFilters): Appointment[] {
  const q = f.query?.trim().toLowerCase();
  const minute = (a: Appointment) => {
    try {
      return clockMinutes(a.time);
    } catch {
      return -1;
    }
  };
  return list
    .filter(
      (a) =>
        (!selected(f.patientId) || a.patientId === f.patientId) &&
        (!selected(f.doctorId) || a.doctorId === f.doctorId) &&
        (!selected(f.date) || a.date === f.date) &&
        (!selected(f.clinicId) || a.clinicId === f.clinicId) &&
        (!selected(f.status) || a.status === f.status) &&
        (!q ||
          [a.patientName, a.patientPhone, a.tokenNumber, a.doctorName]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || minute(b) - minute(a) || a.id.localeCompare(b.id),
    );
}

export const page = <T>(items: T[], pageNumber: number, pageSize: number) =>
  items.slice((pageNumber - 1) * pageSize, pageNumber * pageSize);
