process.env.DATABASE_PROVIDER = 'mysql';
process.env.AUTH_PROVIDER = 'local';
process.env.NODE_ENV = 'development';
async function setup() {
  if (
    !['127.0.0.1', 'localhost'].includes(process.env.MYSQL_HOST || '127.0.0.1') ||
    !/^qureflow_(dbms|test)/.test(process.env.MYSQL_DATABASE || 'qureflow_dbms')
  )
    throw new Error('Setup requires a named loopback MySQL database.');
  await (await import('./migrate.js')).migrateMysql();
  await (await import('./seed.js')).seedMysqlDemo();
  console.log('[QureFlow] Local MySQL database is ready.');
}
setup()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await (await import('./connection.js')).pool.end();
  });
