import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { clinicDate } from '../lib/time.js';
import { trainDurationModel, DurationModel } from './predictionService.js';
const modelCache = new Map<string, { expires: number; models: Map<string, DurationModel> }>();
export const analyticsService = {
  async getModels(clinicId: string, refresh = false) {
    const cached = modelCache.get(clinicId);
    if (cached && cached.expires > Date.now() && !refresh) return cached.models;
    const [tokens, doctors, settings] = await Promise.all([
      dynamoDbRepo.getRecentTokens(clinicId),
      dynamoDbRepo.getDoctors(),
      dynamoDbRepo.getSettings(clinicId),
    ]);
    const models = new Map(
      doctors
        .filter((d) => d.clinicId === clinicId)
        .map((d) => [
          d.id,
          trainDurationModel(
            tokens.filter((t) => t.doctorId === d.id),
            settings.averageConsultationMinutes,
          ),
        ]),
    );
    modelCache.set(clinicId, { expires: Date.now() + 60000, models });
    return models;
  },
  async overview(clinicId: string) {
    const [tokens, doctors, settings, models, events] = await Promise.all([
      dynamoDbRepo.getRecentTokens(clinicId),
      dynamoDbRepo.getDoctors(),
      dynamoDbRepo.getSettings(clinicId),
      this.getModels(clinicId),
      dynamoDbRepo.getAuditEvents(clinicId, 30),
    ]);
    const today = clinicDate(),
      todayTokens = tokens.filter(
        (t) => (t.queueDate || clinicDate(new Date(t.createdAt))) === today,
      );
    const completed = tokens.filter((t) => t.status === 'completed' && t.calledAt && t.servedAt);
    const durations = completed
      .map((t) => (Date.parse(t.servedAt!) - Date.parse(t.calledAt!)) / 60000)
      .filter((v) => Number.isFinite(v) && v >= 0 && v <= 120);
    const average = durations.length
      ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
      : null;
    const trend = Array.from({ length: 14 }, (_, i) => {
      const date = clinicDate(new Date(Date.now() - (13 - i) * 86400000)),
        day = tokens.filter((t) => (t.queueDate || t.createdAt.slice(0, 10)) === date);
      return {
        date,
        total: day.length,
        completed: day.filter((t) => t.status === 'completed').length,
        cancelled: day.filter((t) => t.status === 'cancelled').length,
        noShow: day.filter((t) => t.status === 'skipped').length,
      };
    });
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
        cancellationCount: tokens.filter((t) => t.status === 'cancelled').length,
        noShowCount: tokens.filter((t) => t.status === 'skipped').length,
      },
      trend,
      doctors: doctors
        .filter((d) => d.clinicId === clinicId)
        .map((d) => ({
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
  async refreshModels(clinicId: string) {
    const models = await this.getModels(clinicId, true);
    for (const [id, model] of models) await dynamoDbRepo.saveModelMetadata(id, clinicId, model);
    return { success: true, modelsUpdated: models.size };
  },
};
