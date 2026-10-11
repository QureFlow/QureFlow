import { Link } from 'react-router-dom';
import { HeartPulse } from 'lucide-react';
interface Props {
  showTagline?: boolean;
  to?: string;
  isWhite?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}
export const BrandLogo = ({
  showTagline = false,
  to = '/',
  isWhite = false,
  className = '',
  size = 'md',
}: Props) => (
  <Link
    to={to}
    aria-label="QureFlow home"
    className={`inline-flex items-center gap-3 shrink-0 ${className}`}
  >
    <span
      className={`flex items-center justify-center rounded-xl ${size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'} ${isWhite ? 'bg-white/10 text-white border border-white/20' : 'bg-brand-600 text-white'}`}
    >
      <HeartPulse className="w-5 h-5" strokeWidth={2} />
    </span>
    <span>
      <span
        className={`block font-bold tracking-[-.035em] ${size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-xl' : 'text-2xl'} ${isWhite ? 'text-white' : 'text-brand-950'}`}
      >
        QureFlow
      </span>
      {showTagline && (
        <span
          className={`block text-[10px] tracking-wide mt-0.5 ${isWhite ? 'text-brand-200' : 'text-slate-500'}`}
        >
          A better flow of care
        </span>
      )}
    </span>
  </Link>
);
