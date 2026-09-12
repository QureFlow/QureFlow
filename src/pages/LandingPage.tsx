import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Navbar } from '../components/layout/Navbar';
import { Footer } from '../components/layout/Footer';
import {
  Search,
  Calendar,
  Ticket,
  Activity,
  UserCheck,
  Building2,
  Clock,
  ShieldCheck,
  ArrowRight,
  Stethoscope,
  Users,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'Find a Doctor',
      desc: 'Browse verified general physicians and specialists at nearby community health centres.',
      icon: <Search className="w-5 h-5 text-brand-700" />,
    },
    {
      num: '02',
      title: 'Choose Date & Time',
      desc: 'Select a suitable OPD consultation slot that fits your schedule without standing in morning lines.',
      icon: <Calendar className="w-5 h-5 text-brand-700" />,
    },
    {
      num: '03',
      title: 'Get Your Token',
      desc: 'Instantly receive a clear digital token number (e.g. A-042) linked to your patient mobile number.',
      icon: <Ticket className="w-5 h-5 text-brand-700" />,
    },
    {
      num: '04',
      title: 'Track Your Queue',
      desc: 'See live tokens being served and remaining wait times on your phone from home or transit.',
      icon: <Activity className="w-5 h-5 text-brand-700" />,
    },
    {
      num: '05',
      title: 'Arrive Just in Time',
      desc: 'Reach the clinic waiting area comfortably before your number is called into the consultation room.',
      icon: <UserCheck className="w-5 h-5 text-brand-700" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-white border-b border-slate-200 py-16 sm:py-20 lg:py-24">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Notice / Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 mb-6">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Rural & Semi-Urban Healthcare OPD Management</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight max-w-3xl mx-auto">
              Smarter queues.{' '}
              <span className="text-brand-950">Less waiting.</span>
            </h1>

            <p className="mt-5 text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Find your doctor, book a convenient time, and track your queue without spending hours waiting at the clinic. Built specifically for reliable operation in community health centres.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <Link to="/patient/doctors">
                <Button variant="primary" size="lg" icon={<Search className="w-4 h-4" />}>
                  Find a Doctor
                </Button>
              </Link>
              <Link to="/admin/login">
                <Button variant="outline" size="lg" icon={<Building2 className="w-4 h-4 text-slate-500" />}>
                  Reception / Admin Login
                </Button>
              </Link>
            </div>

            {/* Micro proof line */}
            <div className="mt-10 pt-8 border-t border-slate-100 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-600" />
                <span>Average wait reduced by 45 mins</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-brand-600" />
                <span>Hybrid Walk-in & Online Triage</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Verified Rural OPD Rosters</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5-Step Workflow */}
        <section className="py-16 sm:py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-xs uppercase font-bold tracking-wider text-brand-700 mb-1">
              Transparent Patient Journey
            </h2>
            <h3 className="text-2xl font-bold text-slate-900">How QueueLess Rural Works</h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-500">
              Designed for simplicity and low digital barrier so patients and family members can track tokens effortlessly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {steps.map((step) => (
              <div
                key={step.num}
                className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {step.num}
                    </span>
                    <div className="p-2 rounded-md bg-brand-50 border border-brand-100">
                      {step.icon}
                    </div>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1.5">{step.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* For Clinics Section */}
        <section className="py-12 bg-white border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-slate-950 text-white rounded-xl p-8 sm:p-10 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-xl space-y-3">
                <div className="inline-flex items-center gap-1.5 text-xs text-brand-300 font-semibold uppercase tracking-wider">
                  <Stethoscope className="w-4 h-4" />
                  <span>Healthcare Facility Operations</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  Built for Clinic Receptionists and Chief Medical Officers
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Reception staff can manage doctor schedules, triage online and walk-in arrivals into a single ordered queue, handle emergency priorities, and eliminate overcrowded waiting corridors from a single dashboard.
                </p>
              </div>

              <div className="flex-shrink-0 w-full md:w-auto">
                <Link to="/admin/login">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full md:w-auto bg-white text-slate-950 hover:bg-slate-100"
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Open Clinic Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};
