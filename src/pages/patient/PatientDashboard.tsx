import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { queueService } from '../../services/queueService';
import { appointmentService } from '../../services/appointmentService';
import { Appointment, PatientQueueStatus } from '../../types';
import { clinicDate } from '../../lib/time';
import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { MobileNav } from '../../components/layout/MobileNav';
import { DoctorCard } from '../../components/patient/DoctorCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Calendar, ArrowUpRight, Clock, MapPin, Search, Ticket, Users } from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tokens, appointments, doctors, clinics } = useQueue();
  const [active, setActive] = useState<PatientQueueStatus | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) return;
      try {
        const [queue, visits] = await Promise.all([
          queueService.getPatientActiveToken(user.id),
          appointmentService.getAppointments({ patientId: user.id }),
        ]);
        if (cancelled) return;
        setActive(queue);
        setUpcoming(
          visits
            .filter(
              (a) =>
                a.date >= clinicDate() &&
                ['booked', 'waiting', 'in_consultation'].includes(a.status),
            )
            .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
        );
        setError('');
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Unable to refresh your appointments.');
      } finally {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id, tokens, appointments]);
  const next = upcoming[0];
  return (
    <div className="min-h-screen qf-shell pb-16 md:pb-0 flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto w-full px-5 sm:px-8 py-10 flex-1 space-y-8 qf-enter">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="qf-eyebrow mb-3">Your care, at a glance</p>
            <h1 className="qf-title text-4xl sm:text-5xl font-semibold text-slate-900">
              Hello, {user?.name.split(' ')[0] || 'there'}.
            </h1>
            <p className="text-slate-500 mt-3">
              A little less waiting. A little more time for you.
            </p>
          </div>
          <Link
            to="/patient/doctors"
            className="rounded-full bg-brand-600 text-white px-6 py-3 flex gap-3 items-center text-sm font-semibold"
          >
            <Search size={17} />
            Find a Doctor
            <ArrowUpRight size={17} />
          </Link>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700 text-sm">
            {error}
          </p>
        )}
        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          <section className="rounded-[28px] bg-brand-950 text-white p-7 sm:p-9 qf-grid-paper relative overflow-hidden">
            <div className="flex justify-between items-center">
              <p className="text-[11px] tracking-[.18em] uppercase text-brand-200 font-semibold">
                Your queue companion
              </p>
              <Ticket className="text-brand-300" />
            </div>
            {!loaded ? (
              <p className="py-14 text-brand-100">Checking your queue…</p>
            ) : active ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-6 mt-8">
                  <div>
                    <p className="text-brand-200 text-sm">
                      {active.token.status === 'current'
                        ? 'It’s your turn'
                        : active.isPaused
                          ? 'Queue temporarily paused'
                          : 'You’re in the queue'}
                    </p>
                    <h2 className="text-6xl sm:text-7xl font-semibold tracking-tight mt-3">
                      {active.token.tokenNumber}
                    </h2>
                    <p className="mt-4 text-brand-100 text-sm">{active.token.doctorName}</p>
                    <p className="text-brand-300 text-xs mt-1">
                      {clinics.find((c) => c.id === active.token.clinicId)?.name ||
                        active.token.clinicName}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-5 min-w-36">
                    <Clock className="text-brand-200 mb-2" size={20} />
                    <strong className="text-3xl block">
                      {active.token.status === 'current'
                        ? 'Now'
                        : `~${active.estimatedWaitMinutes} min`}
                    </strong>
                    <span className="text-xs text-brand-200">
                      {active.isPaused ? 'Estimate may change' : 'Estimated waiting time'}
                    </span>
                  </div>
                </div>
                <div className="mt-8 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-brand-100 flex items-center gap-2">
                    <Users size={16} />
                    {active.patientsAhead} people ahead · Serving{' '}
                    {active.currentServingToken || '—'}
                  </span>
                  <Link
                    to="/patient/token"
                    className="text-xs font-semibold flex gap-2 items-center"
                  >
                    Track my token
                    <ArrowUpRight size={16} />
                  </Link>
                </div>
                {active.prediction && (
                  <p className="text-[11px] text-brand-300 mt-4">
                    Estimate based on {active.prediction.sampleCount} consultation samples
                    {active.prediction.syntheticSamples > 0
                      ? ' (includes synthetic demo history)'
                      : ''}
                    . Actual waiting time can change.
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="qf-title text-white text-4xl font-semibold mt-9 max-w-sm">
                  Your next visit starts here.
                </h2>
                <p className="text-brand-200 text-sm mt-4 max-w-sm leading-relaxed">
                  You have no active queue token. Choose a doctor and book a consultation to follow
                  your place in the queue.
                </p>
                <Link
                  to="/patient/doctors"
                  className="inline-flex gap-3 items-center rounded-full bg-brand-100 text-brand-950 px-5 py-3 text-sm font-semibold mt-7"
                >
                  Explore doctors
                  <ArrowUpRight size={17} />
                </Link>
              </>
            )}
          </section>
          <section className="qf-panel p-7 sm:p-8">
            <div className="flex justify-between items-center mb-7">
              <p className="qf-eyebrow">Coming up next</p>
              <Calendar className="text-brand-700" size={22} />
            </div>
            {next ? (
              <>
                <StatusBadge status={next.status} size="sm" />
                <h2 className="text-2xl font-semibold text-slate-900 mt-4">{next.doctorName}</h2>
                <p className="text-brand-700 text-sm mt-2">{next.doctorSpecialization}</p>
                <p className="flex gap-2 items-center text-sm text-slate-500 mt-5">
                  <MapPin size={17} />
                  {next.clinicName}
                </p>
                <div className="grid grid-cols-2 rounded-2xl bg-brand-50 p-4 gap-3 mt-5">
                  <div>
                    <p className="text-xs text-slate-500">Appointment date</p>
                    <p className="font-semibold text-sm mt-2">{next.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Arrival slot</p>
                    <p className="font-semibold text-sm mt-2">{next.time}</p>
                  </div>
                </div>
                <Link
                  to="/patient/appointments"
                  className="flex items-center justify-between text-sm font-semibold text-brand-700 mt-6"
                >
                  Manage appointments
                  <ArrowUpRight size={18} />
                </Link>
              </>
            ) : (
              <div className="py-5">
                <h2 className="text-2xl font-semibold text-slate-900">A clear calendar.</h2>
                <p className="mt-3 text-sm text-slate-500 leading-relaxed">
                  {loaded
                    ? 'No upcoming appointments. Browse the care directory whenever you’re ready.'
                    : 'Loading your appointments…'}
                </p>
                <Link
                  to="/patient/appointments"
                  className="inline-flex gap-2 text-brand-700 font-semibold text-sm mt-6"
                >
                  View appointment history
                  <ArrowUpRight size={18} />
                </Link>
              </div>
            )}
          </section>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            {
              label: 'Explore care',
              text: `${doctors.length} doctors across the care directory`,
              path: '/patient/doctors',
              Icon: Search,
            },
            {
              label: 'My appointments',
              text: `${upcoming.length} upcoming visits · history and bookings`,
              path: '/patient/appointments',
              Icon: Calendar,
            },
            {
              label: 'Live token tracker',
              text: 'Your place in the queue, in one view',
              path: '/patient/token',
              Icon: Ticket,
            },
          ].map(({ label, text, path, Icon }) => (
            <Link
              key={path}
              to={path}
              className="qf-panel p-5 flex items-center gap-4 hover:border-brand-300 transition"
            >
              <div className="rounded-xl bg-brand-50 p-3 text-brand-700">
                <Icon size={21} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">{label}</h3>
                <p className="text-xs text-slate-500 mt-1">{text}</p>
              </div>
              <ArrowUpRight size={18} className="text-slate-400" />
            </Link>
          ))}
        </div>
        <section>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="qf-eyebrow mb-2">Meet the care team</p>
              <h2 className="text-2xl font-semibold text-slate-900">Care close to you.</h2>
            </div>
            <Link to="/patient/doctors" className="text-sm font-semibold text-brand-700">
              View all doctors →
            </Link>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {doctors
              .filter((d) => d.status === 'active')
              .slice(0, 3)
              .map((d) => (
                <DoctorCard key={d.id} doctor={d} />
              ))}
          </div>
        </section>
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
};
