import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { QueueToken, Appointment, Doctor, Clinic, QueueSettings, QueuePriority } from '../types';
import { queueService } from '../services/queueService';
import { appointmentService } from '../services/appointmentService';
import { doctorService } from '../services/doctorService';
import { clinicService } from '../services/clinicService';
import { useAuth } from './AuthContext';
import { announceClinic, prepareClinicAudio, stopClinicAnnouncements } from '../lib/clinicAnnouncements';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

interface QueueContextType {
  tokens: QueueToken[];
  appointments: Appointment[];
  doctors: Doctor[];
  clinics: Clinic[];
  settings: QueueSettings;
  pausedDoctors: string[];
  toasts: ToastMessage[];
  showToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  removeToast: (id: string) => void;
  refreshState: () => void;
  callNextPatient: (doctorId: string) => Promise<QueueToken | null>;
  testAnnouncement: () => void;
  repeatAnnouncement: (token: QueueToken) => void;
  announcementError: string | null;
  markServed: (tokenId: string) => Promise<void>;
  skipToken: (tokenId: string) => Promise<void>;
  cancelToken: (tokenId: string) => Promise<void>;
  toggleQueuePause: (doctorId: string) => Promise<boolean>;
  addWalkIn: (data: {
    patientName: string;
    patientPhone: string;
    doctorId: string;
    time?: string;
    priority?: QueuePriority;
  }) => Promise<QueueToken>;
  bookAppointment: (data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorId: string;
    date: string;
    time: string;
    notes?: string;
  }) => Promise<{ appointment: Appointment; token: QueueToken }>;
  cancelAppointment: (id: string, reason?: string) => Promise<void>;
  connectionError: string | null;
  lastSyncedAt: string | null;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [settings, setSettings] = useState<QueueSettings>({
    averageConsultationMinutes: 10,
    bufferMinutes: 2,
    allowWalkIns: true,
    allowEmergencyPriority: true,
    notifyOnTwoAhead: false,
    autoTokenPrefixByDoctor: true,
    clinicName: '',
    contactNumber: '',
  });
  const [pausedDoctors, setPausedDoctors] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  useEffect(() => {
    setAnnouncementError(null);
    return stopClinicAnnouncements;
  }, [user?.id]);
  const currentUserRef = useRef(user?.id);
  currentUserRef.current = user?.id;

  const isSyncingRef = useRef<string | null>(null);

  // Safe background remote sync without event cascade loops
  const syncRemoteData = useCallback(async () => {
    const sessionKey = user?.id || 'public';
    if (isLoading || isSyncingRef.current === sessionKey) return;
    isSyncingRef.current = sessionKey;
    const sessionId = user?.id;

    try {
      const [aptsRes, docsRes, clinicsRes, settingsRes, queuesRes] = await Promise.allSettled([
        user ? appointmentService.getAppointments() : Promise.resolve([]),
        doctorService.getDoctors(),
        clinicService.getClinics(),
        user ? clinicService.getSettings() : Promise.resolve(null),
        user ? queueService.getAllDoctorQueues() : Promise.resolve([]),
      ]);
      if (currentUserRef.current !== sessionId) return;
      const failures = [aptsRes, docsRes, clinicsRes, settingsRes, queuesRes].filter(
        (r) => r.status === 'rejected',
      );
      setConnectionError(
        failures.length
          ? 'Some records could not be refreshed. Displayed data may be out of date.'
          : null,
      );
      if (!failures.length) setLastSyncedAt(new Date().toISOString());

      if (aptsRes.status === 'fulfilled' && Array.isArray(aptsRes.value)) {
        setAppointments(aptsRes.value);
      }
      if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)) {
        setDoctors(
          user && user.role !== 'patient'
            ? docsRes.value.filter(
                (d) =>
                  d.clinicId === user.clinicId &&
                  (user.role !== 'doctor' || d.id === user.doctorId),
              )
            : docsRes.value,
        );
      }
      if (clinicsRes.status === 'fulfilled' && Array.isArray(clinicsRes.value)) {
        setClinics(
          user && user.role !== 'patient'
            ? clinicsRes.value.filter((c) => c.id === user.clinicId)
            : clinicsRes.value,
        );
      }
      if (settingsRes.status === 'fulfilled' && settingsRes.value) {
        setSettings(settingsRes.value);
      }
      if (queuesRes.status === 'fulfilled' && Array.isArray(queuesRes.value)) {
        const liveTokens = queuesRes.value.flatMap((q) => q.tokens || []);
        setTokens(liveTokens);
        setPausedDoctors(queuesRes.value.filter((q) => q.isPaused).map((q) => q.doctorId));
      }
    } catch (err) {
      console.warn('[QueueContext] Remote sync error:', err);
    } finally {
      if (isSyncingRef.current === sessionKey) isSyncingRef.current = null;
    }
  }, [user?.id, isLoading]);

  const refreshState = useCallback(() => {
    syncRemoteData();
  }, [syncRemoteData]);

  useEffect(() => {
    setTokens([]);
    setAppointments([]);
    setPausedDoctors([]);
    setDoctors([]);
    setClinics([]);
    setLastSyncedAt(null);
    setConnectionError(null);
    syncRemoteData();

    // Requests already in flight for this session are coalesced.
    const handleSync = () => {
      syncRemoteData();
    };

    window.addEventListener('queless-state-change', handleSync);
    window.addEventListener('storage', handleSync);

    // Periodic gentle refresh every 15s to keep queues and tokens updated
    const interval = setInterval(() => {
      syncRemoteData();
    }, 15000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('queless-state-change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [syncRemoteData]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const repeatAnnouncement = (token: QueueToken) => {
    prepareClinicAudio();
    setAnnouncementError(null);
    const room = doctors.find((doctor) => doctor.id === token.doctorId)?.roomNumber;
    const spokenToken = token.tokenNumber.replace(/-/g, ' ').replace(/\d/g, '$& ');
    announceClinic(
      `Token ${spokenToken}, please proceed to ${room ? `room ${room}` : 'the consultation room'} for ${token.doctorName}.`,
      setAnnouncementError,
    );
  };

  const testAnnouncement = () => {
    prepareClinicAudio();
    setAnnouncementError(null);
    announceClinic('QureFlow voice announcements are ready. Please proceed when your token is called.', setAnnouncementError);
  };

  const callNextPatient = async (doctorId: string) => {
    prepareClinicAudio();
    try {
      const token = await queueService.callNextPatient(doctorId);
      refreshState();
      if (token) {
        repeatAnnouncement(token);
        showToast(`Token ${token.tokenNumber} called for consultation`, 'success');
      } else {
        showToast('No more waiting patients in this queue', 'info');
      }
      return token;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error calling next patient';
      showToast(msg, 'error');
      return null;
    }
  };

  const markServed = async (tokenId: string) => {
    try {
      await queueService.markPatientServed(tokenId);
      refreshState();
      showToast('Patient marked as successfully served', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      showToast(msg, 'error');
    }
  };

  const skipToken = async (tokenId: string) => {
    try {
      await queueService.skipPatient(tokenId);
      refreshState();
      showToast('Patient marked as skipped / no-show', 'warning');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error skipping patient';
      showToast(msg, 'error');
    }
  };

  const cancelToken = async (tokenId: string) => {
    try {
      await queueService.cancelToken(tokenId);
      refreshState();
      showToast('Token was cancelled', 'warning');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error cancelling token';
      showToast(msg, 'error');
    }
  };

  const toggleQueuePause = async (doctorId: string) => {
    const isPaused = pausedDoctors.includes(doctorId);
    try {
      if (isPaused) {
        await queueService.resumeQueue(doctorId);
        showToast('Queue resumed', 'info');
      } else {
        await queueService.pauseQueue(doctorId);
        showToast('Queue temporarily paused', 'warning');
      }
      refreshState();
      return !isPaused;
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'The queue state could not be changed.',
        'error',
      );
      return isPaused;
    }
  };

  const addWalkIn = async (data: {
    patientName: string;
    patientPhone: string;
    doctorId: string;
    time?: string;
    priority?: QueuePriority;
  }) => {
    try {
      const token = await queueService.addWalkInPatient(data);
      setTokens((prev) => {
        const filtered = prev.filter((t) => t.id !== token.id);
        return [...filtered, token];
      });
      refreshState();
      showToast(
        `Walk-in registered! Generated Token: ${token.tokenNumber} (${token.priority.toUpperCase()})`,
        'success',
      );
      return token;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register walk-in patient';
      showToast(msg, 'error');
      throw err;
    }
  };

  const bookAppointment = async (data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorId: string;
    date: string;
    time: string;
    notes?: string;
  }) => {
    try {
      const result = await appointmentService.createAppointment(data);
      setAppointments((prev) => {
        const filtered = prev.filter((a) => a.id !== result.appointment.id);
        return [result.appointment, ...filtered];
      });
      setTokens((prev) => {
        const filtered = prev.filter((t) => t.id !== result.token.id);
        return [...filtered, result.token];
      });
      refreshState();
      showToast(`Appointment confirmed! Token ${result.token.tokenNumber} allocated.`, 'success');
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Booking failed';
      showToast(msg, 'error');
      throw err;
    }
  };

  const cancelAppointment = async (id: string, reason?: string) => {
    try {
      await appointmentService.cancelAppointment(id, reason);
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelled' } : a)));
      refreshState();
      showToast('Appointment and queue token successfully cancelled', 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel appointment';
      showToast(msg, 'error');
      throw err;
    }
  };

  return (
    <QueueContext.Provider
      value={{
        tokens,
        appointments,
        doctors,
        clinics,
        settings,
        pausedDoctors,
        toasts,
        showToast,
        removeToast,
        refreshState,
        callNextPatient,
        testAnnouncement,
        repeatAnnouncement,
        announcementError,
        markServed,
        skipToken,
        cancelToken,
        toggleQueuePause,
        addWalkIn,
        bookAppointment,
        cancelAppointment,
        connectionError,
        lastSyncedAt,
      }}
    >
      {children}
    </QueueContext.Provider>
  );
};

export const useQueue = () => {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
};
