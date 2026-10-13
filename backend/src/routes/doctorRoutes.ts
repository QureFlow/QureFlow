import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../repositories/repository.js';
import { appointmentService } from '../services/appointmentService.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { route } from '../lib/http.js';
import { accessDoctor, staffClinic } from '../lib/access.js';
import { parse, nameSchema } from '../lib/validation.js';
import { clinicDate, weekday, clockMinutes } from '../lib/time.js';
import { AppError } from '../lib/errors.js';
import { mysqlRepo } from '../repositories/mysqlRepo.js';
const router = Router();
const time = z.string().regex(/^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/);
const schema = z
  .object({
    name: nameSchema,
    specialization: nameSchema,
    experienceYears: z.number().int().min(0).max(70),
    qualifications: z.string().trim().min(2).max(300),
    clinicId: z.string().min(1).max(100),
    consultationDays: z
      .array(z.enum(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']))
      .min(1)
      .max(7),
    startTime: time,
    endTime: time,
    slotDurationMinutes: z.number().int().min(2).max(30),
    consultationFee: z.number().min(0).max(100000),
    status: z.enum(['active', 'inactive']),
    avatar: z.string().url().startsWith('https://').optional(),
  })
  .strict();
const decorate = (d: any) => ({
  ...d,
  isAvailableToday: d.status === 'active' && d.consultationDays.includes(weekday(clinicDate())),
});
router.get(
  '/doctors/options',
  route(async (_req, res) => {
    if (process.env.DATABASE_PROVIDER !== 'mysql')
      throw new AppError(404, 'SQL directory is available in the DBMS variant.');
    res.json(await mysqlRepo.directoryOptions());
  }),
);
router.get(
  '/doctors/search',
  route(async (req, res) => {
    if (process.env.DATABASE_PROVIDER !== 'mysql')
      throw new AppError(404, 'SQL directory is available in the DBMS variant.');
    const filters = parse(
      z
        .object({
          query: z.string().trim().max(200).optional(),
          specialization: z.string().max(100).optional(),
          clinicId: z.string().max(100).optional(),
          language: z.string().max(60).optional(),
          availableTodayOnly: z.enum(['true', 'false']).optional(),
          sort: z.enum(['name', 'fee', 'experience']).default('name'),
          page: z.coerce.number().int().min(1).max(10000).default(1),
          pageSize: z.coerce.number().int().min(1).max(50).default(9),
        })
        .strict(),
      req.query,
    );
    const result = await mysqlRepo.searchDoctors({
      ...filters,
      status: 'active',
      availableTodayOnly: filters.availableTodayOnly === 'true',
      limit: filters.pageSize,
      offset: (filters.page - 1) * filters.pageSize,
    });
    res.json({ ...result, page: filters.page, pageSize: filters.pageSize });
  }),
);
router.get(
  '/doctors',
  route(async (req, res) => {
    if (process.env.DATABASE_PROVIDER === 'mysql') {
      res.json(
        await mysqlRepo.getDoctors({
          query: typeof req.query.query === 'string' ? req.query.query : undefined,
          specialization:
            typeof req.query.specialization === 'string' ? req.query.specialization : undefined,
          clinicId: typeof req.query.clinicId === 'string' ? req.query.clinicId : undefined,
          availableTodayOnly: req.query.availableTodayOnly === 'true',
        }),
      );
      return;
    }
    let doctors = (await db.getDoctors()).map(decorate);
    if (typeof req.query.query === 'string') {
      const q = req.query.query.toLowerCase();
      doctors = doctors.filter((d) =>
        `${d.name} ${d.specialization} ${d.clinicName}`.toLowerCase().includes(q),
      );
    }
    if (typeof req.query.specialization === 'string' && req.query.specialization !== 'all')
      doctors = doctors.filter((d) => d.specialization === req.query.specialization);
    if (typeof req.query.clinicId === 'string' && req.query.clinicId !== 'all')
      doctors = doctors.filter((d) => d.clinicId === req.query.clinicId);
    if (req.query.availableTodayOnly === 'true')
      doctors = doctors.filter((d) => d.isAvailableToday);
    res.json(doctors);
  }),
);
router.get(
  '/doctors/:id/slots',
  route(async (req, res) =>
    res.json(
      await appointmentService.getDoctorSlotAvailability(
        req.params.id,
        typeof req.query.date === 'string' ? req.query.date : clinicDate(),
      ),
    ),
  ),
);
router.get(
  '/doctors/:id',
  route(async (req, res) => {
    const doctor = await db.getDoctorById(req.params.id);
    if (!doctor) throw new AppError(404, 'Doctor not found');
    res.json(decorate(doctor));
  }),
);
router.post(
  '/doctors',
  authenticateToken,
  requireRoles('admin'),
  route(async (req, res) => {
    const data = parse(schema, req.body);
    if (data.clinicId !== staffClinic(req))
      throw new AppError(403, 'Doctors must belong to your clinic.');
    const clinic = await db.getClinicById(data.clinicId);
    if (!clinic) throw new AppError(404, 'Clinic not found');
    if (clockMinutes(data.endTime) <= clockMinutes(data.startTime))
      throw new AppError(400, 'Closing time must be after opening time.');
    const doctor = {
      ...data,
      id: `doc-${randomUUID()}`,
      clinicName: clinic.name,
      isAvailableToday: false,
      nextAvailableSlot: data.startTime,
    };
    res.status(201).json(decorate(await db.saveDoctor(doctor)));
  }),
);
router.patch(
  '/doctors/:id',
  authenticateToken,
  requireRoles('admin'),
  route(async (req, res) => {
    const existing = await accessDoctor(req, req.params.id),
      updates = parse(schema.partial(), req.body);
    if (updates.clinicId && updates.clinicId !== existing.clinicId)
      throw new AppError(403, 'Clinic reassignment is not supported.');
    const doctor = { ...existing, ...updates };
    if (clockMinutes(doctor.endTime) <= clockMinutes(doctor.startTime))
      throw new AppError(400, 'Closing time must be after opening time.');
    res.json(decorate(await db.saveDoctor(doctor)));
  }),
);
export default router;
