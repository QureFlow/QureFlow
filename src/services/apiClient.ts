/**
 * QureFlow Backend API Client
 * Centralized HTTP client for the configured Express API (web or packaged Android).
 */
import { Capacitor } from '@capacitor/core';
import { mobileConnectionKey, mobileConnectionLostEvent, mobileConnectionReadyEvent, resolveApiBase } from '../lib/mobileConnection';

let nativeClinicReady = false;
const nativeRequests = new Set<AbortController>();
const connectionCheckReason = 'QUREFLOW_CONNECTION_CHECK';
export function setNativeClinicReady(ready: boolean) {
  const restored = ready && !nativeClinicReady;
  nativeClinicReady = ready;
  if (!ready) for (const controller of nativeRequests) controller.abort(connectionCheckReason);
  if (restored) window.dispatchEvent(new Event(mobileConnectionReadyEvent));
}

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

export class ClinicConnectionPending extends ApiError {
  constructor(message = 'QureFlow is checking the clinic connection. Please wait.') {
    super(message, 503);
    this.name = 'ClinicConnectionPending';
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
    const native = Capacitor.getPlatform() === 'android';
    if (native && !nativeClinicReady)
      throw new ClinicConnectionPending();
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

    const controller = new AbortController();
    const abort = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out')), 20000);
    if (native) nativeRequests.add(controller);
    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
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
      if (controller.signal.reason === connectionCheckReason)
        throw new ClinicConnectionPending('The clinic connection is being checked. Check your appointments or queue before repeating an action.');
      // Reconnect separately; never replay a booking or other mutation after a network failure.
      if (native && nativeClinicReady && !options.signal?.aborted)
        window.dispatchEvent(new Event(mobileConnectionLostEvent));
      if (native && !options.signal?.aborted)
        throw new ClinicConnectionPending(`Network error connecting to QureFlow API: ${err.message}`);
      throw new Error(`Network error connecting to QureFlow API: ${err.message}`);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
      nativeRequests.delete(controller);
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
