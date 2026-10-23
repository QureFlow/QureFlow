import { randomBytes } from 'node:crypto';
process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:18000';
process.env.DYNAMODB_TABLE_NAME = 'QureFlowDemo';
process.env.AUTH_PROVIDER = 'local';
process.env.JWT_SECRET = process.env.DEMO_JWT_SECRET || randomBytes(48).toString('hex');
process.env.NODE_ENV = 'development';
// The synthetic administrator may switch between demo clinics; real staff never can.
process.env.DEMO_ALL_CLINICS = process.env.DEMO_ALL_CLINICS || 'true';
// Lets the Android app find this computer on the same Wi-Fi network.
process.env.CLINIC_DISCOVERY = process.env.CLINIC_DISCOVERY || 'true';
process.env.CORS_ORIGINS =
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173,http://localhost:5000,http://127.0.0.1:5000,https://localhost';
async function start() {
  const { seedLocalDemo } = await import('./demo/localDatabase.js');
  await seedLocalDemo();
  console.log('[QureFlow] Local DynamoDB demo: synthetic records only.');
  await import('./server.js');
}
start().catch((error) => {
  console.error('Local demo could not start:', error.message);
  console.error('Start DynamoDB Local first: docker compose up -d dynamodb-local');
  process.exitCode = 1;
});
