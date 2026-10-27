import type { DynamoDbRepository } from './dynamoDbRepo.js';
import type { User } from '../models/types.js';
import { mysqlRepo } from './mysqlRepo.js';
import { dynamoDbRepo } from './dynamoDbRepo.js';
import { canManageAllDemoClinics } from '../lib/demoAccess.js';

export const publicUser = (user: User): User => {
  const { passwordHash, cognitoSub, sessionVersion, ...safe } = user;
  return { ...safe, demoAllClinics: canManageAllDemoClinics(user) };
};
// Pick strips private implementation details while retaining the existing typed API.
export const db: Pick<DynamoDbRepository, keyof DynamoDbRepository> =
  process.env.DATABASE_PROVIDER === 'mysql' ? mysqlRepo : dynamoDbRepo;
