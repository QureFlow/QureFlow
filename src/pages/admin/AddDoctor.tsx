import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { doctorService } from '../../services/doctorService';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Button } from '../../components/common/Button';
import { Menu, ChevronLeft, Plus } from 'lucide-react';

export const AddDoctor: React.FC = () => {
  const navigate = useNavigate();
  const { clinics, refreshState, showToast } = useQueue();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('General Medicine');
  const [experienceYears, setExperienceYears] = useState('8');
  const [qualifications, setQualifications] = useState('MBBS, MD');
  const [clinicId, setClinicId] = useState(clinics[0]?.id || 'clinic-1');
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
  ]);
  const [startTime, setStartTime] = useState('09:00 AM');
  const [endTime, setEndTime] = useState('01:30 PM');
  const [slotDurationMinutes, setSlotDurationMinutes] = useState('10');
  const [consultationFee, setConsultationFee] = useState('100');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const weekDays = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const toggleDay = (day: string) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter((d) => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide the doctor full name');
      return;
    }
    if (selectedDays.length === 0) {
      setError('Please select at least one consulting day');
      return;
    }

    const clinic = clinics.find((c) => c.id === clinicId) || clinics[0];

    try {
      setIsSubmitting(true);
      setError('');
      await doctorService.addDoctor({
        name: name.startsWith('Dr.') ? name : `Dr. ${name}`,
        specialization,
        experienceYears: parseInt(experienceYears, 10) || 5,
        qualifications,
        clinicId: clinic.id,
        clinicName: clinic.name,
        consultationDays: selectedDays,
        startTime,
        endTime,
        slotDurationMinutes: parseInt(slotDurationMinutes, 10) || 10,
        consultationFee: parseInt(consultationFee, 10) || 100,
        isAvailableToday: selectedDays.includes('Saturday'), // current test day
        nextAvailableSlot: startTime,
        status,
      });

      refreshState();
      showToast('Doctor registered successfully in OPD schedule', 'success');
      navigate('/admin/doctors');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error registering doctor');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <div className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-900">Add Doctor Schedule</h2>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl w-full mx-auto space-y-6">
          <div className="mb-2">
            <Link
              to="/admin/doctors"
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Doctor Roster
            </Link>
          </div>

          <PageHeader
            title="Register New Doctor"
            subtitle="Add a consulting physician to the OPD roster with available time slots and department."
          />

          <div className="bg-white rounded-lg border border-slate-200 p-6 sm:p-8 shadow-subtle">
            {error && (
              <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 mb-4">
                  1. Physician Identification
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Doctor Name"
                    placeholder="e.g. Dr. Bikramaditya Chatterjee"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />

                  <Select
                    label="Specialization / Department"
                    options={[
                      { value: 'General Medicine', label: 'General Medicine' },
                      { value: 'Pediatrics & Child Care', label: 'Pediatrics & Child Care' },
                      { value: 'Obstetrics & Gynecology', label: 'Obstetrics & Gynecology' },
                      { value: 'Orthopedics & Joint Care', label: 'Orthopedics & Joint Care' },
                      { value: 'Ophthalmology (Eye Care)', label: 'Ophthalmology (Eye Care)' },
                      { value: 'Dermatology & Skin', label: 'Dermatology & Skin' },
                      { value: 'General Surgery', label: 'General Surgery' },
                      { value: 'ENT (Ear, Nose, Throat)', label: 'ENT (Ear, Nose, Throat)' },
                    ]}
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                  />

                  <Input
                    label="Medical Qualifications & Degrees"
                    placeholder="e.g. MBBS, MD (Internal Medicine)"
                    value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                  />

                  <Input
                    label="Years of Clinical Experience"
                    type="number"
                    min={1}
                    max={50}
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                  />
                </div>
              </div>

              {/* Facility & Shift Hours */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 mb-4">
                  2. Facility & OPD Consulting Hours
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Assigned Health Facility"
                    options={clinics.map((c) => ({ value: c.id, label: c.name }))}
                    value={clinicId}
                    onChange={(e) => setClinicId(e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      label="Shift Start Time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="09:00 AM"
                    />
                    <Input
                      label="Shift End Time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      placeholder="01:30 PM"
                    />
                  </div>

                  <Input
                    label="Slot Duration (Minutes / Patient)"
                    type="number"
                    value={slotDurationMinutes}
                    onChange={(e) => setSlotDurationMinutes(e.target.value)}
                  />

                  <Input
                    label="Standard Consultation Fee (₹ INR)"
                    type="number"
                    value={consultationFee}
                    onChange={(e) => setConsultationFee(e.target.value)}
                  />
                </div>
              </div>

              {/* Days Available */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 pb-2 border-b border-slate-100 mb-3">
                  3. Weekly Consultation Days
                </h3>
                <div className="flex flex-wrap gap-2">
                  {weekDays.map((day) => {
                    const isSelected = selectedDays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                          isSelected
                            ? 'bg-brand-950 text-white border-brand-950 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Initial Status */}
              <div>
                <Select
                  label="Initial Roster Status"
                  options={[
                    { value: 'active', label: 'Active (Appears on Patient Directory & OPD Queue)' },
                    { value: 'inactive', label: 'Inactive (Temporary Leave / Unscheduled)' },
                  ]}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Link to="/admin/doctors">
                  <Button variant="outline" size="md">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  icon={<Plus className="w-4 h-4" />}
                >
                  Save Doctor Record
                </Button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
};
