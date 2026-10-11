const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

// Compile the real frontend components in memory; no database or server is used.
function loadComponent(relativePath) {
  const filename = path.resolve(__dirname, '..', relativePath);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const compiledModule = new Module(filename);
  compiledModule.filename = filename;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(filename));
  compiledModule._compile(source, filename);
  return compiledModule.exports;
}

const { FlowInsights } = loadComponent('src/components/admin/FlowInsights.tsx');
const { ModelErrorComparison } = loadComponent('src/components/admin/ModelErrorComparison.tsx');
const { displayQueue, nextCallableToken } = loadComponent('src/lib/queuePresentation.ts');
const renderFlow = (trend) => renderToStaticMarkup(React.createElement(FlowInsights, {
  trend, timeZone: 'Asia/Kolkata',
}));

test('daily outcomes and completion percentage use actual recorded visits', () => {
  const html = renderFlow([
    { date: '2026-10-10', total: 10, completed: 7, cancelled: 1, noShow: 1 },
    { date: '2026-10-11', total: 20, completed: 8, cancelled: 4, noShow: 2 },
  ]);
  assert.match(html, /50\.0%/); // 15 / 30, rather than averaging the two daily percentages.
  assert.doesNotMatch(html, /55\.0%/);
});

test('zero-volume days have no fabricated rate or invalid chart dimensions', () => {
  const html = renderFlow([{ date: '2026-10-11', total: 0, completed: 0, cancelled: 0, noShow: 0 }]);
  assert.match(html, /No visits recorded/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});

test('missing history has a clear empty state', () => {
  assert.match(renderFlow([]), /No daily visit records available/);
});

test('uniform historical records are disclosed without manufactured variation', () => {
  const days = [7, 8, 9, 10, 11].map((day) => ({
    date: `2026-10-${String(day).padStart(2, '0')}`, total: 16, completed: 12, cancelled: 2, noShow: 2,
  }));
  const html = renderFlow(days);
  assert.match(html, /Historical days have identical recorded counts and outcomes/);
  assert.match(html, /75\.0%/);
});

test('model comparison excludes unavailable validation and reports worse predictions honestly', () => {
  const html = renderToStaticMarkup(React.createElement(ModelErrorComparison, { doctors: [
    { id: 'one', name: 'Measured doctor', model: { baselineMae: 2, modelMae: 3, validationCount: 10 } },
    { id: 'two', name: 'Unvalidated doctor', model: { baselineMae: null, modelMae: null, validationCount: 0 } },
  ] }));
  assert.match(html, /50\.0% higher/);
  assert.doesNotMatch(html, /Unvalidated doctor|NaN|Infinity/);
});

test('queue display preserves server call order despite inconsistent fixture timestamps', () => {
  const tokens = [
    { id: 'current', status: 'current', createdAt: '2026-10-11T10:00:00Z' },
    { id: 'first', status: 'waiting', createdAt: '2026-10-11T09:00:00Z' },
    { id: 'second', status: 'waiting', createdAt: '2026-10-11T08:00:00Z' },
  ];
  assert.deepEqual(displayQueue(tokens).map((token) => token.id), ['current', 'first', 'second']);
  assert.notEqual(displayQueue(tokens), tokens);
});

test('next-call preview excludes future slots but allows due appointments and walk-ins', () => {
  const tokens = [
    { id: 'future', status: 'waiting', priority: 'normal', isWalkIn: false, scheduledTime: '02:00 PM' },
    { id: 'due', status: 'waiting', priority: 'normal', isWalkIn: false, scheduledTime: '01:00 PM' },
    { id: 'walk-in', status: 'waiting', priority: 'normal', isWalkIn: true, scheduledTime: 'Walk-in' },
  ];
  const now = new Date('2026-10-11T08:00:00Z'); // 13:30 in the clinic timezone.
  assert.equal(nextCallableToken(tokens, now).id, 'due');
  assert.equal(nextCallableToken([tokens[0], tokens[2]], now).id, 'walk-in');
  assert.equal(nextCallableToken([tokens[0]], now), null);
});

test('next-call preview respects server emergency ordering and ignores closed visits', () => {
  const tokens = [
    { id: 'closed', status: 'completed', priority: 'emergency', scheduledTime: 'Now' },
    { id: 'urgent', status: 'waiting', priority: 'emergency', isWalkIn: false, scheduledTime: '04:00 PM' },
    { id: 'normal', status: 'waiting', priority: 'normal', isWalkIn: true, scheduledTime: 'Walk-in' },
  ];
  assert.equal(nextCallableToken(tokens, new Date('2026-10-11T08:00:00Z')).id, 'urgent');
});
