import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Layers,
  Calendar,
  UserCog,
  Users,
  Building2,
  Settings,
  LogOut,
  X,
  Stethoscope,
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItemClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
      isActive
        ? 'bg-slate-800 text-white font-semibold'
        : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
    }`;

  const navItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/admin/queue', label: 'Live Queue Manager', icon: <Layers className="w-4 h-4" /> },
    { to: '/admin/appointments', label: 'Appointments', icon: <Calendar className="w-4 h-4" /> },
    { to: '/admin/doctors', label: 'Doctors & OPD', icon: <Stethoscope className="w-4 h-4" /> },
    { to: '/admin/patients', label: 'Patient Directory', icon: <Users className="w-4 h-4" /> },
    { to: '/admin/clinics', label: 'Clinic Facility', icon: <Building2 className="w-4 h-4" /> },
    { to: '/admin/settings', label: 'Queue Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-slate-950 text-slate-100 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-800/80">
          <BrandLogo isWhite to="/admin/dashboard" />
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Clinic Info Badge */}
        <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 text-xs">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Assigned Facility</p>
          <p className="font-semibold text-slate-100 truncate mt-0.5">Bolpur Community Health Centre</p>
          <p className="text-[11px] text-slate-400">Birbhum District OPD</p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={navItemClass}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                <UserCog className="w-4 h-4" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate">{user?.name || 'Reception Staff'}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.staffId || 'REC-204'} • Reception</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-1.5 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-red-950/40 border border-slate-800 hover:border-red-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            Sign Out Staff Portal
          </button>
        </div>
      </aside>
    </>
  );
};
