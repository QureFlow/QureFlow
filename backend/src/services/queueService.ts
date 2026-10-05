import { v4 as uuidv4 } from 'uuid';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import {
  QueueToken,
  DoctorQueueState,
  QueuePriority,
  TokenStatus,
  PatientQueueStatus,
} from '../models/types.js';

export class QueueService {
  private getDoctorPrefix(doctorId: string): string {
    const prefixes: Record<string, string> = {
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
    };
    return prefixes[doctorId] || 'Q';
  }

  /**
   * Concurrency-safe queue join.
   * Atomically increments token counter and indexes into QueueWaitingIndex and PatientIndex.
   */
  async joinQueue(data: {
    doctorId: string;
    patientId?: string;
    patientName: string;
    patientPhone: string;
    priority?: QueuePriority;
    isWalkIn?: boolean;
    scheduledTime?: string;
    appointmentId?: string;
    dateStr?: string;
  }): Promise<QueueToken> {
    const doc = await dynamoDbRepo.getDoctorById(data.doctorId);
    if (!doc) {
      throw new Error(`Doctor with ID ${data.doctorId} not found`);
    }

    const queueId = dynamoDbRepo.getQueueId(data.doctorId, data.dateStr);

    // Concurrency / Duplicate Check: Prevent duplicate active queue entry for same patient on same date
    if (data.patientId) {
      const activeToken = await dynamoDbRepo.getActivePatientToken(data.patientId, data.dateStr);
      if (activeToken && activeToken.status === 'waiting') {
        throw new Error(
          `Patient already has an active waiting token (${activeToken.tokenNumber}) in a consultation queue.`
        );
      }
    }

    // Atomic Counter Increment
    const { seq, paddedSeq } = await dynamoDbRepo.getNextTokenSequence(queueId);
    const prefix = this.getDoctorPrefix(data.doctorId);
    const tokenNumber = `${prefix}-${String(seq).padStart(3, '0')}`;

    const priority = data.priority || 'normal';
    const newToken: QueueToken = {
      id: `tok-${Date.now()}-${uuidv4().substring(0, 6)}`,
      tokenNumber,
      appointmentId: data.appointmentId,
      patientId: data.patientId,
      patientName: data.patientName.trim(),
      patientPhone: data.patientPhone.trim(),
      doctorId: doc.id,
      doctorName: doc.name,
      clinicId: doc.clinicId,
      clinicName: doc.clinicName,
      scheduledTime: data.scheduledTime || (data.isWalkIn ? 'Walk-in' : 'Now'),
      priority,
      isWalkIn: Boolean(data.isWalkIn),
      status: 'waiting',
      createdAt: new Date().toISOString(),
    };

    return dynamoDbRepo.createToken(newToken, queueId, seq);
  }

  /**
   * Retrieve doctor queue state with active tokens and current serving token
   */
  async getDoctorQueue(doctorId: string, dateStr?: string): Promise<DoctorQueueState> {
    const doc = await dynamoDbRepo.getDoctorById(doctorId);
    const queueId = dynamoDbRepo.getQueueId(doctorId, dateStr);
    const allTokens = await dynamoDbRepo.getAllTokensForQueue(queueId);
    const pausedDoctors = await dynamoDbRepo.getPausedDoctors();

    const currentToken = allTokens.find((t) => t.status === 'current');

    return {
      doctorId,
      doctorName: doc ? doc.name : 'Doctor',
      specialization: doc ? doc.specialization : 'OPD',
      clinicId: doc ? doc.clinicId : 'clinic-1',
      currentTokenNumber: currentToken ? currentToken.tokenNumber : null,
      isPaused: pausedDoctors.includes(doctorId),
      tokens: allTokens,
    };
  }

  /**
   * Doctor calls next patient.
   * Pulls the next highest priority waiting patient from QueueWaitingIndex.
   */
  async callNextPatient(doctorId: string, dateStr?: string): Promise<QueueToken | null> {
    const queueId = dynamoDbRepo.getQueueId(doctorId, dateStr);

    // 1. If there's an ongoing consultation, automatically complete it
    const allTokens = await dynamoDbRepo.getAllTokensForQueue(queueId);
    const currentToken = allTokens.find((t) => t.status === 'current');
    if (currentToken) {
      const found = await dynamoDbRepo.findTokenById(currentToken.id);
      if (found) {
        await dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'completed', {
          servedAt: new Date().toISOString(),
        });
        if (currentToken.appointmentId) {
          await dynamoDbRepo.updateAppointmentStatus(currentToken.appointmentId, 'completed');
        }
      }
    }

    // 2. Query next waiting token via QueueWaitingIndex (prioritizes EMERGENCY before NORMAL)
    const waitingTokens = await dynamoDbRepo.getWaitingTokens(queueId);
    if (waitingTokens.length === 0) {
      return null;
    }

    const nextToken = waitingTokens[0];
    const foundNext = await dynamoDbRepo.findTokenById(nextToken.id);
    if (!foundNext) return null;

