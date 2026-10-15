import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, rows } from './connection.js';

async function capture() {
  if (!['localhost', '127.0.0.1'].includes(process.env.MYSQL_HOST || '127.0.0.1'))
    throw new Error('Evidence collection requires loopback MySQL.');
  const destination = path.resolve(process.argv[2] || 'docs/verification/local');
  await mkdir(destination, { recursive: true });
  const columns = await rows(`SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE,
    COLUMN_KEY, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,ORDINAL_POSITION`);
  const relationships = await rows(`SELECT TABLE_NAME,COLUMN_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE()
    AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,COLUMN_NAME`);
  const constraints = await rows(`SELECT TABLE_NAME,CONSTRAINT_NAME,CONSTRAINT_TYPE
    FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME,CONSTRAINT_NAME`);
  const checks = await rows(`SELECT CONSTRAINT_NAME,CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA=DATABASE() ORDER BY CONSTRAINT_NAME`);
  const version = (await rows('SELECT VERSION() version,DATABASE() databaseName'))[0];
  await writeFile(path.join(destination, 'schema.json'), JSON.stringify({ capturedAt: new Date().toISOString(), version, columns, relationships, constraints, checks }, null, 2));
  const dictionary = '# MySQL data dictionary\n\nGenerated from the running database. CHECK definitions and foreign keys are in schema.json.\n\n' +
    '| Relation | Attribute | Type | Nullable | Key | Default | Extra |\n|---|---|---|---|---|---|---|\n' +
    columns.map((c) => `| ${c.TABLE_NAME} | ${c.COLUMN_NAME} | ${c.COLUMN_TYPE} | ${c.IS_NULLABLE} | ${c.COLUMN_KEY} | ${c.COLUMN_DEFAULT ?? ''} | ${c.EXTRA} |`).join('\n');
  await writeFile(path.join(destination, 'data-dictionary.md'), dictionary + '\n');
  // Optional references use zero-or-one participation on the child side.
  const diagram = ['erDiagram', ...relationships.map((r) => {
    const nullable = columns.find((c) => c.TABLE_NAME === r.TABLE_NAME && c.COLUMN_NAME === r.COLUMN_NAME)?.IS_NULLABLE === 'YES';
    const unique = columns.find((c) => c.TABLE_NAME === r.TABLE_NAME && c.COLUMN_NAME === r.COLUMN_NAME)?.COLUMN_KEY === 'UNI' ||
      ['clinic_settings', 'queue_state', 'prediction_models'].includes(r.TABLE_NAME);
    return `  ${r.REFERENCED_TABLE_NAME} ${nullable ? '|o' : '||'}--${unique ? 'o|' : 'o{'} ${r.TABLE_NAME} : "${r.COLUMN_NAME}"`;
  })].join('\n');
  await writeFile(path.join(destination, 'er-diagram.mmd'), diagram + '\n');
  console.log(JSON.stringify({ version, columns: columns.length, relationships: relationships.length, destination }));
}
capture().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => pool.end());
