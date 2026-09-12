import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const PatientRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-brand-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'patient') {
    return <Navigate to="/patient/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-6 h-6 border-2 border-brand-950 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
