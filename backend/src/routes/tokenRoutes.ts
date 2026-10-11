import { Router } from 'express';
import { queueService } from '../services/queueService.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { accessToken } from '../lib/access.js';
import { route } from '../lib/http.js';
const router = Router();
router.use(authenticateToken);
router.post(
  '/:id/serve',
  requireRoles('doctor', 'admin', 'health_worker'),
  route(async (req, res) => {
    await accessToken(req, req.params.id);
    await queueService.markPatientServed(req.params.id);
    res.json({ success: true });
  }),
);
router.post(
  '/:id/skip',
  requireRoles('doctor', 'admin', 'health_worker'),
  route(async (req, res) => {
    await accessToken(req, req.params.id);
    await queueService.skipPatient(req.params.id);
    res.json({ success: true });
  }),
);
router.post(
  '/:id/cancel',
  route(async (req, res) => {
    await accessToken(req, req.params.id);
    await queueService.cancelToken(req.params.id);
    res.json({ success: true });
  }),
);
export default router;
