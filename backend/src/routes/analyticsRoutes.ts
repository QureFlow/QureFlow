import { Router } from 'express';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';
import { route } from '../lib/http.js';
import { selectedStaffClinic } from '../lib/access.js';
import { analyticsService } from '../services/analyticsService.js';
const router = Router();
router.use(authenticateToken, requireRoles('admin', 'health_worker'));
router.get(
  '/',
  route(async (req, res) => res.json(await analyticsService.overview(await selectedStaffClinic(req)))),
);
router.post(
  '/models/refresh',
  requireRoles('admin'),
  route(async (req, res) => res.json(await analyticsService.refreshModels(await selectedStaffClinic(req)))),
);
export default router;
