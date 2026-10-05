import React from 'react';
import { Clock, Users, CheckCircle2, AlertOctagon } from 'lucide-react';
import { SlotAvailability } from '../../types';

interface TimeSlotPickerProps {
  slots: SlotAvailability[];
  selectedSlot: string | null;
  onSelectSlot: (slot: string) => void;
  isLoading?: boolean;
}

export const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  slots,
  selectedSlot,
  onSelectSlot,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="p-8 text-center bg-slate-50 rounded-lg border border-slate-200">
        <div className="w-5 h-5 border-2 border-brand-950 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
        <p className="text-xs text-slate-500">Checking live slot availability & queue waiting times...</p>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-500">
        No consultation slots configured for this date.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Select Consultation Slot</span>
        </div>
        <span className="text-[11px] text-slate-500">
          Max window: 30 mins/slot • Real-time queue wait
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {slots.map((slot) => {
          const { time, available, isFull, patientsAhead, estimatedWaitMinutes } = slot;
          const isSelected = selectedSlot === time;
          const slotFull = isFull || !available;

          return (
            <button
              key={time}
              type="button"
              disabled={slotFull}
              onClick={() => onSelectSlot(time)}
              className={`p-3 rounded-lg text-xs font-medium transition-all text-center border relative select-none flex flex-col items-center justify-center gap-1 min-h-[72px] ${
                isSelected
                  ? 'bg-brand-950 text-white border-brand-950 ring-2 ring-brand-700/30 shadow-sm'
                  : !slotFull
                  ? 'bg-white text-slate-800 border-slate-200 hover:border-brand-600 hover:bg-slate-50/80 shadow-xs'
                  : 'bg-slate-100/90 text-slate-400 border-slate-200 cursor-not-allowed opacity-80'
              }`}
            >
              <span className={`font-bold ${isSelected ? 'text-white' : slotFull ? 'text-slate-400' : 'text-slate-900'}`}>
                {time}
              </span>

              {slotFull ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                  <AlertOctagon className="w-2.5 h-2.5 text-rose-600" />
                  Slot Full
                </span>
              ) : patientsAhead > 0 ? (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    isSelected
                      ? 'bg-white/20 text-white border-white/30'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <Users className="w-2.5 h-2.5" />
                  {patientsAhead} {patientsAhead === 1 ? 'person' : 'people'} ahead (~{estimatedWaitMinutes}m)
                </span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                    isSelected
                      ? 'bg-white/20 text-white border-white/30'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Available
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
