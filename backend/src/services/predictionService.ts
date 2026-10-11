import { QueueToken } from '../models/types.js';

export interface DurationModel {
  method: 'configured' | 'ridge_regression';
  sampleCount: number;
  trainingCount: number;
  validationCount: number;
  baselineMae: number | null;
  modelMae: number | null;
  coefficients: number[];
  defaultMinutes: number;
  modelVersion: string;
  trainedAt: string;
  syntheticSamples: number;
}
const clamp = (v: number) => Math.max(2, Math.min(60, v));
const features = (token: QueueToken) => {
  const time = new Date(token.calledAt || token.createdAt);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(time),
  );
  return [1, token.isWalkIn ? 1 : 0, token.priority === 'emergency' ? 1 : 0, (hour - 12) / 6];
};
export const predictDuration = (model: DurationModel, token: QueueToken) =>
  model.method === 'configured'
    ? model.defaultMinutes
    : clamp(features(token).reduce((sum, x, i) => sum + x * model.coefficients[i], 0));
export function trainDurationModel(tokens: QueueToken[], defaultMinutes: number): DurationModel {
  const samples = tokens
    .filter((t) => t.status === 'completed' && t.calledAt && t.servedAt)
    .map((t) => ({ token: t, y: (Date.parse(t.servedAt!) - Date.parse(t.calledAt!)) / 60000 }))
    .filter((s) => Number.isFinite(s.y) && s.y >= 2 && s.y <= 60)
    .sort((a, b) => a.token.servedAt!.localeCompare(b.token.servedAt!));
  const base: DurationModel = {
    method: 'configured',
    sampleCount: samples.length,
    trainingCount: 0,
    validationCount: 0,
    baselineMae: null,
    modelMae: null,
    coefficients: [],
    defaultMinutes,
    modelVersion: 'consultation-ridge-v1',
    trainedAt: new Date().toISOString(),
    syntheticSamples: samples.filter((s) => s.token.metadata?.synthetic === true).length,
  };
  if (samples.length < 40) return base;
  const split = Math.floor(samples.length * 0.8),
    train = samples.slice(0, split),
    validation = samples.slice(split),
    width = 4;
  const matrix = Array.from({ length: width }, (_, i) =>
    Array.from({ length: width + 1 }, (_, j) => (j === i ? (i === 0 ? 0.001 : 1) : 0)),
  );
  for (const { token, y } of train) {
    const x = features(token);
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < width; j++) matrix[i][j] += x[i] * x[j];
      matrix[i][width] += x[i] * y;
    }
  }
  // Solve the regularized normal equations with partial pivoting.
  for (let col = 0; col < width; col++) {
    let pivot = col;
    for (let row = col + 1; row < width; row++)
      if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
    [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
    const divisor = matrix[col][col];
    if (Math.abs(divisor) < 1e-10) return base;
    for (let j = col; j <= width; j++) matrix[col][j] /= divisor;
    for (let row = 0; row < width; row++)
      if (row !== col) {
        const factor = matrix[row][col];
        for (let j = col; j <= width; j++) matrix[row][j] -= factor * matrix[col][j];
      }
  }
  const candidate = {
    ...base,
    method: 'ridge_regression' as const,
    coefficients: matrix.map((row) => row[width]),
    trainingCount: train.length,
    validationCount: validation.length,
  };
  const mae = (fn: (t: QueueToken) => number) =>
    validation.reduce((sum, s) => sum + Math.abs(s.y - fn(s.token)), 0) / validation.length;
  candidate.baselineMae = mae(() => defaultMinutes);
  candidate.modelMae = mae((t) => predictDuration(candidate, t));
  // A model is used only when it beats the configured baseline on later, unseen consultations.
  if (candidate.modelMae >= candidate.baselineMae)
    return { ...candidate, method: 'configured', coefficients: [] };
  return candidate;
}
