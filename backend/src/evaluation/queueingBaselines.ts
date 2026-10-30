import { PredictorFactory, recentSnapshots } from '../services/waitBacktest.js';
import { meanService, point, queueLength, serviceIndex } from '../services/waitFeatures.js';

/*
 * The classical steady-state estimate from queueing theory, for comparison only (Green, 2006):
 * an M/M/c queue with arrival rate λ and service rate μ has expected wait in queue
 * Wq = C(c, λ/μ) / (cμ − λ), where C is the Erlang-C probability of waiting. Each QureFlow
 * doctor serves their own queue, so c = 1. λ is the doctor's rate of patients joining the
 * queue over the last 28 days of sessions; 1/μ is the mean of the last 20 consultations plus the
 * changeover buffer. The estimate ignores the live queue, as a steady-state formula does.
 */
const MAX_UTILISATION = 0.95;
const SERVERS = 1;

export function erlangC(servers: number, offered: number) {
  let term = 1,
    sum = 1;
  for (let k = 1; k < servers; k++) {
    term *= offered / k;
    sum += term;
  }
  const top = ((term * offered) / servers) * (servers / (servers - offered));
  return top / (sum + top);
}

export const erlangCPredictor =
  (defaultMinutes: number, buffer: number): PredictorFactory =>
  (history) => {
    const index = serviceIndex(history);
    // Patients per minute of session, per doctor: arrivals over the span from first arrival to
    // last call on each day.
    const sessions = new Map<string, { patients: number; minutes: number }>();
    const days = new Map<string, { first: number; last: number; patients: number }>();
    for (const s of recentSnapshots(history, 28)) {
      const key = `${s.target.doctorId}|${s.target.queueDate}`;
      const day = days.get(key) || { first: Infinity, last: -Infinity, patients: 0 };
      day.first = Math.min(day.first, s.at);
      day.last = Math.max(day.last, Date.parse(s.target.calledAt!));
      day.patients++;
      days.set(key, day);
    }
    for (const [key, day] of days) {
      const doctorId = key.split('|')[0];
      const total = sessions.get(doctorId) || { patients: 0, minutes: 0 };
      total.patients += day.patients;
      total.minutes += Math.max(1, (day.last - day.first) / 60000);
      sessions.set(doctorId, total);
    }
    return (s) => {
      const session = sessions.get(s.target.doctorId);
      if (!session) return point(queueLength(index, s, defaultMinutes, buffer));
      const service = meanService(index, s, defaultMinutes) + buffer;
      const lambda = session.patients / session.minutes;
      const offered = Math.min(MAX_UTILISATION * SERVERS, lambda * service);
      const mu = 1 / service;
      return point(erlangC(SERVERS, offered) / (SERVERS * mu - offered * mu));
    };
  };
