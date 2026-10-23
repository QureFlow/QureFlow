import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';
import { UserRole } from '../models/types.js';
import { requestContext } from '../lib/context.js';
import { canManageAllDemoClinics } from '../lib/demoAccess.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    sub: string;
    role: UserRole;
    name: string;
    phone: string;
    email: string;
    clinicId?: string;
    staffId?: string;
    doctorId?: string;
    demoAllClinics?: boolean;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = await authService.verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Unauthorized: Token is invalid or expired' });
    return;
  }

  req.user = {
    sub: payload.id,
    role: payload.role,
    name: payload.name,
    phone: payload.phone,
    email: payload.email,
    clinicId: payload.clinicId,
    staffId: payload.staffId,
    doctorId: payload.doctorId,
    demoAllClinics: canManageAllDemoClinics(payload),
  };
  const context = requestContext.getStore();
  if (context) context.actorId = payload.id;
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
