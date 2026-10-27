import test from 'node:test';
import assert from 'node:assert/strict';
import { createSocket } from 'node:dgram';
import { once } from 'node:events';
import { discoveryReply, startLocalDiscovery } from '../src/lib/localDiscovery.js';

const identity = { apiPort: 5001, serverId: '12345678-1234-1234-1234-123456789abc' };
const query = { type: 'QureFlowDiscover', version: 1, nonce: 'test-session-1234' };

test('hotspot discovery returns only public routing identity and the request nonce', () => {
  const reply = discoveryReply(Buffer.from(JSON.stringify(query)), '192.168.43.1', identity);
  assert.deepEqual(JSON.parse(reply!.toString()), { type: 'QureFlowServer', version: 1,
    nonce: query.nonce, serverId: identity.serverId, port: 5001 });
});

test('malformed, unrelated, oversized and non-local discovery requests receive no reply', () => {
  for (const body of ['garbage', 'null', JSON.stringify({ ...query, version: 2 }),
    JSON.stringify({ ...query, nonce: '' }), JSON.stringify({ ...query, type: 'other' }), 'x'.repeat(513)]) {
    assert.equal(discoveryReply(Buffer.from(body), '192.168.43.1', identity), null);
  }
  for (const host of ['8.8.8.8', '172.32.1.1', '192.168.1.1.example.com', '999.1.1.1'])
    assert.equal(discoveryReply(Buffer.from(JSON.stringify(query)), host, identity), null);
});

test('direct discovery works over a real UDP socket without an mDNS service', { timeout: 4000 }, async () => {
  const responder = startLocalDiscovery(identity, { port: 0, host: '127.0.0.1' });
  const client = createSocket('udp4');
  try {
    await once(responder, 'listening');
    const port = responder.address().port;
    const answer = once(client, 'message');
    client.send(Buffer.from(JSON.stringify(query)), port, '127.0.0.1');
    const [packet] = await answer;
    assert.equal(JSON.parse(packet.toString()).nonce, query.nonce);
    assert.equal(JSON.parse(packet.toString()).serverId, identity.serverId);
  } finally {
    client.close();
    responder.close();
  }
});
