import { User } from '../types';
import { storage } from './storage';

export const authService = {
  async getCurrentUser(): Promise<User | null> {
    return storage.getActiveUser();
  },

  async loginPatient(identifier: string, _password?: string): Promise<User> {
    const cleanId = identifier.trim().toLowerCase();
    const patients = storage.getPatients();

    const matched = patients.find(
      (p) =>
        p.phone === cleanId ||
        p.email.toLowerCase() === cleanId ||
        (p.phone && p.phone.replace(/[^0-9]/g, '').endsWith(cleanId.replace(/[^0-9]/g, '')))
    );

    if (!matched) {
      // If demo user or general phone entered, let them log in as demo patient or create on fly
      if (cleanId === '9876543210' || cleanId === 'suman.roy@example.com') {
        const defaultP = storage.getDefaultPatient();
        storage.setActiveUser(defaultP);
        return defaultP;
      }
      throw new Error('No patient account found with this phone number or email.');
    }

    storage.setActiveUser(matched);
    return matched;
  },

  async registerPatient(data: {
    name: string;
    phone: string;
    email: string;
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other';
    password?: string;
  }): Promise<User> {
    const patients = storage.getPatients();

    const existing = patients.find(
      (p) => p.phone === data.phone || (data.email && p.email.toLowerCase() === data.email.toLowerCase())
    );

    if (existing) {
      throw new Error('An account with this phone number or email already exists.');
    }

    const newPatient: User = {
      id: `patient-${Date.now()}`,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      role: 'patient',
      dob: data.dob,
      gender: data.gender,
    };

    patients.push(newPatient);
    storage.savePatients(patients);
    storage.setActiveUser(newPatient);
    return newPatient;
  },

  async loginAdmin(identifier: string, _password?: string): Promise<User> {
    const cleanId = identifier.trim().toLowerCase();
    const admin = storage.getDefaultAdmin();

    // Check against admin email or staffId
    if (
      cleanId === admin.email.toLowerCase() ||
      cleanId === admin.staffId?.toLowerCase() ||
      cleanId === 'admin' ||
      cleanId.includes('rec-204')
    ) {
      storage.setActiveUser(admin);
      return admin;
    }

    throw new Error('Invalid Staff ID or Email. (Demo: admin@bolpurhealth.org or REC-204)');
  },

  async logout(): Promise<void> {
    storage.setActiveUser(null);
  },

  quickDemoPatient(): User {
    const p = storage.getDefaultPatient();
    storage.setActiveUser(p);
    return p;
  },

  quickDemoAdmin(): User {
    const a = storage.getDefaultAdmin();
    storage.setActiveUser(a);
    return a;
  },
};
