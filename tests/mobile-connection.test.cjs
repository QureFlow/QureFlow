const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/mobileConnection.ts');
const compiled = new Module(filename);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, filename);
const { normalizeMobileServer, resolveApiBase } = compiled.exports;
const { findClinicServers, probeClinicServer } = compiled.exports;
const healthy = (serverId = 'clinic-a') => ({ status: 'healthy', project: 'QureFlow',
  database: 'mysql', discoveryVersion: 1, serverId, serverName: 'QureFlow Clinic' });

function nativeClient(context) {
  const originals = {};
  for (const key of ['localStorage', 'sessionStorage', 'window', 'fetch']) originals[key] = global[key];
  const memory = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
      removeItem: key => values.delete(key) };
  };
  global.localStorage = memory();
  global.sessionStorage = memory();
  global.window = new EventTarget();
  localStorage.setItem('qureflow_mobile_api', 'http://192.168.1.8:5001/api');
  sessionStorage.setItem('qureflow_token', 'test-session');
  const clientFilename = path.resolve(__dirname, '../src/services/apiClient.ts');
  const clientModule = new Module(clientFilename);
  clientModule.require = name => {
    if (name === '@capacitor/core') return { Capacitor: { getPlatform: () => 'android', isNativePlatform: () => true } };
    if (name === '../lib/mobileConnection') return compiled.exports;
    throw new Error('Unexpected dependency: ' + name);
  };
  // The test host supplies Vite's build-time configuration; all request code is the real client.
  const source = fs.readFileSync(clientFilename, 'utf8')
    .replace('import.meta.env.VITE_API_GATEWAY_URL', JSON.stringify('/api'));
  clientModule._compile(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, clientFilename);
  context.after(() => {
    clientModule.exports.setNativeClinicReady(false);
    for (const key of Object.keys(originals)) global[key] = originals[key];
  });
  const authFilename = path.resolve(__dirname, '../src/services/authService.ts');
  const authModule = new Module(authFilename);
  const user = { id: 'patient-a', role: 'patient' };
  let cachedUser = user;
  authModule.require = name => {
    if (name === './apiClient') return clientModule.exports;
    if (name === './storage') return { storage: {
      getActiveUser: () => cachedUser, setActiveUser: value => { cachedUser = value; },
    } };
    throw new Error('Unexpected auth dependency: ' + name);
  };
  authModule._compile(ts.transpileModule(fs.readFileSync(authFilename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, authFilename);
  return { ...clientModule.exports, authService: authModule.exports.authService, user };
}

test('doctor directory reloads after a connection check without losing search filters', async context => {
  const React = require('react');
  const { create, act } = require('react-test-renderer');
  let screen;
  context.after(() => { if (screen) act(() => screen.unmount()); });
  const { apiClient, setNativeClinicReady } = nativeClient(context);
  const pause = () => new Promise(resolve => setTimeout(resolve, 270));
  let interrupt = false;
  const searches = [];
  global.fetch = async (url, options) => {
    if (interrupt) return new Promise((_resolve, reject) =>
      options.signal.addEventListener('abort', () => reject(new Error('Connection check')), { once: true }));
    return { ok: true, status: 200, json: async () => url.includes('/options')
      ? { specialties: ['Cardiology'], languages: ['English'], doctorCount: 48, clinicCount: 6 }
      : { doctors: [{ id: 'doctor-a', name: 'Dr Test', specialization: 'Cardiology' }], total: 1 } };
  };
  const loadSource = (relative, dependencies) => {
    const target = path.resolve(__dirname, '..', relative);
    const result = new Module(target);
    result.require = name => {
      if (name === 'react') return React;
      if (Object.hasOwn(dependencies, name)) return dependencies[name];
      throw new Error('Unexpected component dependency: ' + name);
    };
    result._compile(ts.transpileModule(fs.readFileSync(target, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, target);
    return result.exports;
  };
  const sourcePath = path.resolve(__dirname, '../src/hooks/useClinicConnectionRevision.ts');
  const hook = fs.existsSync(sourcePath) ? loadSource('src/hooks/useClinicConnectionRevision.ts',
    { '../lib/mobileConnection': compiled.exports }) : {};
  const Empty = () => null;
  const { DoctorList } = loadSource('src/pages/patient/DoctorList.tsx', {
    '../../services/doctorService': { doctorService: {
      directoryOptions: () => apiClient.get('/doctors/options'),
      searchDoctors: filters => { searches.push(filters); return apiClient.get('/doctors/search'); },
    } },
    'react-router-dom': { useSearchParams: () => [new URLSearchParams(), () => {}] },
    '../../context/QueueContext': { useQueue: () => ({ doctors: [], clinics: [] }) },
    '../../components/layout/Navbar': { Navbar: Empty },
    '../../components/layout/MobileNav': { MobileNav: Empty },
    '../../components/layout/Footer': { Footer: Empty },
    '../../components/patient/DoctorCard': { DoctorCard: ({ doctor }) =>
      React.createElement('article', { 'data-doctor-id': doctor.id }, doctor.name) },
    'lucide-react': { Search: Empty, SlidersHorizontal: Empty, ChevronLeft: Empty,
      ChevronRight: Empty, ArrowUpRight: Empty },
    '../../lib/specialtyAppearance': { specialtyAppearance: () => ({ tone: 'blue' }) },
    '../../hooks/useClinicConnectionRevision': hook,
  });
  setNativeClinicReady(true);
  act(() => { screen = create(React.createElement(DoctorList)); });
  await act(pause);
  assert.equal(screen.root.findAllByProps({ 'data-doctor-id': 'doctor-a' }).length, 1);
  interrupt = true;
  act(() => screen.root.findByProps({ 'aria-label': 'Search doctors' }).props.onChange(
    { target: { value: 'cardiology' } }));
  await act(pause);
  await act(async () => { setNativeClinicReady(false); });
  assert.equal(screen.root.findAllByProps({ 'data-doctor-id': 'doctor-a' }).length, 0);
  interrupt = false;
  act(() => setNativeClinicReady(true));
  await act(pause);
  assert.equal(screen.root.findAllByProps({ 'data-doctor-id': 'doctor-a' }).length, 1);
  assert.equal(screen.root.findByProps({ 'aria-label': 'Search doctors' }).props.value, 'cardiology');
  assert.equal(searches.at(-1).query, 'cardiology');
  assert.equal(screen.root.findAllByProps({ role: 'alert' }).length, 0);
});

test('temporary native verification preserves login but a rejected session clears it', async context => {
  const { apiClient, authService, setNativeClinicReady, user } = nativeClient(context);
  assert.deepEqual(await authService.getCurrentUser(), user);
  assert.equal(apiClient.getAuthToken(), 'test-session');
  setNativeClinicReady(true);
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: 'Expired session' }) });
  assert.equal(await authService.getCurrentUser(), null);
  assert.equal(apiClient.getAuthToken(), null);
});

