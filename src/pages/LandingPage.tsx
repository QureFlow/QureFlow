import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  Clock3,
  HeartPulse,
  Menu,
  Search,
  ShieldCheck,
  Stethoscope,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { BrandLogo } from '../components/layout/BrandLogo';
import { useQueue } from '../context/QueueContext';
import { useAuth } from '../context/AuthContext';
import { DoctorCard } from '../components/patient/DoctorCard';

export const LandingPage = () => {
  const { doctors, clinics } = useQueue();
  const { user } = useAuth();
  const [mobile, setMobile] = useState(false);
  const patientPath = user?.role === 'patient' ? '/patient/dashboard' : '/patient/login';
  const staffPath = user && user.role !== 'patient' ? '/admin/dashboard' : '/admin/login';
  const specialties = [...new Set(doctors.map((d) => d.specialization))];
  const featured = [...doctors].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3);
  const demo = doctors.some((d) => d.metadata?.synthetic === true);
  return (
    <div className="qf-shell min-h-screen">
      <header className="border-b border-[#e2e8f0] bg-[#ffffff]/95 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-20 flex items-center justify-between">
          <BrandLogo />
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-600">
            <a href="#care" className="hover:text-brand-700">
              Find care
            </a>
            <a href="#how-it-works" className="hover:text-brand-700">
              How it works
            </a>
            <a href="#for-clinics" className="hover:text-brand-700">
              For clinics
            </a>
          </nav>
          <div className="hidden md:flex items-center gap-5">
            <Link to={staffPath} className="text-sm font-semibold text-brand-900">
              Staff sign in
            </Link>
            <Link
              to={patientPath}
              className="bg-brand-600 text-white rounded-lg px-5 py-2.5 text-sm font-semibold flex gap-2 items-center"
            >
              Patient portal <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <button
            aria-label="Toggle navigation menu"
            className="md:hidden p-2"
            onClick={() => setMobile(!mobile)}
          >
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
        {mobile && (
          <nav className="md:hidden px-5 pb-5 flex flex-col gap-3 text-sm">
            <a href="#care" onClick={() => setMobile(false)}>
              Find care
            </a>
            <a href="#how-it-works" onClick={() => setMobile(false)}>
              How it works
            </a>
            <Link to={patientPath}>Patient portal</Link>
            <Link to={staffPath}>Staff sign in</Link>
          </nav>
        )}
      </header>
      <main>
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pt-12 sm:pt-20 pb-14 grid lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center qf-enter">
          <div>
            <p className="qf-eyebrow flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand-500" />
              Appointments & queue management
            </p>
            <h1 className="qf-title text-[clamp(40px,4.8vw,64px)] mt-6">
              Book your visit.
              <br />
              <span className="text-brand-600">Track your queue.</span>
            </h1>
            <p className="text-slate-600 text-base sm:text-lg leading-relaxed max-w-lg mt-6">
              Find the right doctor, choose your appointment, and follow your place in the queue.
              More clarity. Less time in the waiting room.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                to="/patient/doctors"
                className="rounded-lg bg-brand-600 text-white px-6 py-3.5 text-sm font-semibold inline-flex items-center gap-3"
              >
                Find a doctor <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="rounded-lg bg-white border border-[#e2e8f0] px-6 py-3.5 text-sm font-semibold text-brand-950"
              >
                See how it works
              </a>
            </div>
            <div className="flex flex-wrap gap-5 mt-8 text-xs text-slate-500">
              <span className="inline-flex gap-1.5 items-center">
                <Check className="w-4 h-4 text-brand-600" />
                Book from your phone
              </span>
              <span className="inline-flex gap-1.5 items-center">
                <Check className="w-4 h-4 text-brand-600" />
                Follow your queue
              </span>
            </div>
          </div>
          <div className="relative rounded-2xl bg-[#0f2038] qf-grid-paper p-6 sm:p-9 overflow-hidden min-h-[450px]">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase tracking-[.2em] text-[#cbd5e1]">
                The patient journey
              </span>
              <HeartPulse className="w-6 h-6 text-[#cbd5e1]" />
            </div>
            <div className="absolute rounded-full w-72 h-72 border border-[#94a3b8]/15 -right-16 -top-8" />
            <div className="absolute rounded-full w-96 h-96 border border-[#94a3b8]/10 -right-28 -top-20" />
            <h2 className="relative text-white text-3xl sm:text-4xl font-semibold tracking-tight mt-8 max-w-xs">
              Your visit,
              <br />
              step by step.
            </h2>
            <div className="relative bg-[#f8fafc] rounded-2xl p-5 mt-8 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="qf-eyebrow">Your visit, simplified</span>
                <span className="text-[10px] bg-[#e2e8f0] text-brand-800 rounded-full px-2.5 py-1">
                  Patient journey
                </span>
              </div>
              <div className="flex gap-3 items-center mt-5">
                <div className="rounded-xl bg-brand-100 p-3">
                  <CalendarDays className="w-6 h-6 text-brand-700" />
                </div>
                <div>
                  <p className="text-brand-950 text-sm font-bold">
                    An appointment that fits your day
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Choose a doctor, date, and available time
                  </p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                {[
                  ['01', 'Book'],
                  ['02', 'Track'],
                  ['03', 'Your turn'],
                ].map(([n, label], i) => (
                  <div
                    key={n}
                    className={`rounded-xl py-3 px-2 ${i === 2 ? 'bg-brand-700 text-white' : 'bg-white text-brand-900 border border-[#e2e8f0]'}`}
                  >
                    <p className="text-[10px] opacity-60">{n}</p>
                    <p className="text-xs font-semibold mt-1">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-6 text-[#cbd5e1] text-xs">
              <Clock3 className="w-4 h-4" />
              Your queue updates, wherever you are.
            </div>
          </div>
        </section>
        <section className="max-w-7xl mx-auto px-5 sm:px-8 pb-12">
          <div className="border-y border-[#e2e8f0] py-7 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              [String(doctors.length), 'Doctors in the directory'],
              [String(clinics.length), 'Connected facilities'],
              [String(specialties.length), 'Areas of care'],
              ['One place', 'Appointments & queues'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-2xl sm:text-3xl font-semibold text-brand-950 tracking-tight">
                  {value}
                </p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          {demo && (
            <p className="text-[11px] text-slate-500 mt-3">
              Demo workspace · Directory and visit records are synthetic.
            </p>
          )}
        </section>
        <section id="care" className="max-w-7xl mx-auto px-5 sm:px-8 py-10">
          <div className="flex flex-wrap gap-4 items-end justify-between mb-7">
            <div>
              <p className="qf-eyebrow">Care directory</p>
              <h2 className="qf-title text-3xl sm:text-4xl mt-3">
                Find a doctor.
              </h2>
            </div>
            <Link
              to="/patient/doctors"
              className="text-brand-700 text-sm font-semibold flex gap-2 items-center"
            >
              Explore all doctors <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="flex flex-wrap gap-2 mb-7">
            {specialties.slice(0, 8).map((s) => (
              <Link
                to={`/patient/doctors?specialty=${encodeURIComponent(s)}`}
                key={s}
                className="px-4 py-2 rounded-lg bg-white border border-[#e2e8f0] text-xs text-brand-900 hover:border-brand-400"
              >
                {s}
              </Link>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {featured.map((d) => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </div>
          {!doctors.length && (
            <p className="text-sm text-slate-500">
              The care directory will appear when the service is connected.
            </p>
          )}
        </section>
        <section id="how-it-works" className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
          <p className="qf-eyebrow">How it works</p>
          <h2 className="qf-title text-3xl sm:text-4xl mt-3 mb-8">
            Plan your visit in three steps.
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: Search,
                title: 'Find your doctor',
                text: 'Browse specialties, languages, consulting hours, and clinic locations.',
              },
              {
                icon: CalendarDays,
                title: 'Book an appointment',
                text: 'Choose an available slot. Your booking and queue token stay connected.',
              },
              {
                icon: Ticket,
                title: 'Track your queue',
                text: 'Check your position and estimated wait from your phone. Arrive before your turn.',
              },
            ].map(({ icon: Icon, title, text }, i) => (
              <article key={title} className="qf-panel p-7">
                <div className="flex justify-between items-center">
                  <Icon className="w-6 h-6 text-brand-600" />
                  <span className="text-3xl font-light text-[#cbd5e1]">0{i + 1}</span>
                </div>
                <h3 className="text-lg font-semibold tracking-tight text-brand-950 mt-7">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500 mt-3">{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="for-clinics" className="max-w-7xl mx-auto px-5 sm:px-8 pb-16">
          <div className="bg-[#eef2f7] rounded-2xl p-7 sm:p-12 grid md:grid-cols-[1.1fr_1fr] gap-10 items-center">
            <div>
              <p className="qf-eyebrow">For clinics & hospitals</p>
              <h2 className="qf-title text-3xl sm:text-4xl mt-4">
                Manage daily
                <br />clinic operations.
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 mt-5 max-w-md">
                Bring your appointments, doctor schedules, patient directory, and live queues
                together. Every action leaves a traceable record.
              </p>
              <Link
                to={staffPath}
                className="inline-flex items-center gap-3 bg-brand-950 rounded-lg text-white px-6 py-3 text-sm font-semibold mt-6"
              >
                Open staff workspace <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                [Users, 'Patient directory', 'One record, connected visits'],
                [Stethoscope, 'Doctor workspace', 'Schedules & consultation flow'],
                [Clock3, 'Live operations', 'Call, pause, complete, follow up'],
                [ShieldCheck, 'Scoped access', 'The right records for each role'],
              ].map(([Icon, title, description]) => {
                const I = Icon as typeof Users;
                return (
                  <div key={String(title)} className="bg-white/70 rounded-2xl p-5">
                    <I className="text-brand-600 w-5 h-5" />
                    <p className="font-semibold text-brand-950 text-sm mt-4">{String(title)}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {String(description)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e2e8f0] max-w-7xl mx-auto w-full px-5 sm:px-8 py-7 flex flex-wrap gap-5 items-center justify-between">
        <BrandLogo size="sm" />
        <p className="text-xs text-slate-500">
          A better flow of care. © {new Date().getFullYear()} QureFlow
        </p>
        <Link to={staffPath} className="text-xs text-brand-700 font-semibold">
          Staff sign in ↗
        </Link>
      </footer>
    </div>
  );
};
