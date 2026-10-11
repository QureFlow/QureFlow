import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { clinicDate } from '../../lib/time';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import {
  Calendar,
  Clock,
  MapPin,
  Stethoscope,
  ChevronLeft,
  Ticket,
  AlertCircle,
} from 'lucide-react';

export const BookAppointment: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { doctors, bookAppointment } = useQueue();

  const state = location.state as {
    doctorId?: string;
    date?: string;
    time?: string;
  } | null;

  const doctor = doctors.find((d) => d.id === state?.doctorId);
  const date = state?.date || '';
  const time = state?.time || '';

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!doctor) {
      setError('Select a doctor and an available slot first.');
      return;
    }
    if (!user) {
      navigate('/patient/login');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      const result = await bookAppointment({
        patientId: user.id,
        patientName: user.name,
        patientPhone: user.phone,
        doctorId: doctor.id,
        date,
        time,
        notes,
      });

      // Navigate to token screen with the generated token
      navigate(date === clinicDate() ? '/patient/token' : '/patient/appointments', {
        state: {
          tokenNumber: result.token.tokenNumber,
          appointmentId: result.appointment.id,
          doctorId: doctor.id,
          justBooked: true,
        },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Booking failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!doctor || !date || !time)
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="max-w-2xl mx-auto p-8">
          <h1 className="text-xl font-bold">Choose an appointment slot</h1>
          <p className="my-3 text-sm text-slate-600">
            Select a doctor and an available consultation slot before confirming.
          </p>
          <Link className="text-brand-700 font-semibold" to="/patient/doctors">
            Find a Doctor
          </Link>
        </main>
      </div>
    );

  return (
    <div className="min-h-screen flex flex-col qf-shell pb-16 md:pb-0">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-4">
          <Link
            to={doctor ? `/patient/doctors/${doctor.id}` : '/patient/doctors'}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to slot selection
          </Link>
        </div>

        <div className="qf-panel p-6 sm:p-8">
          <div className="pb-4 border-b border-slate-100 mb-6">
            <h1 className="text-xl font-bold text-slate-900">Confirm Appointment</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Review your OPD consultation schedule before issuing your digital queue token.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Booking Summary Box */}
          <div className="bg-slate-50 rounded-lg p-5 border border-slate-200 space-y-4 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Doctor & Specialty
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{doctor.name}</h3>
                <p className="text-xs font-medium text-brand-700">{doctor.specialization}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Consultation Fee
                </span>
                <p className="text-lg font-black text-slate-900 mt-0.5">
                  ₹{doctor.consultationFee}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>{doctor.clinicName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="font-semibold">{date}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="font-semibold">{time}</span>
              </div>
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  {doctor.roomNumber
                    ? `Consultation room ${doctor.roomNumber}`
                    : 'OPD Consultation Room'}
                </span>
              </div>
            </div>
          </div>

          {/* Patient Details */}
          <div className="space-y-4 mb-6">
            <div className="bg-white p-4 rounded-md border border-slate-200 text-xs space-y-1">
              <span className="text-[11px] font-semibold uppercase text-slate-400">
                Patient Details
              </span>
              <p className="font-bold text-slate-900">{user?.name || 'Patient'}</p>
              <p className="text-slate-500">Mobile: {user?.phone || '—'}</p>
            </div>

            <Input
              label="Reason for visit / Chief complaint (Optional)"
              placeholder="e.g. Follow-up for fever, chest congestion, prescription renewal"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Important Queue Disclaimer */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 mb-6 flex items-start gap-2.5">
            <Ticket className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <p className="font-semibold text-blue-950">Queue token generation notice:</p>
              <p className="text-blue-800 text-[11px] mt-0.5">
                Your sequential queue token will be generated immediately upon confirmation. You can
                monitor live doctor consultations and wait times directly on your screen.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link to={`/patient/doctors/${doctor.id}`} className="w-full sm:w-auto">
              <Button variant="outline" size="md" className="w-full sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              onClick={handleConfirm}
              isLoading={isSubmitting}
              icon={<Ticket className="w-4 h-4" />}
            >
              Confirm & Get Token
            </Button>
          </div>
        </div>
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
