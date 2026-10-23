import type { QueueToken } from '../models/types.js';
import { clockMinutes } from './time.js';

const unscheduled = (t: QueueToken) => t.isWalkIn || ['Now', 'Walk-in'].includes(t.scheduledTime);
const sequence = (t: QueueToken) => t.tokenSeq || Number(t.tokenNumber.split('-').pop());

/** Calling order: emergency priority first, then token sequence. */
export const byQueueOrder = (a: QueueToken, b: QueueToken) =>
  (a.priority === 'emergency' ? 0 : 1) - (b.priority === 'emergency' ? 0 : 1) ||
  sequence(a) - sequence(b);

/**
 * Waiting patients who will be called before `target`. A booked patient whose appointment
 * time has not arrived is not ahead of anyone who can be seen earlier.
 */
export function patientsAhead(waiting: QueueToken[], target: QueueToken, nowMinute: number) {
  const horizon = Math.max(nowMinute, unscheduled(target) ? 0 : clockMinutes(target.scheduledTime));
  const eligible = waiting
    .filter(
      (t) =>
        t.id === target.id ||
        t.priority === 'emergency' ||
        unscheduled(t) ||
        clockMinutes(t.scheduledTime) <= horizon,
    )
    .sort(byQueueOrder);
  const index = eligible.findIndex((t) => t.id === target.id);
  return index < 0 ? [] : eligible.slice(0, index);
}
