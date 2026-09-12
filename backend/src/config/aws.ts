import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import dotenv from 'dotenv';

dotenv.config();

export const AWS_REGION = process.env.AWS_REGION || 'eu-north-1';
export const DYNAMODB_TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'QureFlow';
export const JWT_SECRET = process.env.JWT_SECRET || 'qureflow-jwt-secret-key-production-ready-2026';
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
  credentials,
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
