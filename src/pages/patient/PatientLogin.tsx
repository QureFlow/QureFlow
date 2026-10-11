import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BrandLogo } from '../../components/layout/BrandLogo';
import { AuthShell } from '../../components/layout/AuthShell';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ForgotPasswordModal } from '../../components/common/ForgotPasswordModal';
import { useAuth } from '../../context/AuthContext';
import { Phone, Lock, ArrowRight, Shield } from 'lucide-react';

export const PatientLogin: React.FC = () => {
  const { loginPatient } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your mobile number or registered email.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      // BACKEND HOOK: AWS Cognito signIn({ username: identifier, password })
      await loginPatient(identifier, password);

      const from = (
        location.state as { from?: { pathname: string; search?: string; state?: unknown } } | null
      )?.from;
      const destination =
        from?.pathname?.startsWith('/') && !from.pathname.startsWith('//')
          ? `${from.pathname}${from.search || ''}`
          : '/patient/dashboard';
      navigate(destination, { replace: true, state: from?.state });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid login credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDemo = () => {
    setIdentifier('demo.patient@example.invalid');
    setPassword('DemoPatient123!');
  };

  return (
    <AuthShell kind="patient">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo className="justify-center mb-4" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sign in to check your live queue token and manage appointments
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="qf-panel py-8 px-6 sm:px-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Mobile number / Email"
              type="text"
              placeholder="e.g. 9876543210 or email"
              icon={<Phone className="w-4 h-4" />}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
            />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="patient-password"
                  className="block text-xs font-semibold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-xs text-brand-700 hover:text-brand-900 font-medium cursor-pointer transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="patient-password"
                type="password"
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Sign in to Patient Portal
            </Button>
          </form>

          {/* Demo account quick filler */}
          {import.meta.env.VITE_ENABLE_DEMO_HINTS === 'true' && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Local demo patient</span>
              <button
                type="button"
                onClick={handleUseDemo}
                className="text-brand-700 hover:underline font-semibold"
              >
                Fill Demo Login
              </button>
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-600">
            Don't have an account?{' '}
            <Link
              to="/patient/register"
              state={location.state}
              className="font-semibold text-brand-700 hover:underline"
            >
              Create patient account
            </Link>
          </div>
        </div>

        {/* Subtle staff login jump */}
        <div className="mt-6 text-center">
          <Link
            to="/admin/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Are you clinic staff? Sign in as Reception / Admin</span>
          </Link>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        initialIdentifier={identifier}
      />
    </AuthShell>
  );
};
