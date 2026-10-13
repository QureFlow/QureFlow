import { Router } from 'express';
import { z } from 'zod';
import { appointmentService } from '../services/appointmentService.js';
import { db } from '../repositories/repository.js';
import { mysqlRepo } from '../repositories/mysqlRepo.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { accessDoctor, staffClinic } from '../lib/access.js';
import { parse, bookingDateSchema } from '../lib/validation.js';
import { route } from '../lib/http.js';
import { AppError } from '../lib/errors.js';
const router = Router();
router.get(
  '/search',
  authenticateToken,
  requireRoles('admin', 'health_worker', 'doctor'),
  route(async (req, res) => {
    if (process.env.DATABASE_PROVIDER !== 'mysql')
      throw new AppError(404, 'SQL search is available in the DBMS variant.');
    const filters = parse(
      z
        .object({
          query: z.string().trim().max(200).optional(),
          doctorId: z.string().max(100).optional(),
          date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          status: z
            .enum([
              'all',
              'booked',
              'waiting',
              'in_consultation',
              'completed',
              'cancelled',
              'no_show',
            ])
            .optional(),
          page: z.coerce.number().int().min(1).max(10000).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(20),
        })
        .strict(),
      req.query,
    );
    const doctorId = req.user.role === 'doctor' ? req.user.doctorId : filters.doctorId;
    if (req.user.role === 'doctor') {
      if (!doctorId) throw new AppError(403, 'Assigned doctor required.');
      await accessDoctor(req, doctorId);
    }
    res.json(
      await mysqlRepo.searchAppointments({ ...filters, clinicId: staffClinic(req), doctorId }),
    );
  }),
);
router.use(authenticateToken);
router.get(
  '/',
  route(async (req, res) => {
    if (req.user.role === 'doctor') {
      if (!req.user.doctorId) throw new AppError(403, 'An assigned doctor is required.');
      await accessDoctor(req, req.user.doctorId);
    }
    const patientId =
      req.user.role === 'patient'
        ? req.user.sub
        : typeof req.query.patientId === 'string'
          ? req.query.patientId
          : undefined;
    if (req.user.role === 'patient' && req.query.patientId && req.query.patientId !== req.user.sub)
      throw new AppError(403, 'You can only access your own appointments.');
    const doctorId =
      req.user.role === 'doctor'
        ? req.user.doctorId
        : typeof req.query.doctorId === 'string'
          ? req.query.doctorId
          : undefined;
    let list = await appointmentService.getAppointments({
      ...(req.user.role !== 'patient' ? { clinicId: staffClinic(req) } : {}),
      patientId,
      doctorId,
      date: typeof req.query.date === 'string' ? req.query.date : undefined,
    });
    if (req.user.role !== 'patient')
      list = list.filter((a: any) => a.clinicId === staffClinic(req));
    res.json(list);
  }),
);
router.post(
  '/',
  requireRoles('patient'),
  route(async (req, res) => {
    const data = parse(
      z
        .object({
          patientId: z.string().optional(),
          patientName: z.string().optional(),
          patientPhone: z.string().optional(),
          doctorId: z.string().min(1).max(100),
          date: bookingDateSchema,
          time: z.string().max(20),
          notes: z.string().trim().max(1000).optional(),
        })
        .strict(),
      req.body,
    );
    if (data.patientId && data.patientId !== req.user.sub)
      throw new AppError(403, 'You can only book your own appointment.');
    res.status(201).json(
      await appointmentService.createAppointment({
        ...data,
        patientId: req.user.sub,
        patientName: req.user.name,
        patientPhone: req.user.phone,
      }),
    );
  }),
);
router.post(
  '/:id/cancel',
  route(async (req, res) => {
    const apt = await db.getAppointmentById(req.params.id);
    if (!apt) throw new AppError(404, 'Appointment not found');
    if (req.user.role === 'patient') {
      if (apt.patientId !== req.user.sub)
        throw new AppError(403, 'You can only cancel your own appointment.');
    } else await accessDoctor(req, apt.doctorId);
    const data = parse(
      z.object({ reason: z.string().trim().max(500).optional() }).strict(),
      req.body || {},
    );
    await appointmentService.cancelAppointment(apt.id, data.reason);
    res.json({ success: true });
  }),
);
export default router;
