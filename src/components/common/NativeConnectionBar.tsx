import { Capacitor } from '@capacitor/core';
import { Link, useLocation } from 'react-router-dom';

export function NativeConnectionBar() {
  const location = useLocation();
  if (!Capacitor.isNativePlatform() || location.pathname === '/connection') return null;
  return <div className="bg-brand-50 border-b border-brand-100 px-4 py-2 text-right text-xs">
    <Link to="/connection" className="font-semibold text-brand-800">Clinic connection</Link>
  </div>;
}
