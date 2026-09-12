import { Doctor } from '../types';
import { storage } from './storage';

export const doctorService = {
  async getDoctors(filters?: {
    specialization?: string;
    clinicId?: string;
    query?: string;
    availableTodayOnly?: boolean;
  }): Promise<Doctor[]> {
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
    const list = storage.getDoctors();
    return list.find((d) => d.id === id) || null;
  },

  async addDoctor(data: Omit<Doctor, 'id'>): Promise<Doctor> {
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
    const list = storage.getDoctors();
    const index = list.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Doctor not found');

    const updated = { ...list[index], ...updates };
    list[index] = updated;
    storage.saveDoctors(list);
    return updated;
  },

  async toggleDoctorStatus(id: string): Promise<Doctor> {
    const list = storage.getDoctors();
    const doc = list.find((d) => d.id === id);
    if (!doc) throw new Error('Doctor not found');

    doc.status = doc.status === 'active' ? 'inactive' : 'active';
    storage.saveDoctors(list);
    return doc;
  },

  async getAvailableSlots(
    doctorId: string,
    dateStr: string
  ): Promise<{ time: string; available: boolean }[]> {
    const doc = await this.getDoctorById(doctorId);
    if (!doc) return [];

    // Base slots for the clinic shift
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

    // Find appointments booked for this doctor on this date
    const appointments = storage
      .getAppointments()
      .filter((a) => a.doctorId === doctorId && a.date === dateStr && a.status !== 'cancelled');

    const bookedTimes = new Set(appointments.map((a) => a.time));

    return baseSlots.map((time) => ({
      time,
      available: !bookedTimes.has(time),
    }));
  },
};
