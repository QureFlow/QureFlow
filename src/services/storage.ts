import { User } from '../types';
const key = 'queless_active_user';
export const storage = {
  getActiveUser(): User | null {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setActiveUser(user: User | null) {
    if (user) sessionStorage.setItem(key, JSON.stringify(user));
    else sessionStorage.removeItem(key);
    localStorage.removeItem(key);
    window.dispatchEvent(new CustomEvent('queless-state-change', { detail: { type: 'USER' } }));
  },
};
