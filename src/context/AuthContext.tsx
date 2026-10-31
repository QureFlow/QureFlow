import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';
import { storage } from '../services/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginPatient: (identifier: string, password?: string) => Promise<void>;
  registerPatient: (data: {
    name: string;
    phone: string;
    email: string;
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other';
    password?: string;
  }) => Promise<void>;
  loginAdmin: (identifier: string, password?: string) => Promise<void>;
  loginGuest: (role: 'patient' | 'staff') => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initial load
    let cancelled = false;
    authService.getCurrentUser().then((current) => {
      if (!cancelled) {
        setUser(current);
        setIsLoading(false);
      }
    });

    // Sync when user changes anywhere
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.type === 'USER' || customEvent.detail?.type === 'RESET') {
        setUser(storage.getActiveUser());
      }
    };

    window.addEventListener('queless-state-change', handleSync);
    return () => {
      cancelled = true;
      window.removeEventListener('queless-state-change', handleSync);
    };
  }, []);

  const loginPatient = async (identifier: string, password?: string) => {
    const logged = await authService.loginPatient(identifier, password);
    setUser(logged);
  };

  const registerPatient = async (data: {
    name: string;
    phone: string;
    email: string;
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other';
    password?: string;
  }) => {
    const registered = await authService.registerPatient(data);
    setUser(registered);
  };

  const loginAdmin = async (identifier: string, password?: string) => {
    const logged = await authService.loginAdmin(identifier, password);
    setUser(logged);
  };

  const loginGuest = async (role: 'patient' | 'staff') => {
    setUser(await authService.loginGuest(role));
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginPatient,
        registerPatient,
        loginAdmin,
        loginGuest,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
