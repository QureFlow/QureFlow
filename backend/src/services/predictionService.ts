import { QueueToken } from '../models/types.js';

/**
 * Consultation-duration and waiting-time estimation.
 *
 * Durations are modelled as log-normal: ln(D) = x·β + ε, ε ~ N(0, σ²). Coefficients are fitted
 * by recency-weighted ridge regression that shrinks each doctor toward a clinic-wide model, so
 * a doctor with little history borrows strength from colleagues and recent weeks count more
 * than old ones. Everything is closed-form and inspectable; nothing here triages patients.
 */
export type DurationMethod = 'configured' | 'doctor_history' | 'hierarchical_lognormal';
export interface DurationModel {
  method: DurationMethod;
  sampleCount: number;
  trainingCount: number;
  validationCount: number;
  /** Mean absolute error of the configured clinic average on held-out consultations. */
  baselineMae: number | null;
  /** Mean absolute error of the selected method on the same held-out consultations. */
  modelMae: number | null;
  candidateMae: Partial<Record<DurationMethod, number>>;
  featureNames: string[];
  coefficients: number[];
  sigma: number;
  historyMinutes: number | null;
  /** Smoothed probability that a booked patient is not seen (no-show or same-day cancellation). */
  noShowRate: number;
  /** Smoothed probability that a walk-in leaves before being called. */
  walkInLeaveRate: number;
  defaultMinutes: number;
  halfLifeDays: number;
  modelVersion: string;
  trainedAt: string;
  syntheticSamples: number;
}
export interface PredictionContext {
  /** Clock time at which the consultation is expected to start. */
  at?: number;
  /** Patients who already completed a consultation with this doctor. */
  returningPatients?: Set<string>;
  /** Known encounter type, when the caller has already derived it. */
  firstVisit?: number;
}

export const MODEL_VERSION = 'consultation-lognormal-v2';
export const FEATURE_NAMES = [
  'intercept',
  'walk_in',
  'emergency',
  'first_visit',
  'hour',
  'hour_squared',
];
const HALF_LIFE_DAYS = 21;
const MIN_VALIDATED_SAMPLES = 10;
const DOCTOR_SHRINKAGE = 6; // prior strength, in effective consultations
const CLINIC_SHRINKAGE = 3;
const Z80 = 1.2816;
const clamp = (v: number, low = 1, high = 90) => Math.max(low, Math.min(high, v));

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const istHour = (ms: number) => {
  const parts = clockFormat.format(new Date(ms)).split(':');
  return Number(parts[0]) + Number(parts[1]) / 60;
};
const isFirstVisit = (token: QueueToken, returning?: Set<string>) => {
  const recorded = token.metadata?.encounterType;
  if (recorded === 'first_visit') return 1;
  if (recorded === 'follow_up') return 0;
  return token.patientId && returning?.has(token.patientId) ? 0 : 1;
};
export function features(token: QueueToken, context: PredictionContext = {}): number[] {
  const h = (istHour(context.at ?? Date.parse(token.calledAt || token.createdAt)) - 13) / 4;
  return [
    1,
    token.isWalkIn ? 1 : 0,
    token.priority === 'emergency' ? 1 : 0,
    context.firstVisit ?? isFirstVisit(token, context.returningPatients),
    h,
    h * h,
  ];
}

/** Log-scale location (μ) of a consultation; its median is exp(μ). */
export function logLocation(model: DurationModel, token: QueueToken, context?: PredictionContext) {
  // The configured figure is the clinic's stated average, so it is the mean, not the median.
  if (model.method === 'configured')
    return Math.log(model.defaultMinutes) - effectiveSigma(model) ** 2 / 2;
  if (model.method === 'doctor_history') return Math.log(model.historyMinutes!);
  return features(token, context).reduce((sum, x, i) => sum + x * model.coefficients[i], 0);
}
const effectiveSigma = (model: DurationModel) =>
  model.method === 'configured' ? 0.35 : model.sigma;
