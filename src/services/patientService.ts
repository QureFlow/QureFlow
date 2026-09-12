import { User, Appointment, QueueToken } from '../types';
import { storage } from './storage';
import { apiClient } from './apiClient';

const isMockEnabled = () => import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

export const patientService = {
  async getPatients(query?: string): Promise<User[]> {
    if (!isMockEnabled()) {
      try {
        const endpoint = query ? `/patients?query=${encodeURIComponent(query)}` : '/patients';
        const list = await apiClient.get<User[]>(endpoint);
        if (Array.isArray(list)) return list;
      } catch (err) {
        console.warn('[PatientService] API getPatients failed, using local:', err);
      }
    }

    let list = storage.getPatients();
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    }
    return list;
  },

  async getPatientById(id: string): Promise<User | null> {
    if (!isMockEnabled()) {
      try {
        return await apiClient.get<User>(`/patients/${id}`);
      } catch (err) {
        console.warn(`[PatientService] API getPatientById ${id} failed:`, err);
      }
    }

    const list = storage.getPatients();
    return list.find((p) => p.id === id) || null;
  },

  async getPatientHistory(
    patientId: string
  ): Promise<{ appointments: Appointment[]; tokens: QueueToken[] }> {
    try {
      const appointments = await apiClient.get<Appointment[]>(`/appointments?patientId=${patientId}`);
      const tokens = storage.getTokens().filter((t) => t.patientId === patientId);
      return { appointments: appointments || [], tokens };
    } catch {
      const appointments = storage
        .getAppointments()
        .filter((a) => a.patientId === patientId);
      const tokens = storage.getTokens().filter((t) => t.patientId === patientId);

      return { appointments, tokens };
    }
  },

  async updatePatient(id: string, updates: Partial<User>): Promise<User> {
    if (!isMockEnabled()) {
      try {
        const updated = await apiClient.patch<User>(`/patients/${id}`, updates);
        const active = storage.getActiveUser();
        if (active && active.id === id) {
          storage.setActiveUser(updated);
        }
        return updated;
      } catch (err) {
        console.warn(`[PatientService] API updatePatient ${id} failed:`, err);
      }
    }

    const list = storage.getPatients();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Patient not found');

    const updated = { ...list[index], ...updates };
    list[index] = updated;
    storage.savePatients(list);

    const active = storage.getActiveUser();
    if (active && active.id === id) {
      storage.setActiveUser(updated);
    }

    return updated;
  },
};
