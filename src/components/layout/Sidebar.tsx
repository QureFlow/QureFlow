import { NavLink, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Calendar,
  Layers,
  LayoutDashboard,
  LogOut,
  Settings,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}
export const Sidebar = ({ isOpen = false, onClose }: Props) => {
  const { user, logout } = useAuth();
  const { clinics, tokens, lastSyncedAt, connectionError } = useQueue();
  const navigate = useNavigate();
  const clinic = clinics.find((c) => c.id === user?.clinicId);
  const nav = [
    { to: '/admin/dashboard', label: 'Overview', Icon: LayoutDashboard },
    { to: '/admin/queue', label: 'Live Queue Manager', Icon: Layers },
    { to: '/admin/appointments', label: 'Appointments', Icon: Calendar },
    { to: '/admin/patients', label: 'Patient Directory', Icon: Users },
    { to: '/admin/doctors', label: 'Doctors & OPD', Icon: Stethoscope },
    { to: '/admin/analytics', label: 'Operations & Insights', Icon: BarChart3 },
    { to: '/admin/clinics', label: 'Clinic Facility', Icon: Building2 },
    { to: '/admin/settings', label: 'Queue Settings', Icon: Settings },
  ];
  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-brand-950/50 backdrop-blur-sm z-40 lg:hidden"
        />
      )}
      <aside
        className={`qf-sidebar fixed inset-y-0 left-0 z-50 w-64 text-white flex flex-col transition-transform lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-20 px-6 flex justify-between items-center">
          <BrandLogo isWhite to="/admin/dashboard" />
          {onClose && (
            <button aria-label="Close sidebar" onClick={onClose} className="lg:hidden">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        <div className="mx-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex justify-between items-center">
            <Building2 className="w-4 h-4 text-[#cbd5e1]" />
            {clinic?.metadata?.synthetic === true && (
              <span className="text-[9px] text-[#cbd5e1] tracking-wider">DEMO</span>
            )}
          </div>
          <p className="font-semibold text-sm mt-3 leading-snug">
            {clinic?.name || 'Assigned facility'}
          </p>
          <p className="text-[11px] text-[#94a3b8] mt-1">
            {clinic?.district || 'Clinic workspace'}
          </p>
        </div>
        <p className="text-[9px] tracking-[.18em] text-[#94a3b8] font-semibold mx-7 mt-7 mb-3">
          WORKSPACE
        </p>
        <nav className="flex-1 px-4 space-y-1 overflow-auto">
          {nav
            .filter(
              (i) =>
                user?.role === 'admin' ||
                ![
                  '/admin/settings',
                  '/admin/doctors',
                  '/admin/clinics',
                  ...(user?.role === 'doctor' ? ['/admin/analytics'] : []),
                ].includes(i.to),
            )
            .map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={onClose}
                className={({ isActive }) =>
                  `qf-sidebar-link flex items-center gap-3 rounded-lg px-3 py-3 text-xs font-medium transition-colors ${isActive ? 'qf-sidebar-link-active' : 'text-[#c5dce4] hover:bg-white/5 hover:text-white'}`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
                {to === '/admin/queue' && (
                  <span className="ml-auto text-[10px] opacity-70">
                    {tokens.filter((t) => t.status === 'waiting').length}
                  </span>
                )}
              </NavLink>
            ))}
        </nav>
        <div className="px-5 py-4">
          <div className="rounded-xl bg-[#ffffff06] px-3 py-2.5 text-[10px] text-[#cbd5e1] flex gap-2 items-center">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connectionError ? 'bg-amber-400' : 'bg-emerald-300'}`}
            />
            {connectionError
              ? 'Connection interrupted'
              : lastSyncedAt
                ? 'Connected to clinic records'
                : 'Connecting to records'}
          </div>
          <div className="border-t border-[#ffffff12] pt-4 mt-4 flex gap-3 items-center">
            <div className="rounded-full bg-[#334155] w-9 h-9 flex items-center justify-center text-xs font-semibold shrink-0">
              {user?.name
                ?.split(' ')
                .map((s) => s[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs truncate font-semibold">{user?.name}</p>
              <p className="text-[10px] text-[#94a3b8] mt-1 capitalize">
                {user?.role?.replace('_', ' ')}
              </p>
            </div>
            <button
              aria-label="Sign Out Staff Portal"
              title="Sign out"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="p-2 text-[#cbd5e1] hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
