import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  trend?: {
    text: string;
    isPositive?: boolean;
  };
  highlight?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon,
  trend,
  highlight = false,
}) => {
  return (
    <div
      className={`rounded-xl p-5 sm:p-6 border transition-all ${
        highlight ? 'bg-brand-50/50 border-brand-200' : 'bg-white border-slate-200 shadow-subtle'
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <div
          className={`p-2 rounded-md ${highlight ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-600'}`}
        >
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl sm:text-4xl font-semibold tracking-tight text-brand-950">{value}</p>
        {trend && (
          <span
            className={`text-xs font-medium ${
              trend.isPositive ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {trend.text}
          </span>
        )}
      </div>
      {subtext && <p className="mt-1 text-xs text-slate-500">{subtext}</p>}
    </div>
  );
};
