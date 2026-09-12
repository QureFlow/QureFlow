import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { queueService } from '../../services/queueService';
import { appointmentService } from '../../services/appointmentService';
import { Appointment, QueueToken } from '../../types';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { TokenCard } from '../../components/patient/TokenCard';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/common/Button';
import { Link } from 'react-router-dom';
import {
  Search,
  Calendar,
  Ticket,
  ChevronRight,
  Clock,
  MapPin,
  Stethoscope,
} from 'lucide-react';

export const PatientDashboard: React.FC = () => {
  const { user } = useAuth();
  const { tokens, appointments } = useQueue();

  const [activeTokenData, setActiveTokenData] = useState<{
    token: QueueToken;
    currentServingToken: string | null;
    patientsAhead: number;
    estimatedWaitMinutes: number;
    isPaused: boolean;
  } | null>(null);

  const [nextAppointment, setNextAppointment] = useState<Appointment | null>(null);

  // Derive time-of-day greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      // Load active token for this patient (by id or phone)
      const tokenResult = await queueService.getPatientActiveToken(user.id);
      if (!tokenResult && user.phone) {
        const byPhone = await queueService.getPatientActiveToken(user.phone);
        setActiveTokenData(byPhone);
      } else {
        setActiveTokenData(tokenResult);
      }

      // Load upcoming appointment
      const userApts = await appointmentService.getAppointments({
        patientId: user.id,
      });

      const upcoming = userApts.find(
        (a) => a.status === 'booked' || a.status === 'waiting'
      );
      setNextAppointment(upcoming || null);
    };

    loadDashboardData();
  }, [user, tokens, appointments]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16 md:pb-0">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <PageHeader
          title={`${getGreeting()}, ${user?.name || 'Patient'}`}
          subtitle="Find a doctor or check your upcoming appointment and active queue status."
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Active Token Card */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Live Queue Token
                </h2>
                {activeTokenData && (
                  <span className="text-xs text-brand-700 font-medium">Real-time update</span>
                )}
              </div>
              <TokenCard tokenData={activeTokenData} />
            </div>

            {/* 2. Upcoming Appointment */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Upcoming Appointment
                </h2>
                <Link
                  to="/patient/appointments"
                  className="text-xs text-brand-700 font-semibold hover:underline flex items-center gap-1"
                >
                  All bookings <ChevronRight className="w-3 h-3" />
                </Link>
              </div>

              {nextAppointment ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{nextAppointment.doctorName}</h3>
                      <StatusBadge status={nextAppointment.status} size="sm" />
                    </div>
                    <p className="text-xs text-brand-700 font-medium">{nextAppointment.doctorSpecialization}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {nextAppointment.clinicName}
                    </p>
                    <div className="flex items-center gap-3 pt-1 text-xs text-slate-700">
                      <span className="flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {nextAppointment.date}
                      </span>
                      <span className="flex items-center gap-1 font-medium">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {nextAppointment.time}
                      </span>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2">
                    {nextAppointment.tokenNumber && (
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Allocated Token</span>
                        <p className="font-mono font-extrabold text-slate-900 text-lg">
                          {nextAppointment.tokenNumber}
                        </p>
                      </div>
                    )}
                    <Link to="/patient/appointments">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-slate-500 mb-3">You have no upcoming appointments scheduled.</p>
                  <Link to="/patient/doctors">
                    <Button variant="primary" size="sm">
                      Schedule an Appointment
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Side Column: Quick Actions & OPD Info */}
          <div className="space-y-6">
            {/* Quick Actions (Compact) */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                Quick Actions
              </h2>
              <div className="space-y-2">
                <Link
                  to="/patient/doctors"
                  className="flex items-center justify-between p-3 rounded-md border border-slate-200 hover:border-brand-600 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-brand-50 text-brand-700">
                      <Search className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Find a Doctor</p>
                      <p className="text-[11px] text-slate-500">Search by specialty or clinic</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-700" />
                </Link>

                <Link
                  to="/patient/appointments"
                  className="flex items-center justify-between p-3 rounded-md border border-slate-200 hover:border-brand-600 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-slate-100 text-slate-700">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">My Appointments</p>
                      <p className="text-[11px] text-slate-500">Upcoming and past visits</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-700" />
                </Link>

                <Link
                  to="/patient/token"
                  className="flex items-center justify-between p-3 rounded-md border border-slate-200 hover:border-brand-600 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded bg-amber-50 text-amber-700">
                      <Ticket className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Active Token Tracker</p>
                      <p className="text-[11px] text-slate-500">Live consultation room progress</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-700" />
                </Link>
              </div>
            </div>

            {/* Clinic OPD Notice */}
            <div className="bg-slate-900 text-white rounded-lg p-5 border border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand-300 uppercase tracking-wider mb-2">
                <Stethoscope className="w-4 h-4" />
                <span>Primary Care Advisory</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Emergency trauma, pregnancy triage, or acute asthma emergencies are attended immediately without queue wait at the 24/7 casualty counter.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Emergency: 102 / 108</span>
                <span>OPD: 9:00 AM - 2:00 PM</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
