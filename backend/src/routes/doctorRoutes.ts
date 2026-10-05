import { Router } from 'express';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { appointmentService } from '../services/appointmentService.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/doctors', async (req, res) => {
  try {
    let doctors = await dynamoDbRepo.getDoctors();
    const { specialization, query, availableTodayOnly } = req.query;

    if (query && typeof query === 'string') {
      const q = query.toLowerCase();
      doctors = doctors.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.specialization.toLowerCase().includes(q) ||
          d.clinicName.toLowerCase().includes(q)
      );
    }

    if (specialization && specialization !== 'all' && typeof specialization === 'string') {
      doctors = doctors.filter((d) => d.specialization === specialization);
    }

    if (availableTodayOnly === 'true') {
      doctors = doctors.filter((d) => d.isAvailableToday);
    }

    res.json(doctors);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/doctors/:id', async (req, res) => {
  try {
    const doctorId = req.params.id as string;
    const doctor = await dynamoDbRepo.getDoctorById(doctorId);
    if (!doctor) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }
    res.json(doctor);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/doctors/:id/slots', async (req, res) => {
  try {
    const doctorId = req.params.id as string;
    const dateStr = (req.query.date as string) || new Date().toISOString().split('T')[0];
    const slots = await appointmentService.getDoctorSlotAvailability(doctorId, dateStr);
    res.json(slots);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/doctors', authenticateToken, requireRoles('admin', 'health_worker'), async (req, res) => {
  try {
    const newDoc = {
      ...req.body,
      id: req.body.id || `doc-${Date.now()}`,
    };
    const saved = await dynamoDbRepo.saveDoctor(newDoc);
    res.status(201).json(saved);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/doctors/:id', authenticateToken, requireRoles('admin', 'health_worker'), async (req, res) => {
  try {
    const doctorId = req.params.id as string;
    const existing = await dynamoDbRepo.getDoctorById(doctorId);
    if (!existing) {
      res.status(404).json({ error: 'Doctor not found' });
      return;
    }
    const updated = await dynamoDbRepo.saveDoctor({ ...existing, ...req.body });
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
