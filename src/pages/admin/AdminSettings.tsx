import React, { useState, useEffect } from 'react';
import { useQueue } from '../../context/QueueContext';
import { clinicService } from '../../services/clinicService';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { useAuth } from '../../context/AuthContext';
import { Menu, Sliders, Bell, Check } from 'lucide-react';

export const AdminSettings: React.FC = () => {
  const { settings, clinics, refreshState, showToast } = useQueue();
  const { user } = useAuth();
  const [selectedClinicId, setSelectedClinicId] = useState(user?.clinicId || '');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsLoadVersion, setSettingsLoadVersion] = useState(0);
  const settingsSource = user?.demoAllClinics ? null : settings;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [avgTime, setAvgTime] = useState(settings.averageConsultationMinutes.toString());
  const [allowWalkIns, setAllowWalkIns] = useState(settings.allowWalkIns);
  const [allowEmergency, setAllowEmergency] = useState(settings.allowEmergencyPriority);
  const [notifyTwoAhead, setNotifyTwoAhead] = useState(settings.notifyOnTwoAhead);
  const [clinicName, setClinicName] = useState(settings.clinicName);
  const [contactNumber, setContactNumber] = useState(settings.contactNumber);

  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    let current = true;
    setSettingsLoading(true);
    setSettingsError('');
    const load = async () => {
      try {
        const values = user?.demoAllClinics
          ? await clinicService.getSettings(selectedClinicId) : settingsSource!;
        if (!current) return;
        setAvgTime(String(values.averageConsultationMinutes));
        setAllowWalkIns(values.allowWalkIns);
        setAllowEmergency(values.allowEmergencyPriority);
        setNotifyTwoAhead(false);
        setClinicName(values.clinicName);
        setContactNumber(values.contactNumber);
        setIsSaved(false);
      } catch {
        if (current) setSettingsError('Settings could not be loaded. Retry to continue.');
      } finally {
        if (current) setSettingsLoading(false);
      }
    };
    load();
    return () => { current = false; };
  }, [settingsSource, selectedClinicId, user?.demoAllClinics, settingsLoadVersion]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await clinicService.updateSettings({
        averageConsultationMinutes: parseInt(avgTime, 10) || 7,
        allowWalkIns,
        allowEmergencyPriority: allowEmergency,
        notifyOnTwoAhead: notifyTwoAhead,
        clinicName,
        contactNumber,
      }, user?.demoAllClinics ? selectedClinicId : undefined);
      refreshState();
      setIsSaved(true);
      showToast('Queue configuration saved successfully', 'success');
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      showToast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <div className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-900">Queue & System Parameters</h2>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto space-y-6">
          <PageHeader
            title="Administration Settings"
            subtitle="Configure clinic OPD queue intervals, walk-in tolerances, priority triage rules, and notification policies."
          />

          {user?.demoAllClinics && (
            <Select label="Clinic to configure" value={selectedClinicId}
              disabled={isSaving}
              onChange={(event) => setSelectedClinicId(event.target.value)}
              options={clinics.map((clinic) => ({ value: clinic.id, label: clinic.name }))} />
          )}
          {settingsError && <div role="alert" className="flex items-center gap-3 text-sm text-red-800">
            <p>{settingsError}</p>
            <Button variant="outline" size="sm" onClick={() => setSettingsLoadVersion((value) => value + 1)}>Retry</Button>
          </div>}
          {settingsLoading && <p role="status" className="text-sm text-slate-600">Loading clinic settings…</p>}
          {isSaved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs font-semibold text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" />
              Settings updated. Changes propagate instantly to all active queue timers.
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <fieldset disabled={settingsLoading || Boolean(settingsError) || isSaving} className="space-y-6">
            {/* Section 1: Queue Parameters */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-slate-500" />
                OPD Queue Parameters
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Average Consultation Time (Minutes / Patient)"
                  type="number"
                  min={2}
                  max={60}
                  value={avgTime}
                  onChange={(e) => setAvgTime(e.target.value)}
                  helperText="Used to dynamically calculate estimated waiting times for patients in queue."
                />

                <Input
                  label="Facility Dispatch Name"
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  helperText="Displayed in clinic queue settings."
                />
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowWalkIns}
                    onChange={(e) => setAllowWalkIns(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-800">Allow Reception Walk-ins</p>
                    <p className="text-[11px] text-slate-500">
                      Permits receptionist to manually generate tokens for patients without prior
                      online booking.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={allowEmergency}
                    onChange={(e) => setAllowEmergency(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-800">
                      Allow Emergency / Urgent Priority Triage
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Allows staff to triage acute cases to the immediate top of the waiting queue.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Section 2: Notification & Dispatch */}
            <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-500" />
                Notification & Dispatch Settings
              </h3>

              <div className="space-y-3 text-xs">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={notifyTwoAhead}
                    disabled
                    onChange={(e) => setNotifyTwoAhead(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <p className="font-semibold text-slate-800">SMS "Two Patients Ahead" Prompt</p>
                    <p className="text-[11px] text-slate-500">
                      SMS delivery is not configured. Track queue updates in the patient portal.
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-2">
                <Input
                  label="SMS Helpdesk Helpline Contact"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                />
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
                Save Settings
              </Button>
            </div>
            </fieldset>
          </form>
        </main>
      </div>
    </div>
  );
};
