import { User, Appointment, QueueToken } from '../types';
import { apiClient } from './apiClient';
import { storage } from './storage';
export const patientService = {
  getPatients: (query?: string) =>
    apiClient.get<User[]>(`/patients${query ? `?query=${encodeURIComponent(query)}` : ''}`),
  getPatientById: (id: string) => apiClient.get<User | null>(`/patients/${encodeURIComponent(id)}`),
  async getPatientHistory(
    patientId: string,
  ): Promise<{ appointments: Appointment[]; tokens: QueueToken[] }> {
    const [appointments, queues] = await Promise.all([
      apiClient.get<Appointment[]>(`/appointments?patientId=${encodeURIComponent(patientId)}`),
      apiClient.get<any[]>('/queues/all'),
    ]);
    return {
      appointments,
      tokens: queues.flatMap((q) => q.tokens).filter((t) => t.patientId === patientId),
    };
  },
  async updatePatient(id: string, updates: Partial<User>): Promise<User> {
    const user = await apiClient.patch<User>(`/patients/${encodeURIComponent(id)}`, updates);
    if (storage.getActiveUser()?.id === id) storage.setActiveUser(user);
    return user;
  },
};
