import React from 'react';
import { Link } from 'react-router-dom';

interface BrandLogoProps {
  showTagline?: boolean;
  to?: string;
  isWhite?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  showTagline = false,
  to = '/',
  isWhite = false,
  className = '',
  size = 'md',
}) => {
  const sizeMap = {
    sm: { img: 'h-7 w-7', text: 'text-sm', tagline: 'text-[10px]' },
    md: { img: 'h-9 w-9', text: 'text-base', tagline: 'text-[11px]' },
    lg: { img: 'h-12 w-12', text: 'text-xl', tagline: 'text-xs' },
  };

  const s = sizeMap[size];

  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      <img
        src="/logo.png"
        alt="Qureflow logo"
        className={`${s.img} object-contain rounded-full transition-transform duration-200 group-hover:scale-105 ${isWhite ? 'brightness-110' : ''}`}
      />
      <div className="flex flex-col">
        <span className={`${s.text} font-bold tracking-tight leading-none ${isWhite ? 'text-white' : 'text-slate-900'}`}>
          Qureflow
        </span>
        {showTagline && (
          <span className={`${s.tagline} font-medium tracking-tight mt-0.5 ${isWhite ? 'text-slate-300' : 'text-slate-500'}`}>
            Cloud-Based Medical Queue System
          </span>
        )}
      </div>
    </Link>
  );
};
