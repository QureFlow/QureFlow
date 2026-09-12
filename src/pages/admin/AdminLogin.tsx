import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../../components/layout/BrandLogo';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, ArrowRight, UserCheck } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('admin@bolpurhealth.org');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your Staff ID or official Email');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await loginAdmin(identifier, password);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid staff credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDemo = () => {
    setIdentifier('admin@bolpurhealth.org');
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo isWhite className="justify-center mb-4" />
        <h2 className="text-2xl font-bold tracking-tight text-white">Clinic Administration</h2>
        <p className="mt-1 text-xs text-slate-400">
          Sign in to manage doctors, appointments, patients and queues.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-950 py-8 px-6 sm:px-8 rounded-lg border border-slate-800 shadow-elevated">
          {error && (
            <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-xs text-red-300 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email / Staff ID
              </label>
              <Input
                type="text"
                placeholder="e.g. REC-204 or staff email"
                icon={<Shield className="w-4 h-4 text-slate-400" />}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Staff Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4 text-slate-400" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white border-transparent"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign in to Staff Console
            </Button>
          </form>

          {/* Demo account quick filler */}
          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>Demo Staff: REC-204 (Bishakha Roy)</span>
            <button
              type="button"
              onClick={handleUseDemo}
              className="text-blue-400 hover:underline font-semibold"
            >
              Fill Demo Login
            </button>
          </div>
        </div>

        {/* Patient login link */}
        <div className="mt-6 text-center">
          <Link
            to="/patient/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Are you a patient? Sign in here</span>
          </Link>
        </div>
      </div>
    </div>
  );
};
