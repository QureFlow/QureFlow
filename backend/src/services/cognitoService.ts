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

export function normalizePhoneNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/[^0-9]/g, '');
  if (rawPhone.trim().startsWith('+')) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  return `+91${digits}`;
}

export function getSecretHash(username: string): string | undefined {
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
    email?: string;
    password?: string;
    gender?: string;
    dob?: string;
    role?: string;
  }) {
    if (!this.isConfigured()) {
      throw new Error('Cognito User Pool ID and Client ID are not configured.');
    }

    const normalizedPhone = normalizePhoneNumber(data.phone);
    const trimmedEmail =
      data.email && data.email.trim().length > 0 && !data.email.includes('@sms.queless.org')
        ? data.email.trim().toLowerCase()
        : undefined;

    // Cognito Username determination:
    // If the user provides an email, use the email as the Cognito username.
    // If email is not provided, use normalized E.164 phone (+91XXXXXXXXXX).
    // NEVER the user's full name.
    const cognitoUsername = trimmedEmail || normalizedPhone;
    const secretHash = getSecretHash(cognitoUsername);

    // Profile attributes sent separately:
    const userAttributes: { Name: string; Value: string }[] = [
      { Name: 'name', Value: data.name.trim() },
      { Name: 'phone_number', Value: normalizedPhone },
    ];

    if (trimmedEmail) {
      userAttributes.push({ Name: 'email', Value: trimmedEmail });
    }

    if (data.dob && data.dob.trim().length > 0) {
      userAttributes.push({ Name: 'birthdate', Value: data.dob.trim() });
    }

    if (data.gender && data.gender.trim().length > 0) {
      userAttributes.push({ Name: 'gender', Value: data.gender.toLowerCase().trim() });
    }

    const command = new SignUpCommand({
      ClientId: clientId,
      SecretHash: secretHash,
      Username: cognitoUsername,
      Password: data.password || 'TemporaryPass123!',
      UserAttributes: userAttributes,
    });

    return await cognitoClient.send(command);
  },

  async signIn(username: string, password?: string) {
    if (!this.isConfigured()) {
      throw new Error('Cognito User Pool ID and Client ID are not configured.');
    }

    const cleanId = username.trim();
    const cognitoUsername = cleanId.includes('@') ? cleanId.toLowerCase() : normalizePhoneNumber(cleanId);
    const secretHash = getSecretHash(cognitoUsername);

    const authParams: Record<string, string> = {
      USERNAME: cognitoUsername,
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

    const cleanId = username.trim();
    const cognitoUsername = cleanId.includes('@') ? cleanId.toLowerCase() : normalizePhoneNumber(cleanId);
    const secretHash = getSecretHash(cognitoUsername);

    const command = new ConfirmSignUpCommand({
      ClientId: clientId,
      SecretHash: secretHash,
      Username: cognitoUsername,
      ConfirmationCode: confirmationCode,
    });

    return await cognitoClient.send(command);
  },
};
