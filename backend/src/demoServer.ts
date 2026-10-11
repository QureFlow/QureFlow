import { randomBytes } from 'node:crypto';
process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:18000';
process.env.DYNAMODB_TABLE_NAME = 'QureFlowDemo';
process.env.AUTH_PROVIDER = 'local';
process.env.JWT_SECRET = process.env.DEMO_JWT_SECRET || randomBytes(48).toString('hex');
process.env.NODE_ENV = 'development';
async function start() {
  const { seedLocalDemo } = await import('./demo/localDatabase.js');
  await seedLocalDemo();
  console.log('[QureFlow] Local DynamoDB demo: synthetic records only.');
  await import('./server.js');
}
start().catch(() => {
  console.error('Local demo could not start. Run docker compose up -d dynamodb-local first.');
  process.exitCode = 1;
});
