import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Link, useLocation } from 'react-router-dom';
import {
  cloudApiBase,
  findClinicServers,
  mobileConnectionKey,
  mobileServerIdKey,
  mobileConnectionLostEvent,
  type ClinicServer,
  type DiscoveryCandidate,
} from '../../lib/mobileConnection';
import { apiClient, setNativeClinicReady } from '../../services/apiClient';
import { storage } from '../../services/storage';
import { ClinicConnection } from '../../pages/ClinicConnection';
import { Button } from './Button';

const discovery = registerPlugin<{
  discover(): Promise<{ servers: DiscoveryCandidate[]; error?: string }>;
  cancel(): Promise<void>;
  addListener(event: 'networkChanged', listener: () => void): Promise<PluginListenerHandle>;
}>('ClinicDiscovery');

/** Hold API consumers until a healthy local clinic has been found. Web hosting is unaffected. */
export function NativeClinicGate({ children }: { children: ReactNode }) {
  // A configured cloud API is reachable directly; only a local clinic server needs discovery.
  const native =
    Capacitor.getPlatform() === 'android' && !cloudApiBase(import.meta.env.VITE_API_GATEWAY_URL);
  const manual = useLocation().pathname === '/connection';
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [servers, setServers] = useState<ClinicServer[]>([]);
  const [message, setMessage] = useState('');
  const generation = useRef(0);
  const running = useRef<number | null>(null);
  const hasConnected = useRef(false);
  const retryWhenUnavailable = useRef(false);

  const connect = useCallback((server: ClinicServer) => {
    const oldBase = localStorage.getItem(mobileConnectionKey);
    const oldId = localStorage.getItem(mobileServerIdKey);
    localStorage.setItem(mobileConnectionKey, server.apiBase);
    localStorage.setItem(mobileServerIdKey, server.serverId);
    if (oldId !== server.serverId) {
      apiClient.clearAuthToken();
      storage.setActiveUser(null);
    }
    // A mounted screen may have requests from the old endpoint. Restart it at the verified endpoint.
    if (hasConnected.current && (oldBase !== server.apiBase || oldId !== server.serverId)) {
      window.location.replace('/');
      return;
    }
    setNativeClinicReady(true);
    hasConnected.current = true;
    retryWhenUnavailable.current = false;
    setConnected(true);
    setMessage('');
    setChecking(false);
    setServers([]);
  }, []);

  const search = useCallback(async () => {
    if (running.current !== null) return;
    const run = ++generation.current;
    running.current = run;
    setNativeClinicReady(false);
    retryWhenUnavailable.current = false;
    setChecking(true);
    setMessage('');
    setServers([]);
    const savedId = localStorage.getItem(mobileServerIdKey);
    try {
      const found = await findClinicServers(
        localStorage.getItem(mobileConnectionKey),
        savedId,
        async () => {
          if (generation.current !== run) return [];
          const result = await discovery.discover();
          if (result.error && !result.servers.length) throw new Error(result.error);
          return result.servers;
        },
      );
      if (generation.current !== run) return;
      const remembered = found.find((server) => server.serverId === savedId);
      if (remembered || (!savedId && found.length === 1)) connect(remembered || found[0]);
      else {
        retryWhenUnavailable.current = found.length === 0;
        setServers(found);
        setMessage(
          found.length
            ? savedId
              ? 'Your previous clinic is unavailable. Choose a clinic to switch connections and sign in again.'
              : 'More than one clinic is available. Choose the computer you want to use.'
            : 'Keep the clinic computer running QureFlow and connect both devices to the same Wi-Fi. Then try again.',
        );
      }
    } catch {
      retryWhenUnavailable.current = true;
      if (generation.current === run)
        setMessage('Could not search this Wi-Fi network. Check your connection and try again.');
    } finally {
      if (running.current === run) running.current = null;
      if (generation.current === run) setChecking(false);
    }
  }, [connect]);

  useEffect(() => {
    if (!native) return;
    if (manual) {
      setConnected(false);
      setChecking(true);
      return;
    }
    let disposed = false;
    void search();
    const retry = () => {
      if (!disposed) void search();
    };
    window.addEventListener('online', retry);
    window.addEventListener(mobileConnectionLostEvent, retry);
    const resume = NativeApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) retry();
    });
    const network = discovery.addListener('networkChanged', () => {
      if (disposed) return;
      setNativeClinicReady(false);
      generation.current++;
      running.current = null;
      void discovery
        .cancel()
        .catch(() => undefined)
        .then(retry);
    });
    const timer = setInterval(() => {
      if (retryWhenUnavailable.current && document.visibilityState === 'visible') retry();
    }, 12000);
    return () => {
      disposed = true;
      generation.current++;
      setNativeClinicReady(false);
      running.current = null;
      window.removeEventListener('online', retry);
      window.removeEventListener(mobileConnectionLostEvent, retry);
      void resume.then((handle) => handle.remove());
      void network.then((handle) => handle.remove());
      clearInterval(timer);
      void discovery.cancel().catch(() => undefined);
    };
  }, [manual, native, search]);

  if (!native) return <>{children}</>;
  if (manual) return <ClinicConnection />;
  const blocked = checking || !connected || !!message;
  return (
    <>
      {connected && <div hidden={blocked}>{children}</div>}
      {blocked && (
        <main className="min-h-screen qf-shell p-6 flex items-center justify-center">
          <section className="qf-panel max-w-md w-full p-7 space-y-5" aria-busy={checking}>
            <p className="text-sm font-bold tracking-wide text-brand-700">QureFlow</p>
            <h1 className="qf-title text-2xl">
              {checking
                ? 'Finding your clinic'
                : servers.length
                  ? 'Choose your clinic'
                  : 'Clinic not found yet'}
            </h1>
            <p role="status" aria-live="polite" className="text-sm leading-6 text-slate-600">
              {checking
                ? 'Looking for the QureFlow computer on this Wi-Fi. This may take a few seconds.'
                : message}
            </p>
            {!checking && (
              <>
                {servers.map((server) => (
                  <Button key={server.serverId} className="w-full" onClick={() => connect(server)}>
                    {server.serverName}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    void search();
                  }}
                >
                  Search again
                </Button>
                <p className="text-xs leading-5 text-slate-500">
                  Guest Wi-Fi can block devices from finding each other. Use the same regular Wi-Fi
                  network as the computer.
                </p>
                <Link to="/connection" className="block text-sm text-brand-700">
                  Advanced connection settings
                </Link>
              </>
            )}
          </section>
        </main>
      )}
    </>
  );
}
