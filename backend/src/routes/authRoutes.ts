import { Router, Response } from 'express';
import { authService } from '../services/authService.js';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, dob, gender, password } = req.body;
    if (!name || !phone) {
      res.status(400).json({ error: 'Name and phone number are required' });
      return;
    }

    const session = await authService.registerPatient({
      name,
      phone,
      email: email || '',
      dob,
      gender,
      password,
    });

    res.status(201).json(session);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier) {
      res.status(400).json({ error: 'Phone number, email, or Staff ID is required' });
      return;
    }

    const session = await authService.login(identifier, password);
    res.json(session);
  } catch (err: any) {
    res.status(401).json({ error: err.message || 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const user = await dynamoDbRepo.getUserById(req.user.sub);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
