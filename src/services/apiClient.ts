/**
 * QureFlow Backend API Client
 * Centralized HTTP client for the configured Express API (web or packaged Android).
 */
import { Capacitor } from '@capacitor/core';
import { mobileConnectionKey, resolveApiBase } from '../lib/mobileConnection';

const getApiBaseUrl = (): string => {
  return resolveApiBase(import.meta.env.VITE_API_GATEWAY_URL, Capacitor.isNativePlatform(),
    Capacitor.isNativePlatform() ? localStorage.getItem(mobileConnectionKey) : null);
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const apiClient = {
  getAuthToken(): string | null {
    return sessionStorage.getItem('qureflow_token');
  },

  setAuthToken(token: string) {
    sessionStorage.setItem('qureflow_token', token);
  },

  clearAuthToken() {
    localStorage.removeItem('qureflow_token');
    localStorage.removeItem('queless_jwt_token');
    sessionStorage.removeItem('qureflow_token');
  },

  async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const baseUrl = getApiBaseUrl();
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${baseUrl}${cleanEndpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const token = this.getAuthToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: options.signal || AbortSignal.timeout(20000),
      });

      if (!response.ok) {
        if (response.status === 401 && !endpoint.startsWith('/auth/')) {
          this.clearAuthToken();
          sessionStorage.removeItem('queless_active_user');
          window.dispatchEvent(
            new CustomEvent('queless-state-change', { detail: { type: 'USER' } }),
          );
        }
        let errMsg = `Request failed with status ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error) errMsg = errData.error;
          else if (errData.message) errMsg = errData.message;
        } catch {
          // Response was not JSON
        }
        throw new ApiError(errMsg, response.status);
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null as unknown as T;
      }

      return await response.json();
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new Error(`Network error connecting to QureFlow API: ${err.message}`);
    }
  },

  get<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  },

  post<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  },

  patch<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  },

  put<T = any>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
      headers,
    });
  },

  delete<T = any>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  },
};
