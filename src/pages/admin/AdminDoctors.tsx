import React, { useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { doctorService } from '../../services/doctorService';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/common/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { clinicDate } from '../../lib/time';
import { Menu, Plus, Power, Layers } from 'lucide-react';

export const AdminDoctors: React.FC = () => {
  const { doctors, tokens, appointments, refreshState, showToast } = useQueue();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleToggleDoctorStatus = async (id: string, currentStatus: string) => {
    try {
      await doctorService.toggleDoctorStatus(id);
      refreshState();
      showToast(
        `Doctor status updated to ${currentStatus === 'active' ? 'Inactive' : 'Active'}`,
        'info',
      );
    } catch {
      showToast('Failed to update doctor status', 'error');
    }
  };

  return (
    <div className="min-h-screen qf-shell flex flex-col lg:flex-row">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <div className="qf-workspace-bar h-20 bg-white border-b border-slate-200 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-sm font-bold text-slate-900">Physicians & OPD Roster</h2>
          </div>

          <Link to="/admin/doctors/add">
            <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
              Add New Doctor
            </Button>
          </Link>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <PageHeader
            title="Meet your care team."
            subtitle="Configure consulting schedules, availability status, and consultation room allocations."
            actions={
              <Link to="/admin/doctors/add">
                <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                  Register Doctor
                </Button>
              </Link>
            }
          />

          <div className="qf-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Doctor & Specialization</th>
                    <th className="py-3 px-4">Facility Clinic</th>
                    <th className="py-3 px-4">Consulting Days & Hours</th>
                    <th className="py-3 px-4">Appointments & Queue</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctors.map((doc) => {
                    const todayAptsCount = appointments.filter(
                      (a) =>
                        a.doctorId === doc.id &&
                        a.date === clinicDate() &&
                        !['cancelled', 'no_show'].includes(a.status),
                    ).length;
                    const waitingCount = tokens.filter(
                      (t) => t.doctorId === doc.id && t.status === 'waiting',
                    ).length;

                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{doc.name}</div>
                          <div className="text-[11px] text-brand-700 font-medium">
                            {doc.specialization}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {doc.qualifications} • {doc.experienceYears} yrs exp
                          </div>
                          <div className="text-[11px] text-slate-500 mt-2">
                            Room {doc.roomNumber || 'unassigned'} ·{' '}
                            {doc.languages?.join(', ') || 'Languages not set'}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="text-slate-800 font-medium">{doc.clinicName}</span>
                          <div className="text-[11px] text-slate-500">
                            Fee: ₹{doc.consultationFee}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-slate-800">
                            {doc.startTime} – {doc.endTime}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {doc.consultationDays.join(', ')}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800">
                            {todayAptsCount} appointments today
                          </div>
                          <div className="text-[11px] text-amber-700 font-medium">
                            {waitingCount} waiting now
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <StatusBadge status={doc.status} size="sm" />
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link to={`/admin/queue?doctor=${doc.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<Layers className="w-3 h-3" />}
                              >
                                Queue
                              </Button>
                            </Link>

                            <button
                              onClick={() => handleToggleDoctorStatus(doc.id, doc.status)}
                              className={`p-1.5 rounded border text-xs transition-colors ${
                                doc.status === 'active'
                                  ? 'bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-700 border-slate-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              title={
                                doc.status === 'active' ? 'Deactivate Doctor' : 'Activate Doctor'
                              }
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
