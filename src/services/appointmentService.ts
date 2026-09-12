import { Appointment, AppointmentStatus, QueueToken } from '../types';
import { storage } from './storage';
import { apiClient } from './apiClient';

const isMockEnabled = () => import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

export const appointmentService = {
  async getAppointments(filters?: {
    patientId?: string;
    patientPhone?: string;
    doctorId?: string;
    date?: string;
    status?: string;
  }): Promise<Appointment[]> {
    if (!isMockEnabled()) {
      try {
        const queryParams = new URLSearchParams();
        if (filters?.patientId) queryParams.append('patientId', filters.patientId);
        if (filters?.doctorId && filters.doctorId !== 'all') queryParams.append('doctorId', filters.doctorId);
        if (filters?.date) queryParams.append('date', filters.date);

        const qs = queryParams.toString();
        const endpoint = qs ? `/appointments?${qs}` : '/appointments';
        const list = await apiClient.get<Appointment[]>(endpoint);
        if (Array.isArray(list)) return list;
      } catch (err) {
        console.warn('[AppointmentService] API call failed, using local:', err);
      }
    }

    // Local fallback
    let list = storage.getAppointments();

    if (filters?.patientId) {
      list = list.filter((a) => a.patientId === filters.patientId);
    }

    if (filters?.patientPhone) {
      list = list.filter((a) => a.patientPhone === filters.patientPhone);
    }

    if (filters?.doctorId && filters.doctorId !== 'all') {
      list = list.filter((a) => a.doctorId === filters.doctorId);
    }

    if (filters?.date) {
      list = list.filter((a) => a.date === filters.date);
    }

    if (filters?.status && filters.status !== 'all') {
      list = list.filter((a) => a.status === filters.status);
    }

    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const list = await this.getAppointments();
    return list.find((a) => a.id === id) || null;
  },

  async createAppointment(data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorId: string;
    date: string;
    time: string;
    notes?: string;
  }): Promise<{ appointment: Appointment; token: QueueToken }> {
    if (!isMockEnabled()) {
      try {
        const result = await apiClient.post<{ appointment: Appointment; token: QueueToken }>(
          '/appointments',
          data
        );
        return result;
      } catch (err) {
        console.warn('[AppointmentService] API booking failed, using local:', err);
      }
    }

    // Local fallback
    const doctors = storage.getDoctors();
    const doc = doctors.find((d) => d.id === data.doctorId);
    if (!doc) throw new Error('Doctor not found');

    const aptId = `apt-${Date.now()}`;
    const tokenId = `tok-${Date.now()}`;
    const tokenNumber = `A-${String(Math.floor(1 + Math.random() * 50)).padStart(3, '0')}`;
    const nowIso = new Date().toISOString();

    const newAppointment: Appointment = {
      id: aptId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      doctorId: doc.id,
      doctorName: doc.name,
      doctorSpecialization: doc.specialization,
      clinicId: doc.clinicId,
      clinicName: doc.clinicName,
      date: data.date,
      time: data.time,
      tokenNumber,
      status: 'waiting',
      priority: 'normal',
      isWalkIn: false,
      notes: data.notes || '',
      createdAt: nowIso,
    };

    const newToken: QueueToken = {
      id: tokenId,
      tokenNumber,
      appointmentId: aptId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      doctorId: doc.id,
      doctorName: doc.name,
      clinicId: doc.clinicId,
      clinicName: doc.clinicName,
      scheduledTime: data.time,
      priority: 'normal',
      isWalkIn: false,
      status: 'waiting',
      createdAt: nowIso,
    };

    const appointments = storage.getAppointments();
    appointments.unshift(newAppointment);
    storage.saveAppointments(appointments);

    const tokens = storage.getTokens();
    tokens.push(newToken);
    storage.saveTokens(tokens);

    return { appointment: newAppointment, token: newToken };
  },

  async cancelAppointment(id: string, reason?: string): Promise<void> {
    if (!isMockEnabled()) {
      try {
        await apiClient.post(`/appointments/${id}/cancel`, { reason });
        return;
      } catch (err) {
        console.warn('[AppointmentService] API cancelAppointment failed, using local:', err);
      }
    }

    const appointments = storage.getAppointments();
    const apt = appointments.find((a) => a.id === id);
    if (apt) {
      apt.status = 'cancelled';
      if (reason) {
        apt.notes = apt.notes ? `${apt.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`;
      }
      storage.saveAppointments(appointments);

      if (apt.tokenNumber) {
        const tokens = storage.getTokens();
        const tok = tokens.find(
          (t) => t.tokenNumber === apt.tokenNumber && t.doctorId === apt.doctorId
        );
        if (tok) {
          tok.status = 'cancelled';
          storage.saveTokens(tokens);
        }
      }
    }
  },

  async updateAppointmentStatus(id: string, status: AppointmentStatus): Promise<Appointment> {
    const appointments = storage.getAppointments();
    const index = appointments.findIndex((a) => a.id === id);
    if (index === -1) throw new Error('Appointment not found');

    appointments[index].status = status;
    storage.saveAppointments(appointments);
    return appointments[index];
  },
};
