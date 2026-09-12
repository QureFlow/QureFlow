import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ConfirmSignUpCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';
import { AWS_REGION } from '../config/aws.js';

const userPoolId = process.env.COGNITO_USER_POOL_ID || process.env.VITE_COGNITO_USER_POOL_ID;
const clientId = process.env.COGNITO_CLIENT_ID || process.env.VITE_COGNITO_CLIENT_ID;
const clientSecret = process.env.COGNITO_CLIENT_SECRET || process.env.VITE_COGNITO_CLIENT_SECRET;

const credentials =
  process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined;

const cognitoClient = new CognitoIdentityProviderClient({
  region: AWS_REGION,
  credentials,
});

function getSecretHash(username: string): string | undefined {
  if (!clientSecret || !clientId) return undefined;
  return crypto
    .createHmac('SHA256', clientSecret)
    .update(username + clientId)
    .digest('base64');
}

export const cognitoService = {
  isConfigured(): boolean {
    return Boolean(userPoolId && clientId && !userPoolId.includes('xxxx'));
  },

  async signUp(data: {
    name: string;
    phone: string;
    email: string;
    password?: string;
    gender?: string;
    dob?: string;
    role?: string;
  }) {
    if (!this.isConfigured()) {
      throw new Error('Cognito User Pool ID and Client ID are not configured.');
    }

    const cleanPhone = data.phone.startsWith('+') ? data.phone : `+91${data.phone.replace(/[^0-9]/g, '')}`;
    const secretHash = getSecretHash(data.phone);

    const userAttributes = [
      { Name: 'name', Value: data.name },
      { Name: 'phone_number', Value: cleanPhone },
      { Name: 'email', Value: data.email },
    ];

    if (data.dob) {
      userAttributes.push({ Name: 'birthdate', Value: data.dob });
    }
    if (data.gender) {
      userAttributes.push({ Name: 'gender', Value: data.gender.toLowerCase() });
    }

    const command = new SignUpCommand({
      ClientId: clientId,
      SecretHash: secretHash,
      Username: data.phone,
      Password: data.password || 'TemporaryPass123!',
      UserAttributes: userAttributes,
    });

    return await cognitoClient.send(command);
  },

  async signIn(username: string, password?: string) {
    if (!this.isConfigured()) {
      throw new Error('Cognito User Pool ID and Client ID are not configured.');
    }

    const secretHash = getSecretHash(username);
    const authParams: Record<string, string> = {
      USERNAME: username,
      PASSWORD: password || '',
    };
    if (secretHash) {
      authParams.SECRET_HASH = secretHash;
    }

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: authParams,
    });

    const response = await cognitoClient.send(command);
    return response.AuthenticationResult;
  },

  async confirmSignUp(username: string, confirmationCode: string) {
    if (!this.isConfigured()) {
      throw new Error('Cognito User Pool ID and Client ID are not configured.');
    }

    const secretHash = getSecretHash(username);
    const command = new ConfirmSignUpCommand({
      ClientId: clientId,
      SecretHash: secretHash,
      Username: username,
      ConfirmationCode: confirmationCode,
    });

    return await cognitoClient.send(command);
  },
};
