import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { QueueTable } from '../../components/admin/QueueTable';
import { WalkInModal } from '../../components/admin/WalkInModal';
import {
  Menu,
  UserPlus,
  PlayCircle,
  PauseCircle,
  PhoneForwarded,
  CheckCircle2,
  Users,
} from 'lucide-react';

export const AdminQueue: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    tokens,
    doctors,
    pausedDoctors,
    callNextPatient,
    markServed,
    skipToken,
    cancelToken,
    toggleQueuePause,
  } = useQueue();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);

  // Selected doctor
  const queryDoctorId = searchParams.get('doctor');
  const defaultDocId = doctors[0]?.id || 'doc-1';
  const selectedDoctorId = queryDoctorId || defaultDocId;

  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  const handleSelectDoctor = (id: string) => {
    setSearchParams({ doctor: id });
  };

  // Filter tokens for this doctor
  const doctorTokens = tokens.filter((t) => t.doctorId === selectedDoctorId);
  const currentToken = doctorTokens.find((t) => t.status === 'current');
  const waitingTokens = doctorTokens.filter((t) => t.status === 'waiting');
  const servedCount = doctorTokens.filter((t) => t.status === 'completed').length;
  const isPaused = pausedDoctors.includes(selectedDoctorId);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Operational Bar */}
        <div className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-900">OPD Queue Command Center</h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsWalkInOpen(true)}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Add Walk-in
            </Button>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <PageHeader
            title="Live Queue Management"
            subtitle="Control patient triage, call upcoming tokens, manage walk-in arrivals, and monitor consultation chambers."
          />

          {/* Doctor Queue Tabs */}
          <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-subtle overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
              {doctors.map((doc) => {
                const isSelected = doc.id === selectedDoctorId;
                const docWaiting = tokens.filter(
                  (t) => t.doctorId === doc.id && t.status === 'waiting'
                ).length;
                const docPaused = pausedDoctors.includes(doc.id);

                return (
                  <button
                    key={doc.id}
                    onClick={() => handleSelectDoctor(doc.id)}
                    className={`px-3 py-2 rounded-md text-xs font-semibold transition-all flex items-center gap-2 border select-none ${
                      isSelected
                        ? 'bg-brand-950 text-white border-brand-950 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span>{doc.name}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {docWaiting}
                    </span>
                    {docPaused && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Queue Paused"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Queue Control Header for Selected Doctor */}
          {selectedDoctor && (
            <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 shadow-subtle">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-slate-900">{selectedDoctor.name}</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                      {selectedDoctor.specialization}
                    </span>
                    {isPaused && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                        Queue Paused
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{selectedDoctor.clinicName} • Room 102</p>
                </div>

                {/* Queue Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => callNextPatient(selectedDoctor.id)}
                    disabled={waitingTokens.length === 0 || isPaused}
                    icon={<PhoneForwarded className="w-3.5 h-3.5" />}
                  >
                    Call Next Patient ({waitingTokens.length} waiting)
                  </Button>

                  <Button
                    variant={isPaused ? 'success' : 'outline'}
                    size="sm"
                    onClick={() => toggleQueuePause(selectedDoctor.id)}
                    icon={isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                  >
                    {isPaused ? 'Resume Queue' : 'Pause Queue'}
                  </Button>
                </div>
              </div>

              {/* Doctor Queue Quick Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5">
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                      Currently In Consultation
                    </p>
                    <p className="text-2xl font-black text-blue-700 font-mono mt-0.5">
                      {currentToken ? currentToken.tokenNumber : 'None'}
                    </p>
                    <p className="text-xs text-blue-950 font-medium truncate max-w-[180px]">
                      {currentToken ? currentToken.patientName : 'Room is ready for next call'}
                    </p>
                  </div>
                  {currentToken && (
                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => markServed(currentToken.id)}
                    >
                      Done
                    </Button>
                  )}
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Waiting in Lounge
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-0.5">{waitingTokens.length}</p>
                    <p className="text-xs text-slate-500">Scheduled & walk-ins</p>
                  </div>
                  <Users className="w-6 h-6 text-slate-400" />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Patients Treated Today
                    </p>
                    <p className="text-2xl font-bold text-emerald-700 mt-0.5">{servedCount}</p>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                All Tokens in {selectedDoctor?.name}'s Queue
              </h3>
              <span className="text-xs text-slate-500">
                Emergency priority patients jump to top of waitlist
              </span>
            </div>

            <QueueTable
              tokens={doctorTokens}
              onServe={markServed}
              onCall={callNextPatient}
              onSkip={skipToken}
              onCancel={cancelToken}
              doctorId={selectedDoctorId}
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
