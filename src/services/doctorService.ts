import { Doctor, SlotAvailability } from '../types';
import { apiClient } from './apiClient';
import { storage } from './storage';
const editable = (data: Partial<Doctor>) => {
  const allowed = [
    'name',
    'specialization',
    'experienceYears',
    'qualifications',
    'clinicId',
    'consultationDays',
    'startTime',
    'endTime',
    'slotDurationMinutes',
    'consultationFee',
    'status',
    'avatar',
  ];
  return Object.fromEntries(Object.entries(data).filter(([key]) => allowed.includes(key)));
};
export const doctorService = {
  async getDoctors(filters?: {
    specialization?: string;
    clinicId?: string;
    query?: string;
    availableTodayOnly?: boolean;
  }): Promise<Doctor[]> {
    const params = new URLSearchParams();
    if (filters?.specialization) params.set('specialization', filters.specialization);
    if (filters?.query) params.set('query', filters.query);
    if (filters?.clinicId) params.set('clinicId', filters.clinicId);
    if (filters?.availableTodayOnly) params.set('availableTodayOnly', 'true');
    const list = await apiClient.get<Doctor[]>(`/doctors?${params}`),
      user = storage.getActiveUser();
    return user && user.role !== 'patient'
      ? list.filter(
          (d) => d.clinicId === user.clinicId && (user.role !== 'doctor' || d.id === user.doctorId),
        )
      : list;
  },
  getDoctorById: (id: string) => apiClient.get<Doctor | null>(`/doctors/${encodeURIComponent(id)}`),
  addDoctor: (data: Omit<Doctor, 'id'>) => apiClient.post<Doctor>('/doctors', editable(data)),
  updateDoctor: (id: string, data: Partial<Doctor>) =>
    apiClient.patch<Doctor>(`/doctors/${encodeURIComponent(id)}`, editable(data)),
  async toggleDoctorStatus(id: string) {
    const doc = await this.getDoctorById(id);
    if (!doc) throw new Error('Doctor not found');
    return this.updateDoctor(id, { status: doc.status === 'active' ? 'inactive' : 'active' });
  },
  getAvailableSlots: (id: string, date: string) =>
    apiClient.get<SlotAvailability[]>(
      `/doctors/${encodeURIComponent(id)}/slots?date=${encodeURIComponent(date)}`,
    ),
};
