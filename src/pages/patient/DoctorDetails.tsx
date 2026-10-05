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
import {
  Calendar,
  Clock,
  MapPin,
  ChevronLeft,
  ArrowRight,
} from 'lucide-react';

export const DoctorDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { doctors } = useQueue();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  useEffect(() => {
    if (!id) return;
    const doc = doctors.find((d) => d.id === id);
    if (doc) {
      setDoctor(doc);
    }
  }, [id, doctors]);

  useEffect(() => {
    const fetchSlots = async () => {
      if (!doctor || !selectedDate) return;
      setIsLoadingSlots(true);
      try {
        const available = await doctorService.getAvailableSlots(doctor.id, selectedDate);
        setSlots(available);
      } finally {
        setIsLoadingSlots(false);
      }
    };
    fetchSlots();
  }, [doctor, selectedDate]);

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
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
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
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16 md:pb-0">
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

        {/* Doctor Profile Banner */}
        <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 shadow-subtle mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-brand-50 border border-brand-200 text-brand-900 flex items-center justify-center font-bold text-xl select-none flex-shrink-0">
                {doctor.name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{doctor.name}</h1>
                  <StatusBadge status={doctor.isAvailableToday ? 'active' : 'inactive'} size="sm" />
                </div>
                <p className="text-sm font-semibold text-brand-700">{doctor.specialization}</p>
                <p className="text-xs text-slate-500">{doctor.qualifications}</p>
              </div>
            </div>

            <div className="sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Consultation Fee</p>
              <p className="text-2xl font-black text-slate-900">₹{doctor.consultationFee}</p>
              <span className="text-[11px] text-slate-500">Government OPD Rate</span>
            </div>
          </div>

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
        <div className="bg-white rounded-lg border border-slate-200 p-6 shadow-subtle mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Choose Appointment Date</h2>
              <p className="text-xs text-slate-500">Select an upcoming OPD date</p>
            </div>
            <span className="text-xs font-medium text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              7-Day Booking Horizon
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
                    <span className={`block text-[9px] font-bold mt-1 px-1 rounded ${isSelected ? 'bg-white/20' : 'text-brand-700'}`}>
                      Today
                    </span>
                  )}
                </button>
              );
            })}
          </div>

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
