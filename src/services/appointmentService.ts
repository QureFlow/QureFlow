import { Appointment, AppointmentStatus, QueueToken } from '../types';
import { storage } from './storage';
import { queueService } from './queueService';

export const appointmentService = {
  async getAppointments(filters?: {
    patientId?: string;
    patientPhone?: string;
    doctorId?: string;
    date?: string;
    status?: string;
  }): Promise<Appointment[]> {
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

    // Sort by createdAt descending
    return list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async getAppointmentById(id: string): Promise<Appointment | null> {
    const list = storage.getAppointments();
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
    const doctors = storage.getDoctors();
    const doc = doctors.find((d) => d.id === data.doctorId);
    if (!doc) throw new Error('Doctor not found');

    const tokenNumber = await queueService.generateNextTokenNumber(data.doctorId);
    const aptId = `apt-${Date.now()}`;
    const tokenId = `tok-${Date.now()}`;
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
    const appointments = storage.getAppointments();
    const apt = appointments.find((a) => a.id === id);
    if (apt) {
      apt.status = 'cancelled';
      if (reason) {
        apt.notes = apt.notes ? `${apt.notes} | Cancelled: ${reason}` : `Cancelled: ${reason}`;
      }
      storage.saveAppointments(appointments);

      // Cancel associated queue token
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
