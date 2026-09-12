import { User, Appointment, QueueToken } from '../types';
import { storage } from './storage';

export const patientService = {
  async getPatients(query?: string): Promise<User[]> {
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
    const list = storage.getPatients();
    return list.find((p) => p.id === id) || null;
  },

  async getPatientHistory(
    patientId: string
  ): Promise<{ appointments: Appointment[]; tokens: QueueToken[] }> {
    const appointments = storage
      .getAppointments()
      .filter((a) => a.patientId === patientId);
    const tokens = storage.getTokens().filter((t) => t.patientId === patientId);

    return { appointments, tokens };
  },

  async updatePatient(id: string, updates: Partial<User>): Promise<User> {
    const list = storage.getPatients();
    const index = list.findIndex((p) => p.id === id);
    if (index === -1) throw new Error('Patient not found');

    const updated = { ...list[index], ...updates };
    list[index] = updated;
    storage.savePatients(list);

    // If updating currently logged in user, refresh active session
    const active = storage.getActiveUser();
    if (active && active.id === id) {
      storage.setActiveUser(updated);
    }

    return updated;
  },
};
