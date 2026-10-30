import type { QueueToken } from '../models/types.js';
import { byQueueOrder, patientsAhead } from '../lib/queueOrder.js';
import { clockMinutes } from '../lib/time.js';
import {
  calibrationFrom,
  DurationModel,
  estimateWait,
  trainClinicModels,
  WaitCalibration,
  WaitEstimate,
} from './predictionService.js';

/** The queue as a patient saw it at the moment they started waiting. */
export interface QueueSnapshot {
  target: QueueToken;
  at: number;
  current?: QueueToken;
  /** Patients waiting in the system at that moment, other than the target. */
  waiting: QueueToken[];
  /** The subset the live service counted as ahead of the target at that moment. */
  ahead: QueueToken[];
  /** Completed patients of this doctor before the day, for the follow-up feature. */
  returningPatients: Set<string>;
  notBefore?: number;
  /** All of this doctor's tokens on the same day, for delay-history estimators. */
  dayTokens: QueueToken[];
}
export type WaitPredictor = (snapshot: QueueSnapshot) => WaitEstimate;
/** Builds a predictor from the history available before an evaluation day. */
export type PredictorFactory = (history: QueueToken[], doctorIds: string[]) => WaitPredictor;
export interface MethodScore {
  cases: number;
  maeMinutes: number | null;
  rmseMinutes: number | null;
  withinFiveMinutes: number | null;
  rangeCoverage?: number | null;
}
export interface BacktestOptions {
  defaultMinutes: number;
  bufferMinutes: number;
  evaluationDays: number;
  predictors?: Record<string, PredictorFactory>;
}

const clockFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const istMinute = (ms: number) => {
  const [h, m] = clockFormat.format(new Date(ms)).split(':').map(Number);
  return h * 60 + m;
};
const slotTime = (date: string, label: string) => {
  const minute = clockMinutes(label);
  return Date.parse(
    `${date}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00+05:30`,
  );
};
/** When the patient began waiting: check-in if recorded, else arrival or appointment time. */
export function waitStart(t: QueueToken) {
  const checkIn = t.metadata?.checkInAt;
  if (typeof checkIn === 'string') return Date.parse(checkIn);
  if (t.isWalkIn || ['Now', 'Walk-in'].includes(t.scheduledTime)) return Date.parse(t.createdAt);
  return Math.max(Date.parse(t.createdAt), slotTime(t.queueDate!, t.scheduledTime));
}
const removedAt = (t: QueueToken) =>
  t.calledAt
    ? Date.parse(t.calledAt)
    : ['skipped', 'cancelled'].includes(t.status)
      ? Date.parse(t.updatedAt || t.createdAt)
      : Infinity;

/** Rebuilds what the live service would have seen for every patient who was later called. */
export function snapshots(
  dayTokens: QueueToken[],
  returningPatients: Set<string>,
): QueueSnapshot[] {
  const result: QueueSnapshot[] = [];
  for (const target of dayTokens) {
    if (!target.calledAt) continue;
    const at = waitStart(target);
    if (!Number.isFinite(at) || Date.parse(target.calledAt) < at) continue;
    const current = dayTokens.find(
      (t) =>
        t.calledAt &&
        Date.parse(t.calledAt) <= at &&
        (t.servedAt ? Date.parse(t.servedAt) > at : t.status === 'current'),
    );
    const waiting = dayTokens.filter(
      (t) => t.id === target.id || (Date.parse(t.createdAt) <= at && removedAt(t) > at),
    );
    const scheduled = !(target.isWalkIn || ['Now', 'Walk-in'].includes(target.scheduledTime));
    result.push({
      target,
      at,
      current,
      waiting: waiting.filter((t) => t.id !== target.id),
      ahead: patientsAhead(waiting, target, istMinute(at)),
      returningPatients,
      notBefore: scheduled ? slotTime(target.queueDate!, target.scheduledTime) : undefined,
      dayTokens,
    });
  }
  return result;
}

/**
 * The fixed formula QureFlow first used: t_active + (p − 1)·t_avg + buffer, where p counts the
 * running consultation and every waiting patient ahead in calling order (as it did then, with
 * no appointment-time eligibility filter).
 */
export const formulaPredictor =
  (defaultMinutes: number, bufferMinutes: number): PredictorFactory =>
  () =>
  (s) => {
    const elapsed = s.current ? Math.floor((s.at - Date.parse(s.current.calledAt!)) / 60000) : 0;
    const active = s.current ? Math.max(1, defaultMinutes - elapsed) : 0;
    const p = s.waiting.filter((t) => byQueueOrder(t, s.target) < 0).length + (s.current ? 1 : 0);
    const minutes =
      p <= 0 ? 0 : Math.max(1, Math.round(active + (p - 1) * defaultMinutes + bufferMinutes));
    return { minutes, low: minutes, high: minutes };
  };
const predictWith =
  (
    models: Map<string, DurationModel>,
    bufferMinutes: number,
    calibration?: WaitCalibration,
    adjust: (model: DurationModel) => DurationModel = (m) => m,
  ): WaitPredictor =>
  (s) =>
    estimateWait({
      model: adjust(models.get(s.target.doctorId)!),
      current: s.current,
      target: s.target,
      waiting: s.waiting,
      bufferMinutes,
      now: s.at,
      returningPatients: s.returningPatients,
      calibration,
    });

