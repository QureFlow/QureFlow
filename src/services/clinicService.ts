import { Clinic, QueueSettings } from '../types';
import { apiClient } from './apiClient';
import { storage } from './storage';
export const clinicService = {
  async getClinics(): Promise<Clinic[]> {
    const list = await apiClient.get<Clinic[]>('/clinics'),
      user = storage.getActiveUser();
    return user && user.role !== 'patient' && !user.demoAllClinics
      ? list.filter((c) => c.id === user.clinicId) : list;
  },
  getClinicById: (id: string) => apiClient.get<Clinic | null>(`/clinics/${encodeURIComponent(id)}`),
  updateClinic: (id: string, updates: Partial<Clinic>) => {
    const allowed = [
      'name',
      'address',
      'district',
      'state',
      'phone',
      'email',
      'openingHours',
      'emergencyContact',
    ];
    const data = Object.fromEntries(
      Object.entries(updates).filter(([key]) => allowed.includes(key)),
    );
    return apiClient.patch<Clinic>(`/clinics/${encodeURIComponent(id)}`, data);
  },
  getSettings: (clinicId?: string) => apiClient.get<QueueSettings>(
    '/settings' + (clinicId ? '?clinicId=' + encodeURIComponent(clinicId) : ''),
  ),
  updateSettings: (data: Partial<QueueSettings>, clinicId?: string) => apiClient.put<QueueSettings>(
    '/settings' + (clinicId ? '?clinicId=' + encodeURIComponent(clinicId) : ''), data,
  ),
};
