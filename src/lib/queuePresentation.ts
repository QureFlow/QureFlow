import type { QueueToken } from '../types';

export const displayQueue = (tokens: QueueToken[]) => {
  const ranks = { current: 0, waiting: 1, completed: 2, skipped: 3, cancelled: 4 };
  // Preserve the API's priority / token sequence order for waiting patients.
  // Fixture timestamps can differ from the sequence used by the call-next endpoint.
  return [...tokens].sort((a, b) => ranks[a.status] - ranks[b.status]);
};

export const nextCallableToken = (tokens: QueueToken[], now = new Date()) => {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .split(':');
  const currentMinutes = Number(time[0]) * 60 + Number(time[1]);
  return (
    tokens.find((token) => {
      if (token.status !== 'waiting') return false;
      if (
        token.priority === 'emergency' ||
        token.isWalkIn ||
        ['Now', 'Walk-in'].includes(token.scheduledTime)
      )
        return true;
      const match = /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(token.scheduledTime);
      if (!match) return false;
      const scheduledMinutes =
        (Number(match[1]) % 12) * 60 + Number(match[2]) + (match[3] === 'PM' ? 720 : 0);
      return scheduledMinutes <= currentMinutes;
    }) ?? null
  );
};

/** The likely spread of a wait estimate, e.g. "Usually 8–18 min"; empty when not meaningful. */
export const waitRangeText = (range?: { low: number; high: number }) =>
  range && range.high > range.low ? `Usually ${range.low}–${range.high} min` : '';
