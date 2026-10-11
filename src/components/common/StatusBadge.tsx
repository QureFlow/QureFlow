import React from 'react';
import { AppointmentStatus, TokenStatus, QueuePriority } from '../../types';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  UserCheck,
  PauseCircle,
  Flame,
} from 'lucide-react';

interface StatusBadgeProps {
  status: AppointmentStatus | TokenStatus | 'paused' | 'active' | 'inactive';
  priority?: QueuePriority;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  priority,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  if (priority === 'emergency' && status === 'waiting') {
    return (
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-md bg-red-50 text-red-700 border border-red-200 ${sizeClasses} ${className}`}
      >
        <Flame className="w-3.5 h-3.5 text-red-600 animate-pulse" />
        Emergency · Waiting
      </span>
    );
  }

  switch (status) {
    case 'waiting':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-amber-50 text-amber-800 border border-amber-200 ${sizeClasses} ${className}`}
        >
          <Clock className="w-3 h-3 text-amber-600" />
          Waiting
        </span>
      );

    case 'current':
    case 'in_consultation':
      return (
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
          Now Serving
        </span>
      );

    case 'completed':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses} ${className}`}
        >
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Completed
        </span>
      );

    case 'cancelled':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-red-50 text-red-700 border border-red-200 ${sizeClasses} ${className}`}
        >
          <XCircle className="w-3 h-3 text-red-600" />
          Cancelled
        </span>
      );

    case 'no_show':
    case 'skipped':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses} ${className}`}
        >
          <AlertCircle className="w-3 h-3 text-slate-500" />
          Skipped / No Show
        </span>
      );

    case 'booked':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-200 ${sizeClasses} ${className}`}
        >
          <UserCheck className="w-3 h-3 text-slate-500" />
          Booked
        </span>
      );

    case 'paused':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-700 border border-slate-300 ${sizeClasses} ${className}`}
        >
          <PauseCircle className="w-3 h-3 text-slate-600" />
          Paused
        </span>
      );

    case 'active':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
          Active
        </span>
      );

    case 'inactive':
      return (
        <span
          className={`inline-flex items-center gap-1 font-medium rounded-md bg-slate-100 text-slate-600 border border-slate-200 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          Inactive
        </span>
      );

    default:
      return (
        <span
          className={`inline-flex items-center rounded-md bg-slate-100 text-slate-700 ${sizeClasses} ${className}`}
        >
          {status}
        </span>
      );
  }
};
