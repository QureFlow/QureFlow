import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { queueService } from '../../services/queueService';
import { QueueToken, PatientQueueStatus } from '../../types';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { QueueTimeline } from '../../components/patient/QueueTimeline';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Link, useLocation } from 'react-router-dom';
import {
  Ticket,
  Clock,
  Users,
  RotateCw,
  AlertTriangle,
  MapPin,
  Calendar,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react';
import { waitRangeText } from '../../lib/queuePresentation';

export const TokenScreen: React.FC = () => {
  const { user } = useAuth();
  const { tokens, pausedDoctors, clinics } = useQueue();
  const location = useLocation();

  const [activeData, setActiveData] = useState<PatientQueueStatus | null>(null);

  const [timeline, setTimeline] = useState<{
    completed: QueueToken[];
    current: QueueToken | null;
    waiting: QueueToken[];
  }>({ completed: [], current: null, waiting: [] });

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  // Check if just booked from state
  const justBooked = (location.state as { justBooked?: boolean } | null)?.justBooked;

  const loadTokenAndTimeline = useCallback(async () => {
    if (!user) return;
    setIsRefreshing(true);
    setLoadError('');
    try {
      const data = await queueService.getPatientActiveToken(user.id);
      setActiveData(data);

      if (data?.token) {
        const t = await queueService.getTokenTimeline(data.token.doctorId);
        setTimeline(t);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not refresh queue status.');
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadTokenAndTimeline();
  }, [loadTokenAndTimeline, tokens, pausedDoctors]);

  if (!activeData) {
    return (
      <div className="min-h-screen flex flex-col qf-shell pb-16 md:pb-0">
        <Navbar />
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-12">
          {loadError && (
            <p role="alert" className="p-3 mb-4 bg-red-50 text-red-800 rounded text-sm">
              {loadError}
            </p>
          )}
          <EmptyState
            icon={<Ticket className="w-8 h-8" />}
            title={
              isRefreshing
                ? 'Checking queue status…'
                : loadError
                  ? 'Queue status unavailable'
                  : 'No Active Queue Token'
            }
            description={
              loadError
                ? 'The service could not confirm your queue status. Please try again.'
                : isRefreshing
                  ? 'Loading your latest queue record.'
                  : "You do not currently have a waiting or in-progress queue token for today's OPD."
            }
            actionLabel={loadError ? 'Retry Queue Status' : 'Find a Doctor & Book'}
            onAction={() => {
              if (loadError) loadTokenAndTimeline();
              else window.location.href = '/patient/doctors';
            }}
          />
        </main>
        <Footer />
        <MobileNav />
      </div>
    );
  }

  const { token, currentServingToken, patientsAhead, estimatedWaitMinutes, isPaused } = activeData;
  const isNowServing = token.status === 'current';

  return (
    <div className="min-h-screen flex flex-col qf-shell pb-16 md:pb-0">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loadError && (
          <p role="alert" className="p-3 bg-red-50 text-red-800 rounded text-sm">
            {loadError} Displayed status may be out of date.
          </p>
        )}
        {/* Success banner if just booked */}
        {justBooked && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs text-emerald-900 animate-slide-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold">Appointment Confirmed & Token Generated!</p>
                <p className="text-emerald-800">
                  Your token <strong>{token.tokenNumber}</strong> is securely queued. Track live
                  updates below.
                </p>
              </div>
            </div>
            <span className="font-semibold text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-200">
              Allocated
            </span>
          </div>
        )}

        {/* Temporary Pause Alert */}
        {isPaused && (
          <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-center gap-3 text-xs text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-bold">Queue Temporarily Paused</p>
              <p className="text-amber-800">
                Clinic staff have paused this queue. Wait estimates may change; contact reception
                for updates.
              </p>
            </div>
          </div>
        )}

        {/* Primary Token Card */}
        <div className="qf-panel overflow-hidden">
          {/* Top Bar with Doctor & Clinic */}
          <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-brand-700 mb-1">
                <Stethoscope className="w-3.5 h-3.5" />
                <span>{token.doctorName}</span>
                <span className="text-slate-300">•</span>
                <span className="text-slate-600">
                  {clinics.find((c) => c.id === token.clinicId)?.name || token.clinicName}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Scheduled: {token.scheduledTime}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  OPD reception desk
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={loadTokenAndTimeline}
                isLoading={isRefreshing}
                icon={<RotateCw className="w-3 h-3" />}
              >
                Refresh Queue
              </Button>
              <StatusBadge status={token.status} priority={token.priority} />
            </div>
          </div>

          {/* Token Metrics Section */}
          <div className="p-6 sm:p-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left">
              {/* Token Number */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Your Token Number
                </p>
                <p className="text-4xl sm:text-5xl font-black text-brand-950 tracking-tight mt-1">
                  {token.tokenNumber}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Issued to: <strong className="text-slate-800">{token.patientName}</strong>
                </p>
              </div>

              {/* Serving Now */}
              <div className="p-4 rounded-lg bg-blue-50/60 border border-blue-200 flex flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-wider text-blue-900">
                  Currently Serving
                </p>
                <p className="text-4xl sm:text-5xl font-black text-blue-600 tracking-tight mt-1">
                  {currentServingToken || '—'}
                </p>
                <p className="text-[11px] text-blue-800 mt-1">
                  {isNowServing ? 'It is your turn now!' : 'Inside consultation chamber'}
                </p>
              </div>

              {/* Wait Estimation */}
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-center">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                  <span className="font-semibold uppercase tracking-wider">Patients Ahead</span>
                  <span className="font-semibold uppercase tracking-wider">Est. Wait</span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <div className="flex items-baseline gap-1">
                    <Users className="w-4 h-4 text-slate-400 self-center" />
                    <span className="text-3xl font-extrabold text-slate-900">
                      {isNowServing ? '0' : patientsAhead}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <Clock className="w-4 h-4 text-slate-400 self-center" />
                    <span className="text-3xl font-extrabold text-slate-900">
                      {isNowServing ? 'Now' : `~${estimatedWaitMinutes}m`}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  {!isNowServing && waitRangeText(activeData.estimatedWaitRange) && (
                    <>{waitRangeText(activeData.estimatedWaitRange)}. </>
                  )}
                  {activeData.prediction && activeData.prediction.method !== 'configured'
                    ? `Estimate learned from ${activeData.prediction.sampleCount} completed consultations and the queue order`
                    : 'Estimate based on the configured consultation duration and queue order'}
                  {Boolean(activeData.prediction?.syntheticSamples) && ' • Synthetic demo history'}.
                  Actual consultation times may vary.
                </p>
              </div>
            </div>

            {/* Turn Announcement Banner */}
            {isNowServing ? (
              <div className="mt-6 p-4 rounded-lg bg-blue-600 text-white flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm">Please Enter Doctor's Room</h4>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Your token {token.tokenNumber} is being called now at Reception desk.
                  </p>
                </div>
                <span className="px-3 py-1 bg-white text-blue-700 font-bold rounded text-xs">
                  Active Consultation
                </span>
              </div>
            ) : (
              <div className="mt-6 p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 text-center">
                Please arrive at the clinic waiting hall before your token is called.
              </div>
            )}
          </div>
        </div>

        {/* Queue Progress Timeline */}
        <QueueTimeline
          timeline={timeline}
          patientTokenNumber={token.tokenNumber}
          isPaused={isPaused}
        />

        {/* Footer Navigation link */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
          <Link to="/patient/appointments" className="text-brand-700 font-semibold hover:underline">
            ← View All My Appointments
          </Link>
          <Link to="/patient/dashboard" className="text-slate-600 hover:text-slate-900">
            Return to Dashboard
          </Link>
        </div>
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
