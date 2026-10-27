import { useEffect, useReducer } from 'react';
import { mobileConnectionReadyEvent } from '../lib/mobileConnection';

/** Refresh read-only screen data after verification, keeping form/filter state mounted. */
export function useClinicConnectionRevision() {
  const [revision, refresh] = useReducer((value: number) => value + 1, 0);
  useEffect(() => {
    window.addEventListener(mobileConnectionReadyEvent, refresh);
    return () => window.removeEventListener(mobileConnectionReadyEvent, refresh);
  }, []);
  return revision;
}
