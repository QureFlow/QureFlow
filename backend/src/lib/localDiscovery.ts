import { createSocket } from 'node:dgram';

interface ServerIdentity { apiPort: number; serverId: string }
export const localDiscoveryPort = 45831;

/** Anonymous routing metadata only; malformed and non-local traffic is ignored. */
export function discoveryReply(packet: Buffer, address: string, server: ServerIdentity): Buffer | null {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isInteger(value) || value < 0 || value > 255) ||
    !(parts[0] === 10 || parts[0] === 127 || (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)) || packet.length > 512) return null;
  try {
    const request = JSON.parse(packet.toString('utf8'));
    if (request?.type !== 'QureFlowDiscover' || request.version !== 1 ||
      typeof request.nonce !== 'string' || !/^[a-zA-Z0-9_-]{8,64}$/.test(request.nonce)) return null;
    return Buffer.from(JSON.stringify({ type: 'QureFlowServer', version: 1, nonce: request.nonce,
      serverId: server.serverId, port: server.apiPort }));
  } catch { return null; }
}

export function startLocalDiscovery(server: ServerIdentity,
  options: { port?: number; host?: string } = {}) {
  const socket = createSocket('udp4');
  let windowStart = 0, replies = 0;
  socket.on('message', (packet, remote) => {
    const now = Date.now();
    if (now - windowStart >= 1000) { windowStart = now; replies = 0; }
    if (replies >= 20) return;
    const reply = discoveryReply(packet, remote.address, server);
    if (!reply) return;
    replies++;
    socket.send(reply, remote.port, remote.address, () => {});
  });
  socket.on('error', error => console.warn('[QureFlow local discovery]', error.message));
  socket.bind(options.port ?? localDiscoveryPort, options.host ?? '0.0.0.0');
  socket.unref();
  return socket;
}
