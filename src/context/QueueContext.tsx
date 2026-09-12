import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  QueueToken,
  Appointment,
  Doctor,
  Clinic,
  QueueSettings,
  QueuePriority,
} from '../types';
import { storage } from '../services/storage';
import { queueService } from '../services/queueService';
import { appointmentService } from '../services/appointmentService';

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
  resetToDefaults: () => void;
}

const QueueContext = createContext<QueueContextType | undefined>(undefined);

const playClinicChimeAndAnnounce = (announcement: string) => {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.2); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch {
    // AudioContext blocked before interaction
  }

  try {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    }
  } catch {
    // Speech synthesis error fallback
  }
};

export const QueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tokens, setTokens] = useState<QueueToken[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [settings, setSettings] = useState<QueueSettings>(storage.getSettings());
  const [pausedDoctors, setPausedDoctors] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const refreshState = useCallback(() => {
    storage.init();
    setTokens(storage.getTokens());
    setAppointments(storage.getAppointments());
    setDoctors(storage.getDoctors());
    setClinics(storage.getClinics());
    setSettings(storage.getSettings());
    setPausedDoctors(storage.getPausedDoctors());
  }, []);

  useEffect(() => {
    refreshState();

    const handleSync = () => {
      refreshState();
    };

    window.addEventListener('queless-state-change', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('queless-state-change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [refreshState]);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'warning' | 'error' = 'info') => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, message, type }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const callNextPatient = async (doctorId: string) => {
    try {
      const token = await queueService.callNextPatient(doctorId);
      refreshState();
      if (token) {
        playClinicChimeAndAnnounce(
          `Token ${token.tokenNumber}, please proceed to Consultation Room 102 for ${token.doctorName}.`
        );
        showToast(
          `Token ${token.tokenNumber} (${token.patientName}) called for consultation (Room 102)`,
          'success'
        );
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
    if (isPaused) {
      await queueService.resumeQueue(doctorId);
      showToast('Queue resumed', 'info');
    } else {
      await queueService.pauseQueue(doctorId);
      showToast('Queue temporarily paused', 'warning');
    }
    refreshState();
    return !isPaused;
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
      refreshState();
      showToast(
        `Walk-in registered! Generated Token: ${token.tokenNumber} (${token.priority.toUpperCase()})`,
        'success'
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
      refreshState();
      showToast('Appointment and queue token successfully cancelled', 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel appointment';
      showToast(msg, 'error');
      throw err;
    }
  };

  const resetToDefaults = () => {
    storage.resetAll();
    refreshState();
    showToast('Reset to original sample healthcare data', 'info');
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
        markServed,
        skipToken,
        cancelToken,
        toggleQueuePause,
        addWalkIn,
        bookAppointment,
        cancelAppointment,
        resetToDefaults,
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
