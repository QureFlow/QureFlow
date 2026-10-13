import { randomUUID } from 'node:crypto';
import { db } from '../repositories/repository.js';
import { queueService } from './queueService.js';
import { Appointment, QueueToken, SlotAvailability } from '../models/types.js';
import { clockMinutes, clinicDate, clinicNowMinutes, timeLabel, weekday } from '../lib/time.js';
import { AppError } from '../lib/errors.js';
import { bookingDateSchema, parse } from '../lib/validation.js';
export class AppointmentService {
  async getDoctorSlotAvailability(doctorId: string, date: string): Promise<SlotAvailability[]> {
    parse(bookingDateSchema, date);
    const doc = await db.getDoctorById(doctorId);
    if (!doc) throw new AppError(404, 'Doctor not found');
    const appointments = (await db.getAppointments({ doctorId, date })).filter(
      (a) => !['cancelled', 'no_show'].includes(a.status),
    );
    const settings = await db.getSettings(doc.clinicId),
      slots: SlotAvailability[] = [];
    const start = clockMinutes(doc.startTime),
      end = clockMinutes(doc.endTime),
      consultation = doc.slotDurationMinutes,
      buffer = settings.bufferMinutes ?? 2;
    const windowMinutes = Math.max(30, Math.ceil((consultation + buffer) / 30) * 30);
    for (let minute = start; minute < end; minute += windowMinutes) {
      const time = timeLabel(minute),
        duration = Math.min(windowMinutes, end - minute),
        capacity = Math.max(0, Math.floor(duration / (consultation + buffer)));
      const count = appointments.filter((a) => a.time === time).length;
      const closed =
        doc.status !== 'active' ||
        !doc.consultationDays.includes(weekday(date)) ||
        (date === clinicDate() && minute <= clinicNowMinutes());
      const full = count >= capacity;
      slots.push({
        time,
        available: !closed && !full,
        isFull: full,
        patientsAhead: count,
        estimatedWaitMinutes: count * (consultation + buffer),
        slotDurationMinutes: duration,
        statusText: closed
          ? 'Unavailable'
          : full
            ? 'Slot Full'
            : count
              ? `${count} booked`
              : 'Available',
      });
    }
    return slots;
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
    parse(bookingDateSchema, data.date);
    const doc = await db.getDoctorById(data.doctorId);
    if (!doc) throw new AppError(404, 'Doctor not found');
    const slot = (await this.getDoctorSlotAvailability(data.doctorId, data.date)).find(
      (s) => s.time === data.time,
    );
    if (!slot || !slot.available)
      throw new AppError(409, 'This slot is full or unavailable. Choose an available time.');
    const settings = await db.getSettings(doc.clinicId),
      capacity = Math.max(
        0,
        Math.floor(
          slot.slotDurationMinutes / (doc.slotDurationMinutes + (settings.bufferMinutes ?? 2)),
        ),
      );
    await db.initializeSlot(doc.id, data.date, data.time, capacity);
    const appointment: Appointment = {
      id: `apt-${randomUUID()}`,
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
      tokenNumber: '',
      status: data.date === clinicDate() ? 'waiting' : 'booked',
      priority: 'normal',
      isWalkIn: false,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };
    const token = await queueService.joinQueue(
      { ...data, appointmentId: appointment.id, scheduledTime: data.time, dateStr: data.date },
      appointment,
      capacity,
    );
    return { appointment: (await db.getAppointmentById(appointment.id))!, token };
  }
  async getAppointments(filters?: {
    patientId?: string;
    doctorId?: string;
    date?: string;
    clinicId?: string;
  }) {
    return db.getAppointments(filters);
  }
  async cancelAppointment(id: string, reason?: string): Promise<void> {
    const apt = await db.getAppointmentById(id);
    if (!apt) throw new AppError(404, 'Appointment not found');
    const tokens = apt.tokenId
      ? [(await db.findTokenById(apt.tokenId))?.token].filter((t): t is QueueToken =>
          Boolean(t),
        )
      : await db.getAllTokensForQueue(db.getQueueId(apt.doctorId, apt.date));
    const token =
      tokens.find((t) => t.appointmentId === id) ||
      tokens.find(
        (t) =>
          !t.appointmentId && t.patientId === apt.patientId && t.tokenNumber === apt.tokenNumber,
      );
    if (!token) throw new AppError(409, 'Appointment token is missing. Contact the clinic.');
    await queueService.cancelToken(token.id, reason);
  }
}
export const appointmentService = new AppointmentService();
