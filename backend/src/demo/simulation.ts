import type { Appointment, Doctor, QueueToken, User } from '../models/types.js';
import { byQueueOrder } from '../lib/queueOrder.js';
import { clockMinutes, timeLabel, weekday } from '../lib/time.js';
import { doctorPrefix } from '../services/queueService.js';

/**
 * Seeded discrete-event simulation of outpatient sessions, used for synthetic demo history and
 * offline evaluation. The doctor follows QureFlow's own calling rule (emergency, then token
 * sequence among eligible patients), while patients behave less tidily: they arrive early or
 * late, miss appointments, and consultations vary with case mix, fatigue and gradual drift.
 * All output is labelled synthetic.
 */
export type Random = () => number;
export function seededRandom(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashSeed = (text: string) =>
  [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
const normal = (rng: Random) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const exponential = (rng: Random, mean: number) => -Math.log(1 - rng()) * mean;

/** Hidden "true" behaviour of a doctor; the models never see these values. */
export function doctorProfile(doctor: Doctor) {
  const rng = seededRandom(hashSeed(`profile:${doctor.id}`));
  return {
    baseMinutes: doctor.slotDurationMinutes * (0.65 + rng() * 0.45),
    firstVisitEffect: 0.12 + rng() * 0.2,
    emergencyEffect: 0.2 + rng() * 0.25,
    walkInEffect: rng() * 0.1,
    fatiguePerHour: rng() * 0.08,
    driftPerDay: -0.002 - rng() * 0.006,
    noise: 0.22 + rng() * 0.1,
    lateStartProbability: 0.15 + rng() * 0.25,
  };
}

export interface SimulatedDay {
  tokens: QueueToken[];
  appointments: Appointment[];
}
const at = (date: string, minute: number) =>
  Date.parse(
    `${date}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(Math.floor(minute % 60)).padStart(2, '0')}:00+05:30`,
  ) + Math.round((minute % 1) * 60000);

export function simulateDay(input: {
  doctor: Doctor;
  date: string;
  dayIndex: number;
  patients: User[];
  seenBefore: Set<string>;
  sessionMinutes?: number;
  idPrefix: string;
}): SimulatedDay {
  const { doctor, date, patients, seenBefore } = input;
  const rng = seededRandom(hashSeed(`${input.idPrefix}:${doctor.id}:${date}`));
  const profile = doctorProfile(doctor);
  const start = clockMinutes(doctor.startTime),
    length = input.sessionMinutes ?? 180,
    weekend = ['Saturday', 'Sunday'].includes(weekday(date)),
    capacity = Math.max(1, Math.floor(30 / (doctor.slotDurationMinutes + 2)));
  const used = new Set<string>();
  const pickPatient = () => {
    // Most patients return to a doctor they know; others are new to this doctor.
    const known = patients.filter((p) => seenBefore.has(p.id) && !used.has(p.id));
    const fresh = patients.filter((p) => !seenBefore.has(p.id) && !used.has(p.id));
    const pool =
      known.length && (rng() < 0.6 || !fresh.length) ? known : fresh.length ? fresh : patients;
    const patient = pool[Math.floor(rng() * pool.length)];
    used.add(patient.id);
    return patient;
  };
  interface Plan {
    token: QueueToken;
    appointment?: Appointment;
    arrival: number; // minute of day; Infinity for a no-show
    cancelAt?: number;
    scheduled?: number;
  }
  const plans: Plan[] = [];
  const base = (
    patient: User,
    minuteCreated: number,
    createdAtMs: number,
    extra: Partial<QueueToken>,
  ) => {
    const firstVisit = !seenBefore.has(patient.id);
    return {
      id: `${input.idPrefix}-${doctor.id}-${date}-${plans.length}`,
      tokenNumber: '',
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      doctorId: doctor.id,
      doctorName: doctor.name,
      clinicId: doctor.clinicId,
      clinicName: doctor.clinicName,
      scheduledTime: 'Walk-in',
      priority: 'normal',
      isWalkIn: true,
      status: 'waiting',
      createdAt: new Date(createdAtMs).toISOString(),
      queueDate: date,
      queueId: `${date}#${doctor.id}`,
      version: 1,
      metadata: {
        synthetic: true,
        source: 'synthetic_simulation',
        schemaVersion: 4,
        timeZone: 'Asia/Kolkata',
        encounterType: firstVisit ? 'first_visit' : 'follow_up',
        department: doctor.specialization,
        roomNumber: doctor.roomNumber,
        dataProvenance: 'Simulated locally; no real patient data',
        minuteCreated,
      },
      ...extra,
    } as QueueToken;
  };
  // Booked appointments, made one to seven days in advance.
  for (let minute = start; minute < start + length; minute += 30)
    for (let k = 0; k < capacity; k++) {
      if (rng() > (weekend ? 0.35 : 0.55)) continue;
      const patient = pickPatient(),
        bookedAt = at(date, minute) - (1 + Math.floor(rng() * 7)) * 86400000 - rng() * 36e5;
      const time = timeLabel(minute);
      const token = base(patient, -1, bookedAt, { scheduledTime: time, isWalkIn: false });
      const roll = rng();
      const plan: Plan = {
        token,
        scheduled: minute,
        arrival:
          roll < 0.08 ? Infinity : minute + Math.max(-30, Math.min(20, -8 + 7 * normal(rng))),
      };
      if (roll >= 0.08 && roll < 0.12) plan.cancelAt = minute - 30 - rng() * 120; // same day
      if (roll >= 0.12 && roll < 0.17) plan.cancelAt = -1; // days before
      plan.appointment = {
        id: `apt-${token.id}`,
        tokenId: token.id,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        doctorId: doctor.id,
        doctorName: doctor.name,
        doctorSpecialization: doctor.specialization,
        clinicId: doctor.clinicId,
        clinicName: doctor.clinicName,
        date,
        time,
        tokenNumber: '',
        status: 'booked',
        priority: 'normal',
        isWalkIn: false,
        notes: 'Synthetic outpatient visit; no real clinical information.',
        createdAt: token.createdAt,
        version: 1,
        metadata: {
          synthetic: true,
          source: 'synthetic_simulation',
          schemaVersion: 4,
          bookingChannel: 'patient_portal',
        },
      };
      plans.push(plan);
    }
  plans.sort((a, b) => Date.parse(a.token.createdAt) - Date.parse(b.token.createdAt));
  // Walk-ins: a non-homogeneous Poisson process peaking in the first half of the session.
  const meanGap = weekend ? 26 : 18;
  for (
    let minute = start - 20 + exponential(rng, meanGap);
    minute < start + length - 30;
    minute += exponential(rng, meanGap)
  ) {
    const intensity = 0.7 + 0.6 * Math.sin((Math.PI * (minute - start + 20)) / (length + 20));
    if (rng() > intensity / 1.3) continue;
    const patient = pickPatient();
    const token = base(patient, minute, at(date, minute), {
      priority: rng() < 0.03 ? 'emergency' : 'normal',
    });
    token.metadata = { ...token.metadata, arrivalChannel: 'reception', checkInAt: token.createdAt };
    plans.push({ token, arrival: minute });
  }
  plans.forEach((p, i) => {
    p.token.tokenSeq = i + 1;
    p.token.tokenNumber = `${doctorPrefix(doctor.id)}-${String(i + 1).padStart(3, '0')}`;
    if (p.appointment) p.appointment.tokenNumber = p.token.tokenNumber;
    if (p.scheduled !== undefined && Number.isFinite(p.arrival))
      p.token.metadata = {
        ...p.token.metadata,
        checkInAt: new Date(at(date, p.arrival)).toISOString(),
      };
  });
  const duration = (t: QueueToken, minute: number) => {
    const z =
      Math.log(profile.baseMinutes) +
      (t.metadata?.encounterType === 'first_visit' ? profile.firstVisitEffect : 0) +
      (t.priority === 'emergency' ? profile.emergencyEffect : 0) +
      (t.isWalkIn ? profile.walkInEffect : 0) +
      profile.fatiguePerHour * Math.max(0, (minute - start) / 60) +
      profile.driftPerDay * input.dayIndex +
      profile.noise * normal(rng);
    return Math.max(2, Math.min(60, Math.exp(z)));
  };
  // Serve the session.
  let clock = start + (rng() < profile.lateStartProbability ? rng() * 12 : rng() * 2);
  const pending = new Set(plans.filter((p) => p.cancelAt !== -1));
  for (const p of plans)
    if (p.cancelAt === -1) {
      p.token.status = 'cancelled';
      p.token.updatedAt = new Date(Date.parse(p.token.createdAt) + 6 * 36e5).toISOString();
    }
  const removeCancelled = () => {
    for (const p of pending)
      if (p.cancelAt !== undefined && p.cancelAt <= clock) {
        p.token.status = 'cancelled';
        p.token.updatedAt = new Date(at(date, Math.max(p.cancelAt, start - 180))).toISOString();
        pending.delete(p);
      }
  };
  for (let guard = 0; pending.size && guard < 500; guard++) {
    removeCancelled();
    const inSystem = [...pending].filter((p) => Date.parse(p.token.createdAt) <= at(date, clock));
    const eligible = inSystem
      .filter((p) => p.token.priority === 'emergency' || p.token.isWalkIn || p.scheduled! <= clock)
      .sort((a, b) => byQueueOrder(a.token, b.token));
    // Patients who are not here yet are passed over until a ten-minute grace period ends.
    const present = eligible.find((p) => p.arrival <= clock);
    const overdue = eligible.find((p) => p.arrival > clock && clock >= p.scheduled! + 10);
    if (overdue && (!present || byQueueOrder(overdue.token, present.token) < 0)) {
      overdue.token.status = 'skipped';
      overdue.token.updatedAt = new Date(at(date, clock)).toISOString();
      pending.delete(overdue);
      clock += 0.5;
      continue;
    }
    if (!present) {
      const next = Math.min(
        ...[...pending]
          .flatMap((p) => [
            p.arrival,
            p.scheduled ?? Infinity,
            (p.scheduled ?? Infinity) + 10,
            p.cancelAt ?? Infinity,
          ])
          .filter((m) => m > clock),
      );
      if (!Number.isFinite(next)) break;
      clock = next;
      continue;
    }
    const minutes = duration(present.token, clock);
    present.token.status = 'completed';
    present.token.calledAt = new Date(at(date, clock)).toISOString();
    clock += minutes;
    present.token.servedAt = new Date(at(date, clock)).toISOString();
    present.token.updatedAt = present.token.servedAt;
    present.token.metadata = {
      ...present.token.metadata,
      consultationMinutes: Number(minutes.toFixed(2)),
    };
    pending.delete(present);
    clock += 0.5 + exponential(rng, 1.2);
  }
  for (const p of pending) {
    p.token.status = 'skipped';
    p.token.updatedAt = new Date(at(date, clock)).toISOString();
  }
  for (const p of plans) {
    if (p.appointment)
      p.appointment.status =
        p.token.status === 'skipped'
          ? 'no_show'
          : p.token.status === 'completed'
            ? 'completed'
            : p.token.status === 'cancelled'
              ? 'cancelled'
              : 'booked';
    if (p.appointment) p.appointment.updatedAt = p.token.updatedAt;
    if (p.token.status === 'completed' && p.token.patientId) seenBefore.add(p.token.patientId);
  }
  return {
    tokens: plans.map((p) => p.token),
    appointments: plans.flatMap((p) => (p.appointment ? [p.appointment] : [])),
  };
}
