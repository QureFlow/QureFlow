import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';

/** Keep the system Back button within React Router and hide the app at its root. */
export function AndroidNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    let disposed = false;
    const listener = NativeApp.addListener('backButton', () => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      const index = window.history.state?.idx ?? 0;
      if (index > 0) navigate(-1);
      else if (location.pathname !== '/') navigate('/', { replace: true });
      else void NativeApp.minimizeApp();
    });
    void listener.then((handle) => { if (disposed) void handle.remove(); });
    return () => {
      disposed = true;
      void listener.then((handle) => handle.remove());
    };
  }, [navigate, location.pathname]);
  return null;
}
