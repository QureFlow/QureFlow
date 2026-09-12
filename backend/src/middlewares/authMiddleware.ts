import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { UserRole } from '../models/types.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    role: UserRole;
    name: string;
    phone: string;
    email: string;
    clinicId?: string;
    staffId?: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = authService.verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Token is invalid or expired' });
    return;
  }

  req.user = payload;
  next();
};

export const requireRoles = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden: User role '${req.user.role}' is not authorized for this resource`,
      });
      return;
    }

    next();
  };
};
