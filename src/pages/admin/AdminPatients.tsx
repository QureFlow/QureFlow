import React, { useState, useMemo } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  Menu,
  Search,
  Phone,
  Calendar,
  Ticket,
} from 'lucide-react';

export const AdminPatients: React.FC = () => {
  const { appointments, tokens } = useQueue();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Extract unique patient list from appointments and tokens
  const patientMap = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      phone: string;
      email?: string;
      totalVisits: number;
      lastVisitDate?: string;
    }>();

    // Default registered patients
    map.set('9876543210', {
      id: 'patient-1',
      name: 'Suman Roy',
      phone: '9876543210',
      email: 'suman.roy@example.com',
      totalVisits: 4,
      lastVisitDate: '2026-09-12',
    });
    map.set('9876543211', {
      id: 'patient-2',
      name: 'Anjali Mondal',
      phone: '9876543211',
      email: 'anjali.m@example.com',
      totalVisits: 1,
      lastVisitDate: '2026-09-10',
    });
    map.set('9876543212', {
      id: 'patient-3',
      name: 'Rajesh Ghosh',
      phone: '9876543212',
      email: 'rajesh.g@example.com',
      totalVisits: 2,
      lastVisitDate: '2026-09-12',
    });
    map.set('9876543213', {
      id: 'patient-4',
      name: 'Meera Karmakar',
      phone: '9876543213',
      email: 'meera.k@example.com',
      totalVisits: 1,
      lastVisitDate: '2026-09-12',
    });
    map.set('9876543214', {
      id: 'patient-5',
      name: 'Bikash Das',
      phone: '9876543214',
      email: 'bikash.d@example.com',
      totalVisits: 2,
      lastVisitDate: '2026-09-12',
    });

    // Also index any walk-ins added dynamically
    appointments.forEach((a) => {
      const key = a.patientPhone;
      if (!map.has(key)) {
        map.set(key, {
          id: a.patientId,
          name: a.patientName,
          phone: a.patientPhone,
          totalVisits: 1,
          lastVisitDate: a.date,
        });
      } else {
        const p = map.get(key)!;
        p.totalVisits += 1;
        if (!p.lastVisitDate || a.date > p.lastVisitDate) {
          p.lastVisitDate = a.date;
        }
      }
    });

    return Array.from(map.values());
  }, [appointments]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patientMap;
    const q = searchQuery.toLowerCase();
    return patientMap.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.includes(q) ||
        (p.email && p.email.toLowerCase().includes(q))
    );
  }, [patientMap, searchQuery]);

  // Selected patient for viewing history modal
  const [selectedPatient, setSelectedPatient] = useState<{
    id: string;
    name: string;
    phone: string;
    email?: string;
  } | null>(null);

  const patientAppointments = useMemo(() => {
    if (!selectedPatient) return [];
    return appointments.filter(
      (a) => a.patientPhone === selectedPatient.phone || a.patientId === selectedPatient.id
    );
  }, [appointments, selectedPatient]);

  const patientTokens = useMemo(() => {
    if (!selectedPatient) return [];
    return tokens.filter(
      (t) => t.patientPhone === selectedPatient.phone || t.patientId === selectedPatient.id
    );
  }, [tokens, selectedPatient]);

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
            <h2 className="text-sm font-bold text-slate-900">Patient Directory & Logs</h2>
          </div>
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <PageHeader
            title="Patient Management"
            subtitle="Search registered OPD patients, inspect past visit records, and review queue token history."
          />

          {/* Search bar */}
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-subtle">
            <Input
              placeholder="Search patients by name or phone (e.g. Suman, 9876543210)"
              icon={<Search className="w-4 h-4" />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Patient Roster */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-subtle overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              Total <strong className="text-slate-800">{filteredPatients.length}</strong> patients found
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Patient Name</th>
                    <th className="py-3 px-4">Phone Number</th>
                    <th className="py-3 px-4">Email / ID</th>
                    <th className="py-3 px-4">Total Visits</th>
                    <th className="py-3 px-4">Last Visit</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.map((patient) => (
                    <tr key={patient.phone} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {patient.name}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{patient.phone}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {patient.email || 'SMS registered'}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        {patient.totalVisits} visits
                      </td>

                      <td className="py-3.5 px-4 text-slate-500">
                        {patient.lastVisitDate || 'Today'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPatient(patient)}
                        >
                          View History
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Patient History Modal */}
      <Modal
        isOpen={Boolean(selectedPatient)}
        onClose={() => setSelectedPatient(null)}
        title={`Patient Record: ${selectedPatient?.name}`}
        description={`Contact: ${selectedPatient?.phone} • ${selectedPatient?.email || ''}`}
        maxWidth="lg"
        footer={
          <Button variant="outline" size="sm" onClick={() => setSelectedPatient(null)}>
            Close
          </Button>
        }
      >
        <div className="space-y-5 text-xs">
          {/* Appointment History */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Appointment History ({patientAppointments.length})
            </h4>
            {patientAppointments.length === 0 ? (
              <p className="text-slate-400 py-2">No past appointments recorded.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {patientAppointments.map((a) => (
                  <div
                    key={a.id}
                    className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{a.doctorName}</p>
                      <p className="text-[11px] text-slate-500">
                        {a.date} at {a.time} • Token: <strong className="font-mono">{a.tokenNumber}</strong>
                      </p>
                    </div>
                    <StatusBadge status={a.status} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Queue Token History */}
          <div>
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider">
              <Ticket className="w-3.5 h-3.5 text-slate-500" />
              Recent OPD Queue Tokens ({patientTokens.length})
            </h4>
            {patientTokens.length === 0 ? (
              <p className="text-slate-400 py-2">No queue tokens issued.</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {patientTokens.map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-sm mr-2">
                        {t.tokenNumber}
                      </span>
                      <span className="text-slate-600">{t.doctorName}</span>
                      <p className="text-[10px] text-slate-400">
                        {t.isWalkIn ? 'Walk-in arrival' : 'Pre-booked online'}
                      </p>
                    </div>
                    <StatusBadge status={t.status} priority={t.priority} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
