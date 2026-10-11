import { Router } from 'express';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { route } from '../lib/http.js';
import { staffClinic } from '../lib/access.js';
import { analyticsService } from '../services/analyticsService.js';
const router = Router();
router.use(authenticateToken, requireRoles('admin', 'health_worker'));
router.get(
  '/',
  route(async (req, res) => res.json(await analyticsService.overview(staffClinic(req)))),
);
router.post(
  '/models/refresh',
  requireRoles('admin'),
  route(async (req, res) => res.json(await analyticsService.refreshModels(staffClinic(req)))),
);
export default router;
