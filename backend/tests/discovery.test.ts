import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Bonjour from 'bonjour-service';
import { advertiseClinic, clinicIdentity, discoveryInstanceName } from '../src/lib/clinicDiscovery.js';

test('long and Unicode clinic names fit one valid DNS label without splitting a character', () => {
  for (const name of ['A'.repeat(80), 'क्लिनिक'.repeat(20), '🏥'.repeat(40)]) {
    const label = discoveryInstanceName(name, '12345678-abcd');
    assert.ok(Buffer.byteLength(label) <= 63);
    assert.equal(Buffer.from(label).toString('utf8'), label);
    assert.ok(label.endsWith(' 12345678'));
  }
});

test('the Wi-Fi advertisement resolves to the running API with the same stable identity', { timeout: 20000 }, async context => {
  // Use a separate installation identity so verification can run beside a live clinic.
  const originalDirectory = process.cwd();
  const testDirectory = mkdtempSync(path.join(tmpdir(), 'qureflow-discovery-'));
  const identityDirectory = path.join(testDirectory, 'backend');
  mkdirSync(identityDirectory);
  process.chdir(testDirectory);
  context.after(() => {
    process.chdir(originalDirectory);
    unlinkSync(path.join(identityDirectory, '.qureflow-server.local'));
    rmdirSync(identityDirectory);
    rmdirSync(testDirectory);
  });
  const identity = clinicIdentity();
  assert.deepEqual(clinicIdentity(), identity);
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PROVIDER = 'mysql';
  process.env.AUTH_PROVIDER = 'local';
  process.env.CORS_ORIGINS = 'https://localhost';
  const { app } = await import('../src/server.js');
  const server = app.listen(0, '0.0.0.0');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const stop = advertiseClinic(port, { discoveryPort: 0 });
  const browser = new Bonjour();
  const search = browser.find({ type: 'qureflow' });
  try {
    const found: any = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No QureFlow mDNS reply on this computer')), 14000);
      search.on('up', service => {
        if (service.port === port && service.txt?.id === identity.serverId) {
          clearTimeout(timer);
          resolve(service);
        }
      });
    });
    assert.equal(found.txt.project, 'QureFlow');
    assert.equal(found.txt.database, 'mysql');
    assert.equal(found.txt.version, '1');
    assert.deepEqual(Object.keys(found.txt).sort(), ['addresses', 'database', 'id', 'project', 'version']);
    assert.ok(Buffer.byteLength(found.txt.addresses) <= 223);
    const response = await fetch('http://127.0.0.1:' + found.port + '/api/health', { headers: { Origin: 'https://localhost' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://localhost');
    const health = await response.json() as any;
    assert.equal(health.serverId, found.txt.id);
    assert.equal(health.discoveryVersion, 1);
    assert.equal(health.database, 'mysql');
    assert.equal(health.status, 'healthy');
    assert.deepEqual(Object.keys(health).sort(),
      ['database', 'discoveryVersion', 'project', 'serverId', 'serverName', 'status', 'timestamp']);
  } finally {
    search.stop();
    browser.destroy();
    stop();
    server.close();
  }
});
