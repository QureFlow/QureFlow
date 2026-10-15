import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const output = path.join(root, 'docs/verification/local', runId);
mkdirSync(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), machine: process.env.COMPUTERNAME,
  node: process.version, evidenceDirectory: output, results: [] };
const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const npm = process.execPath;
function run(name, command, args, options = {}) {
  console.log(`Running ${name}...`);
  const start = Date.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8',
    maxBuffer: 30 * 1024 * 1024, timeout: 600000,
    ...options });
  const log = (result.stdout || '') + (result.stderr || '') + (result.error ? '\n' + result.error.message : '');
  writeFileSync(path.join(output, `${name}.txt`), log);
  const item = { name, exitCode: result.status, passed: result.status === 0, durationMs: Date.now() - start };
  report.results.push(item);
  console.log(`${item.passed ? 'PASS' : 'FAIL'} ${name}`);
  if (name === 'mysql-tests') {
    const cases = [...log.matchAll(/^    (not ok|ok) (\d+) - (.+)$/gm)]
      .map((m) => ({ id: `TC${m[2].padStart(2, '0')}`, description: m[3], passed: m[1] === 'ok' }));
    writeFileSync(path.join(output, 'mysql-test-cases.json'), JSON.stringify(cases, null, 2));
    const guide = readFileSync(path.join(root, 'docs/DBMS-DEMONSTRATION.md'), 'utf8');
    const expectations = new Map([...guide.matchAll(/^\| (TC\d+) \| (.+?) \| (.+?) \|$/gm)]
      .map((m) => [m[1], { input: m[2], expected: m[3] }]));
    writeFileSync(path.join(output, 'test-cases.md'), '# Executed MySQL test cases\n\n' +
      `Executed at ${report.startedAt}. Each case uses a disposable qureflow_test database.\n\n` +
      '| TC ID | Description | Input | Expected output | Actual output | Status |\n|---|---|---|---|---|---|\n' +
      cases.map((c) => { const expected = expectations.get(c.id); return `| ${c.id} | ${c.description} | ${expected?.input || 'See test source'} | ${expected?.expected || 'See test assertions'} | ${c.passed ? 'All expected assertions passed' : 'See mysql-tests.txt'} | ${c.passed ? 'Pass' : 'Fail'} |`; }).join('\n') + '\n');
  }
  return item.passed;
}
if (!run('mysql-ready', 'docker', ['compose', '-p', 'qureflow-dbms', '-f', 'compose.dbms.yaml', 'up', '-d', '--wait'])) {
  process.exitCode = 1;
} else {
  const seeded = run('seed', npm, [npmCli, 'run', 'seed']);
  run('mysql-tests', process.execPath, ['backend/node_modules/tsx/dist/cli.mjs', '--test', '--test-reporter=tap', 'backend/tests/mysql.test.ts']);
  run('frontend-tests', process.execPath, ['--test', 'tests/frontend-insights.test.cjs']);
  run('mobile-connection-tests', process.execPath, ['--test', 'tests/mobile-connection.test.cjs']);
  run('announcement-tests', npm, [npmCli, 'run', 'test:announcements']);
  run('web-build', npm, [npmCli, 'run', 'build']);
  run('mobile-build', npm, [npmCli, 'run', 'android:sync']);
  const apkBuilt = run('android-apk', npm, [npmCli, 'run', 'android:apk']);
  if (apkBuilt) run('apk-validation', 'powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/verify-apk.ps1']);
  if (seeded) {
    run('dataset', npm, [npmCli, 'run', 'verify:dbms', '--prefix', 'backend']);
    run('schema', process.execPath, ['backend/node_modules/tsx/dist/cli.mjs', 'backend/src/dbms/evidence.ts', output]);
    for (const file of ['003_demonstration_queries.sql', '004_transaction_demonstration.sql']) {
      run(file.slice(0, 3) + '-sql', 'docker', ['compose', '-p', 'qureflow-dbms', '-f', 'compose.dbms.yaml', 'exec', '-T', 'mysql',
        'mysql', '-uqureflow', '-pqureflow_local_only', '--table', '--verbose', 'qureflow_dbms'],
        { input: readFileSync(path.join(root, 'backend/sql', file), 'utf8') });
    }
  }
}
report.finishedAt = new Date().toISOString();
writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2));
writeFileSync(path.join(root, 'docs/verification/local/latest.json'), JSON.stringify(report, null, 2));
console.log(`Evidence: ${output}`);
if (report.results.some((r) => !r.passed)) process.exitCode = 1;
