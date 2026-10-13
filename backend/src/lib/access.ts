import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { db } from '../repositories/repository.js';
import { AppError } from './errors.js';
import { mysqlRepo } from '../repositories/mysqlRepo.js';
export const staffClinic = (req: AuthenticatedRequest): string => {
  if (!req.user?.clinicId || req.user.role === 'patient')
    throw new AppError(403, 'An assigned clinic is required.');
  return req.user.clinicId;
};
export async function accessDoctor(req: AuthenticatedRequest, id: string) {
  const doctor = await db.getDoctorById(id);
  if (!doctor) throw new AppError(404, 'Doctor not found');
  if (req.user?.role !== 'patient' && doctor.clinicId !== staffClinic(req))
    throw new AppError(403, 'This doctor belongs to another clinic.');
  if (req.user?.role === 'doctor' && (req.user as any).doctorId !== id)
    throw new AppError(403, 'You can only manage your assigned queue.');
  return doctor;
}
export async function accessPatient(req: AuthenticatedRequest, id: string) {
  if (req.user?.role === 'patient') {
    if (req.user.sub !== id) throw new AppError(403, 'You can only access your own profile.');
    return;
  }
  const list = await accessiblePatients(req);
  if (!list.some((u) => u.id === id))
    throw new AppError(403, 'This patient is outside your clinic.');
}
export async function accessiblePatients(req: AuthenticatedRequest, search?: string) {
  if (process.env.DATABASE_PROVIDER === 'mysql') {
    const clinicId = staffClinic(req);
    if (req.user?.role === 'doctor') {
      if (!req.user.doctorId) throw new AppError(403, 'An assigned doctor is required.');
      await accessDoctor(req, req.user.doctorId);
    }
    return mysqlRepo.patientsForDoctor(
      search,
      clinicId,
      req.user?.role === 'doctor' ? req.user.doctorId : undefined,
    );
  }
  const clinicId = staffClinic(req),
    patients = await db.getPatients(search, clinicId);
  if (req.user?.role !== 'doctor') return patients;
  if (!req.user.doctorId) throw new AppError(403, 'An assigned doctor is required.');
  await accessDoctor(req, req.user.doctorId);
  const seen = new Set(
    (await db.getAppointments({ doctorId: req.user.doctorId }))
      .filter((a) => a.clinicId === clinicId)
      .map((a) => a.patientId),
  );
  for (const token of await db.getAllTokensForQueue(db.getQueueId(req.user.doctorId)))
    if (token.patientId) seen.add(token.patientId);
  return patients.filter((patient) => seen.has(patient.id));
}
export async function accessToken(req: AuthenticatedRequest, id: string) {
  const found = await db.findTokenById(id);
  if (!found) throw new AppError(404, 'Token not found');
  if (req.user?.role === 'patient') {
    if (found.token.patientId !== req.user.sub)
      throw new AppError(403, 'You can only access your own token.');
  } else await accessDoctor(req, found.token.doctorId);
  return found;
}
