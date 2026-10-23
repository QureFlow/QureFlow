import type { User } from '../models/types.js';
import { dynamoDbRepo } from './dynamoDbRepo.js';
import { canManageAllDemoClinics } from '../lib/demoAccess.js';

export const publicUser = (user: User): User => {
  const { passwordHash, cognitoSub, sessionVersion, ...safe } = user;
  return { ...safe, demoAllClinics: canManageAllDemoClinics(user) };
};
export const db = dynamoDbRepo;
