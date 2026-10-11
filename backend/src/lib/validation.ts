import { z } from 'zod';
import { AppError } from './errors.js';
import { clinicDate } from './time.js';
export const phoneDigits = (phone: string) =>
  phone.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine((v) => /^[6-9]\d{9}$/.test(phoneDigits(v)), 'Enter a valid 10-digit Indian mobile number')
  .transform(phoneDigits);
export const nameSchema = z.string().trim().min(2).max(100);
export const emailSchema = z.union([
  z.literal(''),
  z.string().trim().toLowerCase().email().max(254),
]);
export const passwordSchema = z
  .string()
  .min(12)
  .max(72)
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password must be no more than 72 bytes')
  .regex(/[A-Z]/, 'Password needs an uppercase letter')
  .regex(/[a-z]/, 'Password needs a lowercase letter')
  .regex(/[0-9]/, 'Password needs a number')
  .regex(/[^a-zA-Z0-9]/, 'Password needs a symbol');
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Invalid calendar date',
  );
export const bookingDateSchema = dateSchema.refine(
  (v) => v >= clinicDate() && v <= clinicDate(new Date(Date.now() + 90 * 86400000)),
  'Choose a date within the next 90 days',
);
export const profileSchema = z
  .object({
    name: nameSchema.optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    dob: dateSchema
      .refine((v) => v <= clinicDate(), 'Birth date cannot be in the future')
      .optional(),
    gender: z.enum(['Male', 'Female', 'Other']).optional(),
  })
  .strict();
export const registrationSchema = profileSchema
  .required({ name: true, phone: true, email: true })
  .extend({ password: passwordSchema });
export const settingsSchema = z
  .object({
    averageConsultationMinutes: z.number().int().min(2).max(60).optional(),
    bufferMinutes: z.number().int().min(0).max(30).optional(),
    allowWalkIns: z.boolean().optional(),
    allowEmergencyPriority: z.boolean().optional(),
    notifyOnTwoAhead: z.boolean().optional(),
    autoTokenPrefixByDoctor: z.boolean().optional(),
    clinicName: nameSchema.optional(),
    contactNumber: z.string().trim().min(3).max(30).optional(),
  })
  .strict();
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new AppError(
      400,
      result.error.issues.map((x) => `${x.path.join('.') || 'request'}: ${x.message}`).join('; '),
      'VALIDATION_ERROR',
    );
  return result.data;
}
