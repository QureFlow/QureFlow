import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Menu,
  Plus,
  Stethoscope,
  Users,
} from 'lucide-react';
import { useQueue } from '../../context/QueueContext';
import { useAuth } from '../../context/AuthContext';
import { Sidebar } from '../../components/layout/Sidebar';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { WalkInModal } from '../../components/admin/WalkInModal';
import { clinicDate } from '../../lib/time';
export const AdminDashboard = () => {
  const { user } = useAuth();
  const { tokens, appointments, doctors, clinics, pausedDoctors, lastSyncedAt } = useQueue();
  const [sidebar, setSidebar] = useState(false),
    [walkin, setWalkin] = useState(false);
  const clinic = clinics.find((c) => c.id === user?.clinicId),
    roster = doctors.filter(
      (d) => d.clinicId === user?.clinicId && (user?.role !== 'doctor' || d.id === user.doctorId),
    );
  const waiting = tokens.filter((t) => t.status === 'waiting'),
    current = tokens.filter((t) => t.status === 'current'),
    completed = tokens.filter((t) => t.status === 'completed');
  const dayAppointments = appointments.filter((a) => a.date === clinicDate()),
    upcoming = appointments
      .filter((a) => a.date > clinicDate() && ['booked', 'waiting'].includes(a.status))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  const firstName = user?.name?.startsWith('Demo ') ? 'team' : user?.name?.split(' ')[0] || 'team';
  return (
    <div className="qf-shell min-h-screen lg:flex">
      <Sidebar isOpen={sidebar} onClose={() => setSidebar(false)} />
      <div className="flex-1 lg:pl-64 min-w-0">
        <header className="qf-workspace-bar h-20 px-5 sm:px-8 flex items-center justify-between bg-white/75 border-b border-[#e2e8f0] sticky top-0 z-20 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden"
              aria-label="Open navigation sidebar"
              onClick={() => setSidebar(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-brand-950">Clinic overview</span>
            <span className="hidden sm:inline text-[10px] border-l pl-3 text-slate-400">
              {clinic?.name}
            </span>
          </div>
          <div className="flex gap-3 items-center">
            <span className="hidden md:inline-flex items-center gap-2 text-xs text-slate-500">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
              Clinic records
            </span>
            {user?.role !== 'doctor' && (
              <Button size="sm" onClick={() => setWalkin(true)} icon={<Plus className="w-4 h-4" />}>
                Add Walk-in Patient
              </Button>
            )}
          </div>
        </header>
        <main className="max-w-[1440px] mx-auto p-5 sm:p-8 space-y-7 qf-enter">
          <div className="qf-page-heading flex flex-wrap justify-between gap-4 items-end">
            <div>
              <p className="qf-eyebrow">
                {new Intl.DateTimeFormat('en-IN', {
                  timeZone: 'Asia/Kolkata',
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }).format(new Date())}
              </p>
              <h1 className="qf-title text-3xl sm:text-4xl mt-3">Clinic overview</h1>
              <p className="text-sm text-slate-500 mt-3">
                Welcome back, {firstName}. Here’s what’s happening at your clinic.
              </p>
            </div>
            <Link
              to="/admin/analytics"
              className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 border border-[#e2e8f0] rounded-lg bg-white px-4 py-2.5"
            >
              View insights <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {clinic?.metadata?.synthetic === true && (
            <p className="text-[11px] text-[#64748b]">
              Synthetic demo workspace · Patient records and operational history are generated for
              demonstration.
            </p>
          )}
          <div className="qf-metrics grid grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Waiting now"
              value={waiting.length}
              subtext="Across your consulting rooms"
              icon={<Users className="w-5 h-5" />}
              highlight
            />
            <StatCard
              label="In consultation"
              value={current.length}
              subtext={`${roster.length} doctors in your roster`}
              icon={<Stethoscope className="w-5 h-5" />}
            />
            <StatCard
              label="Completed today"
              value={completed.length}
              subtext="Consultations marked served"
              icon={<CheckCircle2 className="w-5 h-5" />}
            />
            <StatCard
              label="Bookings today"
              value={dayAppointments.length}
              subtext="Scheduled and reception visits"
              icon={<CalendarDays className="w-5 h-5" />}
            />
          </div>
          <div className="grid xl:grid-cols-[1.8fr_1fr] gap-6">
            <section className="qf-panel p-5 sm:p-6">
              <div className="flex justify-between items-center gap-3 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-brand-950 tracking-tight">
                    Consultation floor
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Your doctors, their queues, one clear view.
                  </p>
                </div>
                <Link to="/admin/queue" className="text-brand-600 text-xs font-semibold">
                  Manage queues ↗
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {roster.map((doc) => {
                  const rows = tokens.filter((t) => t.doctorId === doc.id),
                    now = rows.find((t) => t.status === 'current'),
                    count = rows.filter((t) => t.status === 'waiting').length,
                    paused = pausedDoctors.includes(doc.id);
                  return (
                    <Link
                      to={`/admin/queue?doctor=${doc.id}`}
                      key={doc.id}
                      className="p-4 rounded-2xl border border-[#e2e8f0] hover:border-brand-300 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#f1f5f9] text-brand-700 font-semibold text-xs">
                          {doc.name
                            .replace(/^Dr\.\s*/, '')
                            .split(' ')
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join('')}
                        </span>
                        <span
                          className={`text-[9px] px-2 py-1 rounded-full ${paused ? 'bg-amber-50 text-amber-700' : now ? 'bg-brand-50 text-brand-700' : 'bg-slate-50 text-slate-500'}`}
                        >
                          {paused ? 'Paused' : now ? 'In consultation' : 'Queue open'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-brand-950 mt-3">{doc.name}</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {doc.specialization}
                        {doc.roomNumber ? ` · Room ${doc.roomNumber}` : ''}
                      </p>
                      <div className="mt-4 pt-3 border-t border-[#e2e8f0] flex justify-between text-xs">
                        <span className="text-slate-400">
                          Serving{' '}
                          <strong className="text-brand-800 ml-1 font-mono">
                            {now?.tokenNumber || '—'}
                          </strong>
                        </span>
                        <span className="text-slate-500">
                          <strong className="text-brand-950">{count}</strong> waiting
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
            <div className="space-y-5">
              <section className="bg-[#f1f5f9] rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <p className="qf-eyebrow">Flow snapshot</p>
                  <Activity className="w-4 h-4 text-brand-600" />
                </div>
                <p className="text-3xl font-semibold text-brand-950 mt-5">
                  {tokens.length}
                  <span className="text-sm font-normal text-slate-500 ml-2">visits today</span>
                </p>
                <div className="h-2 rounded-full overflow-hidden flex bg-[#e2e8f0] mt-5">
                  {[
                    ['bg-brand-600', completed.length],
                    ['bg-[#60a5fa]', current.length],
                    ['bg-[#bfdbfe]', waiting.length],
                  ].map(([color, count]) => (
                    <div
                      key={String(color)}
                      className={String(color)}
                      style={{
                        width: `${tokens.length ? (Number(count) / tokens.length) * 100 : 0}%`,
                      }}
                    />
                  ))}
                </div>
                <div className="flex justify-between gap-2 text-[10px] text-slate-500 mt-3">
                  <span>Completed {completed.length}</span>
                  <span>Consulting {current.length}</span>
                  <span>Waiting {waiting.length}</span>
                </div>
                <Link
                  to="/admin/analytics"
                  className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-brand-800"
                >
                  Explore consultation trends <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </section>
              <section className="qf-panel p-6">
                <div className="flex justify-between items-center">
                  <h2 className="font-semibold text-brand-950">Coming up</h2>
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                </div>
                <p className="text-xs text-slate-400 mt-1">Future scheduled appointments</p>
                <div className="mt-4 divide-y divide-[#e2e8f0]">
                  {upcoming.map((a) => (
                    <div key={a.id} className="py-3 flex gap-3 items-center">
                      <div className="bg-[#f1f5f9] rounded-xl px-3 py-2 text-center">
                        <p className="text-base font-semibold text-brand-800">{a.date.slice(8)}</p>
                        <p className="text-[9px] text-slate-500">
                          {new Intl.DateTimeFormat('en-IN', {
                            month: 'short',
                            timeZone: 'Asia/Kolkata',
                          }).format(new Date(`${a.date}T12:00:00+05:30`))}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-brand-950 truncate">
                          {a.patientName}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 truncate">
                          {a.doctorName} · {a.time}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!upcoming.length && (
                    <p className="text-xs text-slate-500 py-5">No upcoming bookings yet.</p>
                  )}
                </div>
                <Link
                  to="/admin/appointments"
                  className="block text-xs font-semibold text-brand-700 mt-3"
                >
                  All appointments ↗
                </Link>
              </section>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            {lastSyncedAt
              ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`
              : 'Connecting to clinic records…'}{' '}
            · Times shown in Asia/Kolkata
          </p>
        </main>
      </div>
      <WalkInModal isOpen={walkin} onClose={() => setWalkin(false)} />
    </div>
  );
};
