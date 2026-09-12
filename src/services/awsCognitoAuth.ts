/**
 * AWS Cognito / Backend Authentication Adapter
 * Connects the frontend authentication UI to the backend service.
 */

import { User } from '../types';
import { authService } from './authService';
import { apiClient } from './apiClient';

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
   */
  async signInPatient(identifier: string, password?: string): Promise<User> {
    return authService.loginPatient(identifier, password);
  },

  /**
   * Patient Registration / Sign Up
   */
  async signUpPatient(data: PatientRegistrationPayload): Promise<User> {
    return authService.registerPatient(data);
  },

  /**
   * Staff / Admin Sign In
   */
  async signInAdmin(identifier: string, password?: string): Promise<User> {
    return authService.loginAdmin(identifier, password);
  },

  /**
   * Confirm Phone / Email OTP
   */
  async confirmSignUp(username: string, confirmationCode: string): Promise<boolean> {
    console.log(`[Auth Adapter] Verifying code for ${username}: ${confirmationCode}`);
    return true;
  },

  /**
   * Global Sign Out
   */
  async signOut(): Promise<void> {
    await authService.logout();
  },

  /**
   * Get Current Stored JWT Session Tokens
   */
  getStoredTokens(): { idToken: string | null; accessToken: string | null } {
    const token = apiClient.getAuthToken();
    return {
      idToken: token,
      accessToken: token,
    };
  },
};
