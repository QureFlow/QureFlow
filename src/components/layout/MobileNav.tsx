import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Search, Ticket, Calendar, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const MobileNav: React.FC = () => {
  const { user } = useAuth();

  // Only show bottom navigation for logged-in patients
  if (!user || user.role !== 'patient') return null;

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center py-2 px-1 text-[11px] font-medium transition-colors flex-1 ${
      isActive ? 'text-brand-950 font-bold' : 'text-slate-500 hover:text-slate-800'
    }`;

  return (
    <nav aria-label="Patient Bottom Navigation" className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 flex items-center justify-around shadow-elevated">
      <NavLink to="/patient/dashboard" className={linkClasses}>
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span>Home</span>
      </NavLink>

      <NavLink to="/patient/doctors" className={linkClasses}>
        <Search className="w-5 h-5 mb-0.5" />
        <span>Doctors</span>
      </NavLink>

      <NavLink to="/patient/token" className={linkClasses}>
        <div className="relative">
          <Ticket className="w-5 h-5 mb-0.5 text-brand-600" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500"></span>
        </div>
        <span className="text-brand-700 font-semibold">Live Queue</span>
      </NavLink>

      <NavLink to="/patient/appointments" className={linkClasses}>
        <Calendar className="w-5 h-5 mb-0.5" />
        <span>Bookings</span>
      </NavLink>

      <NavLink to="/patient/profile" className={linkClasses}>
        <User className="w-5 h-5 mb-0.5" />
        <span>Profile</span>
      </NavLink>
    </nav>
  );
};
