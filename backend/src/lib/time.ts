export const TIME_ZONE = 'Asia/Kolkata';
export const clinicDate = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
export const clockMinutes = (label: string): number => {
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(label);
  if (!match) throw new Error('Invalid appointment time');
  return (Number(match[1]) % 12) * 60 + Number(match[2]) + (match[3] === 'PM' ? 720 : 0);
};
export const timeLabel = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${minutes < 720 ? 'AM' : 'PM'}`;
export const clinicNowMinutes = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .split(':');
  return Number(parts[0]) * 60 + Number(parts[1]);
};
export const weekday = (date: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, weekday: 'long' }).format(
    new Date(`${date}T12:00:00+05:30`),
  );
