import {
  Clinic,
  Doctor,
  Appointment,
  QueueToken,
  User,
  QueueSettings,
} from '../types';
import {
  INITIAL_CLINICS,
  INITIAL_DOCTORS,
  DEFAULT_PATIENTS,
  DEFAULT_ADMIN,
  INITIAL_QUEUE_TOKENS,
  INITIAL_APPOINTMENTS,
  DEFAULT_SETTINGS,
} from './mockData';

const KEYS = {
  CLINICS: 'queless_clinics',
  DOCTORS: 'queless_doctors',
  PATIENTS: 'queless_patients',
  APPOINTMENTS: 'queless_appointments',
  QUEUE_TOKENS: 'queless_tokens',
  SETTINGS: 'queless_settings',
  ACTIVE_USER: 'queless_active_user',
  PAUSED_DOCTORS: 'queless_paused_doctors',
};

// Helper to broadcast storage changes within the same tab
export const broadcastChange = (type: string, detail?: unknown) => {
  window.dispatchEvent(new CustomEvent('queless-state-change', { detail: { type, detail } }));
};

export const storage = {
  // Initialize storage if empty
  init() {
    if (!localStorage.getItem(KEYS.CLINICS)) {
      localStorage.setItem(KEYS.CLINICS, JSON.stringify(INITIAL_CLINICS));
    }
    if (!localStorage.getItem(KEYS.DOCTORS)) {
      localStorage.setItem(KEYS.DOCTORS, JSON.stringify(INITIAL_DOCTORS));
    }
    if (!localStorage.getItem(KEYS.PATIENTS)) {
      localStorage.setItem(KEYS.PATIENTS, JSON.stringify(DEFAULT_PATIENTS));
    }
    if (!localStorage.getItem(KEYS.APPOINTMENTS)) {
      localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(INITIAL_APPOINTMENTS));
    }
    if (!localStorage.getItem(KEYS.QUEUE_TOKENS)) {
      localStorage.setItem(KEYS.QUEUE_TOKENS, JSON.stringify(INITIAL_QUEUE_TOKENS));
    }
    if (!localStorage.getItem(KEYS.SETTINGS)) {
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    }
    if (!localStorage.getItem(KEYS.PAUSED_DOCTORS)) {
      localStorage.setItem(KEYS.PAUSED_DOCTORS, JSON.stringify([]));
    }
  },

  // Reset to original mock data
  resetAll() {
    localStorage.setItem(KEYS.CLINICS, JSON.stringify(INITIAL_CLINICS));
    localStorage.setItem(KEYS.DOCTORS, JSON.stringify(INITIAL_DOCTORS));
    localStorage.setItem(KEYS.PATIENTS, JSON.stringify(DEFAULT_PATIENTS));
    localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(INITIAL_APPOINTMENTS));
    localStorage.setItem(KEYS.QUEUE_TOKENS, JSON.stringify(INITIAL_QUEUE_TOKENS));
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
    localStorage.setItem(KEYS.PAUSED_DOCTORS, JSON.stringify([]));
    broadcastChange('RESET');
  },

  // Clinics
  getClinics(): Clinic[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(KEYS.CLINICS) || '[]');
    } catch {
      return INITIAL_CLINICS;
    }
  },
  saveClinics(clinics: Clinic[]) {
    localStorage.setItem(KEYS.CLINICS, JSON.stringify(clinics));
    broadcastChange('CLINICS');
  },

  // Doctors
  getDoctors(): Doctor[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(KEYS.DOCTORS) || '[]');
    } catch {
      return INITIAL_DOCTORS;
    }
  },
  saveDoctors(doctors: Doctor[]) {
    localStorage.setItem(KEYS.DOCTORS, JSON.stringify(doctors));
    broadcastChange('DOCTORS');
  },

  // Patients
  getPatients(): User[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(KEYS.PATIENTS) || '[]');
    } catch {
      return DEFAULT_PATIENTS;
    }
  },
  savePatients(patients: User[]) {
    localStorage.setItem(KEYS.PATIENTS, JSON.stringify(patients));
    broadcastChange('PATIENTS');
  },

  // Appointments
  getAppointments(): Appointment[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(KEYS.APPOINTMENTS) || '[]');
    } catch {
      return INITIAL_APPOINTMENTS;
    }
  },
  saveAppointments(appointments: Appointment[]) {
    localStorage.setItem(KEYS.APPOINTMENTS, JSON.stringify(appointments));
    broadcastChange('APPOINTMENTS');
  },

  // Queue Tokens
  getTokens(): QueueToken[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(KEYS.QUEUE_TOKENS) || '[]');
    } catch {
      return INITIAL_QUEUE_TOKENS;
    }
  },
  saveTokens(tokens: QueueToken[]) {
    localStorage.setItem(KEYS.QUEUE_TOKENS, JSON.stringify(tokens));
    broadcastChange('TOKENS');
  },

  // Paused Doctor Queues
  getPausedDoctors(): string[] {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(KEYS.PAUSED_DOCTORS) || '[]');
    } catch {
      return [];
    }
  },
  savePausedDoctors(doctorIds: string[]) {
    localStorage.setItem(KEYS.PAUSED_DOCTORS, JSON.stringify(doctorIds));
    broadcastChange('PAUSED_DOCTORS');
  },

  // Settings
  getSettings(): QueueSettings {
    this.init();
    try {
      return JSON.parse(localStorage.getItem(KEYS.SETTINGS) || '{}');
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  saveSettings(settings: QueueSettings) {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    broadcastChange('SETTINGS');
  },

  // Active User Session
  getActiveUser(): User | null {
    try {
      const data = localStorage.getItem(KEYS.ACTIVE_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setActiveUser(user: User | null) {
    if (user) {
      localStorage.setItem(KEYS.ACTIVE_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(KEYS.ACTIVE_USER);
    }
    broadcastChange('USER');
  },

  // Pre-configured default users
  getDefaultPatient(): User {
    return DEFAULT_PATIENTS[0];
  },
  getDefaultAdmin(): User {
    return DEFAULT_ADMIN;
  }
};
