import React, { useState } from 'react';
import { X, KeyRound, Mail, Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { authService } from '../../services/authService';
import { Input } from './Input';
import { Button } from './Button';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialIdentifier?: string;
  theme?: 'light' | 'dark';
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialIdentifier = '',
  theme = 'light',
}) => {
  const [step, setStep] = useState<'request' | 'confirm' | 'success'>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Please enter your registered email or phone number.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const res = await authService.forgotPassword(identifier.trim());
      setSuccessMsg(res.message || 'Verification code dispatched to your registered contact.');
      setStep('confirm');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Please enter the verification code received on your phone or email.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await authService.confirmForgotPassword(identifier.trim(), code.trim(), newPassword);
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setStep('request');
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMsg('');
    onClose();
  };

  const isDark = theme === 'dark';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className={`relative w-full max-w-md rounded-xl p-6 shadow-2xl transition-all border ${
          isDark
            ? 'bg-slate-900 border-slate-700 text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <button
          onClick={resetModal}
          className={`absolute top-4 right-4 p-1 rounded-lg transition-colors ${
            isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <X className="w-5 h-5" />
        </button>

        {step === 'request' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Reset Password</h3>
                <p className="text-xs text-slate-500">We'll send an OTP to verify your account</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleRequestCode} className="space-y-4">
              <Input
                label="Registered Email or Mobile Number"
                type="text"
                placeholder="e.g. name@example.com or 9876543210"
                icon={<Mail className="w-4 h-4" />}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />

              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white"
                isLoading={isLoading}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Send Reset Code
              </Button>
            </form>
          </div>
        )}

        {step === 'confirm' && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Set New Password</h3>
                <p className="text-xs text-slate-500">Enter verification code and your new password</p>
              </div>
            </div>

            {successMsg && (
              <div className="mb-3 p-2.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 rounded-lg">
                {successMsg}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleConfirmReset} className="space-y-3">
              <div>
                <Input
                  label="Verification Code (OTP)"
                  type="text"
                  placeholder="6-digit code (or 123456 in dev)"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Tip: If cellular carriers delay international SMS, sandbox code <span className="font-mono font-semibold text-blue-600">123456</span> is accepted.
                </p>
              </div>

              <Input
                label="New Password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <Input
                label="Confirm New Password"
                type="password"
                placeholder="Re-type new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  onClick={() => setStep('request')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  isLoading={isLoading}
                >
                  Confirm Reset
                </Button>
              </div>
            </form>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold mb-1">Password Reset Complete!</h3>
            <p className="text-xs text-slate-500 mb-5">
              Your password has been updated in AWS Cognito. You can now sign in with your new credentials.
            </p>
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full justify-center bg-blue-600 hover:bg-blue-700 text-white"
              onClick={resetModal}
            >
              Sign In Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