/** Expected consultation length in minutes (the log-normal mean). */
export const predictDuration = (
  model: DurationModel,
  token: QueueToken,
  context?: PredictionContext,
) => clamp(Math.exp(logLocation(model, token, context) + effectiveSigma(model) ** 2 / 2));

interface Sample {
  token: QueueToken;
  y: number;
  servedAt: number;
  firstVisit: number;
}
/** Valid completed consultations, oldest first, labelled first visit or follow-up. */
export function consultationSamples(tokens: QueueToken[]): Sample[] {
  const ordered = tokens
    .filter((t) => t.status === 'completed' && t.calledAt && t.servedAt)
    .map((t) => ({ token: t, y: (Date.parse(t.servedAt!) - Date.parse(t.calledAt!)) / 60000 }))
    .filter((s) => Number.isFinite(s.y) && s.y >= 1 && s.y <= 90)
    .sort((a, b) => a.token.servedAt!.localeCompare(b.token.servedAt!));
  const seen = new Set<string>();
  return ordered.map(({ token, y }) => {
    const key = `${token.doctorId}|${token.patientId}`;
    const firstVisit = isFirstVisit(
      token,
      token.patientId && seen.has(key) ? new Set([token.patientId]) : undefined,
    );
    if (token.patientId) seen.add(key);
    return { token, y, servedAt: Date.parse(token.servedAt!), firstVisit };
  });
}
const sampleFeatures = (s: Sample) => features(s.token, { firstVisit: s.firstVisit });
const recencyWeights = (samples: Sample[]) => {
  const latest = Math.max(...samples.map((s) => s.servedAt));
  return samples.map((s) => 0.5 ** ((latest - s.servedAt) / 86400000 / HALF_LIFE_DAYS));
};

/** Solves (XᵀWX + λI)β = XᵀWy + λβ₀ by Gauss–Jordan elimination with partial pivoting. */
function ridgeTowardPrior(samples: Sample[], prior: number[], lambda: number) {
  const width = prior.length,
    weights = recencyWeights(samples);
  const m = Array.from({ length: width }, (_, i) =>
    Array.from({ length: width + 1 }, (_, j) =>
      j === i ? lambda : j === width ? lambda * prior[i] : 0,
    ),
  );
  samples.forEach((s, k) => {
    const x = sampleFeatures(s),
      y = Math.log(s.y),
      w = weights[k];
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < width; j++) m[i][j] += w * x[i] * x[j];
      m[i][width] += w * x[i] * y;
    }
  });
  for (let col = 0; col < width; col++) {
    let pivot = col;
    for (let row = col + 1; row < width; row++)
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    const divisor = m[col][col];
    if (Math.abs(divisor) < 1e-12) return null;
    for (let j = col; j <= width; j++) m[col][j] /= divisor;
    for (let row = 0; row < width; row++)
      if (row !== col) {
        const factor = m[row][col];
        for (let j = col; j <= width; j++) m[row][j] -= factor * m[col][j];
      }
  }
  const beta = m.map((row) => row[width]);
  let squared = 0,
    total = 0;
  samples.forEach((s, k) => {
    const r = Math.log(s.y) - sampleFeatures(s).reduce((sum, x, i) => sum + x * beta[i], 0);
    squared += weights[k] * r * r;
    total += weights[k];
  });
  return { beta, sigma: Math.sqrt(squared / Math.max(total, 1e-9)) };
}
function weightedMedian(samples: Sample[]) {
  const weights = recencyWeights(samples);
  const pairs = samples.map((s, i) => [s.y, weights[i]]).sort((a, b) => a[0] - b[0]);
  const half = pairs.reduce((sum, p) => sum + p[1], 0) / 2;
  let running = 0;
  for (const [value, weight] of pairs) if ((running += weight) >= half) return value;
  return pairs[pairs.length - 1][0];
}
const unscheduled = (t: QueueToken) => t.isWalkIn || ['Now', 'Walk-in'].includes(t.scheduledTime);
/** Beta-smoothed share of patients who leave the queue unseen; `prior` is the share assumed with no data. */
const leaveRate = (tokens: QueueToken[], prior: number) => {
  let left = 0,
    seen = 0;
  for (const t of tokens) {
    const sameDay = (t.updatedAt || '').slice(0, 10) === t.queueDate;
    if (t.status === 'completed') seen++;
    else if (t.status === 'skipped' || (t.status === 'cancelled' && sameDay)) left++;
  }
  return (left + 10 * prior) / (left + seen + 10);
};

