import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { Select } from '../../components/common/Select';
import { QueueTable } from '../../components/admin/QueueTable';
import { WalkInModal } from '../../components/admin/WalkInModal';
import { displayQueue, nextCallableToken } from '../../lib/queuePresentation';
import {
  Menu,
  UserPlus,
  PlayCircle,
  PauseCircle,
  PhoneForwarded,
  CheckCircle2,
  Users,
  Volume2,
} from 'lucide-react';

export const AdminQueue: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    tokens,
    doctors,
    pausedDoctors,
    callNextPatient,
    testAnnouncement,
    repeatAnnouncement,
    announcementError,
    markServed,
    skipToken,
    cancelToken,
    toggleQueuePause,
  } = useQueue();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [view, setView] = useState<'active' | 'all'>('active');
  const [isCalling, setIsCalling] = useState(false);

  // Selected doctor
  const queryDoctorId = searchParams.get('doctor');
  const selectedDoctor = doctors.find((d) => d.id === queryDoctorId) ||
    (user?.demoAllClinics
      ? doctors.find((d) => tokens.some((t) => t.doctorId === d.id &&
          ['waiting', 'current'].includes(t.status))) : undefined) || doctors[0];
  const selectedDoctorId = selectedDoctor?.id || '';

  const handleCallNext = async () => {
    if (!selectedDoctor || isCalling) return;
    setIsCalling(true);
    try {
      await callNextPatient(selectedDoctor.id);
    } finally {
      setIsCalling(false);
    }
  };

  const handleSelectDoctor = (id: string) => {
    setSearchParams({ doctor: id });
  };

  // Filter tokens for this doctor
  const doctorTokens = displayQueue(tokens.filter((t) => t.doctorId === selectedDoctorId));
  const currentToken = doctorTokens.find((t) => t.status === 'current');
  const waitingTokens = doctorTokens.filter((t) => t.status === 'waiting');
  const servedCount = doctorTokens.filter((t) => t.status === 'completed').length;
  const isPaused = pausedDoctors.includes(selectedDoctorId);
  const nextToken = nextCallableToken(doctorTokens);

  return (
    <div className="min-h-screen qf-shell flex flex-col lg:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Operational Bar */}
        <div className="qf-workspace-bar h-20 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-semibold text-slate-600">Clinic workspace / Queue</h2>
          </div>

          <div className="flex items-center gap-2">
            {user?.role !== 'doctor' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsWalkInOpen(true)}
                icon={<UserPlus className="w-3.5 h-3.5" />}
              >
                Add Walk-in
              </Button>
            )}
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <PageHeader
            title="Queue management"
            subtitle="Monitor arrivals, manage consultations, and call the next patient."
          />

          {/* Doctor Queue Tabs */}
          <div className="qf-panel p-3 overflow-x-auto">
            {user?.demoAllClinics ? (
              <Select
                label="Doctor queue across all demo clinics"
                value={selectedDoctorId}
                onChange={(event) => handleSelectDoctor(event.target.value)}
                options={doctors.map((doc) => ({ value: doc.id,
                  label: `${doc.name} · ${doc.clinicName} · ${tokens.filter(
                    (token) => token.doctorId === doc.id && token.status === 'waiting',
                  ).length} waiting`,
                }))}
              />
            ) : <div className="flex items-center gap-2 min-w-max">
              {doctors.map((doc) => {
                const isSelected = doc.id === selectedDoctorId;
                const docWaiting = tokens.filter(
                  (t) => t.doctorId === doc.id && t.status === 'waiting',
                ).length;
                const docPaused = pausedDoctors.includes(doc.id);

                return (
                  <button
                    key={doc.id}
                    onClick={() => handleSelectDoctor(doc.id)}
                    className={`px-4 py-3 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 border select-none ${
                      isSelected
                        ? 'bg-brand-950 text-white border-brand-950 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{doc.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {docWaiting}
                    </span>
                    {docPaused && (
                      <span
                        className="w-2 h-2 rounded-full bg-amber-400"
                        title="Queue Paused"
                      ></span>
                    )}
                  </button>
                );
              })}
            </div>}
          </div>

          {/* Active Queue Control Header for Selected Doctor */}
          {selectedDoctor && (
            <div className="qf-panel p-5 sm:p-7">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="text-xl font-semibold text-slate-900">{selectedDoctor.name}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                      {selectedDoctor.specialization}
                    </span>
                    {isPaused && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        Queue Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">
                    {selectedDoctor.clinicName} · Room {selectedDoctor.roomNumber || 'not assigned'}
                  </p>
                </div>

                {/* Queue Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={testAnnouncement} icon={<Volume2 className="w-3.5 h-3.5" />}>
                    Test voice
                  </Button>
                  {currentToken && (
                    <Button variant="outline" size="sm" onClick={() => repeatAnnouncement(currentToken)} icon={<Volume2 className="w-3.5 h-3.5" />}>
                      Repeat announcement
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleCallNext}
                    isLoading={isCalling}
                    disabled={!nextToken || isPaused || Boolean(currentToken)}
                    icon={<PhoneForwarded className="w-3.5 h-3.5" />}
                  >
                    Call Next Patient ({waitingTokens.length} waiting)
                  </Button>

                  <Button
                    variant={isPaused ? 'success' : 'outline'}
                    size="sm"
                    onClick={() => toggleQueuePause(selectedDoctor.id)}
                    icon={
                      isPaused ? (
                        <PlayCircle className="w-3.5 h-3.5" />
                      ) : (
                        <PauseCircle className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {isPaused ? 'Resume Queue' : 'Pause Queue'}
                  </Button>
                </div>
              </div>

              {announcementError && (
                <p role="alert" className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  {announcementError} Use Repeat announcement to call out the current token again.
                </p>
              )}

              <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                Calls follow emergency priority, then issued token order.{' '}
                {nextToken
                  ? `Next eligible patient: ${nextToken.tokenNumber} (${nextToken.patientName}).`
                  : 'No waiting patient is eligible to be called yet.'}{' '}
                Scheduled appointments become eligible at their start time.
                {currentToken
                  ? ' Complete the current consultation before calling again.'
                  : isPaused
                    ? ' Resume the queue before calling.'
                    : ''}
              </p>

              {/* Doctor Queue Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
                <div className="p-6 bg-brand-950 text-white rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-brand-200">
                      Currently In Consultation
                    </p>
                    <p className="text-4xl font-semibold text-white tracking-tight mt-3">
                      {currentToken ? currentToken.tokenNumber : 'None'}
                    </p>
                    <p className="text-xs text-brand-200 mt-3 max-w-[180px]">
                      {currentToken ? currentToken.patientName : 'Room is ready for next call'}
                    </p>
                  </div>
                  {currentToken && (
                    <Button variant="success" size="sm" onClick={() => markServed(currentToken.id)}>
                      Done
                    </Button>
                  )}
                </div>

                <div className="p-6 bg-brand-50 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Waiting in Lounge
                    </p>
                    <p className="text-4xl font-semibold text-brand-950 mt-3 mb-2">
                      {waitingTokens.length}
                    </p>
                    <p className="text-xs text-slate-500">Scheduled & walk-ins</p>
                  </div>
                  <Users className="w-6 h-6 text-slate-400" />
                </div>

                <div className="p-6 bg-slate-50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Patients Treated Today
                    </p>
                    <p className="text-4xl font-semibold text-brand-800 mt-3 mb-2">{servedCount}</p>
                    <p className="text-xs text-slate-500">Completed OPD checkups</p>
                  </div>
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
          )}

          {/* Full Queue Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-2 rounded-full bg-white border border-slate-200 p-1">
                <button
                  onClick={() => setView('active')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${view === 'active' ? 'bg-brand-950 text-white' : 'text-slate-500'}`}
                >
                  Active queue ({waitingTokens.length + Number(Boolean(currentToken))})
                </button>
                <button
                  onClick={() => setView('all')}
                  className={`rounded-full px-4 py-2 text-xs font-semibold ${view === 'all' ? 'bg-brand-950 text-white' : 'text-slate-500'}`}
                >
                  All visits ({doctorTokens.length})
                </button>
              </div>
              <span className="hidden sm:inline text-xs text-slate-500">
                Ordered by priority, then token sequence
              </span>
            </div>

            <QueueTable
              tokens={
                view === 'active'
                  ? doctorTokens.filter((t) => ['waiting', 'current'].includes(t.status))
                  : doctorTokens
              }
              onServe={markServed}
              onSkip={skipToken}
              onCancel={cancelToken}
              nextTokenId={nextToken?.id ?? null}
            />
          </div>
        </main>
      </div>

      <WalkInModal
        isOpen={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        defaultDoctorId={selectedDoctorId}
      />
    </div>
  );
};
