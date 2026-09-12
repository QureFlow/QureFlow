import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { WalkInModal } from '../../components/admin/WalkInModal';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle2,
  Stethoscope,
  UserPlus,
  ArrowRight,
  Menu,
  PauseCircle,
  PlayCircle,
  PhoneForwarded,
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tokens, appointments, doctors, pausedDoctors, callNextPatient, toggleQueuePause } =
    useQueue();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [selectedDoctorForWalkIn, setSelectedDoctorForWalkIn] = useState<string | undefined>(undefined);

  // Derive meaningful stats
  const totalAppointmentsToday = appointments.length;
  const waitingTokensCount = tokens.filter((t) => t.status === 'waiting').length;
  const servedTokensCount = tokens.filter((t) => t.status === 'completed').length;
  const activeDoctorsCount = doctors.filter((d) => d.status === 'active' && d.isAvailableToday).length;

  const handleOpenWalkIn = (docId?: string) => {
    setSelectedDoctorForWalkIn(docId);
    setIsWalkInOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Operational Bar */}
        <div className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open navigation sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="leading-tight">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Reception Operations Console
              </span>
              <p className="text-xs font-bold text-slate-800 hidden sm:block">
                Bolpur Community Health Centre • OPD Ward 1
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleOpenWalkIn()}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Add Walk-in Patient
            </Button>
          </div>
        </div>

        {/* Dashboard Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <PageHeader
            title={`Good morning, ${user?.name || 'Staff'}`}
            subtitle="Today's live OPD operational summary and doctor queue flow status."
            badge={
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                Live Reception Desk
              </span>
            }
          />

          {/* Today's Overview Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Appointments Today"
              value={totalAppointmentsToday}
              subtext="Online & Walk-ins booked"
              icon={<Calendar className="w-5 h-5" />}
            />
            <StatCard
              label="Patients Waiting"
              value={waitingTokensCount}
              subtext="In OPD waiting lounge"
              icon={<Clock className="w-5 h-5" />}
              highlight={waitingTokensCount > 0}
            />
            <StatCard
              label="Patients Served"
              value={servedTokensCount}
              subtext="Completed consultations"
              icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            />
            <StatCard
              label="Doctors Active"
              value={activeDoctorsCount}
              subtext="In consultation chambers"
              icon={<Stethoscope className="w-5 h-5" />}
            />
          </div>

          {/* Current Queue Section */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/50">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Current Doctor Queues</h2>
                <p className="text-xs text-slate-500">
                  Live state of tokens across all consulting doctors today
                </p>
              </div>
              <Link to="/admin/queue">
                <Button variant="outline" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Open Full Queue Manager
                </Button>
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Doctor & Department</th>
                    <th className="py-3 px-4">Currently Serving</th>
                    <th className="py-3 px-4">Waiting Count</th>
                    <th className="py-3 px-4">Queue Status</th>
                    <th className="py-3 px-4 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctors
                    .filter((d) => d.status === 'active')
                    .slice(0, 6)
                    .map((doc) => {
                      const docTokens = tokens.filter((t) => t.doctorId === doc.id);
                      const currentToken = docTokens.find((t) => t.status === 'current');
                      const waitingCount = docTokens.filter((t) => t.status === 'waiting').length;
                      const isPaused = pausedDoctors.includes(doc.id);

                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{doc.name}</div>
                            <div className="text-[11px] text-brand-700 font-medium">{doc.specialization}</div>
                            <div className="text-[10px] text-slate-400">{doc.clinicName}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            {currentToken ? (
                              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-800 px-2.5 py-1 rounded border border-blue-200 font-bold">
                                <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                <span className="font-mono text-sm">{currentToken.tokenNumber}</span>
                                <span className="font-normal text-[11px] text-slate-600 hidden sm:inline truncate max-w-[120px]">
                                  ({currentToken.patientName})
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                              <span className="text-sm">{waitingCount}</span>
                              <span className="text-[11px] text-slate-500 font-normal">in queue</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {isPaused ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-medium text-[11px]">
                                <PauseCircle className="w-3 h-3 text-amber-600" />
                                Paused
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                                Active
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Quick Call Next */}
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => callNextPatient(doc.id)}
                                disabled={waitingCount === 0 || isPaused}
                                icon={<PhoneForwarded className="w-3 h-3" />}
                                title="Call next waiting patient"
                              >
                                Call
                              </Button>

                              {/* Pause/Resume Queue */}
                              <button
                                onClick={() => toggleQueuePause(doc.id)}
                                className={`p-1.5 rounded border transition-colors ${
                                  isPaused
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                                title={isPaused ? 'Resume queue' : 'Pause queue'}
                                aria-label={isPaused ? 'Resume queue' : 'Pause queue'}
                              >
                                {isPaused ? (
                                  <PlayCircle className="w-3.5 h-3.5 text-emerald-700" />
                                ) : (
                                  <PauseCircle className="w-3.5 h-3.5" />
                                )}
                              </button>

                              <Link to={`/admin/queue?doctor=${doc.id}`}>
                                <Button variant="outline" size="sm">
                                  Manage
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Walk-in Registration Modal */}
      <WalkInModal
        isOpen={isWalkInOpen}
        onClose={() => setIsWalkInOpen(false)}
        defaultDoctorId={selectedDoctorForWalkIn}
      />
    </div>
  );
};
