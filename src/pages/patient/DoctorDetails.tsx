import { specialtyAppearance } from '../../lib/specialtyAppearance';
import { clinicDate } from '../../lib/time';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { doctorService } from '../../services/doctorService';
import { Doctor, SlotAvailability } from '../../types';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { TimeSlotPicker } from '../../components/patient/TimeSlotPicker';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Calendar, Clock, MapPin, ChevronLeft, ArrowRight } from 'lucide-react';

export const DoctorDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { doctors } = useQueue();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(clinicDate());
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    if (!id) return;
    const doc = doctors.find((d) => d.id === id);
    if (doc) {
      setDoctor(doc);
    }
  }, [id, doctors]);

  useEffect(() => {
    let cancelled = false;
    const fetchSlots = async () => {
      if (!doctor || !selectedDate) {
        setSlots([]);
        setSelectedSlot(null);
        return;
      }
      setIsLoadingSlots(true);
      setSelectedSlot(null);
      setSlotError('');
      setSlots([]);
      try {
        const available = await doctorService.getAvailableSlots(doctor.id, selectedDate);
        if (!cancelled) setSlots(available);
      } catch (err) {
        if (!cancelled)
          setSlotError(err instanceof Error ? err.message : 'Could not load available slots.');
      } finally {
        if (!cancelled) setIsLoadingSlots(false);
      }
    };
    fetchSlots();
    return () => {
      cancelled = true;
    };
  }, [
    doctor?.id,
    doctor?.startTime,
    doctor?.endTime,
    doctor?.slotDurationMinutes,
    doctor?.status,
    doctor?.consultationDays.join(','),
    selectedDate,
  ]);

  if (!doctor) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <Navbar />
        <div className="flex-1 max-w-2xl mx-auto py-16 px-4 text-center">
          <p className="text-sm text-slate-500 mb-4">Doctor record not found.</p>
          <Link to="/patient/doctors">
            <Button variant="outline" size="sm">
              Back to Doctors List
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Generate 7 days for the date selector
  const availableDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = clinicDate(d);
    const dayName = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const dayNum = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric' });
    const month = d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', month: 'short' });
    return { dateStr, dayName, dayNum, month, isToday: i === 0 };
  });

  const handleProceedToBooking = () => {
    if (!selectedSlot) return;
    navigate('/patient/book', {
      state: {
        doctorId: doctor.id,
        date: selectedDate,
        time: selectedSlot,
      },
    });
  };

  return (
    <div className="min-h-screen flex flex-col qf-shell pb-16 md:pb-0">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Link */}
        <div className="mb-4">
          <Link
            to="/patient/doctors"
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Doctors Directory
          </Link>
        </div>

        {slotError && (
          <p role="alert" className="p-3 bg-red-50 text-red-800 rounded text-sm">
            {slotError}
          </p>
        )}
        {/* Doctor Profile Banner */}
        <div className="qf-panel qf-doctor-card p-6 sm:p-8 mb-8" data-tone={specialtyAppearance(doctor.specialization).tone}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="qf-doctor-avatar w-16 h-16 rounded-xl flex items-center justify-center font-bold text-xl select-none flex-shrink-0">
                {doctor.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="qf-title text-2xl sm:text-4xl font-semibold text-slate-900">
                    {doctor.name}
                  </h1>
                  <StatusBadge status={doctor.isAvailableToday ? 'active' : 'inactive'} size="sm" />
                </div>
                <p className="text-sm font-semibold text-brand-700">{doctor.specialization}</p>
                <p className="text-xs text-slate-500">{doctor.qualifications}</p>
              </div>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Consultation Fee
              </p>
              <p className="text-2xl font-black text-slate-900">₹{doctor.consultationFee}</p>
              <span className="text-[11px] text-slate-500">Set by the clinic</span>
            </div>
          </div>

          {doctor.bio && (
            <p className="mt-6 text-sm text-slate-600 leading-relaxed max-w-3xl">{doctor.bio}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-5">
            {doctor.languages?.map((language) => (
              <span
                key={language}
                className="rounded-full bg-brand-50 px-3 py-1.5 text-xs text-brand-800"
              >
                {language}
              </span>
            ))}
            {doctor.roomNumber && (
              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
                Room {doctor.roomNumber}
              </span>
            )}
          </div>
          {!!doctor.clinicalInterests?.length && (
            <div className="mt-5">
              <p className="qf-eyebrow mb-2">Clinical interests</p>
              <p className="text-sm text-slate-600">{doctor.clinicalInterests.join(' · ')}</p>
            </div>
          )}
          {doctor.metadata?.synthetic === true && (
            <p className="mt-5 text-xs text-amber-800">
              Fictional demo profile · {doctor.registrationId} is a demonstration reference.
            </p>
          )}
          {/* Practice Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800">Facility Location</p>
                <p className="text-slate-500 mt-0.5">{doctor.clinicName}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Calendar className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800">Consulting Days</p>
                <p className="text-slate-500 mt-0.5">{doctor.consultationDays.join(', ')}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800">OPD Shift Hours</p>
                <p className="text-slate-500 mt-0.5">
                  {doctor.startTime} – {doctor.endTime}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Date Selector */}
        <div className="qf-panel qf-doctor-card p-6 sm:p-8 mb-8" data-tone={specialtyAppearance(doctor.specialization).tone}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Choose Appointment Date</h2>
              <p className="text-xs text-slate-500">Select an upcoming OPD date</p>
            </div>
            <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Next 7 days
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            {availableDates.map((item) => {
              const isSelected = selectedDate === item.dateStr;
              return (
                <button
                  key={item.dateStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(item.dateStr);
                    setSelectedSlot(null);
                  }}
                  className={`p-3 rounded-lg border text-center transition-all select-none ${
                    isSelected
                      ? 'bg-brand-950 text-white border-brand-950 shadow-sm'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="block text-[11px] font-semibold uppercase">{item.dayName}</span>
                  <span className="block text-lg font-bold my-0.5">{item.dayNum}</span>
                  <span className="block text-[10px] opacity-75">{item.month}</span>
                  {item.isToday && (
                    <span
                      className={`block text-[9px] font-bold mt-1 px-1 rounded ${isSelected ? 'bg-white/20' : 'text-brand-700'}`}
                    >
                      Today
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <label className="block text-xs text-slate-500 mt-5">
            Or choose another date within 90 days
            <input
              aria-label="Choose appointment date"
              type="date"
              value={selectedDate}
              min={clinicDate()}
              max={clinicDate(new Date(Date.now() + 90 * 86400000))}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="block mt-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 bg-white"
            />
          </label>
          <div className="mt-8 pt-6 border-t border-slate-100">
            {/* Time Slots */}
            <TimeSlotPicker
              slots={slots}
              selectedSlot={selectedSlot}
              onSelectSlot={(slot) => setSelectedSlot(slot)}
              isLoading={isLoadingSlots}
            />
          </div>

          {/* Booking Summary Box when slot is selected */}
          {selectedSlot && (
            <div className="mt-6 p-4 rounded-lg bg-brand-50/70 border border-brand-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-brand-900">Selected Booking Schedule</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedDate} at {selectedSlot} with {doctor.name}
                </p>
                <p className="text-xs text-slate-600 mt-0.5">
                  Your queue token will be generated on confirmation.
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={handleProceedToBooking}
                icon={<ArrowRight className="w-4 h-4" />}
              >
                Proceed to Confirmation
              </Button>
            </div>
          )}
        </div>
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
