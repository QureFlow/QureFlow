import { DoctorQueueState, QueueToken, QueuePriority, PatientQueueStatus } from '../types';
import { apiClient } from './apiClient';
export const queueService = {
  getDoctorQueue: (id: string) =>
    apiClient.get<DoctorQueueState>(`/queues/doctor/${encodeURIComponent(id)}`),
  getAllDoctorQueues: () => apiClient.get<DoctorQueueState[]>('/queues/all'),
  callNextPatient: (doctorId: string) =>
    apiClient.post<QueueToken | null>('/queues/call-next', { doctorId }),
  async markPatientServed(id: string): Promise<void> {
    await apiClient.post(`/tokens/${encodeURIComponent(id)}/serve`);
  },
  async skipPatient(id: string): Promise<void> {
    await apiClient.post(`/tokens/${encodeURIComponent(id)}/skip`);
  },
  async cancelToken(id: string): Promise<void> {
    await apiClient.post(`/tokens/${encodeURIComponent(id)}/cancel`);
  },
  async pauseQueue(doctorId: string): Promise<void> {
    await apiClient.post('/queues/pause', { doctorId, paused: true });
  },
  async resumeQueue(doctorId: string): Promise<void> {
    await apiClient.post('/queues/pause', { doctorId, paused: false });
  },
  addWalkInPatient: (data: {
    patientName: string;
    patientPhone: string;
    doctorId: string;
    time?: string;
    priority?: QueuePriority;
  }) => apiClient.post<QueueToken>('/queues/join', { ...data, isWalkIn: true }),
  getPatientActiveToken: (_identifier: string) =>
    apiClient.get<PatientQueueStatus | null>('/patients/me/status'),
  async getTokenTimeline(doctorId: string) {
    const { tokens } = await this.getDoctorQueue(doctorId);
    return {
      completed: tokens.filter((t) => t.status === 'completed').slice(-5),
      current: tokens.find((t) => t.status === 'current') || null,
      waiting: tokens.filter((t) => t.status === 'waiting'),
    };
  },
};
