import React from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from './BrandLogo';
import { ArrowUpRight, CalendarDays, Ticket, HeartPulse } from 'lucide-react';

export const AuthShell: React.FC<{ children: React.ReactNode; kind: 'patient' | 'staff' }> = ({
  children,
  kind,
}) => (
  <div className="min-h-screen qf-auth grid lg:grid-cols-2">
    <aside className="qf-auth-aside hidden lg:flex text-white p-14 xl:p-20 flex-col justify-between">
      <BrandLogo isWhite showTagline />
      <div className="my-12">
        <p className="text-brand-200 text-xs uppercase tracking-[.16em] mb-6">
          {kind === 'staff' ? 'The clinic workspace' : 'The patient portal'}
        </p>
        <h1 className="qf-title text-white text-4xl xl:text-5xl font-semibold max-w-lg">
          {kind === 'staff'
            ? 'Your clinic day, clearly organised.'
            : 'Your next visit starts here.'}
        </h1>
        <p className="text-brand-100 text-base leading-relaxed max-w-sm mt-7">
          {kind === 'staff'
            ? 'One place for your care team, appointments, patient records and daily queues.'
            : 'Find your doctor, plan your visit and follow your queue from wherever you are.'}
        </p>
        <div className="mt-10 space-y-4">
          {[
            {
              Icon: CalendarDays,
              title: kind === 'staff' ? 'Plan the day' : 'Book with clarity',
              description: 'Appointments and consulting schedules',
            },
            {
              Icon: Ticket,
              title: kind === 'staff' ? 'Keep care moving' : 'Know your place',
              description: 'Current queue and waiting estimates',
            },
            {
              Icon: HeartPulse,
              title: kind === 'staff' ? 'Bring your team together' : 'Arrive ready',
              description:
                kind === 'staff'
                  ? 'Clinic and role scoped workspaces'
                  : 'Doctor profiles and visit details',
            },
          ].map(({ Icon, title, description }) => (
            <div key={title} className="flex items-center gap-4">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-[#edc46e]">
                <Icon size={21} />
              </div>
              <div>
                <h2 className="font-medium text-sm">{title}</h2>
                <p className="text-xs text-brand-200 mt-1">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Link to="/" className="flex gap-2 text-slate-300 text-sm items-center">
        Back to QureFlow
        <ArrowUpRight size={17} />
      </Link>
    </aside>
    <main className="flex flex-col justify-center py-12 px-4 sm:px-10 lg:px-14">{children}</main>
  </div>
);
