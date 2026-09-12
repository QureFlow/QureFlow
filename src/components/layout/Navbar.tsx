import React, { useState } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  Search,
  LayoutDashboard,
  Ticket,
  User,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const isPatient = user && user.role === 'patient';

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navItemClasses = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
      isActive
        ? 'bg-slate-100 text-brand-950 font-semibold'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
    }`;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <BrandLogo to={isPatient ? '/patient/dashboard' : '/'} />

          {/* Desktop Navigation links */}
          {isPatient && (
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/patient/dashboard" className={navItemClasses}>
                <LayoutDashboard className="w-3.5 h-3.5" />
                Dashboard
              </NavLink>
              <NavLink to="/patient/doctors" className={navItemClasses}>
                <Search className="w-3.5 h-3.5" />
                Find Doctor
              </NavLink>
              <NavLink to="/patient/appointments" className={navItemClasses}>
                <Calendar className="w-3.5 h-3.5" />
                My Appointments
              </NavLink>
              <NavLink to="/patient/token" className={navItemClasses}>
                <Ticket className="w-3.5 h-3.5" />
                My Token
              </NavLink>
            </nav>
          )}
        </div>

        {/* Right Actions */}
        <div className="hidden md:flex items-center gap-3">
          {isPatient ? (
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-left transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-brand-950 text-white flex items-center justify-center text-xs font-semibold">
                  {user.name.charAt(0)}
                </div>
                <div className="text-left leading-tight hidden lg:block">
                  <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                  <p className="text-[11px] text-slate-500">{user.phone}</p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 mt-1.5 w-48 bg-white rounded-lg border border-slate-200 shadow-elevated py-1 z-50 text-xs">
                  <div className="px-3 py-2 border-b border-slate-100 lg:hidden">
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="text-slate-500">{user.phone}</p>
                  </div>
                  <Link
                    to="/patient/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    Patient Profile
                  </Link>
                  <div className="border-t border-slate-100 my-1"></div>
                  <button
                    onClick={() => {
                      setIsProfileOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 text-left"
                  >
                    <LogOut className="w-3.5 h-3.5 text-red-500" />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/patient/login"
                className="px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 rounded-md border border-slate-200 hover:bg-slate-50"
              >
                Patient Sign In
              </Link>
              <Link
                to="/admin/login"
                className="px-3 py-1.5 text-xs font-medium text-white bg-brand-950 hover:bg-slate-800 rounded-md"
              >
                Reception / Admin
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu trigger */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1">
          {isPatient ? (
            <>
              <div className="py-2 px-3 mb-2 bg-slate-50 rounded-md border border-slate-200 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-950 text-white flex items-center justify-center font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900">{user.name}</p>
                  <p className="text-[11px] text-slate-500">{user.phone}</p>
                </div>
              </div>
              <Link
                to="/patient/dashboard"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md"
              >
                <LayoutDashboard className="w-4 h-4 text-slate-500" />
                Dashboard
              </Link>
              <Link
                to="/patient/doctors"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md"
              >
                <Search className="w-4 h-4 text-slate-500" />
                Find Doctor
              </Link>
              <Link
                to="/patient/appointments"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md"
              >
                <Calendar className="w-4 h-4 text-slate-500" />
                My Appointments
              </Link>
              <Link
                to="/patient/token"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md"
              >
                <Ticket className="w-4 h-4 text-slate-500" />
                My Token
              </Link>
              <Link
                to="/patient/profile"
                onClick={() => setIsMobileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 rounded-md"
              >
                <User className="w-4 h-4 text-slate-500" />
                Profile Settings
              </Link>
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md text-left"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                Sign Out
              </button>
            </>
          ) : (
            <div className="space-y-2 pt-2">
              <Link
                to="/patient/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full text-center px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-md"
              >
                Patient Sign In
              </Link>
              <Link
                to="/admin/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block w-full text-center px-4 py-2 text-sm font-medium text-white bg-brand-950 rounded-md"
              >
                Reception / Admin Login
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};
