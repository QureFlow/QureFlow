import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, Info } from 'lucide-react';

export interface FlowDay {
  date: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
}

const dateLabel = (date: string, long = false) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: long ? 'long' : 'short',
    timeZone: 'UTC',
  });
const rate = (day: FlowDay) => (day.total ? (day.completed / day.total) * 100 : null);
const other = (day: FlowDay) => Math.max(0, day.total - day.completed - day.cancelled - day.noShow);
const outcomes = [
  { key: 'completed', label: 'Completed', color: 'bg-brand-600' },
  { key: 'cancelled', label: 'Cancelled', color: 'bg-amber-400' },
  { key: 'noShow', label: 'No-show / skipped', color: 'bg-slate-500' },
  { key: 'other', label: 'Other statuses', color: 'bg-slate-200' },
] as const;

export const FlowInsights = ({ trend, timeZone }: { trend: FlowDay[]; timeZone: string }) => {
  const [period, setPeriod] = useState(14);
  const [metric, setMetric] = useState<'outcomes' | 'completion'>('outcomes');
  const [selectedDate, setSelectedDate] = useState('');
  const days = [...trend].sort((a, b) => a.date.localeCompare(b.date)).slice(-period);
  const selected = days.find((day) => day.date === selectedDate) ?? days[days.length - 1];
  const total = days.reduce((sum, day) => sum + day.total, 0);
  const completed = days.reduce((sum, day) => sum + day.completed, 0);
  const cancelled = days.reduce((sum, day) => sum + day.cancelled, 0);
  const noShow = days.reduce((sum, day) => sum + day.noShow, 0);
  const maximum = metric === 'completion' ? 100 : Math.max(1, ...days.map((day) => day.total));
  const previousDays = days.slice(0, -1);
  const uniformHistory =
    previousDays.length > 2 &&
    previousDays.every(
      (day) =>
        day.total === previousDays[0].total &&
        day.completed === previousDays[0].completed &&
        day.cancelled === previousDays[0].cancelled &&
        day.noShow === previousDays[0].noShow,
    );
  const previous = selected && days[days.findIndex((day) => day.date === selected.date) - 1];
  const change =
    selected && previous && previous.total > 0
      ? ((selected.total - previous.total) / previous.total) * 100
      : null;
  return (
    <section className="qf-panel overflow-hidden" aria-label="Patient flow insights">
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-wrap gap-4 items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-brand-600" /> Patient flow
          </h2>
          <p className="text-xs text-slate-500 mt-1">Recorded visits and outcomes · {timeZone}</p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-1">
          {[7, 14].map((value) => (
            <button
              key={value}
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
              className={`text-xs font-medium rounded-md px-3 py-1.5 ${period === value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              {value} days
            </button>
          ))}
        </div>
      </div>
      {!days.length ? (
        <p className="p-6 text-sm text-slate-500">No daily visit records available.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 px-5 sm:px-6 py-5 border-b border-slate-100">
            {[
              [total.toLocaleString('en-IN'), 'Recorded visits'],
              [total ? `${((completed / total) * 100).toFixed(1)}%` : '—', 'Completion rate'],
              [cancelled.toLocaleString('en-IN'), 'Cancellations'],
              [noShow.toLocaleString('en-IN'), 'No-show / skipped'],
            ].map(([value, label]) => (
              <div key={label}>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-2xl font-semibold tracking-tight text-slate-900 mt-1 tabular-nums">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex gap-4 text-xs">
                {(
                  [
                    ['outcomes', 'Visit outcomes'],
                    ['completion', 'Completion rate'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={metric === value}
                    onClick={() => setMetric(value)}
                    className={`pb-2 border-b-2 font-medium ${metric === value ? 'text-brand-700 border-brand-600' : 'text-slate-500 border-transparent hover:text-slate-900'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">Select a day to inspect its records</p>
            </div>
            <div className="flex gap-2">
              <div
                className="h-40 flex flex-col justify-between text-[10px] text-slate-400 w-7 shrink-0 text-right pr-1 tabular-nums"
                aria-hidden="true"
              >
                {[maximum, maximum / 2, 0].map((value, i) => (
                  <span key={i}>
                    {Math.round(value)}
                    {metric === 'completion' ? '%' : ''}
                  </span>
                ))}
              </div>
              <div
                className="flex-1 min-w-0 grid gap-1 sm:gap-2"
                style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
              >
                {days.map((day) => {
                  const value = metric === 'completion' ? (rate(day) ?? 0) : day.total;
                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDate(day.date)}
                      aria-pressed={selected?.date === day.date}
                      aria-label={`${dateLabel(day.date, true)}: ${day.total} visits, ${day.completed} completed, ${day.cancelled} cancelled, ${day.noShow} no-show or skipped`}
                      title={`${dateLabel(day.date)} · ${day.total} visits · ${rate(day) === null ? 'No visits recorded' : `${rate(day)!.toFixed(1)}% completed`}`}
                      className="group flex flex-col items-center min-w-0 rounded-md"
                    >
                      <div className="w-full h-40 flex items-end justify-center border-b border-slate-200 bg-[repeating-linear-gradient(to_top,transparent_0,transparent_79px,#f1f5f9_79px,#f1f5f9_80px)]">
                        <div
                          className={`w-full max-w-9 flex flex-col-reverse overflow-hidden rounded-t-sm transition-opacity group-hover:opacity-75 ${selected?.date === day.date ? 'ring-2 ring-brand-600 ring-offset-2' : ''}`}
                          style={{
                            height: `${(value / maximum) * 100}%`,
                            minHeight: value ? '2px' : '0px',
                          }}
                        >
                          {metric === 'completion' ? (
                            <div className="h-full bg-brand-600" />
                          ) : (
                            outcomes.map((outcome) => (
                              <div
                                key={outcome.key}
                                className={outcome.color}
                                style={{
                                  height: `${day.total ? ((outcome.key === 'other' ? other(day) : day[outcome.key]) / day.total) * 100 : 0}%`,
                                }}
                              />
                            ))
                          )}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] mt-3 tabular-nums ${selected?.date === day.date ? 'font-semibold text-brand-700' : 'text-slate-500'}`}
                      >
                        {day.date.slice(8)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-3 pl-9">
              <span>{dateLabel(days[0].date)}</span>
              <span>{dateLabel(days[days.length - 1].date)} · Latest day may be incomplete</span>
            </div>
            {metric === 'outcomes' && (
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-600 mt-5">
                {outcomes.map((outcome) => (
                  <span key={outcome.key} className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-sm ${outcome.color}`} />
                    {outcome.label}
                  </span>
                ))}
              </div>
            )}
            {uniformHistory && (
              <p className="mt-4 text-xs text-slate-500 flex gap-2 items-start leading-relaxed">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Historical days have identical
                recorded counts and outcomes. This chart reflects those records; it does not add
                artificial variation.
              </p>
            )}
          </div>
          {selected && (
            <div
              className="bg-slate-50 border-t border-slate-200 p-5 sm:px-6 flex flex-wrap justify-between gap-4"
              aria-live="polite"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {dateLabel(selected.date, true)}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {selected.total} recorded visits · {selected.completed} completed ·{' '}
                  {selected.cancelled} cancelled · {selected.noShow} no-show / skipped ·{' '}
                  {other(selected)} other
                </p>
              </div>
              <div className="text-sm font-semibold text-slate-900 tabular-nums">
                {rate(selected) === null
                  ? 'No visits recorded'
                  : `${rate(selected)!.toFixed(1)}% completed`}
                {change !== null && (
                  <p className="text-[11px] font-normal text-slate-500 mt-1 flex items-center gap-1">
                    {change < 0 ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                    {Math.abs(change).toFixed(1)}%{' '}
                    {change < 0 ? 'fewer' : change > 0 ? 'more' : 'change in'} visits vs previous
                    day
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
