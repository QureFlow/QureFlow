import { Router } from 'express';
import { z } from 'zod';
import { db } from '../repositories/repository.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { route } from '../lib/http.js';
import { selectedStaffClinic, staffClinic, managesAllDemoClinics } from '../lib/access.js';
import { parse, settingsSchema } from '../lib/validation.js';
import { AppError } from '../lib/errors.js';
const router = Router();
router.get(
  '/clinics',
  route(async (_req, res) => res.json(await db.getClinics())),
);
router.get(
  '/clinics/:id',
  route(async (req, res) => {
    const clinic = await db.getClinicById(req.params.id);
    if (!clinic) throw new AppError(404, 'Clinic not found');
    res.json(clinic);
  }),
);
router.patch(
  '/clinics/:id',
  authenticateToken,
  requireRoles('admin'),
  route(async (req, res) => {
    if (!managesAllDemoClinics(req) && req.params.id !== staffClinic(req))
      throw new AppError(403, 'You can only edit your own clinic.');
    const fields = z
      .object({
        name: z.string().trim().min(2).max(120),
        address: z.string().trim().min(3).max(300),
        district: z.string().trim().min(2).max(100),
        state: z.string().trim().min(2).max(100),
        phone: z.string().trim().min(3).max(30),
        email: z.string().email(),
        openingHours: z.string().trim().min(3).max(150),
        emergencyContact: z.string().trim().min(3).max(100),
      })
      .partial()
      .strict();
    const updates = parse(fields, req.body),
      clinic = await db.getClinicById(req.params.id);
    if (!clinic) throw new AppError(404, 'Clinic not found');
    res.json(await db.saveClinic({ ...clinic, ...updates }));
  }),
);
router.get(
  '/settings',
  authenticateToken,
  route(async (req, res) => res.json(await db.getSettings(
    req.user.role === 'patient' ? req.user.clinicId : await selectedStaffClinic(req),
  ))),
);
router.put(
  '/settings',
  authenticateToken,
  requireRoles('admin'),
  route(async (req, res) => {
    const updates = parse(settingsSchema, req.body),
      clinicId = await selectedStaffClinic(req),
      settings = await db.getSettings(clinicId);
    if (updates.notifyOnTwoAhead === true)
      throw new AppError(
        400,
        'SMS queue alerts are not enabled. Leave this setting off until an alert delivery worker is configured.',
      );
    res.json(await db.saveSettings({ ...settings, ...updates }, clinicId));
  }),
);
export default router;
