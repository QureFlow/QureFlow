import React from 'react';
import { BrandLogo } from './BrandLogo';
import { Link } from 'react-router-dom';
import { ShieldCheck, PhoneCall, HelpCircle } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="qf-footer mt-auto">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 text-xs text-slate-600">
          <div className="space-y-2 md:col-span-2">
            <BrandLogo showTagline />
            <p className="text-slate-500 max-w-sm mt-2 text-xs leading-relaxed">
              QureFlow is an accessible, digital queue and appointment management platform tailored
              for community health centres, sub-divisional hospitals, and rural healthcare clinics.
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-2">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Role-based access to patient records
              </span>
              <span className="inline-flex items-center gap-1">
                <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                Helpline: 102 / 108
              </span>
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] mb-2.5">
              Patient Services
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>
                <Link to="/patient/doctors" className="hover:text-slate-900">
                  Find Available Doctor
                </Link>
              </li>
              <li>
                <Link to="/patient/token" className="hover:text-slate-900">
                  Live Queue Tracking
                </Link>
              </li>
              <li>
                <Link to="/patient/appointments" className="hover:text-slate-900">
                  My Appointments
                </Link>
              </li>
              <li>
                <Link to="/patient/login" className="hover:text-slate-900">
                  Patient Portal Login
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-slate-900 uppercase tracking-wider text-[11px] mb-2.5">
              Clinic & Administration
            </h4>
            <ul className="space-y-1.5 text-xs text-slate-600">
              <li>
                <Link to="/admin/login" className="hover:text-slate-900 font-medium text-brand-700">
                  Reception Staff Sign In
                </Link>
              </li>
              <li>
                <Link to="/admin/queue" className="hover:text-slate-900">
                  OPD Queue Manager
                </Link>
              </li>
              <li>
                <span className="text-slate-400 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3" />
                  Rural Health Assistance
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <p>© 2026 QureFlow. Clinic queue management.</p>
          <p>Appointments and queue updates from your mobile browser.</p>
        </div>
      </div>
    </footer>
  );
};
