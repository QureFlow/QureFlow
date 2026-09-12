import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BrandLogo } from '../../components/layout/BrandLogo';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';
import { User, Phone, Mail, Calendar, ArrowRight } from 'lucide-react';

export const PatientRegister: React.FC = () => {
  const { registerPatient } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('1995-05-15');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!phone.trim() || phone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (password.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      // BACKEND INTEGRATION POINT (AWS Cognito & DynamoDB):
      // 1. AWS Cognito: Auth.signUp({ username: phone, password, attributes: { name, email, birthdate: dob, gender } })
      // 2. AWS DynamoDB: PutItem to PatientsTable with partition key { patientId: cognitoSub }
      await registerPatient({
        name,
        phone,
        email: email ? email.trim() : '',
        dob,
        gender,
        password,
      });

      // Forward to original destination (e.g. /patient/doctors if user was trying to see doctors)
      const destination = (location.state as { from?: { pathname: string } })?.from?.pathname || '/patient/dashboard';
      navigate(destination, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg text-center">
        <BrandLogo className="justify-center mb-3" />
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create Patient Account</h2>
        <p className="mt-1 text-xs text-slate-500">
          Book doctors and track your live queue position from any mobile phone
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0">
        <div className="bg-white py-8 px-6 sm:px-8 rounded-lg border border-slate-200 shadow-subtle">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-xs text-red-700 rounded-md">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="e.g. Suman Roy"
              icon={<User className="w-4 h-4" />}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Mobile Number"
                type="tel"
                placeholder="10-digit phone number"
                icon={<Phone className="w-4 h-4" />}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                maxLength={10}
                required
              />

              <Input
                label="Email Address (Optional)"
                type="email"
                placeholder="name@example.com"
                icon={<Mail className="w-4 h-4" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Date of Birth"
                type="date"
                icon={<Calendar className="w-4 h-4" />}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
              />

              <Select
                label="Gender"
                options={[
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]}
                value={gender}
                onChange={(e) => setGender(e.target.value as 'Male' | 'Female' | 'Other')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              By creating an account, your token updates will be securely accessible across any phone device.
            </p>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Complete Registration & Sign In
            </Button>
          </form>

          <div className="mt-4 pt-3 border-t border-slate-100 text-center text-xs text-slate-600">
            Already have an account?{' '}
            <Link to="/patient/login" state={location.state} className="font-semibold text-brand-700 hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
