import { Router } from 'express';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { queueService } from '../services/queueService.js';
import { db } from '../repositories/repository.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { accessDoctor, staffClinic } from '../lib/access.js';
import { parse, nameSchema, phoneSchema } from '../lib/validation.js';
import { route } from '../lib/http.js';
import { AppError } from '../lib/errors.js';
const router = Router();
router.use(authenticateToken);
const visibleQueue = (queue: any, user: any) =>
  user.role === 'patient'
    ? {
        ...queue,
        tokens: queue.tokens.map((t: any) =>
          t.patientId === user.sub
            ? t
            : {
                id: `position-${t.tokenNumber}`,
                tokenNumber: t.tokenNumber,
                doctorId: t.doctorId,
                doctorName: t.doctorName,
                clinicId: t.clinicId,
                clinicName: t.clinicName,
                status: t.status,
                patientName: '',
                patientPhone: '',
                scheduledTime: t.scheduledTime,
                priority: 'normal',
                isWalkIn: t.isWalkIn,
                createdAt: t.createdAt,
              },
        ),
      }
    : queue;
router.get(
  '/doctor/:doctorId',
  route(async (req, res) => {
    await accessDoctor(req, req.params.doctorId);
    res.json(visibleQueue(await queueService.getDoctorQueue(req.params.doctorId), req.user));
  }),
);
router.get(
  '/all',
  route(async (req, res) => {
    let doctors = await db.getDoctors();
    if (req.user.role !== 'patient')
      doctors = doctors.filter(
        (d) =>
          d.clinicId === staffClinic(req) &&
          (req.user.role !== 'doctor' || d.id === req.user.doctorId),
      );
    res.json(
      await Promise.all(
        doctors.map(async (d) => visibleQueue(await queueService.getDoctorQueue(d.id), req.user)),
      ),
    );
  }),
);
router.post(
  '/join',
  requireRoles('admin', 'health_worker'),
  route(async (req, res) => {
    const data = parse(
      z
        .object({
          doctorId: z.string().min(1).max(100),
          patientName: nameSchema,
          patientPhone: phoneSchema,
          priority: z.enum(['normal', 'emergency']).default('normal'),
          isWalkIn: z.literal(true),
          time: z.string().trim().max(100).optional(),
        })
        .strict(),
      req.body,
    );
    await accessDoctor(req, data.doctorId);
    let patient = await db.findUserByIdentifier(data.patientPhone);
    if (patient && patient.role !== 'patient')
      throw new AppError(409, 'This phone belongs to a staff account.');
    if (!patient)
      patient = await db.saveUser({
        id: `patient-${randomUUID()}`,
        name: data.patientName,
        phone: data.patientPhone,
        email: '',
        role: 'patient',
        clinicId: staffClinic(req),
        createdAt: new Date().toISOString(),
        metadata: { source: 'walk_in', accountStatus: 'unclaimed' },
      });
    res.status(201).json(
      await queueService.joinQueue({
        doctorId: data.doctorId,
        patientId: patient.id,
        patientName: patient.name,
        patientPhone: patient.phone,
        priority: data.priority,
        isWalkIn: true,
        scheduledTime: data.time,
      }),
    );
  }),
);
router.post(
  '/call-next',
  requireRoles('doctor', 'admin', 'health_worker'),
  route(async (req, res) => {
    const data = parse(z.object({ doctorId: z.string().min(1).max(100) }).strict(), req.body);
    await accessDoctor(req, data.doctorId);
    res.json(await queueService.callNextPatient(data.doctorId));
  }),
);
router.post(
  '/pause',
  requireRoles('doctor', 'admin', 'health_worker'),
  route(async (req, res) => {
    const data = parse(
      z.object({ doctorId: z.string().min(1).max(100), paused: z.boolean() }).strict(),
      req.body,
    );
    await accessDoctor(req, data.doctorId);
    res.json({
      doctorId: data.doctorId,
      isPaused: await db.setDoctorPause(data.doctorId, data.paused),
    });
  }),
);
export default router;
