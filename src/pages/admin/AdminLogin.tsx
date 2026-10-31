import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BrandLogo } from '../../components/layout/BrandLogo';
import { AuthShell } from '../../components/layout/AuthShell';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { ForgotPasswordModal } from '../../components/common/ForgotPasswordModal';
import { useAuth } from '../../context/AuthContext';
import { Shield, Lock, ArrowRight, UserCheck } from 'lucide-react';

export const AdminLogin: React.FC = () => {
  const { loginAdmin, loginGuest } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
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
      // BACKEND INTEGRATION POINT (AWS Cognito & DynamoDB):
      // 1. AWS Cognito: Auth.signIn({ username: identifier, password })
      // 2. Verify Cognito User Groups includes 'Admins' or 'HospitalStaff'
      // 3. AWS DynamoDB: Fetch Staff profile from StaffTable by staffId/cognitoSub
      await loginAdmin(identifier, password);
      navigate('/admin/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid staff credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDemo = () => {
    setIdentifier('demo.staff@example.invalid');
    setPassword('DemoClinic123!');
  };

  return (
    <AuthShell kind="staff">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <BrandLogo className="justify-center mb-4" />
        <h2 className="qf-title text-3xl font-semibold text-slate-900">
          Welcome to your workspace.
        </h2>
        <p className="mt-3 text-sm text-slate-500">
          Sign in to manage doctors, appointments, patients and queues.
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="qf-panel py-8 px-6 sm:px-8">
          {error && (
            <div
              role="alert"
              className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-800 rounded-md"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="staff-identifier"
                className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5"
              >
                Email / Staff ID
              </label>
              <Input
                id="staff-identifier"
                type="text"
                placeholder="e.g. REC-204 or staff email"
                icon={<Shield className="w-4 h-4 text-slate-400" />}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="staff-password"
                  className="block text-xs font-semibold text-slate-600 uppercase tracking-wider"
                >
                  Staff Password
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
                id="staff-password"
                type="password"
                placeholder="••••••••"
                icon={<Lock className="w-4 h-4 text-slate-400" />}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
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
              Sign in to Staff Console
            </Button>
          </form>

          {import.meta.env.VITE_GUEST_LOGIN === 'true' && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full mt-3"
              disabled={isLoading}
              onClick={async () => {
                try {
                  setIsLoading(true);
                  setError('');
                  await loginGuest('staff');
                  navigate('/admin/dashboard');
                } catch (err: unknown) {
                  setError(err instanceof Error ? err.message : 'Guest sign-in failed');
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              Continue as guest staff (demo clinic)
            </Button>
          )}

          {/* Demo account quick filler */}
          {import.meta.env.VITE_ENABLE_DEMO_HINTS === 'true' && (
            <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Local demo: all six clinics</span>
              <button
                type="button"
                onClick={handleUseDemo}
                className="text-brand-700 hover:underline font-semibold"
              >
                Fill Demo Login
              </button>
            </div>
          )}

          {/* Explicit Administrative Security Note */}
          <div className="mt-4 p-3 bg-brand-50 rounded-xl text-[11px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-brand-800">Staff accounts:</span> Self-registration
            is disabled. Staff accounts are provisioned exclusively by Hospital IT Administration.
          </div>
        </div>

        {/* Patient login link */}
        <div className="mt-6 text-center">
          <Link
            to="/patient/login"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-brand-700 transition-colors"
          >
            <UserCheck className="w-3.5 h-3.5 text-slate-400" />
            <span>Are you a patient? Sign in here</span>
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
