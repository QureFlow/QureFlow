import { randomUUID } from 'node:crypto';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import {
  QueueToken,
  QueuePriority,
  DoctorQueueState,
  PatientQueueStatus,
  Appointment,
} from '../models/types.js';
import { clinicDate, clinicNowMinutes, clockMinutes } from '../lib/time.js';
import { AppError } from '../lib/errors.js';
import { analyticsService } from './analyticsService.js';
import { predictDuration } from './predictionService.js';
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
    const doc = await dynamoDbRepo.getDoctorById(data.doctorId);
    if (!doc) throw new AppError(404, 'Doctor not found');
    if (doc.status !== 'active') throw new AppError(409, 'This doctor is not accepting patients.');
    if (!data.patientId) throw new AppError(400, 'A patient record is required.');
    const patient = await dynamoDbRepo.getUserById(data.patientId);
    if (!patient || patient.role !== 'patient')
      throw new AppError(400, 'A valid patient record is required.');
    const settings = await dynamoDbRepo.getSettings(doc.clinicId);
    if (data.isWalkIn && !settings.allowWalkIns)
      throw new AppError(409, 'Walk-in registration is disabled.');
    if (data.priority === 'emergency' && !settings.allowEmergencyPriority)
      throw new AppError(409, 'Priority registration is disabled.');
    const date = data.dateStr || clinicDate();
    if (await dynamoDbRepo.getActivePatientToken(data.patientId, date))
      throw new AppError(409, 'This patient already has an active visit on this date.');
    const queueId = dynamoDbRepo.getQueueId(doc.id, date),
      { seq } = await dynamoDbRepo.getNextTokenSequence(queueId);
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
    return dynamoDbRepo.createToken(token, queueId, seq, appointment, capacity);
  }
  async getDoctorQueue(doctorId: string, date = clinicDate()): Promise<DoctorQueueState> {
    const doc = await dynamoDbRepo.getDoctorById(doctorId);
    if (!doc) throw new AppError(404, 'Doctor not found');
    const tokens = await dynamoDbRepo.getAllTokensForQueue(dynamoDbRepo.getQueueId(doctorId, date));
    const waiting = tokens
      .filter((t) => t.status === 'waiting')
      .sort(
        (a, b) =>
          (a.priority === 'emergency' ? 0 : 1) - (b.priority === 'emergency' ? 0 : 1) ||
          (a.tokenSeq || Number(a.tokenNumber.split('-').pop())) -
            (b.tokenSeq || Number(b.tokenNumber.split('-').pop())),
      );
    const ordered = [...tokens.filter((t) => t.status !== 'waiting'), ...waiting];
    return {
      doctorId,
      doctorName: doc.name,
      specialization: doc.specialization,
      clinicId: doc.clinicId,
      currentTokenNumber: tokens.find((t) => t.status === 'current')?.tokenNumber || null,
      isPaused: await dynamoDbRepo.isDoctorPaused(doctorId),
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
    const waiting = await dynamoDbRepo.getWaitingTokens(dynamoDbRepo.getQueueId(doctorId, date));
    // Future appointments must never be called as walk-ins ahead of their appointment window.
    const token = waiting.find(
      (t) =>
        t.priority === 'emergency' ||
        t.isWalkIn ||
        ['Now', 'Walk-in'].includes(t.scheduledTime) ||
        (date === clinicDate() && clockMinutes(t.scheduledTime) <= clinicNowMinutes()),
    );
    if (!token) return null;
    const found = await dynamoDbRepo.findTokenById(token.id);
    if (!found) return null;
    return dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'current', {
      calledAt: new Date().toISOString(),
    });
  }
  async markPatientServed(id: string): Promise<void> {
    const found = await dynamoDbRepo.findTokenById(id);
    if (!found) throw new AppError(404, 'Token not found');
    await dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'completed', {
      servedAt: new Date().toISOString(),
    });
  }
  async skipPatient(id: string): Promise<void> {
    const found = await dynamoDbRepo.findTokenById(id);
    if (!found) throw new AppError(404, 'Token not found');
    await dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'skipped');
  }
  async cancelToken(id: string, reason?: string): Promise<void> {
    const found = await dynamoDbRepo.findTokenById(id);
    if (!found) throw new AppError(404, 'Token not found');
    await dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'cancelled', { reason });
  }
  async getPatientActiveStatus(patientId: string): Promise<PatientQueueStatus | null> {
    const token = await dynamoDbRepo.getActivePatientToken(patientId, clinicDate());
    if (!token) return null;
    const queue = await this.getDoctorQueue(token.doctorId),
      settings = await dynamoDbRepo.getSettings(token.clinicId);
    const waiting = (
      await dynamoDbRepo.getWaitingTokens(dynamoDbRepo.getQueueId(token.doctorId))
    ).filter(
      (t) =>
        t.priority === 'emergency' ||
        t.isWalkIn ||
        ['Now', 'Walk-in'].includes(t.scheduledTime) ||
        clockMinutes(t.scheduledTime) <=
          Math.max(
            clinicNowMinutes(),
            ['Now', 'Walk-in'].includes(token.scheduledTime)
              ? 0
              : clockMinutes(token.scheduledTime),
          ),
    );
    const current = queue.tokens.find((t) => t.status === 'current');
    const ahead =
      token.status === 'current'
        ? 0
        : Math.max(
            0,
            waiting.findIndex((t) => t.id === token.id),
          );
    const model = (await analyticsService.getModels(token.clinicId)).get(token.doctorId)!;
    const buffer = settings.bufferMinutes ?? 2;
    const remaining = current
      ? Math.max(
          1,
          predictDuration(model, current) -
            (Date.now() - Date.parse(current.calledAt || current.createdAt)) / 60000,
        )
      : 0;
    const aheadMinutes = waiting
      .slice(0, ahead)
      .reduce((sum, t) => sum + predictDuration(model, t) + buffer, 0);
    const wait =
      token.status === 'current' ? 0 : Math.ceil(aheadMinutes + remaining + (current ? buffer : 0));
    return {
      token,
      currentServingToken: current?.tokenNumber || null,
      patientsAhead: token.status === 'current' ? 0 : ahead + (current ? 1 : 0),
      estimatedWaitMinutes: wait,
      isPaused: queue.isPaused,
      prediction: {
        method: model.method,
        sampleCount: model.sampleCount,
        syntheticSamples: model.syntheticSamples,
        validationMaeMinutes: model.modelMae,
        modelVersion: model.modelVersion,
        isEstimate: true,
      },
    };
  }
}
export const queueService = new QueueService();
