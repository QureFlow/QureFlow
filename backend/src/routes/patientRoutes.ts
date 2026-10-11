import { Router } from 'express';
import { queueService } from '../services/queueService.js';
import { dynamoDbRepo, publicUser } from '../repositories/dynamoDbRepo.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { accessPatient, accessiblePatients } from '../lib/access.js';
import { parse, profileSchema } from '../lib/validation.js';
import { route } from '../lib/http.js';
import { AppError } from '../lib/errors.js';
const router = Router();
router.use(authenticateToken);
router.get(
  '/me/status',
  requireRoles('patient'),
  route(async (req, res) => res.json(await queueService.getPatientActiveStatus(req.user.sub))),
);
router.get(
  '/',
  requireRoles('admin', 'health_worker', 'doctor'),
  route(async (req, res) => {
    const patients = await accessiblePatients(
      req,
      typeof req.query.query === 'string' ? req.query.query : undefined,
    );
    res.json(patients.map(publicUser));
  }),
);
router.get(
  '/:id',
  route(async (req, res) => {
    await accessPatient(req, req.params.id);
    const user = await dynamoDbRepo.getUserById(req.params.id);
    if (!user) throw new AppError(404, 'Patient not found');
    res.json(publicUser(user));
  }),
);
router.patch(
  '/:id',
  route(async (req, res) => {
    await accessPatient(req, req.params.id);
    const updates = parse(profileSchema, req.body),
      user = await dynamoDbRepo.getUserById(req.params.id);
    if (!user || user.role !== 'patient') throw new AppError(404, 'Patient not found');
    if (
      user.cognitoSub &&
      ((updates.email !== undefined && updates.email !== user.email) ||
        (updates.phone !== undefined && updates.phone !== user.phone))
    )
      throw new AppError(
        409,
        'Contact changes require Cognito verification. Contact the clinic administrator.',
      );
    for (const contact of [updates.phone, updates.email])
      if (contact) {
        const existing = await dynamoDbRepo.findUserByIdentifier(contact);
        if (existing && existing.id !== user.id)
          throw new AppError(409, 'These contact details belong to another account.');
      }
    res.json(publicUser(await dynamoDbRepo.saveUser({ ...user, ...updates })));
  }),
);
export default router;
