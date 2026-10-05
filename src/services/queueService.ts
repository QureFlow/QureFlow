import { DoctorQueueState, QueueToken, QueuePriority } from '../types';
import { storage } from './storage';
import { apiClient } from './apiClient';

const isMockEnabled = () => import.meta.env.VITE_USE_MOCK_BACKEND === 'true';

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
    if (!isMockEnabled()) {
      try {
        return await apiClient.get<DoctorQueueState>(`/queues/doctor/${doctorId}`);
      } catch (err) {
        console.warn('[QueueService] Falling back to local queue state:', err);
      }
    }

    // Mock fallback
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
    if (!isMockEnabled()) {
      try {
        return await apiClient.get<DoctorQueueState[]>('/queues/all');
      } catch (err) {
        console.warn('[QueueService] Falling back to local doctor queues:', err);
      }
    }

    const doctors = storage.getDoctors();
    const queues: DoctorQueueState[] = [];
    for (const d of doctors) {
      const q = await this.getDoctorQueue(d.id);
      queues.push(q);
    }
    return queues;
  },

  async callNextPatient(doctorId: string): Promise<QueueToken | null> {
    if (!isMockEnabled()) {
      try {
        const token = await apiClient.post<QueueToken | null>('/queues/call-next', { doctorId });
        if (token) {
          const tokens = storage.getTokens();
          // Mark previous current as completed
          const prevIdx = tokens.findIndex((t) => t.doctorId === doctorId && t.status === 'current');
          if (prevIdx !== -1) {
            tokens[prevIdx].status = 'completed';
            tokens[prevIdx].servedAt = new Date().toISOString();
          }
          // Mark called token as current
          const newIdx = tokens.findIndex((t) => t.id === token.id);
          if (newIdx !== -1) {
            tokens[newIdx] = { ...tokens[newIdx], status: 'current', calledAt: token.calledAt || new Date().toISOString() };
          } else {
            tokens.push(token);
          }
          storage.saveTokens(tokens);
          return token;
        }
      } catch (err) {
        console.warn('[QueueService] API callNext failed, using local:', err);
      }
    }

    // Local fallback
    const tokens = storage.getTokens();
    const doctorTokens = tokens.filter((t) => t.doctorId === doctorId);

    const currentIdx = tokens.findIndex((t) => t.doctorId === doctorId && t.status === 'current');
    if (currentIdx !== -1) {
      tokens[currentIdx].status = 'completed';
      tokens[currentIdx].servedAt = new Date().toISOString();
    }

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
    if (!isMockEnabled()) {
      try {
        await apiClient.post(`/tokens/${tokenId}/serve`);
      } catch (err) {
        console.warn('[QueueService] API markServed failed, using local:', err);
      }
    }

    const tokens = storage.getTokens();
    const target = tokens.find((t) => t.id === tokenId);
    if (target) {
      target.status = 'completed';
      target.servedAt = new Date().toISOString();
      storage.saveTokens(tokens);

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
    if (!isMockEnabled()) {
      try {
        await apiClient.post(`/tokens/${tokenId}/skip`);
      } catch (err) {
        console.warn('[QueueService] API skip failed, using local:', err);
      }
    }

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
    if (!isMockEnabled()) {
      try {
        await apiClient.post(`/tokens/${tokenId}/cancel`);
      } catch (err) {
        console.warn('[QueueService] API cancelToken failed, using local:', err);
      }
    }

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
    if (!isMockEnabled()) {
      try {
        await apiClient.post('/queues/pause', { doctorId, paused: true });
      } catch (err) {
        console.warn('[QueueService] API pause failed, using local:', err);
      }
    }

    const paused = storage.getPausedDoctors();
    if (!paused.includes(doctorId)) {
      paused.push(doctorId);
      storage.savePausedDoctors(paused);
    }
  },

  async resumeQueue(doctorId: string): Promise<void> {
    if (!isMockEnabled()) {
      try {
        await apiClient.post('/queues/pause', { doctorId, paused: false });
      } catch (err) {
        console.warn('[QueueService] API resume failed, using local:', err);
      }
    }

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
    if (!isMockEnabled()) {
      try {
        const token = await apiClient.post<QueueToken>('/queues/join', {
          ...data,
          isWalkIn: true,
        });
        if (token) {
          const tokens = storage.getTokens();
          tokens.push(token);
          storage.saveTokens(tokens);
          return token;
        }
      } catch (err: any) {
        if (err.status && err.status >= 400 && err.status < 500) {
          throw err;
        }
        console.warn('[QueueService] API joinQueue failed, using local:', err);
      }
    }

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
    return newToken;
  },

  async getPatientActiveToken(patientIdOrPhone: string): Promise<{
    token: QueueToken;
    currentServingToken: string | null;
    patientsAhead: number;
    estimatedWaitMinutes: number;
    isPaused: boolean;
  } | null> {
    if (!isMockEnabled()) {
      try {
        const res = await apiClient.get<any>('/patients/me/status');
        if (res && res.token) return res;
      } catch (err) {
        console.warn('[QueueService] API getPatientActiveStatus failed, using local:', err);
      }
    }

    const tokens = storage.getTokens();
    const pausedDoctors = storage.getPausedDoctors();
    const settings = storage.getSettings();

    const token = tokens.find(
      (t) =>
        (t.patientId === patientIdOrPhone || t.patientPhone === patientIdOrPhone) &&
        (t.status === 'waiting' || t.status === 'current')
    );

    if (!token) return null;

    const docTokens = tokens.filter((t) => t.doctorId === token.doctorId);
    const currentToken = docTokens.find((t) => t.status === 'current');

    let patientsWaitingAhead = 0;
    if (token.status === 'waiting') {
      const waitingTokens = docTokens.filter((t) => t.status === 'waiting');
      const tokenIndex = waitingTokens.findIndex((t) => t.id === token.id);
      patientsWaitingAhead = tokenIndex >= 0 ? tokenIndex : 0;
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

    // p: total patients ahead including the active consultation patient
    const p = pactive === 1 ? patientsWaitingAhead + 1 : patientsWaitingAhead;

    let estimatedWaitMinutes = 0;
    if (token.status === 'current') {
      estimatedWaitMinutes = 0;
    } else if (p <= 0) {
      estimatedWaitMinutes = 0;
    } else {
      // Formula: tactive * pactive + (p - 1) * tavg + buffer
      const calculated = tactive * pactive + (p - 1) * tavg + buffer;
      estimatedWaitMinutes = Math.max(1, Math.round(calculated));
    }

    return {
      token,
      currentServingToken: currentToken ? currentToken.tokenNumber : null,
      patientsAhead: p,
      estimatedWaitMinutes,
      isPaused: pausedDoctors.includes(token.doctorId),
    };
  },

  async getTokenTimeline(doctorId: string): Promise<{
    completed: QueueToken[];
    current: QueueToken | null;
    waiting: QueueToken[];
  }> {
    const queue = await this.getDoctorQueue(doctorId);
    const tokens = queue.tokens;
    return {
      completed: tokens.filter((t) => t.status === 'completed').slice(-5),
      current: tokens.find((t) => t.status === 'current') || null,
      waiting: tokens.filter((t) => t.status === 'waiting'),
    };
  },
};
