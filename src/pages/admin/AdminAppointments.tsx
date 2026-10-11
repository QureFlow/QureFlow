import React, { useState, useMemo, useEffect } from 'react';
import { clinicDate } from '../../lib/time';
import { Modal } from '../../components/common/Modal';
import { Appointment } from '../../types';
import { useQueue } from '../../context/QueueContext';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Button } from '../../components/common/Button';
import { Menu, Search, Phone } from 'lucide-react';

export const AdminAppointments: React.FC = () => {
  const { appointments, doctors, cancelAppointment } = useQueue();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(clinicDate());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  useEffect(() => {
    setPage(1);
  }, [searchQuery, doctorFilter, statusFilter, dateFilter]);
  const confirmCancellation = async () => {
    if (!selected) return;
    setCancelling(true);
    setCancelError('');
    try {
      await cancelAppointment(selected.id, 'Cancelled by Clinic Reception');
      setSelected(null);
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Cancellation failed.');
    } finally {
      setCancelling(false);
    }
  };

  const filteredAppointments = useMemo(() => {
    return appointments
      .filter((apt) => {
        const matchesSearch =
          !searchQuery.trim() ||
          apt.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          apt.patientPhone.includes(searchQuery) ||
          apt.tokenNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          apt.doctorName.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesDoctor = doctorFilter === 'all' || apt.doctorId === doctorFilter;
        const matchesStatus = statusFilter === 'all' || apt.status === statusFilter;
        const matchesDate = !dateFilter || apt.date === dateFilter;

        return matchesSearch && matchesDoctor && matchesStatus && matchesDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [appointments, searchQuery, doctorFilter, statusFilter, dateFilter]);

  const doctorOptions = [
    { value: 'all', label: 'All Consulting Doctors' },
    ...doctors.map((d) => ({ value: d.id, label: `${d.name} (${d.specialization})` })),
  ];

  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'booked', label: 'Booked' },
    { value: 'waiting', label: 'Waiting in Queue' },
    { value: 'in_consultation', label: 'In Consultation' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
    { value: 'no_show', label: 'No Show / Skipped' },
  ];

  const handleResetFilters = () => {
    setSearchQuery('');
    setDoctorFilter('all');
    setStatusFilter('all');
    setDateFilter('');
  };

  return (
    <div className="min-h-screen qf-shell flex flex-col lg:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <div className="h-20 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-900">Appointment Master Log</h2>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <PageHeader
            title="Every visit, connected."
            subtitle="Search, verify, and inspect all patient OPD appointments and digital tokens."
          />

          {/* Search & Filters */}
          <div className="qf-panel p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="md:col-span-2">
                <Input
                  placeholder="Search by patient name, phone, or token (e.g. A-042, Suman)"
                  icon={<Search className="w-4 h-4" />}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div>
                <Select
                  options={doctorOptions}
                  value={doctorFilter}
                  onChange={(e) => setDoctorFilter(e.target.value)}
                />
              </div>

              <div>
                <Select
                  options={statusOptions}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Filter date:</span>
                <input
                  type="date"
                  aria-label="Appointment date filter"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-2 py-1 rounded border border-slate-200 text-xs bg-slate-50 text-slate-800"
                />
              </div>

              {(searchQuery || doctorFilter !== 'all' || statusFilter !== 'all' || dateFilter) && (
                <button
                  onClick={handleResetFilters}
                  className="text-brand-700 font-semibold hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="qf-panel overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span>
                Found <strong className="text-slate-800">{filteredAppointments.length}</strong>{' '}
                appointments
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Token & Date</th>
                    <th className="py-3 px-4">Patient Information</th>
                    <th className="py-3 px-4">Doctor & Department</th>
                    <th className="py-3 px-4">Channel</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No appointments match current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAppointments.slice((page - 1) * 20, page * 20).map((apt) => (
                      <tr key={apt.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {apt.tokenNumber || '—'}
                          </span>
                          <div className="text-[11px] text-slate-500 mt-1">
                            {apt.date} • {apt.time}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{apt.patientName}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {apt.patientPhone}
                          </div>
                          {apt.notes && (
                            <p className="text-[10px] text-slate-400 italic truncate max-w-xs mt-0.5">
                              {apt.notes}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{apt.doctorName}</div>
                          <div className="text-[11px] text-brand-700 font-medium">
                            {apt.doctorSpecialization}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-[11px] text-slate-600">
                            {apt.isWalkIn ? 'Walk-in Desk' : 'Online Portal'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <StatusBadge status={apt.status} priority={apt.priority} size="sm" />
                        </td>

                        <td className="py-3 px-4 text-right">
                          {apt.status === 'booked' || apt.status === 'waiting' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelected(apt);
                                setCancelError('');
                              }}
                              className="text-red-600 hover:bg-red-50 text-[11px]"
                            >
                              Cancel
                            </Button>
                          ) : (
                            <span className="text-slate-400 text-[11px]">No actions</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-slate-100 flex gap-3 items-center justify-between text-xs text-slate-500">
              <span>
                Page {page} of {Math.max(1, Math.ceil(filteredAppointments.length / 20))}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= filteredAppointments.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
      <Modal
        isOpen={!!selected}
        onClose={() => {
          if (!cancelling) setSelected(null);
        }}
        title="Cancel this appointment?"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelected(null)} disabled={cancelling}>
              Keep appointment
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmCancellation()}
              isLoading={cancelling}
            >
              Confirm cancellation
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          {selected?.patientName} · {selected?.doctorName} · {selected?.date} at {selected?.time}.
          Cancellation closes the linked queue token and releases the appointment slot.
        </p>
        {cancelError && (
          <p role="alert" className="text-sm text-red-700 mt-4">
            {cancelError}
          </p>
        )}
      </Modal>
    </div>
  );
};
