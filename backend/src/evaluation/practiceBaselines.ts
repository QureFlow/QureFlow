import { PredictorFactory, recentSnapshots, WaitPredictor } from '../services/waitBacktest.js';
import {
  actualWait,
  calledBefore,
  point,
  queueLength,
  serviceIndex,
} from '../services/waitFeatures.js';

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
export { queueLengthEstimate as queueLengthPredictor } from '../services/waitFeatures.js';

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
