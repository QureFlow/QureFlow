import { Router } from 'express';
import { queueService } from '../services/queueService.js';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { authenticateToken, requireRoles } from '../middlewares/authMiddleware.js';

const router = Router();

// Get queue status for a specific doctor
router.get('/doctor/:doctorId', async (req, res) => {
  try {
    const queue = await queueService.getDoctorQueue(req.params.doctorId);
    res.json(queue);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get queues for all doctors
router.get('/all', async (_req, res) => {
  try {
    const doctors = await dynamoDbRepo.getDoctors();
    const queues = await Promise.all(
      doctors.map((d) => queueService.getDoctorQueue(d.id))
    );
    res.json(queues);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Join queue (Patients or Reception Walk-in)
router.post('/join', async (req, res) => {
  try {
    const {
      doctorId,
      patientId,
      patientName,
      patientPhone,
      priority,
      isWalkIn,
      scheduledTime,
      appointmentId,
      dateStr,
    } = req.body;

    if (!doctorId || !patientName || !patientPhone) {
      res.status(400).json({ error: 'doctorId, patientName, and patientPhone are required' });
      return;
    }

    const token = await queueService.joinQueue({
      doctorId,
      patientId,
      patientName,
      patientPhone,
      priority: priority || 'normal',
      isWalkIn: Boolean(isWalkIn),
      scheduledTime,
      appointmentId,
      dateStr,
    });

    res.status(201).json(token);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Doctor or Admin calls next patient
router.post('/call-next', authenticateToken, requireRoles('doctor', 'admin', 'health_worker'), async (req, res) => {
  try {
    const { doctorId } = req.body;
    if (!doctorId) {
      res.status(400).json({ error: 'doctorId is required' });
      return;
    }

    const token = await queueService.callNextPatient(doctorId);
    res.json(token);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle pause queue for doctor
router.post('/pause', authenticateToken, requireRoles('doctor', 'admin', 'health_worker'), async (req, res) => {
  try {
    const { doctorId, paused } = req.body;
    if (!doctorId) {
      res.status(400).json({ error: 'doctorId is required' });
      return;
    }

    const result = await dynamoDbRepo.setDoctorPause(doctorId, Boolean(paused));
    res.json({ doctorId, isPaused: result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
