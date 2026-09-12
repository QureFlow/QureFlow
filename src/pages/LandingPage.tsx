import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Calendar,
  Ticket,
  Activity,
  ArrowRight,
  Shield,
  Users,
  Stethoscope,
  Clock,
  MapPin,
  Menu,
  X,
  LogIn,
  UserPlus,
  Building2,
  ChevronRight,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const isPatient = user?.role === 'patient';
  const isAdmin = user?.role === 'admin';

  const steps = [
    {
      num: '01',
      title: 'Find a doctor',
      desc: 'Search verified general physicians and specialists across regional rural health centres.',
      icon: <Search className="w-4 h-4 text-brand-700" />,
    },
    {
      num: '02',
      title: 'Book an OPD slot',
      desc: 'Select a convenient morning or afternoon consultation time slot with available physicians.',
      icon: <Calendar className="w-4 h-4 text-brand-700" />,
    },
    {
      num: '03',
      title: 'Receive your token',
      desc: 'Instantly receive a clear sequential queue token number (e.g. A-042) linked to your mobile phone.',
      icon: <Ticket className="w-4 h-4 text-brand-700" />,
    },
    {
      num: '04',
      title: 'Track your queue',
      desc: 'Monitor real-time doctor progress and arrive comfortably before your number is called.',
      icon: <Activity className="w-4 h-4 text-brand-700" />,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      {/* 1. Header with Clean, Practical Navigation */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <BrandLogo />

            {/* Desktop Navigation Links (No direct doctor browse without auth) */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
              <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
                How it works
              </a>
              <a href="#preview" className="hover:text-slate-900 transition-colors">
                Live Queue
              </a>
              <a href="#for-clinics" className="hover:text-slate-900 transition-colors">
                For Clinics
              </a>
              <a href="#about" className="hover:text-slate-900 transition-colors">
                About
              </a>
            </nav>
          </div>

          {/* Right Header Action */}
          <div className="hidden md:flex items-center gap-3">
            {isPatient ? (
              <Link to="/patient/dashboard">
                <Button variant="primary" size="sm">
                  Go to Patient Dashboard
                </Button>
              </Link>
            ) : isAdmin ? (
              <Link to="/admin/dashboard">
                <Button variant="primary" size="sm">
                  Go to Staff Console
                </Button>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setIsPatientModalOpen(true)}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 px-3.5 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Sign In / Register
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 text-xs">
            <a
              href="#how-it-works"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-slate-700 hover:text-slate-900 font-medium"
            >
              How it works
            </a>
            <a
              href="#preview"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-slate-700 hover:text-slate-900 font-medium"
            >
              Live Queue Preview
            </a>
            <a
              href="#for-clinics"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-slate-700 hover:text-slate-900 font-medium"
            >
              For Clinics
            </a>
            <a
              href="#about"
              onClick={() => setIsMobileMenuOpen(false)}
              className="block py-2 text-slate-700 hover:text-slate-900 font-medium"
            >
              About
            </a>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <button
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setIsPatientModalOpen(true);
                }}
                className="w-full text-center py-2 rounded border border-slate-200 text-slate-700 font-medium bg-slate-50"
              >
                Patient Portal
              </button>
              <Link
                to="/admin/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full text-center py-2 rounded bg-brand-950 text-white font-medium"
              >
                Staff / Admin Login
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* 2. Restrained Hero Section (No redundant buttons) */}
        <section className="bg-white border-b border-slate-200 py-12 sm:py-16">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700 mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
              <span>Bolpur & District Health Network OPD Initiative</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
              Smarter queues.
              <br />
              <span className="text-brand-950">Less waiting.</span>
            </h1>

            <p className="mt-4 text-xs sm:text-sm text-slate-600 max-w-xl mx-auto leading-relaxed">
              Find a doctor, book an OPD appointment, receive your queue token, and track your consultation progress without spending hours at the clinic.
            </p>
          </div>
        </section>

        {/* 3. Patient & Staff Entry Boxes (Sentence-based interactive entry, no redundant inner buttons) */}
        <section className="py-10 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Patient Portal Entry Card */}
            <div
              onClick={() => setIsPatientModalOpen(true)}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle flex flex-col justify-between hover:border-brand-600 hover:shadow-md cursor-pointer transition-all group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsPatientModalOpen(true);
                }
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 group-hover:bg-brand-100 transition-colors">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Patient Portal</h2>
                      <p className="text-[11px] text-brand-700 font-medium">Self-Service Access</p>
                    </div>
                  </div>
                  <span className="text-xs text-brand-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Find doctors, book appointments and track your live queue.
                </p>
              </div>

              {/* Normal sentence instruction as requested */}
              <div className="pt-3 border-t border-slate-100 text-xs text-brand-900 font-medium flex items-center justify-between">
                <span>If you are a patient or visitor, click here to continue</span>
                <ChevronRight className="w-4 h-4 text-brand-600 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Reception / Admin Entry Card */}
            <div
              onClick={() => setIsAdminModalOpen(true)}
              className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle flex flex-col justify-between hover:border-slate-400 hover:shadow-md cursor-pointer transition-all group"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsAdminModalOpen(true);
                }
              }}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 group-hover:bg-slate-200 transition-colors">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Reception / Admin</h2>
                      <p className="text-[11px] text-slate-500 font-medium">Clinic Operations Console</p>
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    Open <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  Manage appointments, tokens, doctors and live consultation queues.
                </p>
              </div>

              {/* Normal sentence instruction as requested */}
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-700 font-medium flex items-center justify-between">
                <span>If you are clinic reception staff or admin, click here</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </section>

        {/* 4. How QueueLess Works (Compact 4-Step Section) */}
        <section id="how-it-works" className="py-10 bg-white border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-700">
                Simple Workflow
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                How QueueLess works
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Clear 4-step outpatient care journey without long physical lines.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {steps.map((step) => (
                <div
                  key={step.num}
                  className="p-4 rounded-lg bg-slate-50/70 border border-slate-200 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-400">{step.num}</span>
                    <div className="p-1.5 rounded bg-white border border-slate-200 shadow-xs">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900">{step.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Realistic Live Queue Product Preview (Styled directly as dashboard component) */}
        <section id="preview" className="py-12 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-6">
            <span className="text-[10px] uppercase font-bold tracking-wider text-brand-700">
              Live Queue Experience
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
              Transparent consultation tracking
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Patients track live queue progress from their mobile browser in real time.
            </p>
          </div>

          {/* Realistic Dashboard-Style Queue Card */}
          <div className="max-w-xl mx-auto bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-brand-700 font-semibold mb-0.5">
                  <Stethoscope className="w-3.5 h-3.5" />
                  <span>Dr. Ananya Sharma • General Medicine</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span>Bolpur Community Health Centre • Room 102</span>
                </div>
              </div>

              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                Live OPD Flow
              </span>
            </div>

            {/* Core Metrics Grid */}
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 px-3 bg-slate-50 rounded-lg border border-slate-100 text-center sm:text-left">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Currently Serving
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-blue-600 font-mono mt-0.5">
                    A-039
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Your Token
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-brand-950 font-mono mt-0.5">
                    A-042
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Patients Ahead
                  </p>
                  <div className="flex items-baseline justify-center sm:justify-start gap-1 mt-0.5">
                    <Users className="w-3.5 h-3.5 text-slate-400 self-center" />
                    <span className="text-xl sm:text-2xl font-bold text-slate-800">2</span>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Estimated Wait
                  </p>
                  <div className="flex items-baseline justify-center sm:justify-start gap-1 mt-0.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 self-center" />
                    <span className="text-xl sm:text-2xl font-bold text-slate-800">~14 min</span>
                  </div>
                </div>
              </div>

              {/* Advisory note */}
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                <span>Please arrive at the clinic before token A-042 is called.</span>
                <button
                  type="button"
                  onClick={() => setIsPatientModalOpen(true)}
                  className="text-brand-700 font-semibold hover:underline cursor-pointer"
                >
                  Sign in to get token →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Rural Healthcare Context */}
        <section id="about" className="py-12 bg-white border-y border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="text-[10px] uppercase font-bold tracking-wider text-brand-700">
                Rural & Semi-Urban Healthcare
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                Built for simpler access to OPD care
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Engineered to handle high patient footfall in community health centres and sub-divisional hospitals.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-900 mb-1">Appointment Scheduling</h3>
                <p className="text-slate-600 leading-relaxed">
                  Clear date and time slot bookings to stagger patient arrivals across morning shifts.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-900 mb-1">Digital Queue Tokens</h3>
                <p className="text-slate-600 leading-relaxed">
                  Sequential tokens generated per doctor room to eliminate physical crowding and disputes.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-900 mb-1">Live Queue Tracking</h3>
                <p className="text-slate-600 leading-relaxed">
                  Patients view waiting list progression on standard low-bandwidth mobile browsers.
                </p>
              </div>

              <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50">
                <h3 className="font-bold text-slate-900 mb-1">Reception & Admin</h3>
                <p className="text-slate-600 leading-relaxed">
                  Single operational dashboard to manage doctor rosters, call tokens, and triage walk-ins.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 7. For Clinics Brief Section */}
        <section id="for-clinics" className="py-10 max-w-5xl mx-auto px-4 sm:px-6">
          <div className="bg-slate-900 text-white rounded-lg p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-slate-800">
            <div className="space-y-1.5 max-w-xl">
              <div className="flex items-center gap-1.5 text-xs text-blue-300 font-semibold uppercase tracking-wider">
                <Building2 className="w-3.5 h-3.5" />
                <span>Facility Administration</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Are you clinic reception staff or a medical officer?
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Sign in to the staff operations console to manage today's OPD consultation rooms, call tokens, and triage emergency cases.
              </p>
            </div>

            <div className="flex-shrink-0">
              <Link to="/admin/login">
                <Button variant="outline" size="md" className="bg-white text-slate-900 hover:bg-slate-100 border-white">
                  Staff Sign In
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 8. Minimal, Professional Healthcare Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-500">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">QueueLess</span>
            <span className="text-slate-300">•</span>
            <span>Bolpur & District Health Network</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button
              type="button"
              onClick={() => setIsPatientModalOpen(true)}
              className="hover:text-slate-800 cursor-pointer"
            >
              Patient Portal
            </button>
            <Link to="/admin/login" className="hover:text-slate-800">
              Staff Login
            </Link>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">Emergency Casualty: 102 / 108</span>
          </div>
        </div>
      </footer>

      {/* Patient Portal Choice Modal (Sign In vs Create Account) */}
      <Modal
        isOpen={isPatientModalOpen}
        onClose={() => setIsPatientModalOpen(false)}
        title="Patient Portal Access"
        description="Sign in or create a patient account to view consulting doctors, book appointments, and track your queue tokens."
        maxWidth="md"
      >
        <div className="space-y-3 py-1">
          {/* Option 1: Sign In */}
          <Link
            to="/patient/login"
            onClick={() => setIsPatientModalOpen(false)}
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-brand-600 hover:bg-brand-50/50 transition-all group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-md bg-brand-50 border border-brand-200 flex items-center justify-center text-brand-700 group-hover:bg-brand-600 group-hover:text-white transition-colors">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Sign In to Existing Account</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  For registered patients with mobile number or email
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-700 group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Option 2: Create Account */}
          <Link
            to="/patient/register"
            onClick={() => setIsPatientModalOpen(false)}
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-brand-600 hover:bg-brand-50/50 transition-all group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Create New Patient Account</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register in seconds to book OPD slots & receive SMS tokens
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-700 group-hover:translate-x-0.5 transition-all" />
          </Link>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Are you hospital staff?</span>
          <button
            type="button"
            onClick={() => {
              setIsPatientModalOpen(false);
              setIsAdminModalOpen(true);
            }}
            className="text-brand-700 font-semibold hover:underline"
          >
            Reception / Admin Login →
          </button>
        </div>
      </Modal>

      {/* Reception / Admin Choice Modal (Strictly Sign In Only - No Registration Allowed) */}
      <Modal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        title="Reception / Admin Console Access"
        description="Authorized entry for clinic desk operators, OPD nurses, and hospital administration."
        maxWidth="md"
      >
        <div className="space-y-4 py-1">
          {/* Strictly Sign In Only */}
          <Link
            to="/admin/login"
            onClick={() => setIsAdminModalOpen(false)}
            className="flex items-center justify-between p-4 rounded-lg border border-slate-200 bg-slate-900 text-white hover:bg-slate-800 transition-all group"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-md bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Staff Sign In</h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  Sign in with Staff ID or clinic email to access OPD queue console
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
          </Link>

          {/* Explicit Security Notice Explaining Why There Is No Register Option */}
          <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-md text-xs text-amber-900 flex items-start gap-2.5">
            <Shield className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-semibold text-amber-950">Security Policy:</span> Staff account self-registration is permanently disabled to prevent unauthorized administrative privileges. All staff credentials are strictly issued and managed by hospital IT administration.
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Are you a patient or visitor?</span>
          <button
            type="button"
            onClick={() => {
              setIsAdminModalOpen(false);
              setIsPatientModalOpen(true);
            }}
            className="text-brand-700 font-semibold hover:underline"
          >
            Go to Patient Portal →
          </button>
        </div>
      </Modal>
    </div>
  );
};
