import React from 'react';
import { Link } from 'react-router-dom';

interface BrandLogoProps {
  showTagline?: boolean;
  to?: string;
  isWhite?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  showTagline = false,
  to = '/',
  isWhite = false,
  className = '',
}) => {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 group select-none ${className}`}>
      {/* Restrained queue/cross healthcare glyph */}
      <div
        className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
          isWhite
            ? 'bg-white/10 text-white border border-white/20'
            : 'bg-brand-950 text-white border border-slate-900 shadow-subtle'
        }`}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {/* Subtle queue steps aligned into a healthcare plus/flow mark */}
          <path d="M4 6h16" />
          <path d="M4 12h10" />
          <path d="M4 18h6" />
          <circle cx="18" cy="15" r="3" fill="currentColor" fillOpacity="0.2" />
          <path d="M18 13.5v3" />
          <path d="M16.5 15h3" />
        </svg>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`text-base font-bold tracking-tight ${isWhite ? 'text-white' : 'text-slate-900'}`}>
            QueueLess
          </span>
          <span className={`text-xs font-semibold px-1.5 py-0.2 rounded border ${
            isWhite 
              ? 'bg-white/10 text-slate-200 border-white/20' 
              : 'bg-brand-50 text-brand-800 border-brand-200'
          }`}>
            Rural
          </span>
        </div>
        {showTagline && (
          <span className={`text-[11px] font-medium tracking-tight ${isWhite ? 'text-slate-300' : 'text-slate-500'}`}>
            Smarter queues. Less waiting.
          </span>
        )}
      </div>
    </Link>
  );
};
