import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import {
  CognitoIdentityProviderClient,
  DescribeUserPoolClientCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AWS_REGION, DYNAMODB_TABLE_NAME, docClient } from './config/aws.js';

// Read infrastructure configuration only. Never sign in, seed, or mutate cloud records.
async function run() {
  if (process.env.DYNAMODB_ENDPOINT)
    throw new Error('Unset DYNAMODB_ENDPOINT to check configured AWS infrastructure.');
  const dynamo = new DynamoDBClient({
    region: AWS_REGION,
    credentials: docClient.config.credentials,
  });
  const cognito = new CognitoIdentityProviderClient({
    region: AWS_REGION,
    credentials: docClient.config.credentials,
  });
  const poolId = process.env.COGNITO_USER_POOL_ID || process.env.VITE_COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID || process.env.VITE_COGNITO_CLIENT_ID;
  const checks: { name: string; passed: boolean; details: Record<string, unknown> }[] = [];
  try {
    try {
      const { Table: table } = await dynamo.send(
        new DescribeTableCommand({ TableName: DYNAMODB_TABLE_NAME }),
      );
      const valid =
        table?.TableStatus === 'ACTIVE' &&
        table.KeySchema?.some((k) => k.AttributeName === 'pk' && k.KeyType === 'HASH') &&
        table.KeySchema?.some((k) => k.AttributeName === 'sk' && k.KeyType === 'RANGE');
      checks.push({
        name: 'Configured DynamoDB table is active with expected primary keys',
        passed: Boolean(valid),
        details: {
          tableStatus: table?.TableStatus,
          billingMode: table?.BillingModeSummary?.BillingMode || 'PROVISIONED',
          keySchema: table?.KeySchema,
        },
      });
      if (valid) {
        const { dynamoDbRepo } = await import('./repositories/dynamoDbRepo.js');
        const [clinics, doctors] = await Promise.all([
          dynamoDbRepo.getClinics(),
          dynamoDbRepo.getDoctors(),
        ]);
        checks.push({
          name: 'Configured AWS clinic and doctor directories are readable',
          passed: clinics.length > 0 && doctors.length > 0,
          details: { clinicCount: clinics.length, doctorCount: doctors.length },
        });
      }
    } catch (error: any) {
      checks.push({
        name: 'DynamoDB configuration read',
        passed: false,
        details: { errorType: error.name },
      });
    }
    try {
      if (!poolId || !clientId) throw new Error('MissingCognitoConfiguration');
      const { UserPoolClient: client } = await cognito.send(
        new DescribeUserPoolClientCommand({ UserPoolId: poolId, ClientId: clientId }),
      );
      const passwordFlow = client?.ExplicitAuthFlows?.includes('ALLOW_USER_PASSWORD_AUTH');
      const secretConfigured = Boolean(
        process.env.COGNITO_CLIENT_SECRET || process.env.VITE_COGNITO_CLIENT_SECRET,
      );
      checks.push({
        name: 'Configured Cognito app client supports the backend password flow',
        passed: Boolean(passwordFlow) && (!client?.ClientSecret || secretConfigured),
        details: {
          passwordAuthEnabled: Boolean(passwordFlow),
          clientSecretRequired: Boolean(client?.ClientSecret),
          clientSecretConfigured: secretConfigured,
          preventUserExistenceErrors: client?.PreventUserExistenceErrors,
        },
      });
    } catch (error: any) {
      checks.push({
        name: 'Cognito app-client configuration read',
        passed: false,
        details: { errorType: error.name },
      });
    }
  } finally {
    dynamo.destroy();
    cognito.destroy();
  }
  const evidence = {
    executedAt: new Date().toISOString(),
    readOnly: true,
    cloudWritesPerformed: false,
    region: AWS_REGION,
    authenticationFlowsExecuted: false,
    checks,
  };
  const evidenceDir = path.resolve(
    process.cwd(),
    process.cwd().endsWith('backend') ? '../docs/verification' : 'docs/verification',
  );
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(
    path.join(evidenceDir, 'aws-readonly-results.json'),
    JSON.stringify(evidence, null, 2),
  );
  for (const check of checks)
    console.log(
      `${check.passed ? 'PASS' : 'UNVERIFIED'} ${check.name}: ${JSON.stringify(check.details)}`,
    );
  process.exitCode = checks.every((c) => c.passed) ? 0 : 1;
}
run().catch((error) => {
  console.error('AWS verification could not run:', error.name);
  process.exitCode = 1;
});
