import { v4 as uuidv4 } from 'uuid';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { queueService } from './queueService.js';
import { Appointment, QueueToken, SlotAvailability } from '../models/types.js';

export const BASE_CONSULTATION_SLOTS = [
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

export class AppointmentService {
  /**
   * Calculate slot availability and wait time using the formula:
   * estimatedWaitMinutes = tactive * pactive + (p - 1) * tavg + buffer
   * If estimatedWaitMinutes > slotDurationMinutes then slot is FULL.
   */
  async getDoctorSlotAvailability(doctorId: string, dateStr: string): Promise<SlotAvailability[]> {
    const doc = await dynamoDbRepo.getDoctorById(doctorId);
    const appointments = await dynamoDbRepo.getAppointments({ doctorId, date: dateStr });
    const activeAppointments = appointments.filter((a) => a.status !== 'cancelled');

    // Slot duration between consultation intervals: standard 30 minutes
    const slotDurationMinutes = 30;
    const tavg = doc?.slotDurationMinutes || 10;
    const buffer = 2; // Buffer time between consultations

    return BASE_CONSULTATION_SLOTS.map((time) => {
      // p: number of patients already booked for this specific time slot
      const bookedCount = activeAppointments.filter((a) => a.time === time).length;
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

      // Formula: tactive * pactive + (p - 1) * tavg + buffer
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
  }

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

    // Validate slot capacity and waiting time
    const slotAvailability = await this.getDoctorSlotAvailability(data.doctorId, data.date);
    const targetSlot = slotAvailability.find((s) => s.time === data.time);
    if (targetSlot && targetSlot.isFull) {
      throw new Error(
        `Time slot ${data.time} on ${data.date} is full (${targetSlot.patientsAhead} patients ahead, estimated wait ${targetSlot.estimatedWaitMinutes}m exceeds ${targetSlot.slotDurationMinutes}m slot duration). Please choose another slot.`
      );
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
