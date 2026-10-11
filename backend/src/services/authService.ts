import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { JWT_SECRET } from '../config/aws.js';
import { dynamoDbRepo, publicUser } from '../repositories/dynamoDbRepo.js';
import { cognitoService } from './cognitoService.js';
import { User } from '../models/types.js';
import { AppError } from '../lib/errors.js';
import { parse, registrationSchema, passwordSchema } from '../lib/validation.js';

const pool = process.env.COGNITO_USER_POOL_ID,
  client = process.env.COGNITO_CLIENT_ID;
const verifier =
  pool && client && cognitoService.isConfigured()
    ? CognitoJwtVerifier.create({ userPoolId: pool, clientId: client, tokenUse: 'access' })
    : null;
export class AuthService {
  generateToken(user: User): string {
    return jwt.sign({ sub: user.id, sessionVersion: user.sessionVersion || 0 }, JWT_SECRET, {
      expiresIn: '1h',
      issuer: 'qureflow',
      audience: 'qureflow-api',
      algorithm: 'HS256',
    });
  }
  async verifyToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload | null;
      if (decoded?.iss === 'qureflow') {
        const payload = jwt.verify(token, JWT_SECRET, {
          algorithms: ['HS256'],
          issuer: 'qureflow',
          audience: 'qureflow-api',
        }) as jwt.JwtPayload;
        const user = payload.sub ? await dynamoDbRepo.getUserById(payload.sub) : null;
        return user &&
          !user.cognitoSub &&
          (user.sessionVersion || 0) === (payload.sessionVersion || 0)
          ? user
          : null;
      }
      if (!verifier) return null;
      const payload = await verifier.verify(token);
      return await dynamoDbRepo.findUserByCognitoSub(payload.sub);
    } catch {
      return null;
    }
  }
  async registerPatient(input: unknown) {
    const data = parse(registrationSchema, input);
    if (
      (await dynamoDbRepo.findUserByIdentifier(data.phone)) ||
      (data.email && (await dynamoDbRepo.findUserByIdentifier(data.email)))
    )
      throw new AppError(409, 'An account with these contact details already exists.');
    let cognitoSub: string | undefined,
      confirmationRequired = false;
    if (cognitoService.isConfigured()) {
      const result = await cognitoService.signUp(data);
      cognitoSub = result.UserSub;
      confirmationRequired = !result.UserConfirmed;
    }
    const user: User = {
      id: `patient-${randomUUID()}`,
      name: data.name,
      phone: data.phone,
      email: data.email,
      dob: data.dob,
      gender: data.gender,
      role: 'patient',
      createdAt: new Date().toISOString(),
      sessionVersion: 0,
      ...(cognitoSub ? { cognitoSub } : { passwordHash: await bcrypt.hash(data.password, 12) }),
    };
    const saved = await dynamoDbRepo.saveUser(user);
    // A Cognito account must confirm and sign in before receiving a session.
    return {
      user: publicUser(saved),
      token: cognitoSub ? '' : this.generateToken(saved),
      confirmationRequired,
      requiresLogin: Boolean(cognitoSub),
      identifier: data.email || data.phone,
    };
  }
  async login(identifier: string, password?: string) {
    if (
      typeof identifier !== 'string' ||
      typeof password !== 'string' ||
      !password ||
      Buffer.byteLength(password, 'utf8') > 72
    )
      throw new AppError(401, 'Invalid identifier or password.');
    let user = await dynamoDbRepo.findUserByIdentifier(identifier);
    if (user?.cognitoSub || (cognitoService.isConfigured() && (!user || user.role === 'patient'))) {
      let result;
      try {
        result = await cognitoService.signIn(user?.email || user?.phone || identifier, password);
      } catch {
        throw new AppError(401, 'Sign-in failed. Check your credentials and confirm your account.');
      }
      if (!result?.AccessToken || !verifier)
        throw new AppError(401, 'Sign-in requires an additional Cognito challenge.');
      const claims = await verifier.verify(result.AccessToken);
      if (!user) throw new AppError(401, 'Your account profile is missing. Contact the clinic.');
      if (user.cognitoSub && user.cognitoSub !== claims.sub)
        throw new AppError(401, 'Account identity mismatch.');
      if (!user.cognitoSub) {
        const { passwordHash, ...profile } = user;
        user = await dynamoDbRepo.saveUser({ ...profile, cognitoSub: claims.sub });
      }
      return { user: publicUser(user), token: result.AccessToken };
    }
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash)))
      throw new AppError(401, 'Invalid identifier or password.');
    return { user: publicUser(user), token: this.generateToken(user) };
  }
  async forgotPassword(identifier: string) {
    if (typeof identifier !== 'string')
      throw new AppError(400, 'Enter your registered email or phone.');
    if (cognitoService.isConfigured()) {
      const user = await dynamoDbRepo.findUserByIdentifier(identifier);
      try {
        await cognitoService.forgotPassword(user?.email || user?.phone || identifier);
      } catch {
        /* Avoid account enumeration. Never accept a fallback code. */
      }
    }
    return {
      success: true,
      message:
        'If an eligible account exists, a recovery code will be sent to its registered contact. Contact your administrator for locally provisioned accounts.',
    };
  }
  async confirmForgotPassword(identifier: string, code: string, newPassword: string) {
    parse(passwordSchema, newPassword);
    if (!cognitoService.isConfigured())
      throw new AppError(
        400,
        'Self-service recovery is unavailable for local accounts. Contact your administrator.',
      );
    const user = await dynamoDbRepo.findUserByIdentifier(identifier);
    try {
      await cognitoService.confirmForgotPassword(
        user?.email || user?.phone || identifier,
        code,
        newPassword,
      );
    } catch {
      throw new AppError(400, 'Recovery code is invalid or expired.');
    }
    return { success: true, message: 'Password updated. Sign in with your new password.' };
  }
  async confirmRegistration(identifier: string, code: string) {
    if (!cognitoService.isConfigured())
      throw new AppError(400, 'Account verification is unavailable in local mode.');
    const user = await dynamoDbRepo.findUserByIdentifier(identifier);
    try {
      await cognitoService.confirmSignUp(user?.email || user?.phone || identifier, code);
    } catch {
      throw new AppError(400, 'Verification code is invalid or expired.');
    }
    return { success: true, message: 'Account verified. You can sign in now.' };
  }
}
export const authService = new AuthService();
