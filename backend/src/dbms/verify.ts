import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pool, rows } from './connection.js';
import { mysqlRepo } from '../repositories/mysqlRepo.js';
import { clinicDate } from '../lib/time.js';

async function verify() {
  assert.ok(['127.0.0.1', 'localhost'].includes(process.env.MYSQL_HOST || '127.0.0.1'));
  assert.match(process.env.MYSQL_DATABASE || 'qureflow_dbms', /^qureflow_dbms/);
  const counts = (
    await rows(
      "SELECT (SELECT COUNT(*) FROM clinics) clinics,(SELECT COUNT(*) FROM doctors) doctors,(SELECT COUNT(*) FROM users WHERE role='patient') patients,(SELECT COUNT(*) FROM queue_tokens) visits,(SELECT COUNT(*) FROM appointments) appointments,(SELECT COUNT(*) FROM specialties) specialties",
    )
  )[0];
  assert.equal(counts.clinics, 6);
  assert.equal(counts.doctors, 48);
  assert.ok(counts.patients >= 737);
  assert.ok(counts.visits >= 6000);
  const orphans = (
    await rows(
      'SELECT COUNT(*) n FROM queue_tokens t LEFT JOIN appointments a ON a.id=t.appointmentId WHERE t.appointmentId IS NOT NULL AND a.id IS NULL',
    )
  )[0].n;
  assert.equal(orphans, 0);
  const mismatches = (
    await rows(
      "SELECT COUNT(*) n FROM queue_tokens t JOIN appointments a ON a.id=t.appointmentId WHERE NOT (t.status='waiting' AND a.status IN ('booked','waiting') OR t.status='current' AND a.status='in_consultation' OR t.status='completed' AND a.status='completed' OR t.status='cancelled' AND a.status='cancelled' OR t.status='skipped' AND a.status='no_show')",
    )
  )[0].n;
  assert.equal(mismatches, 0);
  const duplicateActive = (
    await rows(
      "SELECT COUNT(*) n FROM (SELECT patientId,queueDate FROM queue_tokens WHERE status IN ('waiting','current') GROUP BY patientId,queueDate HAVING COUNT(*)>1) conflicts",
    )
  )[0].n;
  const duplicateServing = (
    await rows(
      "SELECT COUNT(*) n FROM (SELECT doctorId,queueDate FROM queue_tokens WHERE status='current' GROUP BY doctorId,queueDate HAVING COUNT(*)>1) conflicts",
    )
  )[0].n;
  assert.equal(duplicateActive, 0);
  assert.equal(duplicateServing, 0);
  const gynecology = await mysqlRepo.searchDoctors({
    specialization: 'Gynecology',
    status: 'active',
    sort: 'fee',
    limit: 9,
  });
  assert.equal(gynecology.total, 4);
  assert.ok(
    gynecology.doctors.every(
      (d, i, list) => !i || list[i - 1].consultationFee <= d.consultationFee,
    ),
  );
  const flow = await mysqlRepo.flowAnalytics('clinic-1');
  assert.equal(flow.trend.length, 14);
  assert.ok(new Set(flow.trend.map((d: any) => d.total)).size > 1);
  const [cursor]: any = await pool.query('CALL sp_doctor_workload_cursor(?,?)', [
    'clinic-1',
    clinicDate(),
  ]);
  assert.equal(cursor[0][0].workload.length, 8);
  const objects = await rows(
    'SELECT ROUTINE_NAME name,ROUTINE_TYPE type FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() ORDER BY ROUTINE_NAME',
  );
  const triggers = await rows(
    'SELECT TRIGGER_NAME name FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() ORDER BY TRIGGER_NAME',
  );
  assert.equal(objects.length, 3);
  assert.equal(triggers.length, 3);
  const report = {
    verifiedAt: new Date().toISOString(),
    database: 'MySQL local synthetic demo',
    counts,
    checks: {
      orphans,
      mismatches,
      duplicateActive,
      duplicateServing,
      gynecologists: gynecology.total,
      trendDays: flow.trend.length,
      cursorDoctors: cursor[0][0].workload.length,
    },
    objects,
    triggers,
  };
  const destination = path.resolve(
    process.cwd(),
    process.cwd().endsWith('backend') ? '../docs/verification' : 'docs/verification',
  );
  await mkdir(destination, { recursive: true });
  await writeFile(
    path.join(destination, 'mysql-verification.json'),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
}
verify()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
