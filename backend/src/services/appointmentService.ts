import { v4 as uuidv4 } from 'uuid';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { queueService } from './queueService.js';
import { Appointment, QueueToken } from '../models/types.js';

export class AppointmentService {
  async createAppointment(data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorId: string;
    date: string;
    time: string;
    notes?: string;
  }): Promise<{ appointment: Appointment; token: QueueToken }> {
    const doc = await dynamoDbRepo.getDoctorById(data.doctorId);
    if (!doc) {
      throw new Error(`Doctor with ID ${data.doctorId} not found`);
    }

    const aptId = `apt-${Date.now()}-${uuidv4().substring(0, 6)}`;
    const nowIso = new Date().toISOString();

    // Automatically allocate token via QueueService
    const token = await queueService.joinQueue({
      doctorId: doc.id,
      patientId: data.patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      priority: 'normal',
      isWalkIn: false,
      scheduledTime: data.time,
      appointmentId: aptId,
      dateStr: data.date,
    });

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
      tokenNumber: token.tokenNumber,
      status: 'waiting',
      priority: 'normal',
      isWalkIn: false,
      notes: data.notes || '',
      createdAt: nowIso,
    };

    await dynamoDbRepo.saveAppointment(newAppointment);

    return { appointment: newAppointment, token };
  }

  async getAppointments(filters?: {
    patientId?: string;
    doctorId?: string;
    date?: string;
  }): Promise<Appointment[]> {
    return dynamoDbRepo.getAppointments(filters);
  }

  async cancelAppointment(aptId: string, reason?: string): Promise<void> {
    const apt = await dynamoDbRepo.getAppointmentById(aptId);
    if (!apt) throw new Error(`Appointment with ID ${aptId} not found`);

    const note = reason ? `Cancelled: ${reason}` : 'Cancelled by patient';
    await dynamoDbRepo.updateAppointmentStatus(aptId, 'cancelled', note);

    // Cancel matching token in today's queue
    if (apt.tokenNumber) {
      const queueId = dynamoDbRepo.getQueueId(apt.doctorId, apt.date);
      const tokens = await dynamoDbRepo.getAllTokensForQueue(queueId);
      const matching = tokens.find((t) => t.tokenNumber === apt.tokenNumber);
      if (matching) {
        await queueService.cancelToken(matching.id);
      }
    }
  }
}

export const appointmentService = new AppointmentService();
