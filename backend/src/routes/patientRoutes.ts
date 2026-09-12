import { Router, Response } from 'express';
import { queueService } from '../services/queueService.js';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { authenticateToken, AuthenticatedRequest, requireRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Retrieve patient active token status, queue position, and estimated wait
router.get('/me/status', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const identifier = req.user.sub || req.user.phone;
    const status = await queueService.getPatientActiveStatus(identifier);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Admin/Doctor patient list
router.get('/', authenticateToken, requireRoles('admin', 'health_worker', 'doctor'), async (req, res) => {
  try {
    const search = req.query.query as string | undefined;
    const patients = await dynamoDbRepo.getPatients(search);
    res.json(patients);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const patientId = req.params.id as string;
    const patient = await dynamoDbRepo.getUserById(patientId);
    if (!patient) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }
    const sanitized = { ...patient };
    delete sanitized.passwordHash;
    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.params.id as string;
    const existing = await dynamoDbRepo.getUserById(patientId);
    if (!existing) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // Only allow updating own profile unless admin
    if (req.user?.role !== 'admin' && req.user?.sub !== patientId) {
      res.status(403).json({ error: 'Forbidden: Cannot update other patients' });
      return;
    }

    const updated = await dynamoDbRepo.saveUser({ ...existing, ...req.body });
    const sanitized = { ...updated };
    delete sanitized.passwordHash;
    res.json(sanitized);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
