import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/*
 * Offline, reproducible evaluation of waiting-time estimation on simulated clinic sessions.
 * Nothing is read from or written to any database. Usage:
 *   npm run evaluate:model --prefix backend
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const DAYS = 60,
  EVALUATION_DAYS = 21,
  ANCHOR = Date.parse('2026-09-30T12:00:00+05:30'),
  BUFFER = 2,
  CONFIGURED_MINUTES = 12;

async function evaluate() {
  const { buildDemoDirectory, PATIENTS_PER_CLINIC } = await import('../demo/demoDirectory.js');
  const { simulateDay } = await import('../demo/simulation.js');
  const { clinicDate } = await import('../lib/time.js');
  const { backtestWaits, formulaPredictor, learnedPredictor } =
    await import('../services/waitBacktest.js');
  const { trainClinicModels, consultationSamples } =
    await import('../services/predictionService.js');
  const { legacyTrainDurationModel, legacyPredictDuration } = await import('./legacyRidge.js');
  type QueueToken = import('../models/types.js').QueueToken;
  type PredictorFactory = import('../services/waitBacktest.js').PredictorFactory;

  const { clinics, doctors, patients } = buildDemoDirectory();
  const byClinic = new Map<string, QueueToken[]>();
  for (const doctor of doctors) {
    const index = clinics.findIndex((c) => c.id === doctor.clinicId),
      seen = new Set<string>();
    for (let day = DAYS; day >= 1; day--) {
      const { tokens, appointments } = simulateDay({
        doctor,
        date: clinicDate(new Date(ANCHOR - day * 86400000)),
        dayIndex: DAYS - day,
        patients: patients.slice(index * PATIENTS_PER_CLINIC, (index + 1) * PATIENTS_PER_CLINIC),
        seenBefore: seen,
        idPrefix: 'eval',
      });
      const linked = new Set(appointments.map((a) => a.tokenId));
      byClinic.set(doctor.clinicId, [
        ...(byClinic.get(doctor.clinicId) || []),
        ...tokens.map((t) => ({
          ...t,
          appointmentId: linked.has(t.id) ? `apt-${t.id}` : undefined,
        })),
      ]);
    }
  }

  // The previous learned model, reproduced exactly as the queue service used it.
  const ridgeV1: PredictorFactory = (history, doctorIds) => {
    const models = new Map(
      doctorIds.map((id) => [
        id,
        legacyTrainDurationModel(
          history.filter((t) => t.doctorId === id),
          CONFIGURED_MINUTES,
        ),
      ]),
    );
    return (s) => {
      const model = models.get(s.target.doctorId)!;
      const remaining = s.current
        ? Math.max(
            1,
            legacyPredictDuration(model, s.current) -
              (s.at - Date.parse(s.current.calledAt!)) / 60000,
          )
        : 0;
      const ahead = s.ahead.reduce((sum, t) => sum + legacyPredictDuration(model, t) + BUFFER, 0);
      const minutes = Math.ceil(ahead + remaining + (s.current ? BUFFER : 0));
      return { minutes, low: minutes, high: minutes };
    };
  };
  const recent =
    (days: number, factory: PredictorFactory): PredictorFactory =>
    (history, ids) => {
      const latest = [...history.map((t) => t.queueDate!)].sort().pop()!;
      const cutoff = clinicDate(
        new Date(Date.parse(`${latest}T12:00:00+05:30`) - (days - 1) * 86400000),
      );
      return factory(
        history.filter((t) => t.queueDate! >= cutoff),
        ids,
      );
    };
  const learned = learnedPredictor(CONFIGURED_MINUTES, BUFFER);
  const predictors: Record<string, PredictorFactory> = {
    formula_original: formulaPredictor(CONFIGURED_MINUTES, BUFFER),
    ridge_v1: ridgeV1,
    queue_projection_configured_durations: learnedPredictor(CONFIGURED_MINUTES, BUFFER, {
      adjust: (m) => ({ ...m, method: 'configured' }),
    }),
    lognormal_v2_without_no_show: learnedPredictor(CONFIGURED_MINUTES, BUFFER, {
      adjust: (m) => ({ ...m, noShowRate: 0, walkInLeaveRate: 0 }),
    }),
    lognormal_v2_parametric_range: learnedPredictor(CONFIGURED_MINUTES, BUFFER, {
      calibrate: false,
    }),
    lognormal_v2: learned,
    lognormal_v2_history_3_days: recent(3, learned),
    lognormal_v2_history_7_days: recent(7, learned),
    lognormal_v2_history_14_days: recent(14, learned),
  };

  const errors: Record<string, { error: number; inRange: boolean; walkIn: boolean }[]> = {};
  for (const tokens of byClinic.values()) {
    const result = backtestWaits(tokens, {
      defaultMinutes: CONFIGURED_MINUTES,
      bufferMinutes: BUFFER,
      evaluationDays: EVALUATION_DAYS,
      predictors,
    });
    for (const [name, list] of Object.entries(result.errors)) (errors[name] ||= []).push(...list);
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  const mae = (list: { error: number }[]) =>
    round(list.reduce((s, e) => s + Math.abs(e.error), 0) / list.length);
  const byArrival = Object.fromEntries(
    Object.entries(errors).map(([name, list]) => [
      name,
      {
        walkInCases: list.filter((e) => e.walkIn).length,
        walkInMaeMinutes: mae(list.filter((e) => e.walkIn)),
        bookedCases: list.filter((e) => !e.walkIn).length,
        bookedMaeMinutes: mae(list.filter((e) => !e.walkIn)),
      },
    ]),
  );
  const scores = Object.fromEntries(
    Object.entries(errors).map(([name, list]) => {
      const abs = list.map((e) => Math.abs(e.error)).sort((a, b) => a - b);
      return [
        name,
        {
          cases: list.length,
          maeMinutes: round(abs.reduce((s, v) => s + v, 0) / abs.length),
          medianAbsoluteErrorMinutes: round(abs[Math.floor(abs.length / 2)]),
          rmseMinutes: round(Math.sqrt(list.reduce((s, e) => s + e.error ** 2, 0) / list.length)),
          meanBiasMinutes: round(list.reduce((s, e) => s + e.error, 0) / list.length),
          withinFiveMinutes: round(list.filter((e) => Math.abs(e.error) <= 5).length / list.length),
          withinTenMinutes: round(list.filter((e) => Math.abs(e.error) <= 10).length / list.length),
          rangeCoverage80: name.startsWith('lognormal')
            ? round(list.filter((e) => e.inRange).length / list.length)
            : null,
        },
      ];
    }),
  );

  // Consultation-duration accuracy on each doctor's most recent 20% of consultations.
  const durationStudy = {
    doctors: 0,
    selected: {} as Record<string, number>,
    maeByCandidate: {} as Record<string, number>,
  };
  const sums: Record<string, { total: number; n: number }> = {};
  let samples = 0;
  for (const [clinicId, tokens] of byClinic) {
    const ids = doctors.filter((d) => d.clinicId === clinicId).map((d) => d.id);
    samples += consultationSamples(tokens).length;
    for (const id of ids) {
      const legacy = legacyTrainDurationModel(
        tokens.filter((t) => t.doctorId === id),
        CONFIGURED_MINUTES,
      );
      const legacyMae = legacy.method === 'ridge_regression' ? legacy.modelMae : legacy.baselineMae;
      if (legacyMae !== null) {
        sums.ridge_v1 ||= { total: 0, n: 0 };
        sums.ridge_v1.total += legacyMae * legacy.validationCount;
        sums.ridge_v1.n += legacy.validationCount;
      }
    }
    for (const model of trainClinicModels(tokens, ids, CONFIGURED_MINUTES).values()) {
      durationStudy.doctors++;
      durationStudy.selected[model.method] = (durationStudy.selected[model.method] || 0) + 1;
      for (const [method, mae] of Object.entries(model.candidateMae)) {
        sums[method] ||= { total: 0, n: 0 };
        sums[method].total += mae! * model.validationCount;
        sums[method].n += model.validationCount;
      }
    }
  }
  for (const [method, { total, n }] of Object.entries(sums))
    durationStudy.maeByCandidate[method] = round(total / n);
  const allTokens = [...byClinic.values()].flat();
  const report = {
    generatedAt: new Date().toISOString(),
    dataset: {
      description: 'Simulated outpatient sessions (synthetic; no real patient data).',
      clinics: clinics.length,
      doctors: doctors.length,
      days: DAYS,
      evaluationDays: EVALUATION_DAYS,
      visits: allTokens.length,
      completedConsultations: samples,
      noShows: allTokens.filter((t) => t.status === 'skipped').length,
      cancellations: allTokens.filter((t) => t.status === 'cancelled').length,
      walkIns: allTokens.filter((t) => t.isWalkIn).length,
      emergencies: allTokens.filter((t) => t.priority === 'emergency').length,
      configuredMinutes: CONFIGURED_MINUTES,
      bufferMinutes: BUFFER,
    },
    waitTimeBacktest: scores,
    waitTimeByArrival: byArrival,
    consultationDuration: durationStudy,
  };
  const dir = path.resolve(
    process.cwd(),
    process.cwd().endsWith('backend') ? '../docs/evaluation' : 'docs/evaluation',
  );
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'wait-model-evaluation.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.dataset, null, 2));
  console.table(
    Object.fromEntries(
      Object.entries(scores).map(([name, s]) => [
        name,
        {
          MAE: s.maeMinutes,
          MedAE: s.medianAbsoluteErrorMinutes,
          RMSE: s.rmseMinutes,
          bias: s.meanBiasMinutes,
          '≤5m': s.withinFiveMinutes,
          '≤10m': s.withinTenMinutes,
          cover80: s.rangeCoverage80,
        },
      ]),
    ),
  );
  console.table(byArrival);
  console.log(durationStudy);
}
evaluate().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
