import { Appointment, QueueToken } from '../types';
import { apiClient } from './apiClient';
export const appointmentService = {
  async getAppointments(filters?: {
    patientId?: string;
    patientPhone?: string;
    doctorId?: string;
    date?: string;
    status?: string;
  }): Promise<Appointment[]> {
    const params = new URLSearchParams();
    if (filters?.patientId) params.set('patientId', filters.patientId);
    if (filters?.doctorId && filters.doctorId !== 'all') params.set('doctorId', filters.doctorId);
    if (filters?.date) params.set('date', filters.date);
    let list = await apiClient.get<Appointment[]>(`/appointments?${params}`);
    if (filters?.status && filters.status !== 'all')
      list = list.filter((a) => a.status === filters.status);
    return list;
  },
  async getAppointmentById(id: string) {
    return (await this.getAppointments()).find((a) => a.id === id) || null;
  },
  createAppointment: (data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorId: string;
    date: string;
    time: string;
    notes?: string;
  }) => apiClient.post<{ appointment: Appointment; token: QueueToken }>('/appointments', data),
  async cancelAppointment(id: string, reason?: string): Promise<void> {
    await apiClient.post(`/appointments/${encodeURIComponent(id)}/cancel`, { reason });
  },
};
