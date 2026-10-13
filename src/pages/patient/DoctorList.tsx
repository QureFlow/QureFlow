import React, { useState, useEffect } from 'react';
import { doctorService } from '../../services/doctorService';
import type { Doctor } from '../../types';
import { useSearchParams } from 'react-router-dom';
import { useQueue } from '../../context/QueueContext';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { DoctorCard } from '../../components/patient/DoctorCard';
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import { specialtyAppearance } from '../../lib/specialtyAppearance';

export const DoctorList: React.FC = () => {
  const { doctors, clinics } = useQueue();
  const [params, setParams] = useSearchParams();
  const specialty = params.get('specialty') || 'all';
  const [query, setQuery] = useState('');
  const [clinic, setClinic] = useState('all');
  const [language, setLanguage] = useState('all');
  const [sort, setSort] = useState('name');
  const [today, setToday] = useState(false);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [results, setResults] = useState<Doctor[]>([]);
  const [total, setTotal] = useState(0);
  const [options, setOptions] = useState({
    specialties: [] as string[],
    languages: [] as string[],
    doctorCount: 0,
    clinicCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const specialties = options.specialties,
    languages = options.languages;
  useEffect(() => {
    let cancelled = false;
    doctorService
      .directoryOptions()
      .then((value) => {
        if (!cancelled) setOptions(value);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Directory filters could not load.');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => {
      doctorService
        .searchDoctors({
          query,
          specialization: specialty,
          clinicId: clinic,
          language,
          sort,
          availableTodayOnly: today,
          page,
          pageSize: 9,
        })
        .then((value) => {
          if (!cancelled) {
            setResults(value.doctors);
            setTotal(value.total);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setResults([]);
            setTotal(0);
            setError(err instanceof Error ? err.message : 'Doctor search failed.');
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, specialty, clinic, language, today, sort, page]);
  useEffect(() => {
    setPage(1);
  }, [query, specialty, clinic, language, today, sort]);
  const pages = Math.max(1, Math.ceil(total / 9));
  const field =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 mt-2';
  return (
    <div className="min-h-screen qf-shell pb-16 md:pb-0 flex flex-col">
      <Navbar />
      <main className="max-w-7xl mx-auto w-full px-5 sm:px-8 py-10 flex-1 qf-enter">
        <div className="qf-directory-heading p-7 sm:p-10 mb-8 flex flex-wrap justify-between items-end gap-6">
          <div>
            <p className="qf-eyebrow mb-3">Find your next consultation</p>
            <h1 className="qf-title text-4xl sm:text-5xl font-semibold text-brand-950">
              Find your doctor.
            </h1>
            <p className="text-brand-800 mt-4 max-w-xl">
              Browse specialists, compare consulting hours, and plan your next visit.
            </p>
          </div>
          <div className="flex gap-8 text-brand-950">
            <div>
              <strong className="block text-3xl">{options.doctorCount}</strong>
              <span className="text-xs">doctors</span>
            </div>
            <div>
              <strong className="block text-3xl">{options.clinicCount}</strong>
              <span className="text-xs">care locations</span>
            </div>
            <ArrowUpRight className="hidden sm:block" size={34} />
          </div>
        </div>
        <label className="qf-panel flex items-center gap-4 p-4 mb-7">
          <Search className="text-brand-600" size={22} />
          <input
            aria-label="Search doctors"
            placeholder="Doctor, specialty, clinic or care interest…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent outline-none flex-1 min-w-0 text-base"
          />
          <span className="hidden sm:block rounded-full bg-brand-50 text-brand-700 px-3 py-1 text-xs">
            {total} matches
          </span>
        </label>
        <div className="flex lg:flex-wrap gap-2 mb-6 overflow-x-auto pb-2 max-w-full [&>button]:shrink-0 [&>button]:whitespace-nowrap">
          <button
            onClick={() => setParams({})}
            className={`rounded-full px-4 py-2 text-xs font-medium ${specialty === 'all' ? 'bg-brand-950 text-white' : 'bg-white border text-slate-600'}`}
          >
            All specialties
          </button>
          {specialties.map((s) => (
            <button
              key={s}
              data-tone={specialtyAppearance(s).tone}
              onClick={() => setParams({ specialty: s })}
              className={`qf-specialty-filter rounded-lg px-4 py-2.5 text-xs font-medium ${specialty === s ? 'bg-brand-900 text-white border-brand-900' : 'hover:border-brand-400'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          aria-expanded={filtersOpen}
          aria-controls="doctor-filters"
          onClick={() => setFiltersOpen((open) => !open)}
          className="lg:hidden flex items-center gap-2 rounded-full bg-white border border-slate-200 px-4 py-2.5 text-sm font-semibold mb-5"
        >
          <SlidersHorizontal size={17} />
          {filtersOpen ? 'Hide filters' : 'Filters & sorting'}
        </button>
        <div className="grid lg:grid-cols-[220px_1fr] gap-7 items-start">
          <aside
            id="doctor-filters"
            className={`qf-panel p-5 lg:sticky lg:top-24 ${filtersOpen ? 'block' : 'hidden lg:block'}`}
          >
            <p className="font-semibold flex items-center gap-2 text-sm mb-5">
              <SlidersHorizontal size={17} />
              Refine your search
            </p>
            <div className="grid sm:grid-cols-3 lg:grid-cols-1 gap-5">
              <label className="text-xs font-semibold text-slate-500">
                Care location
                <select
                  aria-label="Filter by clinic"
                  value={clinic}
                  onChange={(e) => setClinic(e.target.value)}
                  className={field}
                >
                  <option value="all">All clinics</option>
                  {clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Language
                <select
                  aria-label="Filter by language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className={field}
                >
                  <option value="all">All languages</option>
                  {languages.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Sort results
                <select
                  aria-label="Sort doctors"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className={field}
                >
                  <option value="name">Doctor name</option>
                  <option value="experience">Most experienced</option>
                  <option value="fee">Lowest fee first</option>
                </select>
              </label>
            </div>
            <label className="flex items-center gap-3 text-sm mt-6">
              <input
                type="checkbox"
                checked={today}
                onChange={(e) => setToday(e.target.checked)}
                className="accent-brand-600"
              />
              Consulting today
            </label>
            <button
              onClick={() => {
                setParams({});
                setClinic('all');
                setLanguage('all');
                setSort('name');
                setToday(false);
                setQuery('');
              }}
              className="text-xs text-brand-700 underline mt-5"
            >
              Reset filters
            </button>
            <button
              onClick={() => setFiltersOpen(false)}
              className="block lg:hidden mt-5 bg-brand-600 text-white rounded-full w-full py-3 text-sm font-semibold"
            >
              Show {total} doctors
            </button>
            <p className="text-xs text-slate-400 leading-relaxed mt-6">
              Availability and fees come from the clinic directory. Open a profile to see
              appointment slots.
            </p>
          </aside>
          <section aria-busy={loading}>
            {error && (
              <p role="alert" className="qf-panel border-red-200 p-4 mb-4 text-sm text-red-800">
                {error}
              </p>
            )}
            {loading && (
              <p role="status" className="text-sm text-slate-500 mb-4">
                Searching the directory…
              </p>
            )}
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-slate-800">{total} doctors available to explore</h2>
              <span className="text-xs text-slate-500">
                Page {page} / {pages}
              </span>
            </div>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {!loading && results.map((d) => <DoctorCard key={d.id} doctor={d} />)}
            </div>
            {!loading && !error && !total && (
              <div className="qf-panel p-12 text-center text-slate-500">
                No doctors match these filters. Try another specialty or location.
              </div>
            )}
            <div className="flex items-center justify-center gap-4 mt-8">
              <button
                disabled={loading || page <= 1}
                aria-label="Previous doctor page"
                onClick={() => setPage((p) => p - 1)}
                className="p-3 rounded-full border bg-white disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm text-slate-500">
                {page} of {pages}
              </span>
              <button
                disabled={loading || page >= pages}
                aria-label="Next doctor page"
                onClick={() => setPage((p) => p + 1)}
                className="p-3 rounded-full border bg-white disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>
        </div>
        {doctors.some((d) => d.metadata?.synthetic) && (
          <p className="text-xs text-slate-500 mt-8">
            Demo care directory · Doctor profiles and locations are fictional testing data.
          </p>
        )}
      </main>
      <Footer />
      <MobileNav />
    </div>
  );
};
