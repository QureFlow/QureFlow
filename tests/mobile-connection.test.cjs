const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/mobileConnection.ts');
const compiled = new Module(filename);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const { normalizeMobileServer, resolveApiBase } = compiled.exports;

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
