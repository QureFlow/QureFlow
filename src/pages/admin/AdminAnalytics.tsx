import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, Database, RefreshCw, ShieldCheck, Menu, Users } from 'lucide-react';
import { Sidebar } from '../../components/layout/Sidebar';
import { PageHeader } from '../../components/layout/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { Button } from '../../components/common/Button';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { FlowInsights } from '../../components/admin/FlowInsights';
import { ModelErrorComparison } from '../../components/admin/ModelErrorComparison';
import { WaitAccuracy, type WaitAccuracySummary } from '../../components/admin/WaitAccuracy';
import { useQueue } from '../../context/QueueContext';
import { Select } from '../../components/common/Select';
interface Analytics {
  generatedAt: string;
  windowDays: number;
  timeZone: string;
  syntheticData: boolean;
  summary: {
    waiting: number;
    inConsultation: number;
    completedToday: number;
    consultationsObserved: number;
    averageConsultationMinutes: number | null;
    cancellationCount: number;
    noShowCount: number;
  };
  trend: { date: string; total: number; completed: number; cancelled: number; noShow: number }[];
  waitAccuracy?: WaitAccuracySummary;
  doctors: {
    id: string;
    name: string;
    specialization: string;
    waiting: number;
    model: {
      method: string;
      sampleCount: number;
      trainingCount: number;
      validationCount: number;
      baselineMae: number | null;
      modelMae: number | null;
      syntheticSamples: number;
    };
  }[];
  audit: {
    id: string;
    timestamp: string;
    actorId: string;
    entityType: string;
    action: string;
    entityId: string;
    requestId: string;
    details: Record<string, unknown>;
  }[];
}
const methodLabels: Record<string, string> = {
  configured: 'Configured average',
  doctor_history: 'Recent typical duration',
  hierarchical_lognormal: 'Learned duration',
};
export const AdminAnalytics = () => {
  const { user } = useAuth();
  const { clinics } = useQueue();
  const [selectedClinicId, setSelectedClinicId] = useState(user?.clinicId || '');
  const clinicQuery = user?.demoAllClinics
    ? '?clinicId=' + encodeURIComponent(selectedClinicId)
    : '';
  const loadVersion = useRef(0);
  const [data, setData] = useState<Analytics | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(false);
  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    setData(null);
    setError('');
    try {
      const result = await apiClient.get<Analytics>('/analytics' + clinicQuery);
      if (loadVersion.current === version) setData(result);
    } catch (err) {
      if (loadVersion.current === version)
        setError(err instanceof Error ? err.message : 'Analytics could not be loaded.');
    } finally {
      if (loadVersion.current === version) setLoading(false);
    }
  }, [clinicQuery]);
  useEffect(() => {
    load();
    return () => {
      loadVersion.current++;
    };
  }, [load]);
  const refresh = async () => {
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/analytics/models/refresh' + clinicQuery);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model refresh failed.');
    } finally {
      setLoading(false);
    }
  };
  const minutes = (n: number | null) => (n === null ? '—' : `${n.toFixed(1)} min`);
  return (
    <div className="min-h-screen qf-shell lg:flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 lg:pl-64 min-w-0">
        <header className="qf-workspace-bar h-20 bg-white border-b border-slate-200 px-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              aria-label="Open sidebar"
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-sm text-slate-800">Clinic Operations</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            isLoading={loading}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Refresh
          </Button>
        </header>
        <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          <PageHeader
            title="Operations & Insights"
            subtitle="Consultation trends, model validation, and a traceable record of clinic activity."
          />
          {user?.demoAllClinics && (
            <Select
              label="Clinic insights"
              value={selectedClinicId}
              onChange={(event) => setSelectedClinicId(event.target.value)}
              options={clinics.map((clinic) => ({ value: clinic.id, label: clinic.name }))}
            />
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 text-red-800 p-4 text-sm"
            >
              {error}
            </p>
          )}
          {loading && !data && (
            <p role="status" className="text-sm text-slate-500">
              Loading clinic records…
            </p>
          )}
          {data && (
            <>
              {data.syntheticData && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 text-blue-900 px-4 py-3 text-xs">
                  <strong>Synthetic demonstration data.</strong> These model results demonstrate
                  functionality; they do not measure performance in a real clinic.
                </div>
              )}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard
                  label="Patients waiting"
                  value={data.summary.waiting}
                  icon={<Users className="w-5 h-5" />}
                />
                <StatCard
                  label="Completed today"
                  value={data.summary.completedToday}
                  icon={<ShieldCheck className="w-5 h-5" />}
                />
                <StatCard
                  label="Avg. consultation"
                  value={minutes(data.summary.averageConsultationMinutes)}
                  icon={<Clock className="w-5 h-5" />}
                />
                <StatCard
                  label="Observed consultations"
                  value={data.summary.consultationsObserved}
                  subtext={`Previous ${data.windowDays} days`}
                  icon={<Database className="w-5 h-5" />}
                />
              </div>
              <FlowInsights trend={data.trend} timeZone={data.timeZone} />
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-subtle">
                <div className="p-5 flex flex-wrap gap-4 justify-between items-center">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Wait-time learning</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Models predict consultation duration. They learn from timing data and do not
                      make clinical decisions.
                    </p>
                  </div>
                  {user?.role === 'admin' && (
                    <Button size="sm" variant="outline" onClick={refresh} isLoading={loading}>
                      Retrain models
                    </Button>
                  )}
                </div>
                <WaitAccuracy summary={data.waitAccuracy} />
                <ModelErrorComparison doctors={data.doctors} />
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {[
                          'Doctor',
                          'Method',
                          'Samples',
                          'Validation cases',
                          'Baseline error',
                          'Model error',
                        ].map((h) => (
                          <th key={h} className="px-5 py-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.doctors.map((d) => (
                        <tr key={d.id}>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-slate-900">{d.name}</p>
                            <p className="text-slate-500 mt-1">{d.specialization}</p>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${d.model.method === 'configured' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}
                            >
                              {methodLabels[d.model.method] || d.model.method}
                            </span>
                          </td>
                          <td className="px-5 py-4">{d.model.sampleCount}</td>
                          <td className="px-5 py-4">{d.model.validationCount}</td>
                          <td className="px-5 py-4">{minutes(d.model.baselineMae)}</td>
                          <td className="px-5 py-4">{minutes(d.model.modelMae)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-5 py-4 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                  Each doctor's most recent 20% of consultations are held out. The configured
                  average, the doctor's recent typical duration and the learned model are compared
                  there, and a method is used only if it is more accurate than the simpler ones.
                  Doctors with little history borrow from the clinic-wide model; recent weeks count
                  more than older ones. Estimates can change with late arrivals, pauses and
                  emergencies.
                </p>
              </section>
              <section className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-subtle">
                <div className="p-5 border-b border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900">Recent activity</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Clinic-scoped audit history • Patient contact details and passwords are
                    excluded.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['Time', 'Operation', 'Actor', 'Reference'].map((h) => (
                          <th key={h} className="px-5 py-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.audit.map((e) => (
                        <tr key={e.id}>
                          <td className="px-5 py-3 whitespace-nowrap">
                            {new Date(e.timestamp).toLocaleString('en-IN', {
                              timeZone: 'Asia/Kolkata',
                            })}
                          </td>
                          <td className="px-5 py-3">
                            <span className="font-semibold">{e.entityType.replace('_', ' ')}</span>{' '}
                            · {e.action.replace('_', ' ')}
                          </td>
                          <td className="px-5 py-3 font-mono text-[10px]">{e.actorId}</td>
                          <td
                            className="px-5 py-3 font-mono text-[10px] max-w-xs truncate"
                            title={e.entityId}
                          >
                            {e.entityId}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!data.audit.length && (
                    <p className="p-6 text-sm text-slate-500">No recorded activity yet.</p>
                  )}
                </div>
              </section>
              <p className="text-[11px] text-slate-500">
                Updated{' '}
                {new Date(data.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} •{' '}
                {data.windowDays}-day observation window
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
