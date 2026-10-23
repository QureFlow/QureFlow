import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { db } from '../repositories/repository.js';
import { AppError } from './errors.js';
export const managesAllDemoClinics = (req: AuthenticatedRequest): boolean =>
  req.user?.demoAllClinics === true;
export const staffClinicFilter = (req: AuthenticatedRequest): string | undefined =>
  managesAllDemoClinics(req) ? undefined : staffClinic(req);
export async function selectedStaffClinic(req: AuthenticatedRequest): Promise<string> {
  const assigned = staffClinic(req);
  if (req.query.clinicId === undefined) return assigned;
  if (
    typeof req.query.clinicId !== 'string' ||
    (!managesAllDemoClinics(req) && req.query.clinicId !== assigned)
  )
    throw new AppError(403, 'This clinic is outside your workspace.');
  if (!(await db.getClinicById(req.query.clinicId))) throw new AppError(404, 'Clinic not found.');
  return req.query.clinicId;
}
export const staffClinic = (req: AuthenticatedRequest): string => {
  if (!req.user?.clinicId || req.user.role === 'patient')
    throw new AppError(403, 'An assigned clinic is required.');
  return req.user.clinicId;
};
export async function accessDoctor(req: AuthenticatedRequest, id: string) {
  const doctor = await db.getDoctorById(id);
  if (!doctor) throw new AppError(404, 'Doctor not found');
  if (
    req.user?.role !== 'patient' &&
    !managesAllDemoClinics(req) &&
    doctor.clinicId !== staffClinic(req)
  )
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
  const clinicId = staffClinicFilter(req);
  if (req.user?.role !== 'doctor') return db.getPatients(search, clinicId);
  if (!req.user.doctorId) throw new AppError(403, 'An assigned doctor is required.');
  await accessDoctor(req, req.user.doctorId);
  return db.patientsForDoctor(search, clinicId, req.user.doctorId);
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
