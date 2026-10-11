import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({
  path: path.resolve(process.cwd(), process.cwd().endsWith('backend') ? '.env' : 'backend/.env'),
});

export const AWS_REGION = process.env.AWS_REGION || 'eu-north-1';
export const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'QureFlow';
export const JWT_SECRET =
  process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' ? '' : randomBytes(48).toString('hex'));
if (JWT_SECRET.length < 32 || JWT_SECRET === 'qureflow-jwt-secret-key-production-ready-2026')
  throw new Error('Set JWT_SECRET to a unique random secret of at least 32 characters.');
export const PORT = parseInt(process.env.PORT || '5000', 10);

// Initialize AWS DynamoDB client.
// The AWS SDK v3 automatically discovers credentials from ~/.aws/credentials, ~/.aws/config,
// or environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY).
const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const rawClient = new DynamoDBClient({
  region: AWS_REGION,
  endpoint: process.env.DYNAMODB_ENDPOINT,
  credentials: process.env.DYNAMODB_ENDPOINT
    ? { accessKeyId: 'local', secretAccessKey: 'local' }
    : credentials,
});

export const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});
