import type { User } from '../models/types.js';

// This capability exists only for the synthetic administrator in the local DBMS entry point.
export const canManageAllDemoClinics = (user: User): boolean =>
  process.env.DBMS_DEMO_ALL_CLINICS === 'true' &&
  process.env.DATABASE_PROVIDER === 'mysql' &&
  process.env.AUTH_PROVIDER === 'local' &&
  ['development', 'test'].includes(process.env.NODE_ENV || '') &&
  ['127.0.0.1', 'localhost'].includes(process.env.MYSQL_HOST || '127.0.0.1') &&
  /^qureflow_(dbms|test(?:_[a-f0-9]+)?)$/.test(process.env.MYSQL_DATABASE || 'qureflow_dbms') &&
  user.id === 'admin-1' && user.role === 'admin' && user.metadata?.synthetic === true;