/** Snapshots of the most recent days of a clinic's history, grouped by doctor and day. */
export function recentSnapshots(tokens: QueueToken[], days: number) {
  const dates = [...new Set(tokens.map((t) => t.queueDate!).filter(Boolean))].sort().slice(-days);
  const result: QueueSnapshot[] = [];
  for (const date of dates)
    for (const doctorId of new Set(
      tokens.filter((t) => t.queueDate === date).map((t) => t.doctorId),
    )) {
      const returning = new Set(
        tokens
          .filter(
            (t) =>
              t.doctorId === doctorId &&
              t.queueDate! < date &&
              t.status === 'completed' &&
              t.patientId,
          )
          .map((t) => t.patientId!),
      );
      result.push(
        ...snapshots(
          tokens.filter((t) => t.queueDate === date && t.doctorId === doctorId),
          returning,
        ),
      );
    }
  return result;
}

/**
 * Error spread of the given models on the clinic's last week of arrivals. The models have seen
 * those days, so the spread is slightly optimistic; it is still far closer to reality than the
 * parametric range alone.
 */
export function calibrateWaits(
  tokens: QueueToken[],
  models: Map<string, DurationModel>,
  bufferMinutes: number,
  days = 7,
) {
  const predict = predictWith(models, bufferMinutes);
  return calibrationFrom(
    recentSnapshots(tokens, days)
      .filter((s) => models.has(s.target.doctorId))
      .map((s) => ({
        estimate: predict(s).minutes,
        actual: (Date.parse(s.target.calledAt!) - s.at) / 60000,
      })),
  );
}

export const learnedPredictor =
  (
    defaultMinutes: number,
    bufferMinutes: number,
    options: { adjust?: (model: DurationModel) => DurationModel; calibrate?: boolean } = {},
  ): PredictorFactory =>
  (history, doctorIds) => {
    const models = trainClinicModels(history, doctorIds, defaultMinutes);
    const calibration =
      options.calibrate === false ? undefined : calibrateWaits(history, models, bufferMinutes);
    return predictWith(models, bufferMinutes, calibration, options.adjust);
  };

/**
 * Rolling-origin backtest: each evaluation day is predicted by models trained only on earlier
 * days, and every prediction is compared with the wait the patient actually experienced.
 */
export function backtestWaits(tokens: QueueToken[], options: BacktestOptions) {
  const predictors = options.predictors || {
    formula: formulaPredictor(options.defaultMinutes, options.bufferMinutes),
    learned: learnedPredictor(options.defaultMinutes, options.bufferMinutes),
  };
  const days = [...new Set(tokens.map((t) => t.queueDate!).filter(Boolean))].sort();
  const evaluated = days.slice(-options.evaluationDays);
  // Interval coverage is reported only for methods that give a range at all.
  const ranged = new Set<string>();
  const errors: Record<
    string,
    { error: number; actual: number; inRange: boolean; walkIn: boolean; cluster: string }[]
  > = Object.fromEntries(Object.keys(predictors).map((name) => [name, []]));
  const doctorIds = [...new Set(tokens.map((t) => t.doctorId))];
  for (const day of evaluated) {
    const history = tokens.filter((t) => t.queueDate! < day);
    if (!history.some((t) => t.status === 'completed')) continue;
    const prepared = Object.fromEntries(
      Object.entries(predictors).map(([name, factory]) => [name, factory(history, doctorIds)]),
    );
    for (const doctorId of doctorIds) {
      const dayTokens = tokens.filter((t) => t.queueDate === day && t.doctorId === doctorId);
      if (!dayTokens.length) continue;
      const returning = new Set(
        history
          .filter((t) => t.doctorId === doctorId && t.status === 'completed' && t.patientId)
          .map((t) => t.patientId!),
      );
      for (const snapshot of snapshots(dayTokens, returning)) {
        const actual = (Date.parse(snapshot.target.calledAt!) - snapshot.at) / 60000;
        for (const [name, predict] of Object.entries(prepared)) {
          const estimate = predict(snapshot);
          if (estimate.high > estimate.low) ranged.add(name);
          errors[name].push({
            error: estimate.minutes - actual,
            actual,
            inRange: actual >= estimate.low - 0.5 && actual <= estimate.high + 0.5,
            walkIn: snapshot.target.isWalkIn,
            // One doctor's session: errors within it are correlated, so it is the bootstrap unit.
            cluster: `${day}|${doctorId}`,
          });
        }
      }
    }
  }
  const score = (list: { error: number; inRange: boolean }[], ranged: boolean): MethodScore => {
    const round = (v: number) => Math.round(v * 100) / 100;
    if (!list.length)
      return { cases: 0, maeMinutes: null, rmseMinutes: null, withinFiveMinutes: null };
    return {
      cases: list.length,
      maeMinutes: round(list.reduce((s, e) => s + Math.abs(e.error), 0) / list.length),
      rmseMinutes: round(Math.sqrt(list.reduce((s, e) => s + e.error ** 2, 0) / list.length)),
      withinFiveMinutes: round(list.filter((e) => Math.abs(e.error) <= 5).length / list.length),
      ...(ranged
        ? { rangeCoverage: round(list.filter((e) => e.inRange).length / list.length) }
        : {}),
    };
  };
  return {
    summary: {
      evaluationDays: evaluated.length,
      methods: Object.fromEntries(
        Object.entries(errors).map(([name, list]) => [name, score(list, ranged.has(name))]),
      ) as Record<string, MethodScore>,
    },
    errors,
  };
}
