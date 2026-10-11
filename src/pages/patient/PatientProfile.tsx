import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { patientService } from '../../services/patientService';
import { useNavigate } from 'react-router-dom';
import { Check, LogOut, Bell, Shield, User } from 'lucide-react';

export const PatientProfile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [dob, setDob] = useState(user?.dob || '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>(
    (user?.gender as any) || 'Male',
  );

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
      setDob(user.dob || '');
      setGender((user.gender as any) || 'Male');
    }
  }, [user]);

  const [smsNotification] = useState(false);
  const [whatsappNotification] = useState(false);
  const [error, setError] = useState('');

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    setError('');
    try {
      await patientService.updatePatient(user.id, {
        name,
        phone,
        email,
        dob: dob || undefined,
        gender,
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Profile update failed.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16 md:pb-0">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <PageHeader
          title="Patient Profile & Settings"
          subtitle="Manage your contact details and profile information."
        />

        {isSaved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600" />
            Profile updated successfully.
          </div>
        )}
        {error && (
          <p role="alert" className="p-3 bg-red-50 text-red-800 rounded text-sm">
            {error}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Personal Info (2 Cols) */}
          <div className="md:col-span-2 bg-white rounded-lg border border-slate-200 p-6 shadow-subtle">
            <h2 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-5 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              Personal Information
            </h2>

            <form onSubmit={handleSave} className="space-y-4">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Registered Mobile Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={10}
                  required
                />

                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Date of Birth"
                  type="date"
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

              <div className="pt-2 flex justify-end">
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>

          {/* Account Settings & Preferences */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 pb-2 border-b border-slate-100 mb-3 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5" />
                Alert Preferences
              </h2>
              <div className="space-y-3 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={smsNotification}
                    disabled
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-800">SMS Token Status</p>
                    <p className="text-[11px] text-slate-500">
                      Not configured. Track your token in the patient portal.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={whatsappNotification}
                    disabled
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-800">WhatsApp Alert</p>
                    <p className="text-[11px] text-slate-500">
                      WhatsApp delivery is not configured.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5" />
                Security & Session
              </h2>
              <p className="text-xs text-slate-500">You are signed in to your QureFlow account.</p>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-600 hover:bg-red-50 border-red-200 hover:border-red-300"
                onClick={handleLogout}
                icon={<LogOut className="w-3.5 h-3.5 text-red-600" />}
              >
                Sign out of account
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
