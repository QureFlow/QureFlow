import { Router } from 'express';
import { appointmentService } from '../services/appointmentService.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { patientId, doctorId, date } = req.query;
    const appointments = await appointmentService.getAppointments({
      patientId: typeof patientId === 'string' ? patientId : undefined,
      doctorId: typeof doctorId === 'string' ? doctorId : undefined,
      date: typeof date === 'string' ? date : undefined,
    });
    res.json(appointments);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { patientId, patientName, patientPhone, doctorId, date, time, notes } = req.body;
    if (!patientName || !patientPhone || !doctorId || !date || !time) {
      res.status(400).json({
        error: 'patientName, patientPhone, doctorId, date, and time are required for booking',
      });
      return;
    }

    const result = await appointmentService.createAppointment({
      patientId: patientId || `walkin-${Date.now()}`,
      patientName,
      patientPhone,
      doctorId,
      date,
      time,
      notes,
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/cancel', async (req, res) => {
  try {
    const aptId = req.params.id as string;
    const { reason } = req.body;
    await appointmentService.cancelAppointment(aptId, reason);
    res.json({ success: true, message: 'Appointment cancelled' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
