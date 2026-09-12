import { DoctorQueueState, QueueToken, QueuePriority } from '../types';
import { storage } from './storage';

export const queueService = {
  getPrefixForDoctor(doctorId: string): string {
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
  },

  async generateNextTokenNumber(doctorId: string): Promise<string> {
    const prefix = this.getPrefixForDoctor(doctorId);
    const tokens = storage.getTokens().filter((t) => t.doctorId === doctorId);

    let maxNum = 0;
    for (const t of tokens) {
      const match = t.tokenNumber.match(/^[A-Z]-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const nextNum = maxNum === 0 ? 1 : maxNum + 1;
    return `${prefix}-${String(nextNum).padStart(3, '0')}`;
  },

  async getDoctorQueue(doctorId: string): Promise<DoctorQueueState> {
    const doctors = storage.getDoctors();
    const doc = doctors.find((d) => d.id === doctorId);
    const allTokens = storage.getTokens().filter((t) => t.doctorId === doctorId);
    const pausedDoctors = storage.getPausedDoctors();

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
  },

  async getAllDoctorQueues(): Promise<DoctorQueueState[]> {
    const doctors = storage.getDoctors();
    const queues: DoctorQueueState[] = [];
    for (const d of doctors) {
      const q = await this.getDoctorQueue(d.id);
      queues.push(q);
    }
    return queues;
  },

  async callNextPatient(doctorId: string): Promise<QueueToken | null> {
    const tokens = storage.getTokens();
    const doctorTokens = tokens.filter((t) => t.doctorId === doctorId);

    // If there is an active currently serving patient, mark them as completed
    const currentIdx = tokens.findIndex((t) => t.doctorId === doctorId && t.status === 'current');
    if (currentIdx !== -1) {
      tokens[currentIdx].status = 'completed';
      tokens[currentIdx].servedAt = new Date().toISOString();
    }

    // Find next waiting patient: check emergency first, then normal waiting in order
    const nextEmergency = doctorTokens.find(
      (t) => t.status === 'waiting' && t.priority === 'emergency'
    );
    const nextWaiting = nextEmergency || doctorTokens.find((t) => t.status === 'waiting');

    if (!nextWaiting) {
      storage.saveTokens(tokens);
      return null;
    }

    const nextIdx = tokens.findIndex((t) => t.id === nextWaiting.id);
    if (nextIdx !== -1) {
      tokens[nextIdx].status = 'current';
      tokens[nextIdx].calledAt = new Date().toISOString();
      storage.saveTokens(tokens);

      // Also update linked appointment status if any
      if (tokens[nextIdx].appointmentId) {
        const apts = storage.getAppointments();
        const apt = apts.find((a) => a.id === tokens[nextIdx].appointmentId);
        if (apt) {
          apt.status = 'in_consultation';
          storage.saveAppointments(apts);
        }
      }

      return tokens[nextIdx];
    }

    storage.saveTokens(tokens);
    return null;
  },

  async markPatientServed(tokenId: string): Promise<void> {
    const tokens = storage.getTokens();
    const target = tokens.find((t) => t.id === tokenId);
    if (target) {
      target.status = 'completed';
      target.servedAt = new Date().toISOString();
      storage.saveTokens(tokens);

      // Update linked appointment
      if (target.appointmentId) {
        const apts = storage.getAppointments();
        const apt = apts.find((a) => a.id === target.appointmentId);
        if (apt) {
          apt.status = 'completed';
          storage.saveAppointments(apts);
        }
      }
    }
  },

  async skipPatient(tokenId: string): Promise<void> {
    const tokens = storage.getTokens();
    const target = tokens.find((t) => t.id === tokenId);
    if (target) {
      target.status = 'skipped';
      storage.saveTokens(tokens);

      if (target.appointmentId) {
        const apts = storage.getAppointments();
        const apt = apts.find((a) => a.id === target.appointmentId);
        if (apt) {
          apt.status = 'no_show';
          storage.saveAppointments(apts);
        }
      }
    }
  },

  async cancelToken(tokenId: string): Promise<void> {
    const tokens = storage.getTokens();
    const target = tokens.find((t) => t.id === tokenId);
    if (target) {
      target.status = 'cancelled';
      storage.saveTokens(tokens);

      if (target.appointmentId) {
        const apts = storage.getAppointments();
        const apt = apts.find((a) => a.id === target.appointmentId);
        if (apt) {
          apt.status = 'cancelled';
          storage.saveAppointments(apts);
        }
      }
    }
  },

  async pauseQueue(doctorId: string): Promise<void> {
    const paused = storage.getPausedDoctors();
    if (!paused.includes(doctorId)) {
      paused.push(doctorId);
      storage.savePausedDoctors(paused);
    }
  },

  async resumeQueue(doctorId: string): Promise<void> {
    const paused = storage.getPausedDoctors().filter((id) => id !== doctorId);
    storage.savePausedDoctors(paused);
  },

  async addWalkInPatient(data: {
    patientName: string;
    patientPhone: string;
    doctorId: string;
    time?: string;
    priority?: QueuePriority;
  }): Promise<QueueToken> {
    const doctors = storage.getDoctors();
    const doc = doctors.find((d) => d.id === data.doctorId);
    if (!doc) throw new Error('Selected doctor not found');

    const tokenNumber = await this.generateNextTokenNumber(data.doctorId);
    const tokens = storage.getTokens();
    const priority = data.priority || 'normal';

    const newToken: QueueToken = {
      id: `tok-walkin-${Date.now()}`,
      tokenNumber,
      patientName: data.patientName.trim(),
      patientPhone: data.patientPhone.trim(),
      doctorId: doc.id,
      doctorName: doc.name,
      clinicId: doc.clinicId,
      clinicName: doc.clinicName,
      scheduledTime: data.time || 'Walk-in',
      priority,
      isWalkIn: true,
      status: 'waiting',
      createdAt: new Date().toISOString(),
    };

    // If emergency, put near front of waiting list
    if (priority === 'emergency') {
      const currentIdx = tokens.findIndex((t) => t.doctorId === doc.id && t.status === 'current');
      if (currentIdx !== -1) {
        tokens.splice(currentIdx + 1, 0, newToken);
      } else {
        tokens.unshift(newToken);
      }
    } else {
      tokens.push(newToken);
    }

    storage.saveTokens(tokens);

    // Also register a walk-in appointment record so reception has complete audit trail
    const apts = storage.getAppointments();
    const todayStr = new Date().toISOString().split('T')[0];
    apts.unshift({
      id: `apt-walkin-${Date.now()}`,
      patientId: `walkin-${Date.now()}`,
      patientName: data.patientName.trim(),
      patientPhone: data.patientPhone.trim(),
      doctorId: doc.id,
      doctorName: doc.name,
      doctorSpecialization: doc.specialization,
      clinicId: doc.clinicId,
      clinicName: doc.clinicName,
      date: todayStr,
      time: data.time || 'Walk-in',
      tokenNumber,
      status: 'waiting',
      priority,
      isWalkIn: true,
      notes: priority === 'emergency' ? 'EMERGENCY TRIAGE WALK-IN' : 'Routine walk-in reception entry',
      createdAt: new Date().toISOString(),
    });
    storage.saveAppointments(apts);

    return newToken;
  },

  async getPatientActiveToken(patientIdOrPhone: string): Promise<{
    token: QueueToken;
    currentServingToken: string | null;
    patientsAhead: number;
    estimatedWaitMinutes: number;
    isPaused: boolean;
  } | null> {
    const tokens = storage.getTokens();
    const pausedDoctors = storage.getPausedDoctors();
    const settings = storage.getSettings();

    // Find the patient's active or waiting token
    const token = tokens.find(
      (t) =>
        (t.patientId === patientIdOrPhone || t.patientPhone === patientIdOrPhone) &&
        (t.status === 'waiting' || t.status === 'current')
    );

    if (!token) return null;

    const docTokens = tokens.filter((t) => t.doctorId === token.doctorId);
    const currentToken = docTokens.find((t) => t.status === 'current');

    // Count waiting patients ahead of this token
    let patientsAhead = 0;
    if (token.status === 'waiting') {
      const waitingTokens = docTokens.filter((t) => t.status === 'waiting');
      const tokenIndex = waitingTokens.findIndex((t) => t.id === token.id);
      patientsAhead = tokenIndex >= 0 ? tokenIndex : 0;
    }

    const estimatedWaitMinutes = Math.max(
      patientsAhead * (settings.averageConsultationMinutes || 7),
      token.status === 'current' ? 0 : 5
    );

    return {
      token,
      currentServingToken: currentToken ? currentToken.tokenNumber : null,
      patientsAhead,
      estimatedWaitMinutes,
      isPaused: pausedDoctors.includes(token.doctorId),
    };
  },

  async getTokenTimeline(doctorId: string): Promise<{
    completed: QueueToken[];
    current: QueueToken | null;
    waiting: QueueToken[];
  }> {
    const tokens = storage.getTokens().filter((t) => t.doctorId === doctorId);
    return {
      completed: tokens.filter((t) => t.status === 'completed').slice(-5), // show recent 5
      current: tokens.find((t) => t.status === 'current') || null,
      waiting: tokens.filter((t) => t.status === 'waiting'),
    };
  },
};
