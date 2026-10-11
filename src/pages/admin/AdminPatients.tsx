import React, { useEffect, useMemo, useState } from 'react';
import { useQueue } from '../../context/QueueContext';
import { Sidebar } from '../../components/layout/Sidebar';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { patientService } from '../../services/patientService';
import { User } from '../../types';
import {
  Menu,
  Search,
  Users,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
} from 'lucide-react';

export const AdminPatients: React.FC = () => {
  const { appointments } = useQueue();
  const [sidebar, setSidebar] = useState(false);
  const [patients, setPatients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<User | null>(null);
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setPatients(
        (await patientService.getPatients()).sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Patient records could not be loaded.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const visits = useMemo(() => {
    const result = new Map<string, typeof appointments>();
    for (const visit of appointments)
      result.set(visit.patientId, [...(result.get(visit.patientId) || []), visit]);
    for (const history of result.values())
      history.sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    return result;
  }, [appointments]);
  const filtered = patients.filter((p) =>
    [p.name, p.email, p.phone, String(p.metadata?.mrn || '')]
      .join(' ')
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const shown = filtered.slice((page - 1) * 12, page * 12);
  const history = selected ? visits.get(selected.id) || [] : [];
  return (
    <div className="min-h-screen qf-shell">
      <Sidebar isOpen={sidebar} onClose={() => setSidebar(false)} />
      <div className="lg:pl-64">
        <header className="qf-workspace-bar h-20 bg-white/90 border-b border-slate-200 flex items-center gap-4 px-6 lg:px-10">
          <button aria-label="Open sidebar" onClick={() => setSidebar(true)} className="lg:hidden">
            <Menu />
          </button>
          <span className="text-sm font-semibold text-slate-600">
            Clinic workspace <span className="mx-3 text-slate-300">/</span> Patient records
          </span>
        </header>
        <main className="max-w-7xl mx-auto p-5 lg:p-10 space-y-7 qf-enter">
          <div className="flex flex-wrap justify-between gap-5 items-end">
            <div>
              <p className="qf-eyebrow mb-3">People, not just numbers</p>
              <h1 className="qf-title text-4xl font-semibold text-slate-900">
                Your patient directory.
              </h1>
              <p className="mt-3 text-slate-500">
                Registered profiles and appointment history for this clinic.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-brand-100 px-5 py-4">
              <Users className="text-brand-700" />
              <span>
                <strong className="block text-2xl text-brand-950">
                  {loading ? '…' : patients.length}
                </strong>
                <span className="text-xs text-brand-800">patient profiles</span>
              </span>
            </div>
          </div>
          <div className="qf-panel overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-wrap gap-4 items-center justify-between">
              <label className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 w-full sm:w-96">
                <Search size={18} className="text-slate-400" />
                <input
                  aria-label="Search patients"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search name, phone, email or record ID"
                  className="bg-transparent w-full outline-none text-sm"
                />
              </label>
              <span className="text-xs text-slate-500">{filtered.length} matching records</span>
            </div>
            {error ? (
              <div role="alert" className="p-6 text-red-700">
                {error}{' '}
                <button onClick={() => void load()} className="underline ml-3">
                  Retry
                </button>
              </div>
            ) : loading ? (
              <p className="p-10 text-slate-500">Loading clinic records…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/70 text-[11px] uppercase tracking-widest text-slate-500">
                    <tr>
                      {[
                        'Patient',
                        'Contact',
                        'Record ID',
                        'Appointments',
                        'Latest appointment',
                        '',
                      ].map((label, i) => (
                        <th key={i} className="px-5 py-4 font-semibold">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shown.map((p, i) => {
                      const record = visits.get(p.id) || [];
                      return (
                        <tr key={p.id} className="hover:bg-brand-50/50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-semibold ${i % 2 ? 'bg-orange-50 text-orange-800' : 'bg-brand-100 text-brand-800'}`}
                              >
                                {p.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                              <div className="min-w-36">
                                <p className="font-semibold text-slate-800">{p.name}</p>
                                <p className="text-xs text-slate-500 mt-1">
                                  {p.gender || 'Not specified'} ·{' '}
                                  {String(p.metadata?.preferredLanguage || 'Language not set')}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p>{p.phone || 'Not provided'}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {p.email || 'Not provided'}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-xs font-mono text-slate-500">
                            {String(p.metadata?.mrn || p.id)}
                          </td>
                          <td className="px-5 py-4 font-semibold">{record.length}</td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {record[0]?.date || 'No appointments'}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => setSelected(p)}
                              aria-label={`View ${p.name}`}
                              className="rounded-full p-2 bg-brand-50 text-brand-700 hover:bg-brand-100"
                            >
                              <ArrowUpRight size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!shown.length && (
                  <p className="p-10 text-center text-slate-500">
                    No patient records match this search.
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Page {page} of {pages}
              </span>
              <div className="flex gap-2">
                <button
                  aria-label="Previous patient page"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-2 rounded-full border disabled:opacity-30"
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  aria-label="Next patient page"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-2 rounded-full border disabled:opacity-30"
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </div>
          {patients.some((p) => p.metadata?.synthetic) && (
            <p className="text-xs text-slate-500">
              Demo directory · Synthetic profiles and visits for testing. These records do not
              represent real patients.
            </p>
          )}
        </main>
      </div>
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Patient record">
        {selected && (
          <div className="space-y-5">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{selected.name}</h2>
              <p className="text-xs font-mono text-slate-500 mt-2">
                {String(selected.metadata?.mrn || selected.id)}
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <p className="flex gap-2 items-center">
                <Phone size={16} />
                {selected.phone || 'Not provided'}
              </p>
              <p className="flex gap-2 items-center break-all">
                <Mail size={16} />
                {selected.email || 'Not provided'}
              </p>
              <p>Date of birth: {selected.dob || 'Not provided'}</p>
              <p>Gender: {selected.gender || 'Not specified'}</p>
              <p>Language: {String(selected.metadata?.preferredLanguage || 'Not provided')}</p>
              <p>
                Source:{' '}
                {String(
                  selected.metadata?.registrationSource ||
                    selected.metadata?.source ||
                    'Registered profile',
                )}
              </p>
            </div>
            <h3 className="font-semibold pt-3">
              Appointment history · {history.length} appointments
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {history.map((a) => (
                <div key={a.id} className="p-3 rounded-xl bg-slate-50 flex justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{a.doctorName}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {a.date} · {a.time} · {a.tokenNumber}
                    </p>
                  </div>
                  <StatusBadge status={a.status} size="sm" />
                </div>
              ))}
              {!history.length && (
                <p className="text-sm text-slate-500">No appointments at this clinic.</p>
              )}
            </div>
            {selected.metadata?.synthetic === true && (
              <p className="text-xs text-amber-800 bg-amber-50 p-3 rounded-xl">
                Synthetic demonstration record.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
