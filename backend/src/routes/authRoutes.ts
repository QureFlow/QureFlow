import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService.js';
import { db, publicUser } from '../repositories/repository.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { parse, registrationSchema, passwordSchema } from '../lib/validation.js';
import { route } from '../lib/http.js';
import { AppError } from '../lib/errors.js';
const router = Router(),
  identifier = z.string().trim().min(3).max(254);
router.post(
  '/register',
  route(async (req, res) =>
    res.status(201).json(await authService.registerPatient(parse(registrationSchema, req.body))),
  ),
);
router.post(
  '/login',
  route(async (req, res) => {
    const data = parse(
      z.object({ identifier, password: z.string().min(1).max(128) }).strict(),
      req.body,
    );
    res.json(await authService.login(data.identifier, data.password));
  }),
);
router.post(
  '/guest',
  route(async (req, res) => {
    const data = parse(z.object({ role: z.enum(['patient', 'staff']) }).strict(), req.body);
    res.json(await authService.guestLogin(data.role));
  }),
);
router.get(
  '/me',
  authenticateToken,
  route(async (req, res) => {
    const user = await db.getUserById(req.user.sub);
    if (!user) throw new AppError(401, 'Session is no longer valid');
    res.json(publicUser(user));
  }),
);
router.post(
  '/forgot-password',
  route(async (req, res) => {
    const data = parse(z.object({ identifier }).strict(), req.body);
    res.json(await authService.forgotPassword(data.identifier));
  }),
);
router.post(
  '/confirm-forgot-password',
  route(async (req, res) => {
    const data = parse(
      z
        .object({ identifier, code: z.string().min(4).max(20), newPassword: passwordSchema })
        .strict(),
      req.body,
    );
    res.json(await authService.confirmForgotPassword(data.identifier, data.code, data.newPassword));
  }),
);
router.post(
  '/confirm-registration',
  route(async (req, res) => {
    const data = parse(
      z.object({ identifier, code: z.string().min(4).max(20) }).strict(),
      req.body,
    );
    res.json(await authService.confirmRegistration(data.identifier, data.code));
  }),
);
export default router;
