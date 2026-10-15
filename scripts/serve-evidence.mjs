import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'docs/verification/local');
const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
http.createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/') { response.writeHead(404).end('Not found'); return; }
  try {
    const latest = JSON.parse(readFileSync(path.join(base, 'latest.json'), 'utf8'));
    const directory = path.resolve(latest.evidenceDirectory);
    if (!directory.startsWith(base + path.sep)) throw new Error('Invalid evidence directory');
    const cases = JSON.parse(readFileSync(path.join(directory, 'mysql-test-cases.json'), 'utf8'));
    const sql = readFileSync(path.join(directory, '003-sql.txt'), 'utf8');
    const transaction = readFileSync(path.join(directory, '004-sql.txt'), 'utf8');
    const browserProof = ['browser-booking-before.txt', 'browser-booking-after.txt']
      .filter((file) => existsSync(path.join(directory, file)))
      .map((file) => {
        const log = readFileSync(path.join(directory, file), 'utf8');
        const table = log.split(/\r?\n/).filter((line) => line.startsWith('|'))
          .map((line) => line.split('|').slice(1, -1).map((value) => value.trim()));
        return `<h3>${file.includes('before') ? 'App booking persisted in SQL' : 'App cancellation persisted in SQL'}</h3>
          <p>Exact rows from the captured MySQL result; all identities are synthetic.</p>
          <table class="proof"><tr>${(table[0] || []).map((v) => `<th>${escape(v)}</th>`).join('')}</tr>
          ${table.slice(1).map((row) => `<tr>${row.map((v) => `<td>${escape(v)}</td>`).join('')}</tr>`).join('')}</table>
          <details><summary>SQL query and raw output</summary><pre>${escape(log)}</pre></details>`;
      }).join('');
    const caption = 'Actual captured MySQL execution output. Synthetic local records only.';
    const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QureFlow executed DBMS evidence</title>
      <style>body{font:16px system-ui;margin:32px;color:#102e3d;background:#f5f8fa}main{max-width:1100px;margin:auto}h1{margin-bottom:8px}nav{display:flex;gap:24px;margin:24px 0}section{padding:24px;background:white;border:1px solid #dce7eb;border-radius:12px;margin:24px 0}table{border-collapse:collapse;width:100%}td,th{padding:10px;text-align:left;border-bottom:1px solid #e0e9ed}.proof{table-layout:fixed;font-size:12px}.proof td,.proof th{overflow-wrap:anywhere;padding:8px}details{margin:16px 0}pre{font:13px Consolas,monospace;overflow:auto;white-space:pre}a{color:#087b91}.pass{color:#167042}.fail{color:#a23421}</style>
      <main><h1>QureFlow executed DBMS evidence</h1><p>Executed ${escape(latest.startedAt)} on ${escape(latest.machine)}.</p><p>${caption} Native Android device checks are recorded separately.</p>
      <nav><a href="#tests">Test cases</a><a href="#queries">SQL queries</a><a href="#transaction">Trigger and rollback</a><a href="#browser">Browser booking proof</a></nav>
      <section id="tests"><h2>MySQL integration tests</h2><p>${cases.filter((c) => c.passed).length} passed of ${cases.length} cases.</p><table><tr><th>Test</th><th>Executed case</th><th>Result</th></tr>${cases.map((c) => `<tr><td>${escape(c.id)}</td><td>${escape(c.description)}</td><td class="${c.passed?'pass':'fail'}">${c.passed?'Pass':'Fail'}</td></tr>`).join('')}</table></section>
      <section id="queries"><h2>Executed SQL queries and routine output</h2><p>${caption}</p><pre>${escape(sql)}</pre></section>
      <section id="transaction"><h2>Trigger synchronization and transaction rollback</h2><p>The final result confirms zero remaining demonstration records.</p><pre>${escape(transaction)}</pre></section><section id="browser"><h2>Browser booking and cancellation</h2>${browserProof || '<p>Run the browser workflow and capture its SQL output separately.</p>'}</section></main></html>`;
    response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'", 'X-Content-Type-Options':'nosniff' }).end(html);
  } catch {
    response.writeHead(503).end('Run npm run verify:local to generate evidence first.');
  }
}).listen(5175, '127.0.0.1', () => console.log('Read-only captured evidence: http://127.0.0.1:5175'));