    const nowIso = new Date().toISOString();
    const updated = await dynamoDbRepo.updateTokenStatus(foundNext.pk, foundNext.sk, 'current', {
      calledAt: nowIso,
    });

    if (nextToken.appointmentId) {
      await dynamoDbRepo.updateAppointmentStatus(nextToken.appointmentId, 'in_consultation');
    }

    return updated;
  }

  /**
   * Mark token as served/completed
   */
  async markPatientServed(tokenId: string): Promise<void> {
    const found = await dynamoDbRepo.findTokenById(tokenId);
    if (!found) throw new Error(`Token ${tokenId} not found`);

    await dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'completed', {
      servedAt: new Date().toISOString(),
    });

    if (found.token.appointmentId) {
      await dynamoDbRepo.updateAppointmentStatus(found.token.appointmentId, 'completed');
    }
  }

  /**
   * Skip patient (no-show)
   */
  async skipPatient(tokenId: string): Promise<void> {
    const found = await dynamoDbRepo.findTokenById(tokenId);
    if (!found) throw new Error(`Token ${tokenId} not found`);

    await dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'skipped');

    if (found.token.appointmentId) {
      await dynamoDbRepo.updateAppointmentStatus(found.token.appointmentId, 'no_show');
    }
  }

  /**
   * Cancel token
   */
  async cancelToken(tokenId: string): Promise<void> {
    const found = await dynamoDbRepo.findTokenById(tokenId);
    if (!found) throw new Error(`Token ${tokenId} not found`);

    await dynamoDbRepo.updateTokenStatus(found.pk, found.sk, 'cancelled');

    if (found.token.appointmentId) {
      await dynamoDbRepo.updateAppointmentStatus(found.token.appointmentId, 'cancelled');
    }
  }

  /**
   * Retrieve active patient queue status with calculated waiting time and position
   */
  async getPatientActiveStatus(patientIdOrPhone: string): Promise<PatientQueueStatus | null> {
    const settings = await dynamoDbRepo.getSettings();
    const pausedDoctors = await dynamoDbRepo.getPausedDoctors();

    // Look for active token by patientId
    let activeToken = await dynamoDbRepo.getActivePatientToken(patientIdOrPhone);

    // If not found by patientId, scan tokens matching phone with status waiting or current
    if (!activeToken) {
      const cleanPhone = patientIdOrPhone.replace(/[^0-9]/g, '');
      const today = new Date().toISOString().split('T')[0];
      // Search today's queues
      const doctors = await dynamoDbRepo.getDoctors();
      for (const d of doctors) {
        const qId = dynamoDbRepo.getQueueId(d.id, today);
        const tokens = await dynamoDbRepo.getAllTokensForQueue(qId);
        const match = tokens.find(
          (t) =>
            (t.patientPhone.replace(/[^0-9]/g, '').endsWith(cleanPhone) ||
              t.patientId === patientIdOrPhone) &&
            (t.status === 'waiting' || t.status === 'current')
        );
        if (match) {
          activeToken = match;
          break;
        }
      }
    }

    if (!activeToken) return null;

    const queueId = (activeToken as any).queueId || dynamoDbRepo.getQueueId(activeToken.doctorId);
    const waitingTokens = await dynamoDbRepo.getWaitingTokens(queueId);
    const allTokens = await dynamoDbRepo.getAllTokensForQueue(queueId);
    const currentToken = allTokens.find((t) => t.status === 'current');

    let patientsWaitingAhead = 0;
    if (activeToken.status === 'waiting') {
      const idx = waitingTokens.findIndex((t) => t.id === activeToken!.id);
      patientsWaitingAhead = idx >= 0 ? idx : 0;
    }

    const tavg = settings.averageConsultationMinutes || 7;
    const buffer = settings.bufferMinutes ?? 2;
    const pactive = currentToken ? 1 : 0;

    let tactive = 0;
    if (pactive === 1 && currentToken?.calledAt) {
      const elapsedMinutes = Math.floor(
        Math.max(0, Date.now() - new Date(currentToken.calledAt).getTime()) / 60000
      );
      tactive = Math.max(1, tavg - elapsedMinutes);
    } else if (pactive === 1) {
      tactive = tavg;
    }

    // p: Total patients ahead of this patient (including active consultation patient)
    const p = pactive === 1 ? patientsWaitingAhead + 1 : patientsWaitingAhead;

    let estimatedWaitMinutes = 0;
    if (activeToken.status === 'current') {
      estimatedWaitMinutes = 0;
    } else if (p <= 0) {
      estimatedWaitMinutes = 0;
    } else {
      // User formula: tactive * pactive + (p - 1) * tavg + buffer
      const calculated = tactive * pactive + (p - 1) * tavg + buffer;
      estimatedWaitMinutes = Math.max(1, Math.round(calculated));
    }

    return {
      token: activeToken,
      currentServingToken: currentToken ? currentToken.tokenNumber : null,
      patientsAhead: p,
      estimatedWaitMinutes,
      isPaused: pausedDoctors.includes(activeToken.doctorId),
    };
  }
}

export const queueService = new QueueService();
