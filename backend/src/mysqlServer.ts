import { randomBytes } from 'node:crypto';
process.env.DATABASE_PROVIDER = 'mysql';
process.env.AUTH_PROVIDER = 'local';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.DBMS_DEMO_ALL_CLINICS = process.env.NODE_ENV === 'development'
  ? process.env.DBMS_DEMO_ALL_CLINICS || 'true' : 'false';
process.env.PORT = process.env.DBMS_PORT || '5001';
process.env.JWT_SECRET = process.env.DBMS_JWT_SECRET || randomBytes(48).toString('hex');
process.env.CORS_ORIGINS = process.env.DBMS_CORS_ORIGINS ||
  'http://localhost:5174,http://127.0.0.1:5174,http://localhost:5001,https://localhost';
async function start() {
  if (
    !['127.0.0.1', 'localhost'].includes(process.env.MYSQL_HOST || '127.0.0.1') ||
    !/^qureflow_(dbms|test)/.test(process.env.MYSQL_DATABASE || 'qureflow_dbms')
  ) {
    throw new Error('This demo entry point requires a named loopback MySQL DBMS database.');
  }
  const { migrateMysql } = await import('./dbms/migrate.js');
  await migrateMysql();
  const { seedMysqlDemo } = await import('./dbms/seed.js');
  await seedMysqlDemo();
  console.log('[QureFlow] DBMS variant: MySQL / local synthetic authentication.');
  await import('./server.js');
}
start().catch(async (error) => {
  console.error('MySQL startup failed:', error.message);
  await (await import('./dbms/connection.js')).pool.end();
  process.exitCode = 1;
});
