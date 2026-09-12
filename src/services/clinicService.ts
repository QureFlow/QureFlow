import { Clinic, QueueSettings } from '../types';
import { storage } from './storage';
import { apiClient } from './apiClient';

const isMockEnabled = () => import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

export const clinicService = {
  async getClinics(): Promise<Clinic[]> {
    if (!isMockEnabled()) {
      try {
        const clinics = await apiClient.get<Clinic[]>('/clinics');
        if (Array.isArray(clinics) && clinics.length > 0) return clinics;
      } catch (err) {
        console.warn('[ClinicService] API getClinics failed, using local:', err);
      }
    }
    return storage.getClinics();
  },

  async getClinicById(id: string): Promise<Clinic | null> {
    if (!isMockEnabled()) {
      try {
        return await apiClient.get<Clinic>(`/clinics/${id}`);
      } catch (err) {
        console.warn(`[ClinicService] API getClinicById ${id} failed:`, err);
      }
    }
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
    if (!isMockEnabled()) {
      try {
        return await apiClient.get<QueueSettings>('/settings');
      } catch (err) {
        console.warn('[ClinicService] API getSettings failed, using local:', err);
      }
    }
    return storage.getSettings();
  },

  async updateSettings(updates: Partial<QueueSettings>): Promise<QueueSettings> {
    if (!isMockEnabled()) {
      try {
        return await apiClient.put<QueueSettings>('/settings', updates);
      } catch (err) {
        console.warn('[ClinicService] API updateSettings failed, using local:', err);
      }
    }
    const current = storage.getSettings();
    const updated = { ...current, ...updates };
    storage.saveSettings(updated);
    return updated;
  },
};
