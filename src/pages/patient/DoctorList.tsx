import React, { useState, useMemo } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { DoctorCard } from '../../components/patient/DoctorCard';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { EmptyState } from '../../components/common/EmptyState';
import { Search, Stethoscope } from 'lucide-react';

export const DoctorList: React.FC = () => {
  const { doctors, clinics } = useQueue();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpec, setSelectedSpec] = useState('all');
  const [selectedClinic, setSelectedClinic] = useState('all');
  const [availableTodayOnly, setAvailableTodayOnly] = useState(false);

  // Extract unique specializations
  const specializations = useMemo(() => {
    const set = new Set(doctors.map((d) => d.specialization));
    return Array.from(set);
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      // Name or specialization search
      const matchesSearch =
        !searchQuery.trim() ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.specialization.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.clinicName.toLowerCase().includes(searchQuery.toLowerCase());

      // Specialization filter
      const matchesSpec = selectedSpec === 'all' || doc.specialization === selectedSpec;

      // Clinic filter
      const matchesClinic = selectedClinic === 'all' || doc.clinicId === selectedClinic;

      // Availability filter
      const matchesAvailability = !availableTodayOnly || doc.isAvailableToday;

      return matchesSearch && matchesSpec && matchesClinic && matchesAvailability;
    });
  }, [doctors, searchQuery, selectedSpec, selectedClinic, availableTodayOnly]);

  const specOptions = [
    { value: 'all', label: 'All Specializations' },
    ...specializations.map((s) => ({ value: s, label: s })),
  ];

  const clinicOptions = [
    { value: 'all', label: 'All Clinics & Hospitals' },
    ...clinics.map((c) => ({ value: c.id, label: c.name })),
  ];

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedSpec('all');
    setSelectedClinic('all');
    setAvailableTodayOnly(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 pb-16 md:pb-0">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Find a Doctor"
          subtitle="Search doctors and choose a convenient appointment time across regional clinics."
        />

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-lg border border-slate-200 shadow-subtle mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by doctor name or specialization (e.g. Pediatrics, Dr. Sharma)"
                icon={<Search className="w-4 h-4" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              onClick={() => setAvailableTodayOnly(!availableTodayOnly)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md border transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap select-none ${
                availableTodayOnly
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  availableTodayOnly ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              ></span>
              Available Today Only
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <Select
              options={specOptions}
              value={selectedSpec}
              onChange={(e) => setSelectedSpec(e.target.value)}
            />
            <Select
              options={clinicOptions}
              value={selectedClinic}
              onChange={(e) => setSelectedClinic(e.target.value)}
            />
          </div>
        </div>

        {/* Doctor Roster Results */}
        <div className="flex items-center justify-between mb-4 text-xs text-slate-500">
          <p>
            Showing <strong className="text-slate-800">{filteredDoctors.length}</strong> registered doctors
          </p>
          {(searchQuery || selectedSpec !== 'all' || selectedClinic !== 'all' || availableTodayOnly) && (
            <button
              onClick={handleResetFilters}
              className="text-brand-700 font-semibold hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {filteredDoctors.length === 0 ? (
          <EmptyState
            icon={<Stethoscope className="w-6 h-6" />}
            title="No doctors match your search"
            description="Try changing your search terms or selecting 'All Specializations' to see available practitioners."
            actionLabel="Reset Filters"
            onAction={handleResetFilters}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredDoctors.map((doc) => (
              <DoctorCard key={doc.id} doctor={doc} />
            ))}
          </div>
        )}
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
