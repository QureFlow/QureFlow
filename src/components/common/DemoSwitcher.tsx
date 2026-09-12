import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Shield, RotateCcw, ChevronDown, LogOut } from 'lucide-react';

export const DemoSwitcher: React.FC = () => {
  const { user, logout, quickLoginPatient, quickLoginAdmin } = useAuth();
  const { resetToDefaults, tokens } = useQueue();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Don't show inside the public landing hero if minimized, but keep available on top banner
  const isPatient = user?.role === 'patient';
  const isAdmin = user?.role === 'admin';

  const activeToken =
    isPatient && user
      ? tokens.find(
          (t) =>
            (t.patientId === user.id || (user.phone && t.patientPhone === user.phone)) &&
            (t.status === 'waiting' || t.status === 'current')
        )
      : null;

  const switchToPatient = () => {
    if (!isPatient) {
      quickLoginPatient();
    }
    setIsOpen(false);
    if (!location.pathname.startsWith('/patient')) {
      navigate('/patient/dashboard');
    }
  };

  const switchToAdmin = () => {
    quickLoginAdmin();
    setIsOpen(false);
    if (!location.pathname.startsWith('/admin')) {
      navigate('/admin/dashboard');
    }
  };

  const handleReset = () => {
    resetToDefaults();
    setIsOpen(false);
  };

  const handleSignOut = async () => {
    await logout();
    setIsOpen(false);
    navigate('/');
  };

  return (
    <aside aria-label="Demo Persona Switcher" className="fixed top-2 right-4 z-40 text-xs hidden sm:block">
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur border border-slate-300/80 rounded-full shadow-subtle hover:bg-slate-50 transition-colors text-slate-700 font-medium"
          title="Demo Switcher: Quickly change roles to test patient & admin live interaction"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>
            {isAdmin ? `Staff: ${user?.name || 'Bishakha Roy'}` : isPatient ? `Patient: ${user?.name || 'Patient'}` : 'Public View'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-64 bg-white rounded-lg border border-slate-200 shadow-elevated py-1.5 z-50 text-slate-700">
            <div className="px-3 py-1 border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Interactive Prototype Switcher
            </div>

            <button
              onClick={switchToPatient}
              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 text-xs ${
                isPatient ? 'font-semibold text-brand-700 bg-brand-50/60' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <div>
                  <p className="font-medium text-slate-900">
                    Patient: {isPatient && user ? user.name : 'Suman Roy'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isPatient && user
                      ? activeToken
                        ? `Active Token ${activeToken.tokenNumber}`
                        : user.phone || 'Active Session'
                      : 'Active Token A-042'}
                  </p>
                </div>
              </div>
              {isPatient && <span className="text-[10px] bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">Active</span>}
            </button>

            {isPatient && user && user.name !== 'Suman Roy' && (
              <button
                onClick={() => {
                  quickLoginPatient();
                  setIsOpen(false);
                  navigate('/patient/dashboard');
                }}
                className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-xs text-slate-600 border-t border-slate-50"
              >
                <div className="flex items-center gap-2 pl-5">
                  <span className="text-slate-400">↳</span>
                  <div>
                    <p className="text-[11px] text-slate-700 font-medium">Switch to Demo: Suman Roy</p>
                    <p className="text-[10px] text-slate-400">Sample Token A-042</p>
                  </div>
                </div>
              </button>
            )}

            <button
              onClick={switchToAdmin}
              className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-50 text-xs ${
                isAdmin ? 'font-semibold text-brand-700 bg-brand-50/60' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-slate-700" />
                <div>
                  <p className="font-medium text-slate-900">Reception Staff / Admin</p>
                  <p className="text-[11px] text-slate-500">Bolpur Community Clinic</p>
                </div>
              </div>
              {isAdmin && <span className="text-[10px] bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded">Active</span>}
            </button>

            {user && (
              <button
                onClick={handleSignOut}
                className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] text-red-600 hover:text-red-800 hover:bg-red-50"
              >
                <LogOut className="w-3 h-3 text-red-500" />
                Sign Out (Return to Landing)
              </button>
            )}

            <div className="border-t border-slate-100 my-1"></div>

            <button
              onClick={handleReset}
              className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-[11px] text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            >
              <RotateCcw className="w-3 h-3 text-slate-400" />
              Reset Demo Data to Initial State
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
