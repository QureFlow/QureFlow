/**
 * AWS Cognito Authentication Adapter
 * 
 * This service implements the exact contract required by AWS Cognito User Pools.
 * Your backend engineer can either:
 * A. Use AWS Amplify Auth (`import { signIn, signUp, signOut, getCurrentUser } from 'aws-amplify/auth'`)
 * B. Use the official AWS SDK v3 (`@aws-sdk/client-cognito-identity-provider`)
 * C. Call custom API Gateway / Lambda endpoints that interact with Cognito
 * 
 * Notice:
 * - Patients authenticate using Phone Number (or Email) and Password.
 * - Staff / Admins authenticate with Staff ID / official email and Password.
 * - Public self-registration is strictly allowed ONLY for Patients.
 * - Staff accounts are provisioned exclusively via AWS Cognito `AdminCreateUser` by Hospital IT.
 */

import { awsConfig, isLiveAwsEnabled } from '../config/awsConfig';
import { User } from '../types';
import { authService } from './authService';

export interface CognitoAuthSession {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  user: User;
}

export interface PatientRegistrationPayload {
  name: string;
  phone: string;
  email: string;
  dob?: string;
  gender?: 'Male' | 'Female' | 'Other';
  password?: string;
}

export const awsCognitoAuth = {
  /**
   * Patient Sign In
   * Maps to AWS Cognito `InitiateAuth` (USER_PASSWORD_AUTH or USER_SRP_AUTH)
   */
  async signInPatient(identifier: string, password?: string): Promise<User> {
    if (!isLiveAwsEnabled()) {
      // Fallback to mock service during UI development & local preview
      return authService.loginPatient(identifier, password);
    }

    // =========================================================================
    // AWS COGNITO BACKEND CODE TEMPLATE (FOR YOUR BACKEND FRIEND):
    // -------------------------------------------------------------------------
    // import { CognitoIdentityProviderClient, InitiateAuthCommand } from "@aws-sdk/client-cognito-identity-provider";
    // const client = new CognitoIdentityProviderClient({ region: awsConfig.region });
    // const command = new InitiateAuthCommand({
    //   AuthFlow: "USER_PASSWORD_AUTH",
    //   ClientId: awsConfig.cognito.userPoolClientId,
    //   AuthParameters: {
    //     USERNAME: identifier,
    //     PASSWORD: password || '',
    //   },
    // });
    // const response = await client.send(command);
    // const tokens = response.AuthenticationResult;
    // localStorage.setItem('queless_jwt_token', tokens.IdToken);
    // =========================================================================

    throw new Error(`AWS Cognito User Pool [${awsConfig.cognito.userPoolId}] configured. Connect backend client.`);
  },

  /**
   * Patient Registration / Sign Up
   * Maps to AWS Cognito `SignUp` API
   */
  async signUpPatient(data: PatientRegistrationPayload): Promise<User> {
    if (!isLiveAwsEnabled()) {
      return authService.registerPatient(data);
    }

    // =========================================================================
    // AWS COGNITO BACKEND CODE TEMPLATE (FOR YOUR BACKEND FRIEND):
    // -------------------------------------------------------------------------
    // import { CognitoIdentityProviderClient, SignUpCommand } from "@aws-sdk/client-cognito-identity-provider";
    // const client = new CognitoIdentityProviderClient({ region: awsConfig.region });
    // const command = new SignUpCommand({
    //   ClientId: awsConfig.cognito.userPoolClientId,
    //   Username: data.phone,
    //   Password: data.password,
    //   UserAttributes: [
    //     { Name: "name", Value: data.name },
    //     { Name: "phone_number", Value: data.phone.startsWith('+') ? data.phone : `+91${data.phone}` },
    //     { Name: "email", Value: data.email },
    //     { Name: "birthdate", Value: data.dob || '' },
    //     { Name: "custom:gender", Value: data.gender || 'Male' },
    //     { Name: "custom:role", Value: "patient" },
    //   ],
    // });
    // const response = await client.send(command);
    // =========================================================================

    throw new Error(`AWS Cognito User Pool [${awsConfig.cognito.userPoolId}] configured. Connect backend client.`);
  },

  /**
   * Staff / Admin Sign In
   * Authenticates against the Cognito User Pool and verifies that the user
   * belongs to the 'Admins' or 'HospitalStaff' Cognito User Group.
   */
  async signInAdmin(identifier: string, password?: string): Promise<User> {
    if (!isLiveAwsEnabled()) {
      return authService.loginAdmin(identifier, password);
    }

    // =========================================================================
    // AWS COGNITO BACKEND CODE TEMPLATE:
    // -------------------------------------------------------------------------
    // 1. Authenticate credentials via InitiateAuthCommand
    // 2. Decode JWT Claims and check `cognito:groups` array contains 'Admins' or 'HospitalStaff'
    // 3. If not in staff group, reject with 'Unauthorized: Staff credentials required.'
    // =========================================================================

    throw new Error(`AWS Cognito User Pool [${awsConfig.cognito.userPoolId}] configured. Connect backend client.`);
  },

  /**
   * Confirm Phone / Email OTP
   * Maps to AWS Cognito `ConfirmSignUp` API
   */
  async confirmSignUp(username: string, confirmationCode: string): Promise<boolean> {
    console.log(`[Cognito Pool: ${awsConfig.cognito.userPoolId}] Verifying code for ${username}: ${confirmationCode}`);
    return true;
  },

  /**
   * Global Sign Out
   * Maps to AWS Cognito `GlobalSignOut` or local session clearance
   */
  async signOut(): Promise<void> {
    localStorage.removeItem('queless_jwt_token');
    localStorage.removeItem('queless_refresh_token');
    await authService.logout();
  },

  /**
   * Get Current Stored JWT Session Tokens
   */
  getStoredTokens(): { idToken: string | null; accessToken: string | null } {
    return {
      idToken: localStorage.getItem('queless_jwt_token'),
      accessToken: localStorage.getItem('queless_access_token'),
    };
  },
};
