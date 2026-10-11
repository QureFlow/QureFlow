import React from 'react';
import { clinicDate } from '../../lib/time';
import { Appointment } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Stethoscope, Ticket } from 'lucide-react';

interface AppointmentCardProps {
  appointment: Appointment;
  onCancelRequest?: (appointment: Appointment) => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onCancelRequest,
}) => {
  const canCancel = appointment.status === 'booked' || appointment.status === 'waiting';

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
      <div>
        {/* Header: Specialization + Status */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
            <Stethoscope className="w-3.5 h-3.5" />
            <span>{appointment.doctorSpecialization}</span>
          </div>
          <StatusBadge status={appointment.status} priority={appointment.priority} size="sm" />
        </div>

        {/* Doctor Name & Clinic */}
        <h3 className="text-base font-bold text-slate-900 mb-1">{appointment.doctorName}</h3>
        <p className="text-xs text-slate-500 flex items-center gap-1 mb-3">
          <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          <span className="truncate">{appointment.clinicName}</span>
        </p>

        {/* Date & Time pills */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-md border border-slate-100 text-xs mb-4">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{appointment.date}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-medium">{appointment.time}</span>
          </div>
        </div>

        {/* Token allocation */}
        <div className="flex items-center justify-between py-2 px-3 bg-brand-50/60 rounded border border-brand-100 text-xs mb-4">
          <div className="flex items-center gap-1.5 text-brand-900 font-medium">
            <Ticket className="w-3.5 h-3.5 text-brand-700" />
            <span>Queue Token</span>
          </div>
          <span className="font-mono font-extrabold text-brand-950 text-sm">
            {appointment.tokenNumber || 'Assigned at Clinic'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {appointment.tokenNumber &&
            appointment.date === clinicDate() &&
            ['booked', 'waiting', 'in_consultation'].includes(appointment.status) && (
              <Link to="/patient/token">
                <Button variant="outline" size="sm">
                  View Queue
                </Button>
              </Link>
            )}
        </div>

        {canCancel && onCancelRequest && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancelRequest(appointment)}
            className="text-red-600 hover:bg-red-50"
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
};
