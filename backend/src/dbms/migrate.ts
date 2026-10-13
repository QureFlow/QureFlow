import { readFile } from 'node:fs/promises';
import { pool, rows } from './connection.js';
import path from 'node:path';

export async function migrateMysql() {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(30) PRIMARY KEY, appliedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))',
  );
  for (const file of ['001_schema.sql', '002_routines.sql']) {
    if ((await rows('SELECT version FROM schema_migrations WHERE version=?', [file])).length)
      continue;
    const sql = await readFile(
      path.resolve(process.cwd(), process.cwd().endsWith('backend') ? 'sql' : 'backend/sql', file),
      'utf8',
    );
    let delimiter = ';',
      statement = '';
    for (const line of sql.split(/\r?\n/)) {
      if (line.trim().startsWith('--') || !line.trim()) continue;
      if (line.startsWith('DELIMITER ')) {
        delimiter = line.slice(10).trim();
        continue;
      }
      statement += line + '\n';
      if (statement.trimEnd().endsWith(delimiter)) {
        await pool.query(statement.trimEnd().slice(0, -delimiter.length));
        statement = '';
      }
    }
    if (statement.trim()) throw new Error('Unterminated SQL migration: ' + file);
    await pool.execute('INSERT INTO schema_migrations(version) VALUES (?)', [file]);
  }
}
