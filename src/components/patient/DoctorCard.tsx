import { Doctor } from '../../types';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3, Languages, MapPin } from 'lucide-react';
import { specialtyAppearance } from '../../lib/specialtyAppearance';
export const DoctorCard = ({ doctor }: { doctor: Doctor }) => {
  const initials = doctor.name
    .replace(/^Dr\.\s*/, '')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('');
  const { tone } = specialtyAppearance(doctor.specialization);
  return (
    <article className="qf-panel qf-doctor-card p-5 sm:p-6 flex flex-col" data-tone={tone}>
      <div className="flex items-start justify-between gap-3">
        <div
          className="qf-doctor-avatar w-16 h-16 rounded-xl flex items-center justify-center text-xl font-semibold"
        >
          {initials}
        </div>
        <span
          className={`text-[10px] font-semibold rounded-md px-2.5 py-1.5 ${doctor.isAvailableToday ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}
        >
          {doctor.isAvailableToday ? 'Consulting today' : 'View schedule'}
        </span>
      </div>
      <p className="text-xs font-medium text-brand-700 mt-5">{doctor.specialization}</p>
      <h3 className="text-lg font-semibold tracking-tight text-brand-950 mt-2">{doctor.name}</h3>
      <p className="text-xs leading-relaxed text-slate-500 mt-2">
        {doctor.qualifications} · {doctor.experienceYears} years experience
      </p>
      <div className="space-y-2.5 text-xs text-slate-500 my-5">
        <p className="flex gap-2 items-start">
          <MapPin className="w-3.5 h-3.5 shrink-0 text-brand-600" />
          {doctor.clinicName}
        </p>
        <p className="flex gap-2 items-center">
          <Clock3 className="w-3.5 h-3.5 shrink-0 text-brand-600" />
          {doctor.startTime} – {doctor.endTime}
        </p>
        {!!doctor.languages?.length && (
          <p className="flex gap-2 items-center">
            <Languages className="w-3.5 h-3.5 shrink-0 text-brand-600" />
            {doctor.languages.join(', ')}
          </p>
        )}
      </div>
      {!!doctor.clinicalInterests?.length && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {doctor.clinicalInterests.slice(0, 2).map((s) => (
            <span
              key={s}
              className="text-[10px] px-2.5 py-1 rounded-full border border-[#e2e8f0] text-slate-600"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="border-t border-[#e2e8f0] pt-4 mt-auto flex justify-between items-center gap-2">
        <div>
          <p className="text-[10px] text-slate-400">Consultation</p>
          <p className="text-base font-semibold text-brand-950">
            ₹{doctor.consultationFee}
            <span className="text-[10px] font-normal text-slate-400 ml-1">/ visit</span>
          </p>
        </div>
        <Link
          to={`/patient/doctors/${doctor.id}`}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 transition-colors text-white rounded-lg text-xs font-semibold px-4 py-3"
        >
          View Doctor <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </article>
  );
};
