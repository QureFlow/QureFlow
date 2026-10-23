import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Button } from '../components/common/Button';
import { apiClient } from '../services/apiClient';
import { storage } from '../services/storage';
import {
  mobileConnectionKey,
  mobileServerIdKey,
  normalizeMobileServer,
  probeClinicServer,
  resolveApiBase,
} from '../lib/mobileConnection';

export function ClinicConnection() {
  const [address, setAddress] = useState(() =>
    resolveApiBase(
      import.meta.env.VITE_API_GATEWAY_URL,
      true,
      localStorage.getItem(mobileConnectionKey),
    ).replace(/\/api$/, ''),
  );
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (!Capacitor.isNativePlatform()) return <Navigate to="/" replace />;

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const base = normalizeMobileServer(address);
      const health = await probeClinicServer(base, fetch, 8000);
      if (!health) throw new Error('This address did not return a healthy QureFlow clinic server.');
      apiClient.clearAuthToken();
      storage.setActiveUser(null);
      localStorage.setItem(mobileConnectionKey, base);
      localStorage.setItem(mobileServerIdKey, health.serverId);
      window.location.replace('/');
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Could not connect. Keep the clinic computer running and connect both devices to the same Wi-Fi, or use the USB connection.'
          : err instanceof Error
            ? err.message
            : 'Could not connect to the clinic computer.',
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="min-h-screen qf-shell p-6 flex items-center justify-center">
      <div className="qf-panel max-w-md w-full p-6 space-y-5">
        <h1 className="qf-title text-2xl">Advanced connection</h1>
        <p className="text-sm text-slate-600">
          Connect this app to the computer running your clinic. Keep that computer and its database
          running while you use the app.
        </p>
        <form onSubmit={connect} className="space-y-4">
          <label className="block text-sm font-semibold" htmlFor="clinic-computer">
            Computer address
          </label>
          <input
            id="clinic-computer"
            type="url"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            required
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={pending}
            className="w-full p-3 rounded-lg border border-slate-300 text-sm"
            placeholder="http://192.168.1.10:5000"
          />
          <p className="text-xs text-slate-500">
            Changing the connection signs you out. Your appointments remain in the database.
          </p>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={pending}>
            Test and connect
          </Button>
        </form>
        <Link to="/" className="block text-sm text-brand-700">
          Find my clinic automatically
        </Link>
      </div>
    </main>
  );
}
