import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'navy';
  size?: 'sm' | 'md';
  className?: string;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
  icon,
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 font-medium tracking-tight gap-1',
    md: 'text-xs px-2.5 py-1 font-medium gap-1.5',
  };

  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    amber: 'bg-amber-50 text-amber-800 border border-amber-200',
    red: 'bg-red-50 text-red-700 border border-red-200',
    navy: 'bg-slate-900 text-white border border-slate-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md font-medium select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {icon}
      {children}
    </span>
  );
};
