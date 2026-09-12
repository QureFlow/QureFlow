import React from 'react';
import { QueueToken } from '../../types';
import { CheckCircle2, UserCheck, Clock, Flame } from 'lucide-react';

interface QueueTimelineProps {
  timeline: {
    completed: QueueToken[];
    current: QueueToken | null;
    waiting: QueueToken[];
  };
  patientTokenNumber?: string;
  isPaused?: boolean;
}

export const QueueTimeline: React.FC<QueueTimelineProps> = ({
  timeline,
  patientTokenNumber,
  isPaused = false,
}) => {
  const { completed, current, waiting } = timeline;

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 shadow-subtle">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Queue Order & Progress</h3>
          <p className="text-xs text-slate-500">Continuous progression of patient consultations today</p>
        </div>
        {isPaused ? (
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-100 text-amber-900 border border-amber-300">
            Queue Temporarily Paused
          </span>
        ) : (
          <span className="text-xs font-semibold px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live OPD Flow
          </span>
        )}
      </div>

      {/* Progress Line */}
      <div className="space-y-6">
        {/* Completed Tokens */}
        {completed.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Recently Completed ({completed.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pl-6">
              {completed.map((t) => (
                <div
                  key={t.id}
                  className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 text-slate-500 text-xs font-medium flex items-center gap-1.5"
                >
                  <span className="line-through">{t.tokenNumber}</span>
                  <span className="text-[10px] text-slate-400">{t.patientName.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Current Serving Token */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-800">
              In Doctor's Consultation Room
            </span>
          </div>
          <div className="pl-6">
            {current ? (
              <div
                className={`p-4 rounded-lg border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  current.tokenNumber === patientTokenNumber
                    ? 'border-brand-600 bg-brand-50/70 shadow-sm'
                    : 'border-blue-300 bg-blue-50/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-md bg-blue-600 text-white flex items-center justify-center text-lg font-black tracking-tight">
                    {current.tokenNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{current.patientName}</p>
                      {current.tokenNumber === patientTokenNumber && (
                        <span className="text-[10px] uppercase font-bold bg-brand-950 text-white px-1.5 py-0.5 rounded">
                          Your Turn Now
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
                      Scheduled: {current.scheduledTime} • Called at:{' '}
                      {current.calledAt ? new Date(current.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </p>
                  </div>
                </div>

                <div className="text-xs font-semibold text-blue-700 self-start sm:self-center bg-white px-2.5 py-1 rounded border border-blue-200">
                  Doctor is attending
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-500">
                Doctor is getting ready for the next consultation.
              </div>
            )}
          </div>
        </div>

        {/* Waiting Tokens */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-900">
              Waiting in Queue ({waiting.length})
            </span>
          </div>
          <div className="pl-6 space-y-2">
            {waiting.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No patients currently waiting in queue.</p>
            ) : (
              waiting.map((t, idx) => {
                const isPatient = t.tokenNumber === patientTokenNumber;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center justify-between p-2.5 rounded-md border text-xs transition-all ${
                      isPatient
                        ? 'border-brand-600 bg-brand-50/60 font-medium'
                        : 'border-slate-200 bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-[11px] font-bold text-slate-400">#{idx + 1}</span>
                      <span className={`font-bold ${isPatient ? 'text-brand-950 text-sm' : 'text-slate-800'}`}>
                        {t.tokenNumber}
                      </span>
                      <span className="text-slate-600 truncate max-w-[120px] sm:max-w-xs">
                        {t.patientName} {isPatient && <strong className="text-brand-700">(You)</strong>}
                      </span>
                      {t.priority === 'emergency' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 py-0.5 rounded">
                          <Flame className="w-2.5 h-2.5 text-red-600" />
                          Emergency
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 text-[11px]">
                      {t.isWalkIn ? 'Walk-in' : t.scheduledTime}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Arrival notice footer */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50 -mx-5 -mb-5 sm:-mx-6 sm:-mb-6 p-4 rounded-b-lg">
        <span>Please arrive at the clinic waiting hall before your token is called.</span>
        <span className="font-semibold text-slate-700">Room 102 • OPD Wing</span>
      </div>
    </div>
  );
};
