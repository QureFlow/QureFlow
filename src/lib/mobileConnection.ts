export const mobileConnectionKey = 'qureflow_mobile_api';

/** Local demonstration servers only; never accept embedded credentials or arbitrary paths. */
export function normalizeMobileServer(value: string): string {
  const url = new URL(value.trim());
  const parts = url.hostname.split('.').map(Number);
  const ipv4 = parts.length === 4 && parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 255);
  const local = url.hostname === 'localhost' || (ipv4 && (
    parts[0] === 10 || parts[0] === 127 ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
  ));
  if (!local || !['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    url.search || url.hash || !['/', '/api', '/api/'].includes(url.pathname))
    throw new Error('Enter the clinic computer’s local address, for example http://192.168.1.10:5001.');
  return url.origin + '/api';
}

export function resolveApiBase(configured: string | undefined, native: boolean, saved: string | null): string {
  const fallback = (configured || '/api').replace(/\/$/, '');
  if (!native || !saved) return fallback;
  try { return normalizeMobileServer(saved); } catch { return fallback; }
}
