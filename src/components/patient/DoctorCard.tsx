import React from 'react';
import { Doctor } from '../../types';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { MapPin, Calendar, Clock, ChevronRight } from 'lucide-react';

interface DoctorCardProps {
  doctor: Doctor;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({ doctor }) => {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-5 shadow-subtle hover:border-slate-300 transition-all flex flex-col justify-between">
      <div>
        {/* Header with Avatar & Status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-brand-50 border border-brand-200 text-brand-900 flex items-center justify-center font-bold text-sm select-none">
              {doctor.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-snug">{doctor.name}</h3>
              <p className="text-xs font-semibold text-brand-700">{doctor.specialization}</p>
            </div>
          </div>
          <StatusBadge status={doctor.isAvailableToday ? 'active' : 'inactive'} size="sm" />
        </div>

        {/* Qualifications & Clinic */}
        <div className="space-y-1.5 text-xs text-slate-600 mb-4">
          <p className="text-[11px] text-slate-500 line-clamp-1">{doctor.qualifications}</p>
          <div className="flex items-center gap-1.5 text-slate-600">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{doctor.clinicName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">
              {doctor.consultationDays.slice(0, 3).join(', ')}
              {doctor.consultationDays.length > 3 ? ` +${doctor.consultationDays.length - 3} days` : ''}
            </span>
          </div>
        </div>

        {/* Next Slot highlight box */}
        <div className="bg-slate-50 rounded-md p-2.5 border border-slate-100 mb-4 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-700">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-medium">{doctor.isAvailableToday ? 'Available today' : 'Consulting days'}</span>
          </div>
          <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
            {doctor.nextAvailableSlot}
          </span>
        </div>
      </div>

      {/* Action CTA */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Fee: <span className="font-semibold text-slate-900">₹{doctor.consultationFee}</span>
        </span>
        <Link to={`/patient/doctors/${doctor.id}`}>
          <Button variant="outline" size="sm" icon={<ChevronRight className="w-3.5 h-3.5" />}>
            View Doctor
          </Button>
        </Link>
      </div>
    </div>
  );
};
