import { Clinic, QueueSettings } from '../types';
import { storage } from './storage';

export const clinicService = {
  async getClinics(): Promise<Clinic[]> {
    return storage.getClinics();
  },

  async getClinicById(id: string): Promise<Clinic | null> {
    const list = storage.getClinics();
    return list.find((c) => c.id === id) || null;
  },

  async updateClinic(id: string, updates: Partial<Clinic>): Promise<Clinic> {
    const list = storage.getClinics();
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) throw new Error('Clinic not found');

    const updated = { ...list[index], ...updates };
    list[index] = updated;
    storage.saveClinics(list);
    return updated;
  },

  async getSettings(): Promise<QueueSettings> {
    return storage.getSettings();
  },

  async updateSettings(updates: Partial<QueueSettings>): Promise<QueueSettings> {
    const current = storage.getSettings();
    const updated = { ...current, ...updates };
    storage.saveSettings(updated);
    return updated;
  },
};
