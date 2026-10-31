import { User } from '../types';
import { storage } from './storage';
import { apiClient, ClinicConnectionPending } from './apiClient';
export class AccountConfirmationRequired extends Error {
  constructor(
    public identifier: string,
    public requiresCode: boolean,
  ) {
    super(
      requiresCode
        ? 'Enter the verification code sent to your registered contact.'
        : 'Account created. Sign in to continue.',
    );
  }
}
const saveSession = (session: { user: User; token: string }) => {
  apiClient.setAuthToken(session.token);
  storage.setActiveUser(session.user);
  return session.user;
};
export const authService = {
  async getCurrentUser(): Promise<User | null> {
    if (!apiClient.getAuthToken()) {
      storage.setActiveUser(null);
      return null;
    }
    try {
      const user = await apiClient.get<User>('/auth/me');
      storage.setActiveUser(user);
      return user;
    } catch (error) {
      if (error instanceof ClinicConnectionPending) return storage.getActiveUser();
      apiClient.clearAuthToken();
      storage.setActiveUser(null);
      return null;
    }
  },
  async loginPatient(identifier: string, password?: string): Promise<User> {
    const session = await apiClient.post<{ user: User; token: string }>('/auth/login', {
      identifier,
      password,
    });
    if (session.user.role !== 'patient') throw new Error('Use the staff portal for this account.');
    return saveSession(session);
  },
  async loginAdmin(identifier: string, password?: string): Promise<User> {
    const session = await apiClient.post<{ user: User; token: string }>('/auth/login', {
      identifier,
      password,
    });
    if (session.user.role === 'patient')
      throw new Error('Use the patient portal for this account.');
    return saveSession(session);
  },
  async loginGuest(role: 'patient' | 'staff'): Promise<User> {
    return saveSession(
      await apiClient.post<{ user: User; token: string }>('/auth/guest', { role }),
    );
  },
  async registerPatient(data: {
    name: string;
    phone: string;
    email: string;
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other';
    password?: string;
  }): Promise<User> {
    const session = await apiClient.post<{
      user: User;
      token: string;
      confirmationRequired?: boolean;
      requiresLogin?: boolean;
      identifier: string;
    }>('/auth/register', data);
    if (session.requiresLogin)
      throw new AccountConfirmationRequired(
        session.identifier,
        Boolean(session.confirmationRequired),
      );
    return saveSession(session);
  },
  async confirmRegistration(identifier: string, code: string) {
    return apiClient.post('/auth/confirm-registration', { identifier, code });
  },
  async logout() {
    apiClient.clearAuthToken();
    storage.setActiveUser(null);
  },
  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/auth/forgot-password', { identifier });
  },
  async confirmForgotPassword(
    identifier: string,
    code: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    return apiClient.post('/auth/confirm-forgot-password', { identifier, code, newPassword });
  },
};
