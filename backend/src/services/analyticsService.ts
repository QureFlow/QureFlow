import { db } from '../repositories/repository.js';
import { clinicDate } from '../lib/time.js';
import { trainClinicModels, DurationModel, WaitCalibration } from './predictionService.js';
import { backtestWaits, calibrateWaits } from './waitBacktest.js';
import { QueueSettings, QueueToken } from '../models/types.js';

interface ClinicModels {
  expires: number;
  models: Map<string, DurationModel>;
  /** Per doctor, the patients with a completed consultation; kept in memory only. */
  returning: Map<string, Set<string>>;
  calibration: WaitCalibration;
}
const modelCache = new Map<string, ClinicModels>();
const accuracyCache = new Map<
  string,
  { expires: number; summary: ReturnType<typeof backtestWaits>['summary'] }
>();
const HISTORY_DAYS = 90;

function returningPatients(tokens: QueueToken[]) {
  const returning = new Map<string, Set<string>>();
  for (const t of tokens)
    if (t.status === 'completed' && t.patientId) {
      if (!returning.has(t.doctorId)) returning.set(t.doctorId, new Set());
      returning.get(t.doctorId)!.add(t.patientId);
    }
  return returning;
}

export const analyticsService = {
  async getClinicModels(clinicId: string, refresh = false): Promise<ClinicModels> {
    const cached = modelCache.get(clinicId);
    if (cached && cached.expires > Date.now() && !refresh) return cached;
    const [tokens, doctors, settings] = await Promise.all([
      db.getRecentTokens(clinicId, HISTORY_DAYS),
      db.getDoctors(),
      db.getSettings(clinicId),
    ]);
    const models = trainClinicModels(
      tokens,
      doctors.filter((d) => d.clinicId === clinicId).map((d) => d.id),
      settings.averageConsultationMinutes,
    );
    const entry = {
      expires: Date.now() + 60000,
      models,
      returning: returningPatients(tokens),
      calibration: calibrateWaits(tokens, models, settings.bufferMinutes ?? 2),
    };
    modelCache.set(clinicId, entry);
    return entry;
  },
  async getModels(clinicId: string, refresh = false) {
    return (await this.getClinicModels(clinicId, refresh)).models;
  },
  async overview(clinicId: string) {
    const [tokens, doctors, settings, models, events] = await Promise.all([
      db.getRecentTokens(clinicId, HISTORY_DAYS),
      db.getDoctors(),
      db.getSettings(clinicId),
      this.getModels(clinicId),
      db.getAuditEvents(clinicId, 30),
    ]);
    const today = clinicDate(),
      cutoff = clinicDate(new Date(Date.now() - 30 * 86400000)),
      recent = tokens.filter((t) => (t.queueDate || t.createdAt.slice(0, 10)) >= cutoff),
      todayTokens = recent.filter(
        (t) => (t.queueDate || clinicDate(new Date(t.createdAt))) === today,
      );
    const completed = recent.filter((t) => t.status === 'completed' && t.calledAt && t.servedAt);
    const durations = completed
      .map((t) => (Date.parse(t.servedAt!) - Date.parse(t.calledAt!)) / 60000)
      .filter((v) => Number.isFinite(v) && v >= 0 && v <= 120);
    const average = durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : null;
    const trend = Array.from({ length: 14 }, (_, i) => {
      const date = clinicDate(new Date(Date.now() - (13 - i) * 86400000)),
        day = recent.filter((t) => (t.queueDate || t.createdAt.slice(0, 10)) === date);
      return {
        date,
        total: day.length,
        completed: day.filter((t) => t.status === 'completed').length,
        cancelled: day.filter((t) => t.status === 'cancelled').length,
        noShow: day.filter((t) => t.status === 'skipped').length,
      };
    });
    const clinicDoctors = doctors.filter((d) => d.clinicId === clinicId);
    return {
      clinicId,
      generatedAt: new Date().toISOString(),
      windowDays: 30,
      timeZone: 'Asia/Kolkata',
      syntheticData: tokens.some((t) => t.metadata?.synthetic === true),
      summary: {
        waiting: todayTokens.filter((t) => t.status === 'waiting').length,
        inConsultation: todayTokens.filter((t) => t.status === 'current').length,
        completedToday: todayTokens.filter((t) => t.status === 'completed').length,
        consultationsObserved: durations.length,
        averageConsultationMinutes: average,
        cancellationCount: recent.filter((t) => t.status === 'cancelled').length,
        noShowCount: recent.filter((t) => t.status === 'skipped').length,
      },
      trend,
      waitAccuracy: await this.waitAccuracy(clinicId, tokens, settings),
      doctors: clinicDoctors.map((d) => ({
        id: d.id,
        name: d.name,
        specialization: d.specialization,
        status: d.status,
        waiting: todayTokens.filter((t) => t.doctorId === d.id && t.status === 'waiting').length,
        model: models.get(d.id),
        configuredMinutes: settings.averageConsultationMinutes,
      })),
      audit: events,
    };
  },
  /**
   * Replays the clinic's most recent days: what each method would have told arriving patients,
   * against the wait they actually had. Cached because it retrains once per replayed day.
   */
  async waitAccuracy(clinicId: string, tokens: QueueToken[], settings: QueueSettings) {
    const cached = accuracyCache.get(clinicId);
    if (cached && cached.expires > Date.now()) return cached.summary;
    const summary = backtestWaits(tokens, {
      defaultMinutes: settings.averageConsultationMinutes,
      bufferMinutes: settings.bufferMinutes ?? 2,
      evaluationDays: 7,
    }).summary;
    accuracyCache.set(clinicId, { expires: Date.now() + 10 * 60000, summary });
    return summary;
  },
  async refreshModels(clinicId: string) {
    accuracyCache.delete(clinicId);
    const models = await this.getModels(clinicId, true);
    for (const [id, model] of models) await db.saveModelMetadata(id, clinicId, model);
    return { success: true, modelsUpdated: models.size };
  },
};
