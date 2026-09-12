import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { JWT_SECRET } from '../config/aws.js';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { cognitoService } from './cognitoService.js';
import { smsService } from './smsService.js';
import { User, UserRole } from '../models/types.js';

export interface AuthSession {
  user: User;
  token: string;
}

export class AuthService {
  private secret = JWT_SECRET;

  generateToken(user: User): string {
    return jwt.sign(
      {
        sub: user.id,
        role: user.role,
        name: user.name,
        phone: user.phone,
        email: user.email,
        clinicId: user.clinicId,
        staffId: user.staffId,
      },
      this.secret,
      { expiresIn: '7d' }
    );
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch {
      return null;
    }
  }

  async registerPatient(data: {
    name: string;
    phone: string;
    email: string;
    dob?: string;
    gender?: 'Male' | 'Female' | 'Other';
    password?: string;
  }): Promise<AuthSession> {
    const existing = await dynamoDbRepo.findUserByIdentifier(data.phone);
    if (existing) {
      throw new Error('An account with this phone number already exists.');
    }

    if (data.email) {
      const existingEmail = await dynamoDbRepo.findUserByIdentifier(data.email);
      if (existingEmail) {
        throw new Error('An account with this email already exists.');
      }
    }

    // If AWS Cognito is configured with User Pool & Client IDs, register directly with Cognito
    if (cognitoService.isConfigured()) {
      try {
        await cognitoService.signUp({
          name: data.name,
          phone: data.phone,
          email: data.email,
          password: data.password,
          gender: data.gender,
          dob: data.dob,
          role: 'patient',
        });
      } catch (err: any) {
        throw new Error(`AWS Cognito Sign-up Error: ${err.message}`);
      }
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = data.password ? await bcrypt.hash(data.password, salt) : undefined;

    const newUser: User = {
      id: `patient-${uuidv4().substring(0, 8)}`,
      name: data.name.trim(),
      phone: data.phone.trim(),
      email: data.email.trim().toLowerCase(),
      role: 'patient',
      dob: data.dob,
      gender: data.gender,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    await dynamoDbRepo.saveUser(newUser);

    const token = this.generateToken(newUser);
    const sanitizedUser = { ...newUser };
    delete sanitizedUser.passwordHash;

    return { user: sanitizedUser, token };
  }

  async login(identifier: string, password?: string): Promise<AuthSession> {
    const cleanId = identifier.trim();

    // If AWS Cognito is configured, authenticate through Cognito User Pool
    if (cognitoService.isConfigured() && password) {
      try {
        const authResult = await cognitoService.signIn(cleanId, password);
        let user = await dynamoDbRepo.findUserByIdentifier(cleanId);
        if (!user) {
          user = {
            id: `user-${uuidv4().substring(0, 8)}`,
            name: cleanId,
            phone: cleanId,
            email: cleanId.includes('@') ? cleanId : '',
            role: 'patient',
            createdAt: new Date().toISOString(),
          };
          await dynamoDbRepo.saveUser(user);
        }
        return {
          user,
          token: authResult?.IdToken || this.generateToken(user),
        };
      } catch (err: any) {
        // Fallback: Check DynamoDB if this account is provisioned directly (e.g. staff/admin with bcrypt hash)
        const localUser = await dynamoDbRepo.findUserByIdentifier(cleanId);
        if (localUser && localUser.passwordHash) {
          const isMatch = await bcrypt.compare(password, localUser.passwordHash);
          if (isMatch) {
            const sanitized = { ...localUser };
            delete sanitized.passwordHash;
            return {
              user: sanitized,
              token: this.generateToken(sanitized),
            };
          }
        }
        throw new Error(`AWS Cognito Authentication Error: ${err.message}`);
      }
    }
    let user = await dynamoDbRepo.findUserByIdentifier(cleanId);

    // Fallback: If user is not yet in database but is standard demo admin/patient, provision them
    if (!user) {
      if (cleanId.toLowerCase() === 'admin@bolpurhealth.org' || cleanId.toUpperCase() === 'REC-204' || cleanId.toLowerCase() === 'admin') {
        user = {
          id: 'admin-1',
          name: 'Bishakha Roy',
          email: 'admin@bolpurhealth.org',
          phone: '+91 98321 00000',
          role: 'admin',
          staffId: 'REC-204',
          clinicId: 'clinic-1',
          createdAt: new Date().toISOString(),
        };
        await dynamoDbRepo.saveUser(user);
      } else if (cleanId === '9876543210' || cleanId.toLowerCase() === 'suman.roy@example.com') {
        user = {
          id: 'patient-1',
          name: 'Suman Roy',
          phone: '9876543210',
          email: 'suman.roy@example.com',
          role: 'patient',
          dob: '1988-05-14',
          gender: 'Male',
          createdAt: new Date().toISOString(),
        };
        await dynamoDbRepo.saveUser(user);
      }
    }

    if (!user) {
      throw new Error('No account found with this identifier. Please verify your credentials or register.');
    }

    // Verify password if hash exists
    if (user.passwordHash && password) {
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        throw new Error('Invalid password provided.');
      }
    }

    const token = this.generateToken(user);
    const sanitized = { ...user };
    delete sanitized.passwordHash;

    return { user: sanitized, token };
  }

  async forgotPassword(identifier: string): Promise<{ success: boolean; message: string; deliveryDetails?: any }> {
    const cleanId = identifier.trim();
    const dbUser = await dynamoDbRepo.findUserByIdentifier(cleanId);
    const targetPhone = dbUser?.phone || (cleanId.replace(/[^0-9]/g, '').length >= 10 ? cleanId : null);

    // 1. If phone number is available, attempt live Indian SMS dispatch via Fast2SMS / 2Factor
    if (targetPhone) {
      const otp = smsService.generateOtp(targetPhone);
      const smsRes = await smsService.sendOtpSms(targetPhone, otp);
      if (smsRes.success) {
        return {
          success: true,
          message: `Live OTP successfully sent to your mobile phone via ${smsRes.provider}!`,
          deliveryDetails: { DeliveryMedium: 'SMS', Destination: targetPhone },
        };
      }
    }

    // 2. Fallback to AWS Cognito dispatch
    if (cognitoService.isConfigured()) {
      try {
        const cognitoId = (dbUser?.email && dbUser.email.trim()) || (dbUser?.phone && dbUser.phone.trim()) || cleanId;
        const details = await cognitoService.forgotPassword(cognitoId);
        const deliveryMedium = details?.DeliveryMedium || 'SMS';
        const destination = details?.Destination || 'your registered contact';
        return {
          success: true,
          message: `Reset code dispatched via AWS Cognito (${deliveryMedium}) to ${destination}. (Or use sandbox code 123456).`,
          deliveryDetails: details,
        };
      } catch (err: any) {
        if (dbUser || targetPhone) {
          return {
            success: true,
            message: 'OTP generated. (If cellular carriers delay SMS, sandbox code 123456 is accepted).',
          };
        }
        throw new Error(`Cognito Reset Request Error: ${err.message}`);
      }
    }

    // Local / DynamoDB fallback
    const user = await dynamoDbRepo.findUserByIdentifier(cleanId);
    if (!user) {
      throw new Error('No user account found matching this identifier.');
    }

    return {
      success: true,
      message: 'Demo mode: Reset code is 123456.',
    };
  }

  async confirmForgotPassword(
    identifier: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const cleanId = identifier.trim();
    const dbUser = await dynamoDbRepo.findUserByIdentifier(cleanId);
    const targetPhone = dbUser?.phone || (cleanId.replace(/[^0-9]/g, '').length >= 10 ? cleanId : null);

    // 1. Verify against live SMS OTP store if verified via Fast2SMS / 2Factor
    if (targetPhone && smsService.verifyOtp(targetPhone, code)) {
      const localUser = dbUser || (await dynamoDbRepo.findUserByIdentifier(cleanId));
      if (localUser) {
        const salt = await bcrypt.genSalt(10);
        localUser.passwordHash = await bcrypt.hash(newPassword, salt);
        await dynamoDbRepo.saveUser(localUser);
      }
      return {
        success: true,
        message: 'Your password has been successfully reset using phone OTP verification!',
      };
    }

    // 2. Verify via AWS Cognito
    if (cognitoService.isConfigured()) {
      try {
        const cognitoId = (dbUser?.email && dbUser.email.trim()) || (dbUser?.phone && dbUser.phone.trim()) || cleanId;
        await cognitoService.confirmForgotPassword(cognitoId, code.trim(), newPassword);
      } catch (err: any) {
        // If telecom operator blocked SMS or account in SMS sandbox, allow developer code 123456
        if (code.trim() === '123456') {
          const localUser = dbUser || (await dynamoDbRepo.findUserByIdentifier(cleanId));
          if (localUser) {
            const salt = await bcrypt.genSalt(10);
            localUser.passwordHash = await bcrypt.hash(newPassword, salt);
            await dynamoDbRepo.saveUser(localUser);
            return {
              success: true,
              message: 'Your password has been successfully reset using sandbox verification.',
            };
          }
        }
        throw new Error(`Cognito Password Reset Error: ${err.message}`);
      }
    }

    // Also update DynamoDB passwordHash if user exists locally
    const user = await dynamoDbRepo.findUserByIdentifier(cleanId);
    if (user) {
      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(newPassword, salt);
      await dynamoDbRepo.saveUser(user);
    }

    return {
      success: true,
      message: 'Your password has been successfully reset. You can now sign in with your new password.',
    };
  }
}

export const authService = new AuthService();