test('native API calls are blocked before discovery and while identity is being rechecked', async context => {
  const { apiClient, setNativeClinicReady } = nativeClient(context);
  let requests = 0;
  global.fetch = async (url, options) => {
    requests++;
    assert.equal(url, 'http://192.168.1.8:5001/api/doctors');
    assert.equal(options.headers.Authorization, 'Bearer test-session');
    return { ok: true, status: 200, json: async () => [] };
  };
  await assert.rejects(apiClient.get('/doctors'), /checking the clinic connection/);
  assert.equal(requests, 0);
  setNativeClinicReady(true);
  await apiClient.get('/doctors');
  setNativeClinicReady(false);
  await assert.rejects(apiClient.get('/doctors'), /checking the clinic connection/);
  assert.equal(requests, 1);
});

test('a connection check cancels in-flight calls and never replays a mutation', async context => {
  const { apiClient, setNativeClinicReady } = nativeClient(context);
  let requests = 0;
  global.fetch = async (_url, options) => {
    requests++;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort',
      () => reject(new Error('Aborted')), { once: true }));
  };
  setNativeClinicReady(true);
  const booking = apiClient.post('/appointments', { doctorId: 'doctor-a' });
  setNativeClinicReady(false);
  await assert.rejects(booking, /Check your appointments or queue/);
  setNativeClinicReady(true);
  assert.equal(requests, 1);
});

test('a failed native request signals rediscovery without retrying the booking', async context => {
  const { apiClient, setNativeClinicReady } = nativeClient(context);
  let requests = 0, reconnects = 0;
  global.fetch = async () => { requests++; throw new TypeError('Offline'); };
  window.addEventListener(compiled.exports.mobileConnectionLostEvent, () => {
    reconnects++;
    setNativeClinicReady(false);
  });
  setNativeClinicReady(true);
  await assert.rejects(apiClient.post('/appointments', {}), /Network error/);
  await assert.rejects(apiClient.get('/doctors'), /checking the clinic connection/);
  assert.equal(requests, 1);
  assert.equal(reconnects, 1);
});

test('first launch finds a clinic without a saved IP and probes without credentials', async () => {
  const found = await findClinicServers(null, null, async () => [
    { apiBase: 'http://192.168.1.8:5001', serverId: 'clinic-a' },
  ], async (url, options) => {
    assert.equal(url, 'http://192.168.1.8:5001/api/health');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, json: async () => healthy() };
  });
  assert.equal(found.length, 1);
  assert.equal(found[0].serverId, 'clinic-a');
});

