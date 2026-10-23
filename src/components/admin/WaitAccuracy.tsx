export interface MethodScore {
  cases: number;
  maeMinutes: number | null;
  withinFiveMinutes: number | null;
  rangeCoverage?: number | null;
}
export interface WaitAccuracySummary {
  evaluationDays: number;
  methods: Record<string, MethodScore>;
}

const percent = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${Math.round(value * 100)}%`;
const minutes = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)} min`);
const labels: Record<string, string> = {
  formula: 'Fixed average formula',
  learned: 'Learned estimate (current)',
};

/** Replayed accuracy: what each method would have told patients versus their actual wait. */
export const WaitAccuracy = ({ summary }: { summary?: WaitAccuracySummary }) => {
  const rows = Object.entries(summary?.methods || {}).filter(([, s]) => s.cases > 0);
  return (
    <div className="px-5 py-5 border-b border-slate-100">
      <p className="text-xs font-medium text-slate-600">
        Waiting-time accuracy · last {summary?.evaluationDays || 0} days replayed
      </p>
      <p className="text-[11px] text-slate-500 mt-1 mb-4">
        Each day is predicted using only earlier days, then compared with when patients were
        actually called.
      </p>
      {!rows.length ? (
        <p className="text-xs text-slate-500">
          Accuracy appears once a few days of visits are recorded.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-500">
              <tr>
                {['Method', 'Patients', 'Average error', 'Within 5 min', 'Inside shown range'].map(
                  (h) => (
                    <th key={h} className="pr-5 pb-2 font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {rows.map(([name, s]) => (
                <tr key={name}>
                  <td className="pr-5 py-2.5 font-medium text-slate-800">{labels[name] || name}</td>
                  <td className="pr-5 py-2.5">{s.cases}</td>
                  <td className="pr-5 py-2.5">{minutes(s.maeMinutes)}</td>
                  <td className="pr-5 py-2.5">{percent(s.withinFiveMinutes)}</td>
                  <td className="pr-5 py-2.5">
                    {s.rangeCoverage === undefined ? 'No range' : percent(s.rangeCoverage)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
