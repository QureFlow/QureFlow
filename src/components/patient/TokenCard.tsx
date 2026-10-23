import React from 'react';
import { QueueToken } from '../../types';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { Ticket, Users, Clock, ArrowRight, Stethoscope, AlertTriangle } from 'lucide-react';
import { waitRangeText } from '../../lib/queuePresentation';

interface TokenCardProps {
  tokenData: {
    token: QueueToken;
    currentServingToken: string | null;
    patientsAhead: number;
    estimatedWaitMinutes: number;
    estimatedWaitRange?: { low: number; high: number };
    isPaused: boolean;
  } | null;
}

export const TokenCard: React.FC<TokenCardProps> = ({ tokenData }) => {
  if (!tokenData) {
    return (
      <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle text-center">
        <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <Ticket className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1">No active queue</h3>
        <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
          Book an appointment with an available doctor to receive your queue token.
        </p>
        <Link to="/patient/doctors">
          <Button variant="primary" size="sm">
            Find a Doctor
          </Button>
        </Link>
      </div>
    );
  }

  const { token, currentServingToken, patientsAhead, estimatedWaitMinutes, isPaused } = tokenData;

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-subtle">
      {/* Paused alert if clinic temporarily stopped queue */}
      {isPaused && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center gap-2 text-xs font-medium text-amber-900">
          <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0" />
          <span>Notice: The doctor's queue is temporarily paused. Waiting times may extend.</span>
        </div>
      )}

      <div className="p-5 sm:p-6">
        {/* Header: Doctor & Clinic */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-brand-700 font-semibold mb-1">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>{token.clinicName}</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">{token.doctorName}</h3>
            <p className="text-xs text-slate-500">
              Scheduled for:{' '}
              <span className="font-medium text-slate-800">{token.scheduledTime}</span>
            </p>
          </div>
          <div className="self-start">
            <StatusBadge status={token.status} priority={token.priority} />
          </div>
        </div>

        {/* Core Queue Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-5 my-2 border-b border-slate-100 bg-slate-50/50 rounded-lg px-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Your Token
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-brand-950 tracking-tight mt-0.5">
              {token.tokenNumber}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Currently Serving
            </p>
            <p className="text-2xl sm:text-3xl font-extrabold text-blue-600 tracking-tight mt-0.5">
              {currentServingToken || '—'}
            </p>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Patients Ahead
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <Users className="w-4 h-4 text-slate-400 self-center" />
              <p className="text-2xl font-bold text-slate-800">
                {token.status === 'current' ? '0' : patientsAhead}
              </p>
              <span className="text-xs text-slate-500">people</span>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Estimated Wait
            </p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <Clock className="w-4 h-4 text-slate-400 self-center" />
              <p className="text-2xl font-bold text-slate-800">
                {token.status === 'current' ? 'Now' : `~${estimatedWaitMinutes}m`}
              </p>
            </div>
            {token.status !== 'current' && (
              <p className="text-[11px] text-slate-500">
                {waitRangeText(tokenData.estimatedWaitRange)}
              </p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            Please arrive at the clinic before token{' '}
            <strong className="text-slate-800">{token.tokenNumber}</strong> is called.
          </p>
          <Link to="/patient/token" className="self-end sm:self-auto">
            <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
              View Live Queue
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};
