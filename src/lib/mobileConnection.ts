export const mobileConnectionKey = 'qureflow_mobile_api';
export const mobileServerIdKey = 'qureflow_mobile_server_id';
export const mobileConnectionLostEvent = 'qureflow-connection-lost';
export const mobileConnectionReadyEvent = 'qureflow-connection-ready';

export interface ClinicServer {
  apiBase: string;
  serverId: string;
  serverName: string;
}
export interface DiscoveryCandidate { apiBase: string; serverId: string }
type HealthFetch = (url: string, options: RequestInit) => Promise<Pick<Response, 'ok' | 'json'>>;

/** Discovery probes are anonymous. Never forward a session to an unverified address. */
export async function probeClinicServer(
  address: string, fetchHealth: HealthFetch = fetch, timeoutMs = 2200,
): Promise<ClinicServer | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const apiBase = normalizeMobileServer(address);
    const response = await fetchHealth(apiBase + '/health', {
      signal: controller.signal, credentials: 'omit', redirect: 'error', cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const health = await response.json();
    if (!response.ok || health.project !== 'QureFlow' || health.database !== 'mysql' ||
      health.status !== 'healthy' || health.discoveryVersion !== 1 ||
      typeof health.serverId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(health.serverId))
      return null;
    return { apiBase, serverId: health.serverId,
      serverName: typeof health.serverName === 'string' ? health.serverName.slice(0, 80) : 'QureFlow Clinic' };
  } catch { return null; }
  finally { clearTimeout(timeout); }
}

export async function findClinicServers(
  savedAddress: string | null, savedId: string | null,
  discover: () => Promise<DiscoveryCandidate[]>, fetchHealth: HealthFetch = fetch,
): Promise<ClinicServer[]> {
  if (savedAddress) {
    const saved = await probeClinicServer(savedAddress, fetchHealth);
    if (saved && (!savedId || saved.serverId === savedId)) return [saved];
  }
  // Bound both work and fan-out even on a network with many advertisements.
  const candidates = (await discover()).slice(0, 16);
  const servers: ClinicServer[] = [];
  for (let index = 0; index < candidates.length; index += 4) {
    const results = await Promise.all(candidates.slice(index, index + 4).map(async candidate => {
      const server = await probeClinicServer(candidate.apiBase, fetchHealth);
      return server && server.serverId === candidate.serverId ? server : null;
    }));
    for (const server of results)
      if (server && !servers.some(existing => existing.serverId === server.serverId)) servers.push(server);
  }
  return servers;
}

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
