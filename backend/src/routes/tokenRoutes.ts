import { Router } from 'express';
import { queueService } from '../services/queueService.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/:id/serve', authenticateToken, requireRoles('doctor', 'admin', 'health_worker'), async (req, res) => {
  try {
    const tokenId = req.params.id as string;
    await queueService.markPatientServed(tokenId);
    res.json({ success: true, message: 'Patient marked as successfully served' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/skip', authenticateToken, requireRoles('doctor', 'admin', 'health_worker'), async (req, res) => {
  try {
    const tokenId = req.params.id as string;
    await queueService.skipPatient(tokenId);
    res.json({ success: true, message: 'Patient marked as skipped' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const tokenId = req.params.id as string;
    await queueService.cancelToken(tokenId);
    res.json({ success: true, message: 'Token cancelled' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
