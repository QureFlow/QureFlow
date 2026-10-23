import type { User } from '../models/types.js';

const loopback = (endpoint?: string) => {
  try {
    return (
      Boolean(endpoint) && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint!).hostname)
    );
  } catch {
    return false;
  }
};

// This capability exists only for the synthetic administrator of the local DynamoDB demo.
export const canManageAllDemoClinics = (user: User): boolean =>
  process.env.DEMO_ALL_CLINICS === 'true' &&
  process.env.AUTH_PROVIDER === 'local' &&
  ['development', 'test'].includes(process.env.NODE_ENV || '') &&
  loopback(process.env.DYNAMODB_ENDPOINT) &&
  /^QureFlow(Demo|Test)/.test(process.env.DYNAMODB_TABLE_NAME || '') &&
  user.id === 'admin-1' &&
  user.role === 'admin' &&
  user.metadata?.synthetic === true;
