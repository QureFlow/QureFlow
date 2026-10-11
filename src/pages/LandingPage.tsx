import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, CalendarDays, Clock3, MapPin, Menu, Search, Stethoscope, Ticket, X } from 'lucide-react';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Footer } from '../components/layout/Footer';
import { useQueue } from '../context/QueueContext';
import { useAuth } from '../context/AuthContext';
import { DoctorCard } from '../components/patient/DoctorCard';
import { specialtyAppearance } from '../lib/specialtyAppearance';
import { specialtyPhotography } from '../lib/specialtyPhotography';

export const LandingPage = () => {
  const { doctors, clinics } = useQueue();
  const { user } = useAuth();
  const [mobile, setMobile] = useState(false);
  const patientPath = user?.role === 'patient' ? '/patient/dashboard' : '/patient/login';
  const staffPath = user && user.role !== 'patient' ? '/admin/dashboard' : '/admin/login';
  const specialties = [...new Set(doctors.map((d) => d.specialization))];
  const featured = [...doctors].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 3);
  const demo = doctors.some((d) => d.metadata?.synthetic === true);

  return (
    <div className="qf-home min-h-screen">
      <div className="qf-utility-bar">
        <div className="qf-container flex items-center gap-4 py-2.5">
          <span className="inline-flex items-center gap-2"><Stethoscope size={14} /> Appointments & connected care</span>
        </div>
      </div>
      <header className="qf-public-header sticky top-0 z-30">
        <div className="qf-container flex h-22 items-center justify-between gap-6">
          <BrandLogo showTagline />
          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-5 xl:gap-8 text-xs xl:text-sm font-medium text-slate-600">
            <a href="#care">Specialties</a>
            <a href="#doctors">Our doctors</a>
            <a href="#how-it-works">Plan your visit</a>
            <a href="#for-clinics">For clinics</a>
          </nav>
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <Link to={staffPath} className="qf-action qf-action-secondary">Staff sign in <ArrowUpRight size={16} /></Link>
            <Link to={patientPath} className="qf-action qf-action-primary">Patient portal <ArrowUpRight size={16} /></Link>
          </div>
          <button aria-label="Toggle navigation menu" aria-expanded={mobile} onClick={() => setMobile(!mobile)} className="lg:hidden p-2 text-brand-900">
            {mobile ? <X /> : <Menu />}
          </button>
        </div>
        {mobile && (
          <nav aria-label="Mobile navigation" className="qf-container lg:hidden border-t border-slate-100 py-5 grid grid-cols-2 gap-5 text-sm font-medium">
            <a href="#care" onClick={() => setMobile(false)}>Specialties</a>
            <a href="#doctors" onClick={() => setMobile(false)}>Our doctors</a>
            <a href="#how-it-works" onClick={() => setMobile(false)}>Plan your visit</a>
            <a href="#for-clinics" onClick={() => setMobile(false)}>For clinics</a>
            <Link to={staffPath} className="qf-action qf-action-secondary">Staff sign in <ArrowUpRight size={16} /></Link>
            <Link to={patientPath} className="qf-action qf-action-primary">Patient portal <ArrowUpRight size={16} /></Link>
          </nav>
        )}
      </header>
      <main>
        <section className="qf-home-hero">
          <div className="qf-container grid lg:grid-cols-[1.15fr_1fr] items-center gap-12 lg:gap-20 py-14 sm:py-20">
            <div className="qf-enter">
              <p className="qf-eyebrow qf-accent-label">Care, with you in mind</p>
              <h1 className="qf-title text-[clamp(2.7rem,4.5vw,4.25rem)] mt-6 text-brand-950">
                Find your doctor.<br /><span className="text-brand-600">Plan your visit.</span>
              </h1>
              <p className="mt-6 text-base sm:text-lg leading-relaxed text-slate-600 max-w-lg">
                Choose a specialist, book an appointment, and follow your queue. Everything you need for your next clinic visit, in one place.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/patient/doctors" className="qf-action qf-action-primary"><Search size={18} /> Find a doctor <ArrowRight size={17} /></Link>
                <a href="#care" className="qf-action qf-action-secondary">Explore specialties</a>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-8 text-xs text-slate-600">
                <span className="inline-flex gap-2 items-center"><CalendarDays size={16} className="text-brand-600" /> Online appointments</span>
                <span className="inline-flex gap-2 items-center"><Clock3 size={16} className="text-brand-600" /> Live queue updates</span>
              </div>
            </div>
            <aside className="qf-visit-card" aria-label="Patient services">
              <div className="qf-visit-card-heading">
                <span className="qf-eyebrow text-brand-200">Patient services</span>
                <h2 className="text-2xl sm:text-3xl font-semibold mt-3 tracking-tight">How can we help you?</h2>
                <p className="text-sm text-brand-100 mt-3">A simpler start to your next visit.</p>
              </div>
              <div className="px-6 sm:px-8">
                {[
                  { to: '/patient/doctors', Icon: Stethoscope, title: 'Book an appointment', text: 'Explore doctors and available slots', tone: 'blue' },
                  { to: '/patient/token', Icon: Ticket, title: 'Track your queue', text: 'Check your token and estimated wait', tone: 'gold' },
                  { to: patientPath, Icon: CalendarDays, title: 'Manage your visits', text: 'View appointments in your patient portal', tone: 'mint' },
                ].map(({ to, Icon, title, text, tone }) => (
                  <Link key={title} to={to} className="qf-service-link group">
                    <span className="qf-specialty-icon" data-tone={tone}><Icon size={23} strokeWidth={1.7} /></span>
                    <span className="flex-1 min-w-0"><strong className="block text-sm font-semibold text-brand-950">{title}</strong><span className="block text-xs text-slate-500 mt-1.5 leading-relaxed">{text}</span></span>
                    <ArrowUpRight size={19} className="text-brand-600 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                ))}
              </div>
              <div className="qf-visit-card-foot"><MapPin size={15} /> Connected to your clinic, wherever you are.</div>
            </aside>
          </div>
        </section>
        <section className="qf-directory-strip" aria-label="Care directory overview">
          <div className="qf-container grid grid-cols-2 md:grid-cols-4 gap-y-6 py-7">
            {[[String(doctors.length), 'Doctors in our directory'], [String(clinics.length), 'Connected care facilities'], [String(specialties.length), 'Medical specialties'], ['Your visit', 'From booking to consultation']].map(([value, label]) => (
              <div key={label} className="qf-directory-stat"><strong className="block text-2xl font-semibold tracking-tight text-brand-900">{value}</strong><span className="block text-xs text-slate-500 mt-1.5">{label}</span></div>
            ))}
          </div>
        </section>
        <section id="care" className="qf-container qf-home-section">
          <div className="qf-section-heading">
            <div><p className="qf-eyebrow">Specialist care</p><h2 className="qf-title text-3xl sm:text-4xl mt-3">Explore our <span className="text-brand-600">specialties</span></h2><p className="text-sm sm:text-base text-slate-500 mt-4">Find the right department for your consultation.</p></div>
            <Link to="/patient/doctors" className="qf-text-link">View all doctors <ArrowRight size={17} /></Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {specialties.map((specialty) => {
              const { description } = specialtyAppearance(specialty);
              const photo = specialtyPhotography(specialty);
              return (
                <Link key={specialty} to={'/patient/doctors?specialty=' + encodeURIComponent(specialty)} className="qf-specialty-card group">
                  <span className="qf-specialty-photo">
                    <img src={photo.src} style={{ objectPosition: photo.position }} alt="" width={768} height={512} loading="lazy" decoding="async" />
                  </span>
                  <span className="qf-specialty-copy">
                    <h3>{specialty}</h3>
                    <p>{description}</p>
                    <span className="qf-specialty-cta">View doctors <ArrowUpRight size={14} aria-hidden="true" /></span>
                  </span>
                </Link>
              );
            })}
          </div>
          {!specialties.length && <p className="qf-panel p-8 text-sm text-slate-500">The care directory will appear when the service is connected.</p>}
          {demo && <p className="qf-demo-note mt-5">Demo directory · Facilities and doctor profiles are fictional.</p>}
        </section>
        <section id="doctors" className="qf-doctors-section">
          <div className="qf-container qf-home-section">
            <div className="qf-section-heading"><div><p className="qf-eyebrow">Meet your care team</p><h2 className="qf-title text-3xl sm:text-4xl mt-3">Your next consultation starts here.</h2></div><Link to="/patient/doctors" className="qf-text-link">Browse the directory <ArrowRight size={17} /></Link></div>
            <div className="grid md:grid-cols-3 gap-6">{featured.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} />)}</div>
            {!doctors.length && <p className="text-sm text-slate-500">Doctor profiles will appear when the service is connected.</p>}
          </div>
        </section>
        <section id="how-it-works" className="qf-container qf-home-section">
          <div className="qf-section-heading"><div><p className="qf-eyebrow">Before you arrive</p><h2 className="qf-title text-3xl sm:text-4xl mt-3">Three steps to your appointment.</h2></div></div>
          <div className="grid md:grid-cols-3 gap-8 sm:gap-12">
            {[
              { Icon: Search, title: 'Choose your doctor', text: 'Browse specialties, clinic locations, languages and consulting hours.' },
              { Icon: CalendarDays, title: 'Reserve your time', text: 'Select an available appointment. Your booking includes a connected queue token.' },
              { Icon: Ticket, title: 'Follow your queue', text: 'Check your position and estimated waiting time, and arrive before your turn.' },
            ].map(({ Icon, title, text }, index) => (
              <article key={title} className="qf-visit-step"><div className="flex justify-between items-center"><Icon size={25} strokeWidth={1.7} className="text-brand-600" /><span className="text-sm font-semibold text-brand-600">0{index + 1}</span></div><h3 className="text-lg font-semibold text-brand-950 mt-6">{title}</h3><p className="text-sm leading-7 text-slate-500 mt-3">{text}</p></article>
            ))}
          </div>
        </section>
        <section id="for-clinics" className="qf-container pb-16 sm:pb-20">
          <div className="qf-clinic-banner flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="max-w-xl"><p className="qf-eyebrow text-brand-200">For clinics & hospitals</p><h2 className="qf-title text-3xl sm:text-4xl mt-3 text-white">A clearer view of your clinic day.</h2><p className="text-sm leading-7 text-brand-100 mt-4">Manage appointments, patient records, consulting schedules and daily queues from your staff workspace.</p></div>
            <Link to={staffPath} className="qf-action qf-action-gold shrink-0">Open staff workspace <ArrowUpRight size={18} /></Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};
