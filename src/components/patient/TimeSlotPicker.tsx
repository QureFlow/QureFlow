import React from 'react';
import { Clock } from 'lucide-react';

interface TimeSlotPickerProps {
  slots: { time: string; available: boolean }[];
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
        <p className="text-xs text-slate-500">Checking slot availability...</p>
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
      <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
        <Clock className="w-3.5 h-3.5 text-slate-500" />
        <span>Select Available Consultation Slot</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
        {slots.map(({ time, available }) => {
          const isSelected = selectedSlot === time;

          return (
            <button
              key={time}
              type="button"
              disabled={!available}
              onClick={() => onSelectSlot(time)}
              className={`px-3 py-2.5 rounded-md text-xs font-medium transition-all text-center border relative select-none ${
                isSelected
                  ? 'bg-brand-950 text-white border-brand-950 ring-2 ring-brand-700/20 shadow-sm'
                  : available
                  ? 'bg-white text-slate-800 border-slate-200 hover:border-brand-600 hover:bg-slate-50'
                  : 'bg-slate-100/80 text-slate-400 border-slate-200/60 cursor-not-allowed line-through'
              }`}
            >
              <span>{time}</span>
              {!available && (
                <span className="block text-[10px] no-underline font-normal text-slate-400">
                  Booked
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
