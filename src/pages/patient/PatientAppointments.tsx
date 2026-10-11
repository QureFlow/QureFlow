import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useQueue } from '../../context/QueueContext';
import { Appointment } from '../../types';
import { Navbar } from '../../components/layout/Navbar';
import { MobileNav } from '../../components/layout/MobileNav';
import { Footer } from '../../components/layout/Footer';
import { PageHeader } from '../../components/layout/PageHeader';
import { AppointmentCard } from '../../components/patient/AppointmentCard';
import { EmptyState } from '../../components/common/EmptyState';
import { Modal } from '../../components/common/Modal';
import { Button } from '../../components/common/Button';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, Plus } from 'lucide-react';

export const PatientAppointments: React.FC = () => {
  const { user } = useAuth();
  const { appointments, cancelAppointment } = useQueue();
  const location = useLocation();
  const bookingState = location.state as { justBooked?: boolean; appointmentId?: string } | null;
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const [activeTab, setActiveTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean;
    appointment: Appointment | null;
    reason: string;
  }>({
    isOpen: false,
    appointment: null,
    reason: '',
  });

  // Filter appointments belonging to this patient
  const patientAppointments = useMemo(() => {
    if (!user) return [];
    return appointments.filter((a) => a.patientId === user.id);
  }, [appointments, user]);

  const filteredAppointments = useMemo(() => {
    return patientAppointments.filter((a) => {
      if (activeTab === 'upcoming') {
        return a.status === 'booked' || a.status === 'waiting' || a.status === 'in_consultation';
      }
      if (activeTab === 'completed') {
        return a.status === 'completed';
      }
      if (activeTab === 'cancelled') {
        return a.status === 'cancelled' || a.status === 'no_show';
      }
      return true;
    });
  }, [patientAppointments, activeTab]);

  const handleOpenCancel = (apt: Appointment) => {
    setCancelError('');
    setCancelModal({
      isOpen: true,
      appointment: apt,
      reason: 'Patient requested cancellation',
    });
  };

  const handleConfirmCancel = async () => {
    if (!cancelModal.appointment) return;
    setIsCancelling(true);
    setCancelError('');
    try {
      await cancelAppointment(cancelModal.appointment.id, cancelModal.reason);
      setCancelModal({ isOpen: false, appointment: null, reason: '' });
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : 'Cancellation failed. Please try again.');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col qf-shell pb-16 md:pb-0">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {bookingState?.justBooked &&
          patientAppointments.some(
            (a) =>
              a.id === bookingState.appointmentId &&
              ['booked', 'waiting', 'in_consultation'].includes(a.status),
          ) && (
            <p role="status" className="p-3 mb-4 bg-emerald-50 text-emerald-800 rounded text-sm">
              Appointment confirmed. Your token is allocated for the appointment date.
            </p>
          )}
        <PageHeader
          title="My Appointments"
          subtitle="Review and track your OPD consultations, tokens, and medical visit history."
          actions={
            <Link to="/patient/doctors">
              <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
                Book New Appointment
              </Button>
            </Link>
          }
        />

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'upcoming'
                ? 'border-brand-950 text-brand-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Upcoming (
            {
              patientAppointments.filter(
                (a) =>
                  a.status === 'booked' || a.status === 'waiting' || a.status === 'in_consultation',
              ).length
            }
            )
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'completed'
                ? 'border-brand-950 text-brand-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Completed ({patientAppointments.filter((a) => a.status === 'completed').length})
          </button>

          <button
            onClick={() => setActiveTab('cancelled')}
            className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'cancelled'
                ? 'border-brand-950 text-brand-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Cancelled & No-Show (
            {
              patientAppointments.filter((a) => a.status === 'cancelled' || a.status === 'no_show')
                .length
            }
            )
          </button>
        </div>

        {/* Appointment Cards Grid */}
        {filteredAppointments.length === 0 ? (
          <EmptyState
            icon={<Calendar className="w-8 h-8" />}
            title={`No ${activeTab} appointments`}
            description={
              activeTab === 'upcoming'
                ? 'You do not have any upcoming doctor appointments. You can book an OPD slot anytime.'
                : `No appointments marked as ${activeTab} in your record history.`
            }
            actionLabel={activeTab === 'upcoming' ? 'Find a Doctor' : undefined}
            onAction={
              activeTab === 'upcoming'
                ? () => {
                    window.location.href = '/patient/doctors';
                  }
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredAppointments.map((apt) => (
              <AppointmentCard key={apt.id} appointment={apt} onCancelRequest={handleOpenCancel} />
            ))}
          </div>
        )}

        {/* Cancellation Confirmation Modal */}
        <Modal
          isOpen={cancelModal.isOpen}
          onClose={() => setCancelModal({ ...cancelModal, isOpen: false })}
          title="Cancel Appointment"
          description="Are you sure you want to cancel this OPD consultation?"
          footer={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelModal({ ...cancelModal, isOpen: false })}
              >
                Keep Appointment
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmCancel}
                isLoading={isCancelling}
              >
                Confirm Cancellation
              </Button>
            </>
          }
        >
          <div className="space-y-3 text-xs text-slate-600">
            {cancelError && (
              <p role="alert" className="text-red-700">
                {cancelError}
              </p>
            )}
            <p>
              Cancelling appointment for <strong>{cancelModal.appointment?.doctorName}</strong> on{' '}
              <strong>
                {cancelModal.appointment?.date} at {cancelModal.appointment?.time}
              </strong>
              .
            </p>
            <p className="text-slate-500">
              Your token <strong>{cancelModal.appointment?.tokenNumber}</strong> will be released
              and removed from the active doctor queue.
            </p>
          </div>
        </Modal>
      </main>

      <Footer />
      <MobileNav />
    </div>
  );
};
