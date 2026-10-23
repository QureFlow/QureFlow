import { DynamoDBClient, DeleteTableCommand } from '@aws-sdk/client-dynamodb';

// Deletes only the named demo table on the loopback DynamoDB Local endpoint.
process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:18000';
process.env.DYNAMODB_TABLE_NAME = 'QureFlowDemo';
async function reset() {
  const { requireLocalDatabase } = await import('./localDatabase.js');
  requireLocalDatabase();
  const client = new DynamoDBClient({
    region: 'eu-north-1',
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  try {
    await client.send(new DeleteTableCommand({ TableName: 'QureFlowDemo' }));
    console.log('[QureFlow] Local demo table deleted. The next `npm run dev:demo` rebuilds it.');
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
    console.log('[QureFlow] No local demo table to delete.');
  } finally {
    client.destroy();
  }
}
reset().catch((e) => {
  console.error('Reset failed:', e.message);
  process.exitCode = 1;
});