test('a healthy saved clinic connects immediately without starting discovery', async () => {
  const found = await findClinicServers('http://192.168.1.8:5001/api', 'clinic-a',
    async () => { throw new Error('Discovery should not run'); },
    async () => ({ ok: true, json: async () => healthy() }));
  assert.equal(found.length, 1);
});

test('a changed IP is recovered by discovery and duplicate interfaces are collapsed', async () => {
  const found = await findClinicServers('http://192.168.1.8:5001', 'clinic-a',
    async () => [{ apiBase: 'http://192.168.1.9:5001', serverId: 'clinic-a' },
      { apiBase: 'http://10.1.1.9:5001', serverId: 'clinic-a' }],
    async url => {
      if (url.includes('192.168.1.8')) throw new TypeError('Offline');
      return { ok: true, json: async () => healthy() };
    });
  assert.equal(found.length, 1);
  assert.equal(found[0].apiBase, 'http://192.168.1.9:5001/api');
});

test('a reused IP with a different server identity triggers discovery', async () => {
  let discovered = false;
  const found = await findClinicServers('http://192.168.1.8:5001', 'clinic-a',
    async () => { discovered = true; return [{ apiBase: 'http://192.168.1.9:5001', serverId: 'clinic-a' }]; },
    async url => ({ ok: true, json: async () => healthy(url.includes('.8:') ? 'clinic-b' : 'clinic-a') }));
  assert.equal(discovered, true);
  assert.equal(found[0].serverId, 'clinic-a');
});

test('discovery rejects public URLs, wrong databases and mismatched advertised identities', async () => {
  let requests = 0;
  const found = await findClinicServers(null, null, async () => [
    { apiBase: 'http://example.com', serverId: 'clinic-a' },
    { apiBase: 'http://192.168.1.8:5001', serverId: 'clinic-a' },
    { apiBase: 'http://192.168.1.9:5001', serverId: 'clinic-b' },
  ], async url => {
    requests++;
    return { ok: true, json: async () => url.includes('.8:') ? { ...healthy(), database: 'dynamodb' } : healthy() };
  });
  assert.equal(requests, 2);
  assert.deepEqual(found, []);
});

test('multiple clinics remain distinct so the interface can offer a choice', async () => {
  const found = await findClinicServers(null, null, async () => [
    { apiBase: 'http://192.168.1.8:5001', serverId: 'clinic-a' },
    { apiBase: 'http://192.168.1.9:5001', serverId: 'clinic-b' },
  ], async url => ({ ok: true, json: async () => healthy(url.includes('.8:') ? 'clinic-a' : 'clinic-b') }));
  assert.equal(found.length, 2);
});

test('failed or malformed health responses are never accepted', async () => {
  for (const body of [{}, { ...healthy(), status: 'unhealthy' }, { ...healthy(), serverId: '' },
    { ...healthy(), discoveryVersion: 2 }]) {
    assert.equal(await probeClinicServer('http://127.0.0.1:5001',
      async () => ({ ok: true, json: async () => body })), null);
  }
  assert.equal(await probeClinicServer('http://127.0.0.1:5001',
    async () => ({ ok: false, json: async () => healthy() })), null);
});

test('phone, emulator and USB addresses retain the server port', () => {
  for (const host of ['172.16.145.76', '192.168.1.10', '10.0.2.2', '127.0.0.1', 'localhost'])
    assert.equal(normalizeMobileServer(`http://${host}:5001`), `http://${host}:5001/api`);
});
test('server input accepts an API suffix and whitespace without duplicating the path', () => {
  assert.equal(normalizeMobileServer('  http://192.168.1.10:5001/api/  '), 'http://192.168.1.10:5001/api');
});
test('public hosts and private network lookalikes cannot receive app sessions', () => {
  for (const host of ['example.com', '172.32.1.1', '192.169.1.1', '192.168.1.10.example.com', '8.8.8.8'])
    assert.throws(() => normalizeMobileServer(`http://${host}:5001`));
});
test('embedded credentials, unrelated paths, query strings and fragments are rejected', () => {
  for (const url of ['http://user:secret@192.168.1.10:5001', 'http://192.168.1.10:5001/admin',
    'http://192.168.1.10:5001?x=1', 'http://192.168.1.10:5001#x', 'ftp://192.168.1.10:5001'])
    assert.throws(() => normalizeMobileServer(url));
});
test('web configuration ignores a saved phone server', () => {
  assert.equal(resolveApiBase('/api', false, 'http://192.168.1.10:5001'), '/api');
});
test('native configuration uses a valid saved server and rejects corrupt stored settings', () => {
  assert.equal(resolveApiBase('http://10.0.2.2:5001/api', true, 'http://192.168.1.10:5001'), 'http://192.168.1.10:5001/api');
  assert.equal(resolveApiBase('http://10.0.2.2:5001/api', true, 'http://example.com'), 'http://10.0.2.2:5001/api');
});
