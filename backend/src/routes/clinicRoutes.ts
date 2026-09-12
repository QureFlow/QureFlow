import { Router } from 'express';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/clinics', async (_req, res) => {
  try {
    const clinics = await dynamoDbRepo.getClinics();
    res.json(clinics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/clinics/:id', async (req, res) => {
  try {
    const clinicId = req.params.id as string;
    const clinic = await dynamoDbRepo.getClinicById(clinicId);
    if (!clinic) {
      res.status(404).json({ error: 'Clinic not found' });
      return;
    }
    res.json(clinic);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/settings', async (_req, res) => {
  try {
    const settings = await dynamoDbRepo.getSettings();
    res.json(settings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/settings', authenticateToken, requireRoles('admin', 'health_worker'), async (req, res) => {
  try {
    const updated = await dynamoDbRepo.saveSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
