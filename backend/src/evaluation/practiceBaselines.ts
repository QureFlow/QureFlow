import type { QueueToken } from '../models/types.js';
import {
  PredictorFactory,
  QueueSnapshot,
  recentSnapshots,
  waitStart,
  WaitPredictor,
} from '../services/waitBacktest.js';

/*
 * Waiting-time estimators that are documented as used in practice, for comparison only.
 *
 * - Queue length × mean service time: US patent 5,867,572 (British Telecommunications, 1999)
 *   multiplies the customers ahead by the mean service time and adds the time until the server
 *   is next free; Ibrahim and Whitt (2009) call this queue-length estimator standard in practice.
 *   The same patent corrects estimates with a weighting factor from past estimates and actual
 *   waits, implemented here as the ratio of actual to estimated waits over the last week.
 * - Last to enter service and a rolling average of recent waits: delay-history estimators from
 *   Ibrahim and Whitt (2009) and the rolling averages hospitals used in Ang et al. (2016).
 */
const RECENT_CONSULTATIONS = 20;
const point = (minutes: number) => {
  const value = Math.max(0, Math.round(minutes));
  return { minutes: value, low: value, high: value };
};
const duration = (t: QueueToken) => (Date.parse(t.servedAt!) - Date.parse(t.calledAt!)) / 60000;
const completedBefore = (tokens: QueueToken[], at: number) =>
  tokens.filter(
    (t) => t.status === 'completed' && t.calledAt && t.servedAt && Date.parse(t.servedAt) <= at,
  );

type ServiceIndex = Map<string, { servedAt: number; minutes: number }[]>;
/** Each doctor's completed consultations in the history, oldest first. */
function serviceIndex(history: QueueToken[]): ServiceIndex {
  const index: ServiceIndex = new Map();
  for (const t of completedBefore(history, Infinity)) {
    const minutes = duration(t);
    if (!(minutes > 0 && minutes <= 120)) continue;
    if (!index.has(t.doctorId)) index.set(t.doctorId, []);
    index.get(t.doctorId)!.push({ servedAt: Date.parse(t.servedAt!), minutes });
  }
  for (const list of index.values()) list.sort((a, b) => a.servedAt - b.servedAt);
  return index;
}

/** Mean of the doctor's last 20 consultation durations finished before `at`. */
function meanService(index: ServiceIndex, s: QueueSnapshot, fallback: number) {
  const past = (index.get(s.target.doctorId) || []).filter((x) => x.servedAt <= s.at);
  const today = completedBefore(s.dayTokens, s.at)
    .map((t) => ({ servedAt: Date.parse(t.servedAt!), minutes: duration(t) }))
    .filter(
      (x) => x.minutes > 0 && x.minutes <= 120 && !past.some((p) => p.servedAt === x.servedAt),
    )
    .sort((a, b) => a.servedAt - b.servedAt);
  const recent = [...past.slice(-RECENT_CONSULTATIONS), ...today].slice(-RECENT_CONSULTATIONS);
  return recent.length ? recent.reduce((sum, x) => sum + x.minutes, 0) / recent.length : fallback;
}

/** Customers ahead × mean service time (+ changeover), plus the time until the doctor is free. */
function queueLength(
  index: ServiceIndex,
  s: QueueSnapshot,
  defaultMinutes: number,
  buffer: number,
) {
  const service = meanService(index, s, defaultMinutes);
  const elapsed = s.current ? (s.at - Date.parse(s.current.calledAt!)) / 60000 : 0;
  const untilFree = s.current ? Math.max(0, service - elapsed) + buffer : 0;
  return untilFree + s.ahead.length * (service + buffer);
}

export const queueLengthPredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const index = serviceIndex(history);
    return (s) => point(queueLength(index, s, defaultMinutes, buffer));
  };

export const queueLengthWithFeedbackPredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const index = serviceIndex(history);
    const factors = new Map<string, number>();
    const sums = new Map<string, { actual: number; estimate: number }>();
    for (const past of recentSnapshots(history, 7)) {
      const estimate = queueLength(index, past, defaultMinutes, buffer);
      const actual = (Date.parse(past.target.calledAt!) - past.at) / 60000;
      const sum = sums.get(past.target.doctorId) || { actual: 0, estimate: 0 };
      sum.actual += actual;
      sum.estimate += estimate;
      sums.set(past.target.doctorId, sum);
    }
    for (const [doctorId, { actual, estimate }] of sums)
      factors.set(doctorId, estimate > 0 ? Math.min(2, Math.max(0.5, actual / estimate)) : 1);
    return (s) =>
      point(queueLength(index, s, defaultMinutes, buffer) * (factors.get(s.target.doctorId) ?? 1));
  };

const actualWait = (t: QueueToken) => Math.max(0, (Date.parse(t.calledAt!) - waitStart(t)) / 60000);
const calledBefore = (s: QueueSnapshot) =>
  s.dayTokens
    .filter((t) => t.calledAt && Date.parse(t.calledAt) < s.at && Number.isFinite(waitStart(t)))
    .sort((a, b) => Date.parse(a.calledAt!) - Date.parse(b.calledAt!));

/** The wait of the patient most recently called; queue length when nobody was called yet. */
export const lastToEnterServicePredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const index = serviceIndex(history);
    return (s) => {
      const last = calledBefore(s).pop();
      return point(last ? actualWait(last) : queueLength(index, s, defaultMinutes, buffer));
    };
  };

/** Mean wait of patients called in the last `hours`; queue length when there were none. */
export const rollingAveragePredictor =
  (hours: number, defaultMinutes: number, buffer: number): PredictorFactory =>
  (history): WaitPredictor => {
    const index = serviceIndex(history);
    return (s) => {
      const recent = calledBefore(s).filter(
        (t) => Date.parse(t.calledAt!) >= s.at - hours * 3600000,
      );
      return point(
        recent.length
          ? recent.reduce((sum, t) => sum + actualWait(t), 0) / recent.length
          : queueLength(index, s, defaultMinutes, buffer),
      );
    };
  };
