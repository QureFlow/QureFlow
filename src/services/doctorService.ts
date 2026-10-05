import { Doctor, SlotAvailability } from '../types';
import { storage } from './storage';
import { apiClient } from './apiClient';

const isMockEnabled = () => import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

export const doctorService = {
  async getDoctors(filters?: {
    specialization?: string;
    clinicId?: string;
    query?: string;
    availableTodayOnly?: boolean;
  }): Promise<Doctor[]> {
    if (!isMockEnabled()) {
      try {
        const queryParams = new URLSearchParams();
        if (filters?.specialization) queryParams.append('specialization', filters.specialization);
        if (filters?.query) queryParams.append('query', filters.query);
        if (filters?.availableTodayOnly) queryParams.append('availableTodayOnly', 'true');

        const qs = queryParams.toString();
        const endpoint = qs ? `/doctors?${qs}` : '/doctors';
        const list = await apiClient.get<Doctor[]>(endpoint);
        if (Array.isArray(list) && list.length > 0) return list;
      } catch (err) {
        console.warn('[DoctorService] API getDoctors failed, using local:', err);
      }
    }

    // Local fallback
    let list = storage.getDoctors();

    if (filters?.query) {
      const q = filters.query.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q) ||
          d.clinicName.toLowerCase().includes(q)
      );
    }

    if (filters?.specialization && filters.specialization !== 'all') {
      list = list.filter((d) => d.specialization === filters.specialization);
    }

    if (filters?.clinicId && filters.clinicId !== 'all') {
      list = list.filter((d) => d.clinicId === filters.clinicId);
    }

    if (filters?.availableTodayOnly) {
      list = list.filter((d) => d.isAvailableToday);
    }

    return list;
  },

  async getDoctorById(id: string): Promise<Doctor | null> {
    if (!isMockEnabled()) {
      try {
        return await apiClient.get<Doctor>(`/doctors/${id}`);
      } catch (err) {
        console.warn(`[DoctorService] API getDoctorById ${id} failed:`, err);
      }
    }

    const list = storage.getDoctors();
    return list.find((d) => d.id === id) || null;
  },

  async addDoctor(data: Omit<Doctor, 'id'>): Promise<Doctor> {
    if (!isMockEnabled()) {
      try {
        return await apiClient.post<Doctor>('/doctors', data);
      } catch (err) {
        console.warn('[DoctorService] API addDoctor failed, using local:', err);
      }
    }

    const list = storage.getDoctors();
    const newDoc: Doctor = {
      ...data,
      id: `doc-${Date.now()}`,
    };
    list.unshift(newDoc);
    storage.saveDoctors(list);
    return newDoc;
  },

  async updateDoctor(id: string, updates: Partial<Doctor>): Promise<Doctor> {
    if (!isMockEnabled()) {
      try {
        return await apiClient.patch<Doctor>(`/doctors/${id}`, updates);
      } catch (err) {
        console.warn('[DoctorService] API updateDoctor failed, using local:', err);
      }
    }

    const list = storage.getDoctors();
    const index = list.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Doctor not found');

    const updated = { ...list[index], ...updates };
    list[index] = updated;
    storage.saveDoctors(list);
    return updated;
  },

  async toggleDoctorStatus(id: string): Promise<Doctor> {
    const doc = await this.getDoctorById(id);
    if (!doc) throw new Error('Doctor not found');

    const nextStatus = doc.status === 'active' ? 'inactive' : 'active';
    return this.updateDoctor(id, { status: nextStatus });
  },

  async getAvailableSlots(
    doctorId: string,
    dateStr: string
  ): Promise<SlotAvailability[]> {
    const baseSlots = [
      '09:00 AM',
      '09:30 AM',
      '10:00 AM',
      '10:30 AM',
      '11:00 AM',
      '11:30 AM',
      '12:00 PM',
      '12:30 PM',
      '01:00 PM',
      '01:30 PM',
    ];

    if (!isMockEnabled()) {
      try {
        const slots = await apiClient.get<SlotAvailability[]>(
          `/doctors/${doctorId}/slots?date=${dateStr}`
        );
        if (Array.isArray(slots) && slots.length > 0) {
          return slots;
        }
      } catch (err) {
        console.warn('[DoctorService] API slots fetch failed, using local calculation:', err);
      }
    }

    // Local / offline calculation using user formula:
    // estimatedWaitMinutes = tactive * pactive + (p - 1) * tavg + buffer
    const doc =
      (await this.getDoctorById(doctorId)) ||
      storage.getDoctors().find((d) => d.id === doctorId);
    const appointments = storage
      .getAppointments()
      .filter((a) => a.doctorId === doctorId && a.date === dateStr && a.status !== 'cancelled');

    const slotDurationMinutes = 30;
    const tavg = doc?.slotDurationMinutes || 10;
    const buffer = 2;

    return baseSlots.map((time) => {
      const bookedCount = appointments.filter((a) => a.time === time).length;
      const p = bookedCount;

      if (p === 0) {
        return {
          time,
          available: true,
          isFull: false,
          patientsAhead: 0,
          estimatedWaitMinutes: 0,
          slotDurationMinutes,
          statusText: 'Available',
        };
      }

      const pactive = 1;
      const tactive = tavg;
      const estimatedWaitMinutes = Math.round(tactive * pactive + (p - 1) * tavg + buffer);
      const isFull = estimatedWaitMinutes > slotDurationMinutes;

      return {
        time,
        available: !isFull,
        isFull,
        patientsAhead: p,
        estimatedWaitMinutes,
        slotDurationMinutes,
        statusText: isFull ? 'Slot Full' : `${p} ahead (~${estimatedWaitMinutes}m)`,
      };
    });
  },
};