export interface PriorModel {
  coefficients: number[];
  sigma: number;
  sampleCount: number;
}
const configuredPrior = (minutes: number): PriorModel => ({
  coefficients: [Math.log(minutes), 0, 0, 0, 0, 0],
  sigma: 0.35,
  sampleCount: 0,
});
/** Clinic-wide log-normal model used as the prior for every doctor of the clinic. */
export function clinicPrior(samples: Sample[], defaultMinutes: number): PriorModel {
  const base = configuredPrior(defaultMinutes);
  if (samples.length < 5) return base;
  const fit = ridgeTowardPrior(samples, base.coefficients, CLINIC_SHRINKAGE);
  return fit
    ? { coefficients: fit.beta, sigma: Math.max(0.05, fit.sigma), sampleCount: samples.length }
    : base;
}

function fitMethod(
  method: DurationMethod,
  train: Sample[],
  prior: PriorModel,
  base: DurationModel,
): DurationModel {
  if (method === 'configured' || !train.length)
    return { ...base, method: 'configured', coefficients: [] };
  if (method === 'doctor_history')
    return {
      ...base,
      method,
      historyMinutes: weightedMedian(train),
      sigma: prior.sigma,
      coefficients: [],
    };
  const fit = ridgeTowardPrior(train, prior.coefficients, DOCTOR_SHRINKAGE);
  if (!fit) return { ...base, method: 'configured', coefficients: [] };
  // Shrink the residual spread toward the clinic's as well; a few cases understate it.
  const n = train.length;
  const sigma = Math.max(
    0.05,
    Math.sqrt((n * fit.sigma ** 2 + DOCTOR_SHRINKAGE * prior.sigma ** 2) / (n + DOCTOR_SHRINKAGE)),
  );
  return { ...base, method, coefficients: fit.beta, sigma };
}

/**
 * Trains one doctor's model. Candidates are compared on the most recent 20% of consultations
 * after fitting on the earlier 80%; a candidate replaces a simpler one only if it is strictly
 * more accurate. The chosen method is then refitted on all consultations.
 */
export function trainDurationModel(
  tokens: QueueToken[],
  defaultMinutes: number,
  priorFor?: (beforeMs: number) => PriorModel,
): DurationModel {
  const samples = consultationSamples(tokens);
  const prior = priorFor || (() => configuredPrior(defaultMinutes));
  const base: DurationModel = {
    method: 'configured',
    sampleCount: samples.length,
    trainingCount: 0,
    validationCount: 0,
    baselineMae: null,
    modelMae: null,
    candidateMae: {},
    featureNames: FEATURE_NAMES,
    coefficients: [],
    sigma: 0.35,
    historyMinutes: null,
    noShowRate: leaveRate(
      tokens.filter((t) => !unscheduled(t)),
      0.1,
    ),
    walkInLeaveRate: leaveRate(tokens.filter(unscheduled), 0.03),
    defaultMinutes,
    halfLifeDays: HALF_LIFE_DAYS,
    modelVersion: MODEL_VERSION,
    trainedAt: new Date().toISOString(),
    syntheticSamples: samples.filter((s) => s.token.metadata?.synthetic === true).length,
  };
  if (!samples.length) return base;
  const fullPrior = prior(Infinity);
  if (samples.length < MIN_VALIDATED_SAMPLES) {
    // Too little doctor history to validate: lean on the clinic model only if it has evidence.
    const pooled =
      fullPrior.sampleCount >= 2 * MIN_VALIDATED_SAMPLES
        ? fitMethod('hierarchical_lognormal', samples, fullPrior, base)
        : base;
    return { ...pooled, trainingCount: samples.length };
  }
  const split = Math.floor(samples.length * 0.8),
    train = samples.slice(0, split),
    validation = samples.slice(split);
  const trainPrior = prior(train[train.length - 1].servedAt);
  const candidates: DurationMethod[] = ['configured', 'doctor_history', 'hierarchical_lognormal'];
  const candidateMae: Partial<Record<DurationMethod, number>> = {};
  for (const method of candidates) {
    const model = fitMethod(method, train, trainPrior, base);
    candidateMae[method] =
      validation.reduce(
        (sum, s) =>
          sum + Math.abs(s.y - predictDuration(model, s.token, { firstVisit: s.firstVisit })),
        0,
      ) / validation.length;
  }
  let chosen: DurationMethod = 'configured';
  for (const method of candidates)
    if (candidateMae[method]! < candidateMae[chosen]! - 1e-9) chosen = method;
  return {
    ...fitMethod(chosen, samples, fullPrior, base),
    trainingCount: train.length,
    validationCount: validation.length,
    baselineMae: candidateMae.configured!,
    modelMae: candidateMae[chosen]!,
    candidateMae,
  };
}

