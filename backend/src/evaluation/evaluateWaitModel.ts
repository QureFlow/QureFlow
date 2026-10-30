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
  // EVAL_ANCHOR and EVAL_SEED replay a different simulated period as a holdout check.
  ANCHOR = Date.parse(process.env.EVAL_ANCHOR || '2026-09-30T12:00:00+05:30'),
  BUFFER = 2,
  CONFIGURED_MINUTES = 12;

async function evaluate() {
  const { buildDemoDirectory, PATIENTS_PER_CLINIC } = await import('../demo/demoDirectory.js');
  const { simulateDay } = await import('../demo/simulation.js');
  const { clinicDate } = await import('../lib/time.js');
  const { backtestWaits, formulaPredictor, learnedPredictor, snapshots } =
    await import('../services/waitBacktest.js');
  const { trainClinicModels, consultationSamples } =
    await import('../services/predictionService.js');
  const { legacyTrainDurationModel, legacyPredictDuration } = await import('./legacyRidge.js');
  const {
    queueLengthPredictor,
    queueLengthWithFeedbackPredictor,
    lastToEnterServicePredictor,
    rollingAveragePredictor,
  } = await import('./practiceBaselines.js');
  const {
    qLassoPredictor,
    quantileRegressionPredictor,
    gradientBoostingPredictor,
    linearRegressionPredictor,
    projectionBoostingPredictor,
  } = await import('./researchBaselines.js');
  const { erlangCPredictor } = await import('./queueingBaselines.js');
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
        idPrefix: process.env.EVAL_SEED || 'eval',
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
    // Estimators documented as used in practice (see practiceBaselines.ts for sources).
    practice_queue_length: queueLengthPredictor(CONFIGURED_MINUTES, BUFFER),
    practice_queue_length_feedback: queueLengthWithFeedbackPredictor(CONFIGURED_MINUTES, BUFFER),
    practice_last_to_enter_service: lastToEnterServicePredictor(CONFIGURED_MINUTES, BUFFER),
    practice_rolling_average_1h: rollingAveragePredictor(1, CONFIGURED_MINUTES, BUFFER),
    practice_rolling_average_2h: rollingAveragePredictor(2, CONFIGURED_MINUTES, BUFFER),
    practice_rolling_average_4h: rollingAveragePredictor(4, CONFIGURED_MINUTES, BUFFER),
    // Steady-state queueing theory (see queueingBaselines.ts).
    theory_erlang_c: erlangCPredictor(CONFIGURED_MINUTES, BUFFER),
    // Learned predictors from the research literature (see researchBaselines.ts for sources).
    research_linear_regression: linearRegressionPredictor(CONFIGURED_MINUTES, BUFFER),
    research_q_lasso: qLassoPredictor(CONFIGURED_MINUTES, BUFFER),
    research_quantile_regression: quantileRegressionPredictor(CONFIGURED_MINUTES, BUFFER),
    research_gradient_boosting: gradientBoostingPredictor(CONFIGURED_MINUTES, BUFFER),
    proposed_projection_boosting: projectionBoostingPredictor(CONFIGURED_MINUTES, BUFFER),
    formula_original: formulaPredictor(CONFIGURED_MINUTES, BUFFER),
    // The service trained the previous model on the last 30 days of visits.
    ridge_v1: recent(30, ridgeV1),
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

  type CaseError = {
    error: number;
    actual: number;
    inRange: boolean;
    walkIn: boolean;
    cluster: string;
  };
  const errors: Record<string, CaseError[]> = {};
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
  const sse = (list: CaseError[]) => list.reduce((s, e) => s + e.error ** 2, 0);
  const sst = (list: CaseError[]) => {
    const mean = list.reduce((s, e) => s + e.actual, 0) / list.length;
    return list.reduce((s, e) => s + (e.actual - mean) ** 2, 0);
  };
  const longWaits = (list: CaseError[]) => list.filter((e) => e.actual >= 5);
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
          rSquared: round(1 - sse(list) / sst(list)),
          // Percentage errors explode for waits near zero, so MAPE covers waits of 5 min or more.
          mapePercentWaitsAtLeast5: round(
            (100 * longWaits(list).reduce((s, e) => s + Math.abs(e.error) / e.actual, 0)) /
              longWaits(list).length,
          ),
          rangeCoverage80:
            name.startsWith('lognormal') || name.startsWith('proposed')
              ? round(list.filter((e) => e.inRange).length / list.length)
              : null,
        },
      ];
    }),
  );

  // Paired cluster bootstrap of MAE differences. Every method is scored on the same cases in the
  // same order, and whole doctor-sessions are resampled because errors within one are correlated.
  const bootstrap = (method: string, baseline: string, resamples = 2000) => {
    const a = errors[method],
      b = errors[baseline];
    const clusters = new Map<string, { diff: number; n: number }>();
    a.forEach((e, i) => {
      const c = clusters.get(e.cluster) || { diff: 0, n: 0 };
      c.diff += Math.abs(e.error) - Math.abs(b[i].error);
      c.n++;
      clusters.set(e.cluster, c);
    });
    const list = [...clusters.values()];
    let seed = 20261030;
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const draws: number[] = [];
    for (let r = 0; r < resamples; r++) {
      let diff = 0,
        n = 0;
      for (let k = 0; k < list.length; k++) {
        const c = list[Math.floor(random() * list.length)];
        diff += c.diff;
        n += c.n;
      }
      draws.push(diff / n);
    }
    draws.sort((x, y) => x - y);
    const observed = list.reduce((s, c) => s + c.diff, 0) / list.reduce((s, c) => s + c.n, 0);
    return {
      method,
      baseline,
      sessions: list.length,
      resamples,
      maeDifferenceMinutes: round(observed),
      ci95Minutes: [round(draws[Math.floor(resamples * 0.025)]), round(draws[Math.floor(resamples * 0.975)])],
      shareOfResamplesNotBetter: round(draws.filter((d) => d >= 0).length / resamples),
    };
  };
  const significance = [
    'research_gradient_boosting',
    'research_quantile_regression',
    'practice_queue_length',
    'theory_erlang_c',
    'research_linear_regression',
  ].map((baseline) => bootstrap('proposed_projection_boosting', baseline));

  // Consultation-duration accuracy on each doctor's most recent 20% of consultations.
  const durationStudy = {
    doctors: 0,
    selected: {} as Record<string, number>,
    maeByCandidate: {} as Record<string, number>,
  };
  const sums: Record<string, { total: number; n: number }> = {};
  const observedMeans: { method: string; meanMinutes: number }[] = [];
  let samples = 0;
  for (const [clinicId, tokens] of byClinic) {
    const ids = doctors.filter((d) => d.clinicId === clinicId).map((d) => d.id);
    samples += consultationSamples(tokens).length;
    // The previous model is scored on exactly the same held-out consultations as the others:
    // it is trained on each doctor's first 80% of consultations, as trainDurationModel splits.
    for (const id of ids) {
      const doctorSamples = consultationSamples(tokens.filter((t) => t.doctorId === id));
      if (doctorSamples.length < 10) continue;
      const split = Math.floor(doctorSamples.length * 0.8);
      const legacy = legacyTrainDurationModel(
        doctorSamples.slice(0, split).map((s) => s.token),
        CONFIGURED_MINUTES,
      );
      const validation = doctorSamples.slice(split);
      sums.ridge_v1 ||= { total: 0, n: 0 };
      for (const s of validation)
        sums.ridge_v1.total += Math.abs(s.y - legacyPredictDuration(legacy, s.token));
      sums.ridge_v1.n += validation.length;
    }
    for (const [id, model] of trainClinicModels(tokens, ids, CONFIGURED_MINUTES)) {
      durationStudy.doctors++;
      const own = consultationSamples(tokens.filter((t) => t.doctorId === id));
      observedMeans.push({
        method: model.method,
        meanMinutes: own.reduce((sum, x) => sum + x.y, 0) / own.length,
      });
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
  // Observed mean consultation length of the doctors for whom each method was selected.
  const observedMeanByMethod = Object.fromEntries(
    [...new Set(observedMeans.map((o) => o.method))].map((method) => {
      const list = observedMeans.filter((o) => o.method === method).map((o) => o.meanMinutes);
      return [
        method,
        {
          doctors: list.length,
          minMinutes: round(Math.min(...list)),
          maxMinutes: round(Math.max(...list)),
        },
      ];
    }),
  );
  const allTokens = [...byClinic.values()].flat();
  // How long patients actually waited on the evaluation days, to put errors in proportion.
  const evaluatedDays = new Set(
    [...new Set(allTokens.map((t) => t.queueDate!))].sort().slice(-EVALUATION_DAYS),
  );
  const waits: { minutes: number; walkIn: boolean }[] = [];
  for (const doctor of doctors) {
    const own = allTokens.filter((t) => t.doctorId === doctor.id && evaluatedDays.has(t.queueDate!));
    for (const day of evaluatedDays)
      for (const s of snapshots(own.filter((t) => t.queueDate === day), new Set()))
        waits.push({
          minutes: (Date.parse(s.target.calledAt!) - s.at) / 60000,
          walkIn: s.target.isWalkIn,
        });
  }
  const waitStats = (list: number[]) => {
    const sorted = [...list].sort((a, b) => a - b);
    return {
      cases: sorted.length,
      meanMinutes: round(sorted.reduce((sum, v) => sum + v, 0) / sorted.length),
      medianMinutes: round(sorted[Math.floor(sorted.length / 2)]),
      p90Minutes: round(sorted[Math.floor(sorted.length * 0.9)]),
    };
  };
  const actualWaits = {
    all: waitStats(waits.map((w) => w.minutes)),
    walkIn: waitStats(waits.filter((w) => w.walkIn).map((w) => w.minutes)),
    booked: waitStats(waits.filter((w) => !w.walkIn).map((w) => w.minutes)),
  };
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
    significance,
    consultationDuration: { ...durationStudy, observedMeanByMethod },
    actualWaits,
  };
  const dir = path.resolve(
    process.cwd(),
    process.cwd().endsWith('backend') ? '../docs/evaluation' : 'docs/evaluation',
  );
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, process.env.EVAL_OUT || 'wait-model-evaluation.json'),
    JSON.stringify(report, null, 2),
  );
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
          R2: s.rSquared,
          MAPE5: s.mapePercentWaitsAtLeast5,
        },
      ]),
    ),
  );
  console.table(byArrival);
  console.log(durationStudy);
  console.table(significance);
}
evaluate().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
