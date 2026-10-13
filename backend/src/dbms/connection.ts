import mysql, { type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { AppError } from '../lib/errors.js';

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3307),
  user: process.env.MYSQL_USER || 'qureflow',
  password: process.env.MYSQL_PASSWORD || 'qureflow_local_only',
  database: process.env.MYSQL_DATABASE || 'qureflow_dbms',
  connectionLimit: 10,
  timezone: 'Z',
  dateStrings: ['DATE'],
  decimalNumbers: true,
  multipleStatements: false,
});
export const rows = async (sql: string, values: any[] = [], connection = pool) =>
  (await connection.execute<RowDataPacket[]>(sql, values))[0];

export function sqlError(error: any): never {
  if (
    [
      'ER_DUP_ENTRY',
      'ER_LOCK_DEADLOCK',
      'ER_LOCK_WAIT_TIMEOUT',
      'ER_CHECK_CONSTRAINT_VIOLATED',
    ].includes(error.code)
  )
    throw new AppError(
      409,
      'This record changed, an active visit already exists, or the slot is full. Refresh and try again.',
      'CONFLICT',
    );
  if (error.code === 'ER_SIGNAL_EXCEPTION')
    throw new AppError(409, error.sqlMessage || 'Database validation failed.');
  throw error;
}
export async function transaction<T>(
  operation: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await operation(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    return sqlError(error);
  } finally {
    await connection
      .query('SET @qf_actor=NULL, @qf_request=NULL')
      .catch(() => connection.destroy());
    connection.release();
  }
}
