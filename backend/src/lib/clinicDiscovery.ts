import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { hostname, networkInterfaces } from 'node:os';
import path from 'node:path';
import Bonjour from 'bonjour-service';
import { startLocalDiscovery } from './localDiscovery.js';

let identity: { serverId: string; serverName: string } | undefined;

/** Wi-Fi discovery is for a clinic's local server; cloud deployments leave it off. */
export const discoveryEnabled = () =>
  process.env.CLINIC_DISCOVERY === 'true' && !process.env.AWS_LAMBDA_FUNCTION_NAME;

export function clinicIdentity() {
  if (identity) return identity;
  const identityFile = path.resolve(
    process.cwd(),
    process.cwd().endsWith('backend') ? '.qureflow-server.local' : 'backend/.qureflow-server.local',
  );
  let serverId: string;
  try {
    serverId = readFileSync(identityFile, 'utf8').trim();
    if (!/^[a-f0-9-]{36}$/.test(serverId)) throw new Error('Invalid saved server identity');
  } catch (error: any) {
    if (error.code !== 'ENOENT') throw error;
    serverId = randomUUID();
    writeFileSync(identityFile, serverId, { flag: 'wx' });
  }
  identity = {
    serverId,
    serverName: (process.env.CLINIC_SERVER_NAME || 'QureFlow · ' + hostname()).slice(0, 70),
  };
  return identity;
}

/** Publish only the API and public installation identity; never patient data or credentials. */
export function discoveryInstanceName(name: string, id: string) {
  let prefix = '';
  for (const character of name.replaceAll('.', ' ')) {
    if (Buffer.byteLength(prefix + character, 'utf8') > 54) break;
    prefix += character;
  }
  return prefix + ' ' + id.slice(0, 8);
}

function lanAddresses() {
  return [
    ...new Set(
      Object.values(networkInterfaces())
        .flatMap((entries) => entries || [])
        .filter((entry) => entry.family === 'IPv4' && !entry.internal)
        .map((entry) => entry.address)
        .filter((address) => {
          const parts = address.split('.').map(Number);
          return (
            parts[0] === 10 ||
            (parts[0] === 192 && parts[1] === 168) ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
          );
        }),
    ),
  ]
    .sort()
    .slice(0, 14)
    .join(',');
}

export function advertiseClinic(port: number, options: { discoveryPort?: number } = {}) {
  const { serverId, serverName } = clinicIdentity();
  const directDiscovery = startLocalDiscovery(
    { apiPort: port, serverId },
    { port: options.discoveryPort },
  );
  const bonjour = new Bonjour({}, (error: Error) =>
    console.warn('[QureFlow Wi-Fi] Discovery unavailable:', error.message),
  );
  let addresses = lanAddresses();
  const publish = () =>
    bonjour.publish({
      name: discoveryInstanceName(serverName, serverId),
      type: 'qureflow',
      protocol: 'tcp',
      port,
      disableIPv6: true,
      txt: { project: 'QureFlow', database: 'dynamodb', id: serverId, version: '1', addresses },
    });
  let service = publish();
  service.on('up', () =>
    console.log('[QureFlow Wi-Fi] Automatic Android connection available on this network.'),
  );
  service.on('error', (error: Error) => console.warn('[QureFlow Wi-Fi]', error.message));
  let stopped = false;
  // Refresh DNS records when DHCP or Wi-Fi changes the computer's addresses.
  const refresh = setInterval(() => {
    const updated = lanAddresses();
    if (stopped || updated === addresses) return;
    addresses = updated;
    service.stop(() => {
      if (stopped) return;
      service = publish();
      service.on('error', (error: Error) => console.warn('[QureFlow Wi-Fi]', error.message));
    });
  }, 10000);
  refresh.unref();
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(refresh);
    try {
      directDiscovery.close();
    } catch {
      /* It may already be closed after a bind failure. */
    }
    bonjour.unpublishAll(() => bonjour.destroy());
  };
}