/** Trains every doctor of a clinic, sharing a clinic-wide prior fitted without later data. */
export function trainClinicModels(
  tokens: QueueToken[],
  doctorIds: string[],
  defaultMinutes: number,
) {
  const pooled = consultationSamples(tokens);
  const cache = new Map<number, PriorModel>();
  const priorFor = (beforeMs: number) => {
    if (!cache.has(beforeMs))
      cache.set(
        beforeMs,
        clinicPrior(
          pooled.filter((s) => s.servedAt <= beforeMs),
          defaultMinutes,
        ),
      );
    return cache.get(beforeMs)!;
  };
  return new Map(
    doctorIds.map((id) => [
      id,
      trainDurationModel(
        tokens.filter((t) => t.doctorId === id),
        defaultMinutes,
        priorFor,
      ),
    ]),
  );
}

// Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7).
function normalCdf(z: number) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const erf =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}
/** E[D − t | D > t] for a log-normal consultation already running for t minutes. */
export function expectedRemaining(
  model: DurationModel,
  current: QueueToken,
  elapsed: number,
  context?: PredictionContext,
) {
  const mu = logLocation(model, current, context),
    sigma = effectiveSigma(model),
    mean = clamp(Math.exp(mu + sigma ** 2 / 2));
  if (elapsed <= 0.5) return mean;
  const survival = normalCdf((mu - Math.log(elapsed)) / sigma);
  if (survival < 1e-6) return 1;
  const conditional =
    (Math.exp(mu + sigma ** 2 / 2) * normalCdf((mu + sigma ** 2 - Math.log(elapsed)) / sigma)) /
    survival;
  return Math.max(1, Math.min(mean, conditional - elapsed));
}

export interface WaitEstimate {
  minutes: number;
  low: number;
  high: number;
}
/** Empirical spread of past estimates, as quantiles of (actual − estimate) / √(estimate + 4). */
export interface WaitCalibration {
  cases: number;
  low: number;
  high: number;
}
const scale = (minutes: number) => Math.sqrt(minutes + 4);
const minuteOfDay = (ms: number) => Math.round(istHour(ms) * 60);
const scheduledMinute = (t: QueueToken) =>
  unscheduled(t) ? -Infinity : clockMinutesOf(t.scheduledTime);
function clockMinutesOf(label: string) {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(label);
  return match
    ? (Number(match[1]) % 12) * 60 + Number(match[2]) + (match[3] === 'PM' ? 720 : 0)
    : -Infinity;
}
const queueRank = (a: QueueToken, b: QueueToken) =>
  (a.priority === 'emergency' ? 0 : 1) - (b.priority === 'emergency' ? 0 : 1) ||
  (a.tokenSeq || Number(a.tokenNumber.split('-').pop())) -
    (b.tokenSeq || Number(b.tokenNumber.split('-').pop()));

