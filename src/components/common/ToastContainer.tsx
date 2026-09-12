import React from 'react';
import { useQueue } from '../../context/QueueContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useQueue();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((toast) => {
        let borderClass = 'border-blue-200 bg-white';
        let icon = <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />;

        if (toast.type === 'success') {
          borderClass = 'border-emerald-200 bg-emerald-50/90 text-emerald-900';
          icon = <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-200 bg-amber-50/90 text-amber-900';
          icon = <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />;
        } else if (toast.type === 'error') {
          borderClass = 'border-red-200 bg-red-50/90 text-red-900';
          icon = <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2.5 p-3 rounded-lg border shadow-elevated transition-all text-xs font-medium text-slate-800 animate-slide-in ${borderClass}`}
          >
            <div className="mt-0.5">{icon}</div>
            <div className="flex-1 leading-normal">{toast.message}</div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 rounded p-0.5"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
