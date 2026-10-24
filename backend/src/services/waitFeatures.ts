import type { QueueToken } from '../models/types.js';
import { clockMinutes } from '../lib/time.js';
import { PredictorFactory, QueueSnapshot, recentSnapshots, waitStart } from './waitBacktest.js';

/*
 * Queue-state features and gradient-boosted regression trees, shared by the live waiting-time
 * correction and by the offline comparison with published estimators.
 */
export const RECENT_CONSULTATIONS = 20;
export const point = (minutes: number) => {
  const value = Math.max(0, Math.round(minutes));
  return { minutes: value, low: value, high: value };
};
const duration = (t: QueueToken) => (Date.parse(t.servedAt!) - Date.parse(t.calledAt!)) / 60000;
const completedBefore = (tokens: QueueToken[], at: number) =>
  tokens.filter(
    (t) => t.status === 'completed' && t.calledAt && t.servedAt && Date.parse(t.servedAt) <= at,
  );

export type ServiceIndex = Map<string, { servedAt: number; minutes: number }[]>;
/** Each doctor's completed consultations in the history, oldest first. */
export function serviceIndex(history: QueueToken[]): ServiceIndex {
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
export function meanService(index: ServiceIndex, s: QueueSnapshot, fallback: number) {
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
export function queueLength(
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

export const actualWait = (t: QueueToken) =>
  Math.max(0, (Date.parse(t.calledAt!) - waitStart(t)) / 60000);
export const calledBefore = (s: QueueSnapshot) =>
  s.dayTokens
    .filter((t) => t.calledAt && Date.parse(t.calledAt) < s.at && Number.isFinite(waitStart(t)))
    .sort((a, b) => Date.parse(a.calledAt!) - Date.parse(b.calledAt!));

export const TRAINING_DAYS = 28;

const clock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});
export function features(
  index: ServiceIndex,
  s: QueueSnapshot,
  defaultMinutes: number,
  buffer: number,
) {
  const parts = Object.fromEntries(
    clock.formatToParts(new Date(s.at)).map((p) => [p.type, p.value]),
  );
  const minute = Number(parts.hour) * 60 + Number(parts.minute);
  const recent5 = calledBefore(s)
    .filter((t) => t.servedAt && Date.parse(t.servedAt) <= s.at)
    .slice(-5)
    .map((t) => (Date.parse(t.servedAt!) - Date.parse(t.calledAt!)) / 60000)
    .sort((a, b) => a - b);
  const service = meanService(index, s, defaultMinutes);
  const called = calledBefore(s);
  const lastHour = called.filter((t) => Date.parse(t.calledAt!) >= s.at - 3600000);
  const ql = queueLength(index, s, defaultMinutes, buffer);
  const scheduled = !(s.target.isWalkIn || ['Now', 'Walk-in'].includes(s.target.scheduledTime));
  return [
    s.ahead.length,
    s.waiting.length,
    service,
    recent5.length ? recent5[Math.floor(recent5.length / 2)] : service,
    ql,
    called.length ? actualWait(called[called.length - 1]) : ql,
    lastHour.length ? lastHour.reduce((sum, t) => sum + actualWait(t), 0) / lastHour.length : ql,
    s.current ? (s.at - Date.parse(s.current.calledAt!)) / 60000 : 0,
    minute / 60,
    ['Sat', 'Sun'].includes(parts.weekday) ? 1 : 0,
    s.target.isWalkIn ? 1 : 0,
    s.target.priority === 'emergency' ? 1 : 0,
    scheduled ? Math.max(0, clockMinutes(s.target.scheduledTime) - minute) : 0,
  ];
}

export interface Dataset {
  index: ServiceIndex;
  snapshots: QueueSnapshot[];
  x: number[][];
  y: number[];
}
// Every learned baseline trains on the same snapshots; build them once per evaluation day.
const datasets = new WeakMap<QueueToken[], Dataset>();
export function dataset(history: QueueToken[], defaultMinutes: number, buffer: number): Dataset {
  const cached = datasets.get(history);
  if (cached) return cached;
  const index = serviceIndex(history);
  const snapshots = recentSnapshots(history, TRAINING_DAYS);
  const x = snapshots.map((s) => features(index, s, defaultMinutes, buffer));
  const y = snapshots.map((s) => (Date.parse(s.target.calledAt!) - waitStart(s.target)) / 60000);
  const built = { index, snapshots, x, y };
  datasets.set(history, built);
  return built;
}

export const mae = (pred: (r: number[]) => number, x: number[][], y: number[]) =>
  x.reduce((s, r, i) => s + Math.abs(pred(r) - y[i]), 0) / x.length;
/** Chronological 80/20 split used to choose each model's regularisation. */
export const split = (x: number[][], y: number[]) => {
  const k = Math.floor(x.length * 0.8);
  return { xt: x.slice(0, k), yt: y.slice(0, k), xv: x.slice(k), yv: y.slice(k) };
};

interface Tree {
  feature: number;
  threshold: number;
  left: Tree | number;
  right: Tree | number;
}
const BINS = 32;
/** Per-feature quantile thresholds, so split search is a histogram pass rather than a sort. */
function binning(x: number[][]) {
  const thresholds = x[0].map((_, f) => {
    const values = x.map((r) => r[f]).sort((p, q) => p - q);
    const cuts = new Set<number>();
    for (let k = 1; k < BINS; k++) cuts.add(values[Math.floor((k * values.length) / BINS)]);
    return [...cuts].sort((p, q) => p - q);
  });
  const bin = (f: number, v: number) => {
    const t = thresholds[f];
    let lo = 0,
      hi = t.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (v <= t[mid]) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  };
  return { thresholds, codes: x.map((r) => r.map((v, f) => bin(f, v))) };
}
/** Least-squares regression tree; a row goes left when its value is at most the threshold. */
function growTree(
  codes: number[][],
  thresholds: number[][],
  g: number[],
  rows: number[],
  depth: number,
  minLeaf: number,
): Tree | number {
  const total = rows.reduce((s, i) => s + g[i], 0);
  const mean = total / rows.length;
  if (depth === 0 || rows.length < 2 * minLeaf) return mean;
  let best = { gain: (total * total) / rows.length, feature: -1, bin: 0 };
  for (let f = 0; f < thresholds.length; f++) {
    const sum = new Array(BINS + 1).fill(0),
      count = new Array(BINS + 1).fill(0);
    for (const i of rows) {
      sum[codes[i][f]] += g[i];
      count[codes[i][f]]++;
    }
    let ls = 0,
      ln = 0;
    for (let k = 0; k < thresholds[f].length; k++) {
      ls += sum[k];
      ln += count[k];
      const rn = rows.length - ln;
      if (ln < minLeaf || rn < minLeaf) continue;
      const gain = (ls * ls) / ln + ((total - ls) * (total - ls)) / rn;
      if (gain > best.gain + 1e-9) best = { gain, feature: f, bin: k };
    }
  }
  if (best.feature < 0) return mean;
  const left = rows.filter((i) => codes[i][best.feature] <= best.bin);
  const right = rows.filter((i) => codes[i][best.feature] > best.bin);
  return {
    feature: best.feature,
    threshold: thresholds[best.feature][best.bin],
    left: growTree(codes, thresholds, g, left, depth - 1, minLeaf),
    right: growTree(codes, thresholds, g, right, depth - 1, minLeaf),
  };
}
const evaluate = (tree: Tree | number, row: number[]): number =>
  typeof tree === 'number'
    ? tree
    : evaluate(row[tree.feature] <= tree.threshold ? tree.left : tree.right, row);

export function boost(x: number[][], y: number[], rounds: number, rate = 0.1, depth = 3) {
  const { codes, thresholds } = binning(x);
  const base = y.reduce((s, v) => s + v, 0) / y.length;
  const fitted = y.map(() => base);
  const trees: (Tree | number)[] = [];
  const rows = y.map((_, i) => i);
  for (let r = 0; r < rounds; r++) {
    const residual = y.map((v, i) => v - fitted[i]);
    const tree = growTree(codes, thresholds, residual, rows, depth, 20);
    trees.push(tree);
    for (let i = 0; i < y.length; i++) fitted[i] += rate * evaluate(tree, x[i]);
  }
  return (row: number[], upTo = trees.length): number =>
    trees.slice(0, upTo).reduce<number>((s, t) => s + rate * evaluate(t, row), base);
}

/** Patients ahead × recent mean consultation time, as a backtest predictor. */
export const queueLengthEstimate =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const index = serviceIndex(history);
    return (s) => point(queueLength(index, s, defaultMinutes, buffer));
  };
