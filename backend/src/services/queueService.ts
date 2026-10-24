import { randomUUID } from 'node:crypto';
import { db } from '../repositories/repository.js';
import {
  QueueToken,
  QueuePriority,
  DoctorQueueState,
  PatientQueueStatus,
  Appointment,
} from '../models/types.js';
import { clinicDate, clinicNowMinutes, clockMinutes } from '../lib/time.js';
import { byQueueOrder, patientsAhead } from '../lib/queueOrder.js';
import { AppError } from '../lib/errors.js';
import { analyticsService } from './analyticsService.js';
import { estimateWait } from './predictionService.js';
import { applyCorrection } from './waitCorrection.js';
export const doctorPrefix = (id: string) =>
  ({
    'doc-1': 'A',
    'doc-2': 'B',
    'doc-3': 'C',
    'doc-4': 'R',
    'doc-5': 'F',
    'doc-6': 'P',
    'doc-7': 'M',
    'doc-8': 'D',
    'doc-9': 'T',
    'doc-10': 'K',
  })[id] ||
  (/^doc-\d+$/.test(id) ? `D${id.slice(4)}` : '') ||
  `Q${id
    .replace(/[^a-z0-9]/gi, '')
    .slice(-4)
    .toUpperCase()}`;
export class QueueService {
  async joinQueue(
    data: {
      doctorId: string;
      patientId?: string;
      patientName: string;
      patientPhone: string;
      priority?: QueuePriority;
      isWalkIn?: boolean;
      scheduledTime?: string;
      appointmentId?: string;
      dateStr?: string;
    },
    appointment?: Appointment,
    capacity?: number,
  ): Promise<QueueToken> {
    const doc = await db.getDoctorById(data.doctorId);
    if (!doc) throw new AppError(404, 'Doctor not found');
    if (doc.status !== 'active') throw new AppError(409, 'This doctor is not accepting patients.');
    if (!data.patientId) throw new AppError(400, 'A patient record is required.');
    const patient = await db.getUserById(data.patientId);
    if (!patient || patient.role !== 'patient')
      throw new AppError(400, 'A valid patient record is required.');
    const settings = await db.getSettings(doc.clinicId);
    if (data.isWalkIn && !settings.allowWalkIns)
      throw new AppError(409, 'Walk-in registration is disabled.');
    if (data.priority === 'emergency' && !settings.allowEmergencyPriority)
      throw new AppError(409, 'Priority registration is disabled.');
    const date = data.dateStr || clinicDate();
    if (await db.getActivePatientToken(data.patientId, date))
      throw new AppError(409, 'This patient already has an active visit on this date.');
    const queueId = db.getQueueId(doc.id, date),
      { seq } = await db.getNextTokenSequence(queueId);
    const token: QueueToken = {
      id: `tok-${randomUUID()}`,
      tokenNumber: `${doctorPrefix(doc.id)}-${String(seq).padStart(3, '0')}`,
      patientId: data.patientId,
      patientName: data.patientName.trim(),
      patientPhone: data.patientPhone.trim(),
      appointmentId: data.appointmentId,
      doctorId: doc.id,
      doctorName: doc.name,
      clinicId: doc.clinicId,
      clinicName: doc.clinicName,
      scheduledTime: data.scheduledTime || 'Walk-in',
      priority: data.priority || 'normal',
      isWalkIn: Boolean(data.isWalkIn),
      status: 'waiting',
      createdAt: new Date().toISOString(),
      ...(patient.metadata?.synthetic === true ? { metadata: { synthetic: true } } : {}),
    };
    if (appointment) appointment.tokenNumber = token.tokenNumber;
    return db.createToken(token, queueId, seq, appointment, capacity);
  }
  async getDoctorQueue(doctorId: string, date = clinicDate()): Promise<DoctorQueueState> {
    const doc = await db.getDoctorById(doctorId);
    if (!doc) throw new AppError(404, 'Doctor not found');
    const tokens = await db.getAllTokensForQueue(db.getQueueId(doctorId, date));
    const ordered = [
      ...tokens.filter((t) => t.status !== 'waiting'),
      ...tokens.filter((t) => t.status === 'waiting').sort(byQueueOrder),
    ];
    return {
      doctorId,
      doctorName: doc.name,
      specialization: doc.specialization,
      clinicId: doc.clinicId,
      currentTokenNumber: tokens.find((t) => t.status === 'current')?.tokenNumber || null,
      isPaused: await db.isDoctorPaused(doctorId),
      tokens: ordered,
    };
  }
  async callNextPatient(doctorId: string, date = clinicDate()): Promise<QueueToken | null> {
    const queue = await this.getDoctorQueue(doctorId, date);
    if (queue.isPaused) throw new AppError(409, 'Resume the queue before calling a patient.');
    if (queue.currentTokenNumber)
      throw new AppError(
        409,
        'Complete or skip the current consultation before calling the next patient.',
      );
    // Future appointments must never be called as walk-ins ahead of their appointment window.
    const token = await db.getNextEligibleToken(db.getQueueId(doctorId, date), clinicNowMinutes());
    if (!token) return null;
    const found = await db.findTokenById(token.id);
    if (!found) return null;
    return db.updateTokenStatus(found.pk, found.sk, 'current', {
      calledAt: new Date().toISOString(),
    });
  }
  async markPatientServed(id: string): Promise<void> {
    const found = await db.findTokenById(id);
    if (!found) throw new AppError(404, 'Token not found');
    await db.updateTokenStatus(found.pk, found.sk, 'completed', {
      servedAt: new Date().toISOString(),
    });
  }
  async skipPatient(id: string): Promise<void> {
    const found = await db.findTokenById(id);
    if (!found) throw new AppError(404, 'Token not found');
    await db.updateTokenStatus(found.pk, found.sk, 'skipped');
  }
  async cancelToken(id: string, reason?: string): Promise<void> {
    const found = await db.findTokenById(id);
    if (!found) throw new AppError(404, 'Token not found');
    await db.updateTokenStatus(found.pk, found.sk, 'cancelled', { reason });
  }
  async getPatientActiveStatus(patientId: string): Promise<PatientQueueStatus | null> {
    const token = await db.getActivePatientToken(patientId, clinicDate());
    if (!token) return null;
    const queue = await this.getDoctorQueue(token.doctorId),
      settings = await db.getSettings(token.clinicId);
    const current = queue.tokens.find((t) => t.status === 'current');
    const ahead =
      token.status === 'current'
        ? []
        : patientsAhead(
            queue.tokens.filter((t) => t.status === 'waiting'),
            token,
            clinicNowMinutes(),
          );
    let clinic = await analyticsService.getClinicModels(token.clinicId);
    // A doctor added since the cached training run needs a fresh one.
    if (!clinic.models.has(token.doctorId))
      clinic = await analyticsService.getClinicModels(token.clinicId, true);
    const model = clinic.models.get(token.doctorId)!;
    const now = Date.now(),
      buffer = settings.bufferMinutes ?? 2,
      waiting = queue.tokens.filter((t) => t.status === 'waiting' && t.id !== token.id);
    const projected =
      token.status === 'current'
        ? { minutes: 0, low: 0, high: 0 }
        : estimateWait({
            model,
            current,
            target: token,
            waiting,
            bufferMinutes: buffer,
            now,
            returningPatients: clinic.returning.get(token.doctorId),
            calibration: clinic.calibration,
          });
    const scheduled = !(token.isWalkIn || ['Now', 'Walk-in'].includes(token.scheduledTime));
    const estimate =
      token.status === 'current' || !clinic.correction
        ? projected
        : applyCorrection(
            clinic.correction,
            {
              target: token,
              at: now,
              current,
              waiting,
              ahead,
              returningPatients: clinic.returning.get(token.doctorId) || new Set(),
              notBefore: scheduled
                ? now + (clockMinutes(token.scheduledTime) - clinicNowMinutes()) * 60000
                : undefined,
              dayTokens: queue.tokens,
            },
            projected,
            settings.averageConsultationMinutes,
            buffer,
          );
    return {
      token,
      currentServingToken: current?.tokenNumber || null,
      patientsAhead: token.status === 'current' ? 0 : ahead.length + (current ? 1 : 0),
      estimatedWaitMinutes: estimate.minutes,
      estimatedWaitRange: { low: estimate.low, high: estimate.high },
      isPaused: queue.isPaused,
      prediction: {
        method: model.method,
        sampleCount: model.sampleCount,
        syntheticSamples: model.syntheticSamples,
        validationMaeMinutes: model.modelMae,
        learnedCorrection: Boolean(clinic.correction),
        noShowRate: Math.round(model.noShowRate * 100) / 100,
        modelVersion: model.modelVersion,
        isEstimate: true,
      },
    };
  }
}
export const queueService = new QueueService();
