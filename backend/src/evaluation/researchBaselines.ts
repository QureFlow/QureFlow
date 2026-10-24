import { learnedPredictor, PredictorFactory } from '../services/waitBacktest.js';
import {
  boost,
  dataset,
  features,
  mae,
  point,
  queueLength,
  split,
} from '../services/waitFeatures.js';
import { applyCorrection, trainCorrection } from '../services/waitCorrection.js';

/*
 * Learned wait predictors from the research literature, re-implemented for comparison only.
 * Each learns the wait directly from queue-state features, as those papers do:
 *
 * - Q-Lasso (Ang et al., 2016): Lasso regression whose features include a fluid/queue-length
 *   estimate and recent-wait averages.
 * - Quantile regression (Sun et al., 2012): a linear model of the median wait.
 * - Gradient-boosted trees (Curtis et al., 2018; Li et al., 2023 found tree ensembles or
 *   elastic net most accurate for outpatient and radiology waits).
 *
 * Features are those the papers report as most useful and that QureFlow records: patients
 * ahead and waiting, recent service times (mean of 20, median of 5), the queue-length
 * estimate, last-to-enter-service and 1-hour rolling waits, the running consultation's elapsed
 * time, hour, weekday, walk-in and emergency flags, and minutes until the patient's own slot.
 * Each day's models are trained on the previous 28 days only.
 */
function standardiser(x: number[][]) {
  const width = x[0].length;
  const mean = Array.from({ length: width }, (_, j) => x.reduce((s, r) => s + r[j], 0) / x.length);
  const sd = Array.from({ length: width }, (_, j) =>
    Math.max(1e-6, Math.sqrt(x.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / x.length)),
  );
  return (row: number[]) => row.map((v, j) => (v - mean[j]) / sd[j]);
}
const linear = (w: number[], b: number, row: number[]) => row.reduce((s, v, j) => s + v * w[j], b);
/** Lasso by cyclic coordinate descent on standardised features. */
function lasso(x: number[][], y: number[], lambda: number) {
  const n = x.length,
    width = x[0].length,
    w = new Array(width).fill(0);
  let b = y.reduce((s, v) => s + v, 0) / n;
  const residual = y.map((v) => v - b);
  for (let sweep = 0; sweep < 100; sweep++) {
    let change = 0;
    for (let j = 0; j < width; j++) {
      let rho = 0,
        norm = 0;
      for (let i = 0; i < n; i++) {
        rho += x[i][j] * (residual[i] + x[i][j] * w[j]);
        norm += x[i][j] * x[i][j];
      }
      const next = (Math.sign(rho) * Math.max(0, Math.abs(rho) / n - lambda)) / (norm / n);
      if (next !== w[j]) {
        for (let i = 0; i < n; i++) residual[i] -= x[i][j] * (next - w[j]);
        change = Math.max(change, Math.abs(next - w[j]));
        w[j] = next;
      }
    }
    const shift = residual.reduce((s, v) => s + v, 0) / n;
    b += shift;
    for (let i = 0; i < n; i++) residual[i] -= shift;
    if (change < 1e-6) break;
  }
  return { w, b };
}

export const qLassoPredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const data = dataset(history, defaultMinutes, buffer);
    if (data.x.length < 50) return (s) => point(queueLength(data.index, s, defaultMinutes, buffer));
    const scale = standardiser(data.x);
    const z = data.x.map(scale);
    const { xt, yt, xv, yv } = split(z, data.y);
    let best = { lambda: 0.01, error: Infinity };
    for (const lambda of [0.001, 0.01, 0.1, 0.5, 1, 2]) {
      const m = lasso(xt, yt, lambda);
      const error = mae((r) => linear(m.w, m.b, r), xv, yv);
      if (error < best.error) best = { lambda, error };
    }
    const model = lasso(z, data.y, best.lambda);
    return (s) =>
      point(linear(model.w, model.b, scale(features(data.index, s, defaultMinutes, buffer))));
  };

/** Median regression by iteratively reweighted least squares (small ridge for stability). */
function medianRegression(x: number[][], y: number[]) {
  const width = x[0].length + 1;
  let beta = new Array(width).fill(0);
  for (let iter = 0; iter < 40; iter++) {
    const a = Array.from({ length: width }, () => new Array(width + 1).fill(0));
    x.forEach((row, i) => {
      const r = [1, ...row];
      const residual = y[i] - r.reduce((s, v, j) => s + v * beta[j], 0);
      const weight = 1 / Math.max(0.5, Math.abs(residual));
      for (let p = 0; p < width; p++) {
        for (let q = 0; q < width; q++) a[p][q] += weight * r[p] * r[q];
        a[p][width] += weight * r[p] * y[i];
      }
    });
    for (let p = 1; p < width; p++) a[p][p] += 1e-3;
    for (let col = 0; col < width; col++) {
      let pivot = col;
      for (let row = col + 1; row < width; row++)
        if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
      [a[col], a[pivot]] = [a[pivot], a[col]];
      const d = a[col][col] || 1e-9;
      for (let j = col; j <= width; j++) a[col][j] /= d;
      for (let row = 0; row < width; row++)
        if (row !== col) {
          const f = a[row][col];
          for (let j = col; j <= width; j++) a[row][j] -= f * a[col][j];
        }
    }
    beta = a.map((row) => row[width]);
  }
  return (row: number[]) => [1, ...row].reduce((s, v, j) => s + v * beta[j], 0);
}

export const quantileRegressionPredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const data = dataset(history, defaultMinutes, buffer);
    if (data.x.length < 50) return (s) => point(queueLength(data.index, s, defaultMinutes, buffer));
    const scale = standardiser(data.x);
    const predict = medianRegression(data.x.map(scale), data.y);
    return (s) => point(predict(scale(features(data.index, s, defaultMinutes, buffer))));
  };

export const gradientBoostingPredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const data = dataset(history, defaultMinutes, buffer);
    if (data.x.length < 50) return (s) => point(queueLength(data.index, s, defaultMinutes, buffer));
    // Choose the number of trees on the most recent 20% of training snapshots.
    const { xt, yt, xv, yv } = split(data.x, data.y);
    const trial = boost(xt, yt, 300);
    let rounds = 50,
      error = Infinity;
    for (const k of [50, 100, 150, 200, 300]) {
      const e = mae((r) => trial(r, k), xv, yv);
      if (e < error) [rounds, error] = [k, e];
    }
    const model = boost(data.x, data.y, rounds);
    return (s) => point(model(features(data.index, s, defaultMinutes, buffer)));
  };

/** QureFlow's estimator: the queue projection with its learned correction (waitCorrection.ts). */
export const projectionBoostingPredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history, doctorIds) => {
    const current = learnedPredictor(defaultMinutes, buffer)(history, doctorIds);
    const correction = trainCorrection(history, doctorIds, defaultMinutes, buffer, current);
    if (!correction) return current;
    return (s) => applyCorrection(correction, s, current(s), defaultMinutes, buffer);
  };