/**
 * Projects the doctor's session forward under QureFlow's calling rule (emergency first, then
 * token order among patients who are eligible at that moment) using expected durations. Unlike
 * counting the patients ahead right now, this includes booked patients whose appointment time
 * arrives while the patient is still waiting. Each patient called before the target contributes
 * P(seen) × (expected duration + changeover buffer).
 */
export function estimateWait(input: {
  model: DurationModel;
  current?: QueueToken;
  target: QueueToken;
  waiting: QueueToken[];
  bufferMinutes: number;
  now: number;
  returningPatients?: Set<string>;
  calibration?: WaitCalibration;
}): WaitEstimate {
  const { model, current, target, bufferMinutes, now } = input;
  const sigma = effectiveSigma(model);
  let clock = now,
    variance = 0;
  if (current) {
    const elapsed = Math.max(0, (now - Date.parse(current.calledAt || current.createdAt)) / 60000);
    const remaining = expectedRemaining(model, current, elapsed, {
      returningPatients: input.returningPatients,
    });
    clock += (remaining + bufferMinutes) * 60000;
    variance += (remaining * Math.sqrt(Math.exp(sigma ** 2) - 1)) ** 2;
  }
  const queue = input.waiting.filter((t) => t.id !== target.id);
  for (let guard = 0; guard <= queue.length + 2; guard++) {
    const minute = minuteOfDay(clock);
    const eligible = [target, ...queue]
      .filter((t) => t.priority === 'emergency' || scheduledMinute(t) <= minute)
      .sort(queueRank);
    if (!eligible.length || eligible[0].id !== target.id) {
      const next = eligible[0];
      if (!next) {
        // Nobody can be called yet: wait for the next appointment time, including the target's.
        const upcoming = Math.min(
          ...[target, ...queue].map(scheduledMinute).filter((m) => m > minute),
        );
        if (!Number.isFinite(upcoming)) break;
        clock += (upcoming - minute) * 60000;
        continue;
      }
      queue.splice(queue.indexOf(next), 1);
      const p = unscheduled(next) ? model.walkInLeaveRate : model.noShowRate;
      const m = predictDuration(model, next, {
          at: clock,
          returningPatients: input.returningPatients,
        }),
        step = m + bufferMinutes;
      clock += (1 - p) * step * 60000;
      variance += (1 - p) * (Math.exp(sigma ** 2) - 1) * m * m + p * (1 - p) * step * step;
      continue;
    }
    break;
  }
  const mean = Math.max(0, (clock - now) / 60000);
  if (mean <= 0 && !input.calibration) return { minutes: 0, low: 0, high: 0 };
  if (input.calibration && input.calibration.cases >= 30) {
    // Ranges reflect how wrong this clinic's recent estimates actually were.
    const spread = scale(mean);
    return {
      minutes: Math.ceil(mean),
      low: Math.max(0, Math.floor(mean + input.calibration.low * spread)),
      high: Math.ceil(Math.max(mean, mean + input.calibration.high * spread)),
    };
  }
  if (mean <= 0) return { minutes: 0, low: 0, high: 0 };
  const s2 = Math.log(1 + variance / (mean * mean)),
    mu = Math.log(mean) - s2 / 2;
  return {
    minutes: Math.ceil(mean),
    low: Math.max(0, Math.floor(Math.exp(mu - Z80 * Math.sqrt(s2)))),
    high: Math.ceil(Math.exp(mu + Z80 * Math.sqrt(s2))),
  };
}

/** 10th and 90th percentiles of normalised errors from a set of (estimate, actual) pairs. */
export function calibrationFrom(pairs: { estimate: number; actual: number }[]): WaitCalibration {
  const r = pairs.map((p) => (p.actual - p.estimate) / scale(p.estimate)).sort((a, b) => a - b);
  const q = (f: number) => (r.length ? r[Math.min(r.length - 1, Math.floor(f * r.length))] : 0);
  return { cases: r.length, low: q(0.1), high: q(0.9) };
}
