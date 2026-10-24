import type { QueueToken } from '../models/types.js';
import type { WaitEstimate } from './predictionService.js';
import { learnedPredictor, QueueSnapshot, WaitPredictor } from './waitBacktest.js';
import {
  boost,
  dataset,
  features,
  mae,
  ServiceIndex,
  split,
  TRAINING_DAYS,
} from './waitFeatures.js';

/**
 * A learned correction on top of the queue projection: gradient-boosted trees receive the
 * projected wait together with queue-state features and learn what the projection misses
 * (for example emergencies that arrive while a patient waits). Training snapshots use
 * projections from models that had not seen the training window, so the trees learn from the
 * same kind of error they will correct.
 */
export interface WaitCorrection {
  index: ServiceIndex;
  predict: (row: number[]) => number;
  trainedOn: number;
  rounds: number;
}
const MIN_TRAINING_ARRIVALS = 50;

export function trainCorrection(
  history: QueueToken[],
  doctorIds: string[],
  defaultMinutes: number,
  buffer: number,
  current?: WaitPredictor,
): WaitCorrection | null {
  const data = dataset(history, defaultMinutes, buffer);
  if (data.x.length < MIN_TRAINING_ARRIVALS) return null;
  const days = [...new Set(history.map((t) => t.queueDate!).filter(Boolean))].sort();
  const cutoff = days[Math.max(0, days.length - TRAINING_DAYS)];
  const earlier = history.filter((t) => t.queueDate! < cutoff);
  const projection = earlier.some((t) => t.status === 'completed')
    ? learnedPredictor(defaultMinutes, buffer, { calibrate: false })(earlier, doctorIds)
    : current || learnedPredictor(defaultMinutes, buffer)(history, doctorIds);
  const x = data.x.map((row, i) => [...row, projection(data.snapshots[i]).minutes]);
  // The number of trees is chosen on the most recent 20% of the training arrivals.
  const { xt, yt, xv, yv } = split(x, data.y);
  const trial = boost(xt, yt, 300);
  let rounds = 50,
    error = Infinity;
  for (const k of [50, 100, 150, 200, 300]) {
    const e = mae((r) => trial(r, k), xv, yv);
    if (e < error) [rounds, error] = [k, e];
  }
  return { index: data.index, predict: boost(x, data.y, rounds), trainedOn: x.length, rounds };
}

/** Applies the correction to a projected estimate, keeping the width of its range. */
export function applyCorrection(
  correction: WaitCorrection,
  snapshot: QueueSnapshot,
  projected: WaitEstimate,
  defaultMinutes: number,
  buffer: number,
): WaitEstimate {
  const row = [...features(correction.index, snapshot, defaultMinutes, buffer), projected.minutes];
  const minutes = Math.max(0, Math.round(correction.predict(row)));
  return {
    minutes,
    low: Math.max(0, minutes - (projected.minutes - projected.low)),
    high: minutes + (projected.high - projected.minutes),
  };
}
