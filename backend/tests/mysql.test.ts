import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const database = 'qureflow_test_' + randomUUID().replaceAll('-', '');
assert.match(database, /^qureflow_test_[a-f0-9]{32}$/);
process.env.MYSQL_DATABASE = database;
process.env.DATABASE_PROVIDER = 'mysql';
process.env.AUTH_PROVIDER = 'local';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const root = path.resolve(process.cwd(), process.cwd().endsWith('backend') ? '..' : '.');
function adminSql(sql: string) {
  return execFileSync(
    'docker',
    [
      'compose',
      '-p',
      'qureflow-dbms',
      '-f',
      path.join(root, 'compose.dbms.yaml'),
      'exec',
      '-T',
      'mysql',
      'mysql',
      '-uroot',
      '-pqureflow_local_root_only',
      '-e',
      sql,
    ],
    { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
  );
}
test('MySQL DBMS integration', async (suite) => {
  adminSql('CREATE DATABASE ' + database + '; GRANT ALL ON ' + database + ".* TO 'qureflow'@'%';");
  const { pool, rows } = await import('../src/dbms/connection.js');
  let server: any;
  try {
    const { migrateMysql } = await import('../src/dbms/migrate.js');
    await migrateMysql();
    const { mysqlRepo: repo } = await import('../src/repositories/mysqlRepo.js');
    const { CLINICS, DOCTORS } = await import('../src/seed.js');
    for (const c of CLINICS) await repo.saveClinic({ ...c, metadata: { synthetic: true } });
    for (const d of DOCTORS)
      await repo.saveDoctor({
        ...d,
        consultationDays: [
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
          'Sunday',
        ],
        languages: ['English', 'Hindi'],
        metadata: { synthetic: true },
      });
    const bcrypt = await import('bcryptjs');
    const staffHash = await bcrypt.default.hash('DemoClinic123!', 4),
      patientHash = await bcrypt.default.hash('DemoPatient123!', 4);
    for (const u of [
      {
        id: 'admin-1',
        name: 'Clinic one staff',
        email: 'demo.staff@example.invalid',
        phone: '9900000000',
        role: 'admin',
        clinicId: 'clinic-1',
        passwordHash: staffHash,
      },
      {
        id: 'admin-2',
        name: 'Clinic two staff',
        email: 'demo.staff2@example.invalid',
        phone: '9900000001',
        role: 'admin',
        clinicId: 'clinic-2',
        passwordHash: staffHash,
      },
      {
        id: 'patient-1',
        name: 'Demo Patient',
        email: 'demo.patient@example.invalid',
        phone: '9900000002',
        role: 'patient',
        passwordHash: patientHash,
      },
      {
        id: 'patient-2',
        name: 'Second patient',
        email: 'patient2@example.invalid',
        phone: '9900000003',
        role: 'patient',
        passwordHash: patientHash,
      },
      {
        id: 'patient-3',
        name: 'Third patient',
        email: 'patient3@example.invalid',
        phone: '9900000004',
        role: 'patient',
        passwordHash: patientHash,
      },
    ] as const)
      await repo.saveUser({ ...u, metadata: { synthetic: true } });
    const { app } = await import('../src/server.js');
    const { authService: auth } = await import('../src/services/authService.js');
    const { queueService: queue } = await import('../src/services/queueService.js');
    const { appointmentService: appointments } = await import(
      '../src/services/appointmentService.js'
    );
    const { clinicDate } = await import('../src/lib/time.js');
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const base = 'http://127.0.0.1:' + server.address().port + '/api';
    const api = async (endpoint: string, token?: string, method = 'GET', body?: any) => {
      const r = await fetch(base + endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    const admin = await auth.login('demo.staff@example.invalid', 'DemoClinic123!'),
      other = await auth.login('demo.staff2@example.invalid', 'DemoClinic123!'),
      patient = await auth.login('demo.patient@example.invalid', 'DemoPatient123!');
    const today = clinicDate(),
      future = clinicDate(new Date(Date.now() + 86400000));
    const join = (id: string, doctorId = 'doc-1', priority: 'normal' | 'emergency' = 'normal') =>
      queue.joinQueue({
        doctorId,
        patientId: id,
        patientName: 'Synthetic',
        patientPhone: '9900000002',
        isWalkIn: true,
        priority,
      });

    await suite.test(
      'directory joins specialty, clinic and normalized language with SQL ordering',
      async () => {
        const r = await api(
          '/doctors/search?specialization=' +
            encodeURIComponent('Obstetrics & Gynecology') +
            '&language=Hindi&sort=fee&pageSize=1',
        );
        assert.equal(r.status, 200);
        assert.equal(r.body.total, 1);
        assert.equal(r.body.doctors[0].specialization, 'Obstetrics & Gynecology');
        assert.ok(r.body.doctors[0].languages.includes('Hindi'));
        const page = await api('/doctors/search?sort=experience&pageSize=2&page=2');
        assert.equal(page.status, 200);
        assert.equal(page.body.total, 10);
        assert.equal(page.body.doctors.length, 2);
        assert.ok(page.body.doctors[0].experienceYears >= page.body.doctors[1].experienceYears);
      },
    );
    await suite.test(
      'SQL injection values cannot change search or select arbitrary sort expressions',
      async () => {
        assert.equal(
          (await api('/doctors/search?query=' + encodeURIComponent("' OR 1=1 --"))).body.total,
          0,
        );
        assert.equal(
          (await api('/doctors/search?sort=' + encodeURIComponent('name; DROP TABLE doctors')))
            .status,
          400,
        );
        assert.equal((await repo.getDoctors()).length, 10);
      },
    );
    await suite.test('empty search and out-of-range pages preserve a correct total', async () => {
      const absent = await api('/doctors/search?specialization=Unknown');
      assert.equal(absent.body.total, 0);
      const far = await api('/doctors/search?page=999');
      assert.equal(far.body.total, 10);
      assert.deepEqual(far.body.doctors, []);
      assert.equal((await api('/doctors/search?pageSize=10000')).status, 400);
    });
    await suite.test('unauthenticated access and cross-clinic writes remain denied', async () => {
      assert.equal((await api('/queues/all')).status, 401);
      assert.equal(
        (await api('/queues/pause', other.token, 'POST', { doctorId: 'doc-1', paused: true }))
          .status,
        403,
      );
      assert.equal((await api('/patients/patient-2', admin.token)).status, 403);
    });
    let first: any, second: any;
    await suite.test(
      'simultaneous registrations cannot create two active visits for one patient',
      async () => {
        const results = await Promise.allSettled([join('patient-1'), join('patient-1')]);
        assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
        first = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>)
          .value;
        assert.equal(
          (
            await rows(
              "SELECT COUNT(*) n FROM queue_tokens WHERE patientId='patient-1' AND status IN ('waiting','current')",
            )
          )[0].n,
          1,
        );
      },
    );
    await suite.test('foreign keys reject orphan visits', async () => {
      await assert.rejects(() =>
        pool.execute(
          "INSERT INTO queue_tokens(id,patientId,doctorId,queueDate,tokenSeq,tokenNumber,status,createdAt,updatedAt) VALUES ('orphan','missing','doc-1',?,500,'A-500','waiting',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
          [today],
        ),
        (error: any) => error.code === 'ER_NO_REFERENCED_ROW_2',
      );
    });
    await suite.test('emergency priority is selected by SQL before a normal token', async () => {
      second = await join('patient-2', 'doc-1', 'emergency');
      const next = await queue.callNextPatient('doc-1');
      assert.equal(next?.id, second.id);
      assert.equal((await repo.getWaitingTokens(repo.getQueueId('doc-1')))[0].id, first.id);
    });
    await suite.test(
      'database unique constraint prevents a second simultaneous consultation',
      async () => {
        await assert.rejects(() =>
          repo.updateTokenStatus(first.id, 'TOKEN', 'current', {
            calledAt: new Date().toISOString(),
          }),
        );
        assert.equal(
          (
            await rows(
              "SELECT COUNT(*) n FROM queue_tokens WHERE status='current' AND doctorId='doc-1'",
            )
          )[0].n,
          1,
        );
      },
    );
    await suite.test('patient queue responses conceal other patient identity', async () => {
      const r = await api('/queues/doctor/doc-1', patient.token);
      assert.equal(r.status, 200);
      assert.ok(
        r.body.tokens
          .filter((t: any) => t.patientId !== 'patient-1')
          .every((t: any) => !t.patientPhone && !t.patientName),
      );
      assert.equal(
        (await api('/tokens/' + second.id + '/cancel', patient.token, 'POST', {})).status,
        403,
      );
    });
    await suite.test(
      'trigger records state changes and rejects reopening completed visits',
      async () => {
        await queue.markPatientServed(second.id);
        await assert.rejects(() =>
          pool.execute("UPDATE queue_tokens SET status='waiting' WHERE id=?", [second.id]),
        );
        const events = await repo.getAuditEvents('clinic-1');
        assert.ok(events.some((e) => e.entityId === second.id && e.action === 'status_changed'));
        assert.ok(
          events.every(
            (e) =>
              !JSON.stringify(e.details).includes('password') &&
              !JSON.stringify(e.details).includes('patientPhone'),
          ),
        );
      },
    );
    await suite.test('pause is respected and the next call resumes correctly', async () => {
      await repo.setDoctorPause('doc-1', true);
      await assert.rejects(() => queue.callNextPatient('doc-1'));
      await repo.setDoctorPause('doc-1', false);
      assert.equal((await queue.callNextPatient('doc-1'))?.id, first.id);
      await queue.markPatientServed(first.id);
    });
    let booking: any;
    await suite.test(
      'appointment and token are created atomically with capacity accounting',
      async () => {
        const slot = (await appointments.getDoctorSlotAvailability('doc-1', future)).find(
          (s) => s.available,
        )!;
        assert.ok(slot);
        booking = await appointments.createAppointment({
          patientId: 'patient-1',
          patientName: 'Demo Patient',
          patientPhone: '9900000002',
          doctorId: 'doc-1',
          date: future,
          time: slot.time,
        });
        assert.equal(booking.appointment.tokenId, booking.token.id);
        assert.equal(
          (
            await rows(
              'SELECT bookedCount FROM appointment_slots WHERE doctorId=? AND slotDate=? AND slotMinute=(SELECT slotMinute FROM appointments WHERE id=?)',
              ['doc-1', future, booking.appointment.id],
            )
          )[0].bookedCount,
          1,
        );
      },
    );
    await suite.test('capacity conflicts roll back without orphan appointments', async () => {
      const doctor = (await repo.getDoctorById('doc-1'))!;
      await repo.saveSettings(
        {
          averageConsultationMinutes: 10,
          bufferMinutes: 20,
          allowWalkIns: true,
          allowEmergencyPriority: true,
          notifyOnTwoAhead: false,
          autoTokenPrefixByDoctor: true,
          clinicName: 'Demo',
          contactNumber: '',
        },
        'clinic-1',
      );
      await assert.rejects(() =>
        appointments.createAppointment({
          patientId: 'patient-2',
          patientName: 'Second',
          patientPhone: '9900000003',
          doctorId: doctor.id,
          date: future,
          time: booking.appointment.time,
        }),
      );
      assert.equal(
        (
          await rows('SELECT COUNT(*) n FROM appointments WHERE date=? AND doctorId=?', [
            future,
            doctor.id,
          ])
        )[0].n,
        1,
      );
    });
    await suite.test(
      'cancellation trigger updates linked appointment and releases its slot',
      async () => {
        await appointments.cancelAppointment(booking.appointment.id, 'Test cancellation');
        assert.equal((await repo.getAppointmentById(booking.appointment.id))?.status, 'cancelled');
        assert.equal((await repo.findTokenById(booking.token.id))?.token.status, 'cancelled');
        assert.equal(
          (
            await rows(
              'SELECT bookedCount FROM appointment_slots WHERE doctorId=? AND slotDate=?',
              ['doc-1', future],
            )
          )[0].bookedCount,
          0,
        );
        assert.equal(await repo.getActivePatientToken('patient-1', future), null);
      },
    );
    await suite.test(
      'unique identities and optimistic profile versions prevent conflicting updates',
      async () => {
        const profile = (await repo.getUserById('patient-3'))!;
        const saved = await repo.saveUser({ ...profile, name: 'Updated patient' });
        await assert.rejects(() => repo.saveUser({ ...profile, name: 'Stale update' }));
        await assert.rejects(() =>
          repo.saveUser({ ...saved, email: 'demo.patient@example.invalid' }),
        );
      },
    );
    await suite.test(
      'a new conflicting identity cannot overwrite an existing account',
      async () => {
        const before = (await repo.getUserById('patient-1'))!;
        await assert.rejects(() =>
          repo.saveUser({
            ...before,
            id: 'conflicting-user',
            name: 'Unexpected replacement',
            version: undefined,
          }),
        );
        assert.equal((await repo.getUserById('patient-1'))?.name, before.name);
        assert.equal(await repo.getUserById('conflicting-user'), null);
      },
    );
    await suite.test(
      'staff appointment filters and SQL pagination use the assigned clinic',
      async () => {
        const results = await api('/appointments/search?status=cancelled&pageSize=1', admin.token);
        assert.equal(results.status, 200);
        assert.equal(results.body.total, 1);
        assert.equal(results.body.appointments.length, 1);
        assert.equal(results.body.appointments[0].status, 'cancelled');
        assert.equal(results.body.appointments[0].clinicId, 'clinic-1');
        const none = await api(
          '/appointments/search?query=' + encodeURIComponent("' OR 1=1 --"),
          admin.token,
        );
        assert.equal(none.body.total, 0);
        assert.equal((await api('/appointments/search', patient.token)).status, 403);
        assert.equal((await api('/appointments/search', other.token)).body.total, 0);
      },
    );
    await suite.test(
      'stored function, daily procedure, views and cursor return verifiable results',
      async () => {
        const fn = await rows(
          "SELECT fn_consultation_minutes('2026-10-13 10:00:00','2026-10-13 10:12:30') minutes",
        );
        assert.equal(fn[0].minutes, 12.5);
        const flow = await repo.flowAnalytics('clinic-1');
        assert.equal(flow.trend.length, 14);
        assert.equal(flow.trend[13].total, 2);
        assert.equal(flow.trend[13].completed, 2);
        const [result]: any = await pool.query('CALL sp_doctor_workload_cursor(?,?)', [
          'clinic-1',
          today,
        ]);
        assert.equal(result[0][0].workload.length, 5);
        assert.equal((await api('/analytics', admin.token)).status, 200);
      },
    );
    await suite.test(
      'parameterized patient and appointment filters stay within the clinic',
      async () => {
        assert.deepEqual(await repo.getPatients("' OR 1=1 --", 'clinic-1'), []);
        assert.ok(
          (await repo.getAppointments({ patientId: 'patient-1', clinicId: 'clinic-1' })).every(
            (a) => a.patientId === 'patient-1' && a.clinicId === 'clinic-1',
          ),
        );
        assert.equal(
          (await api('/patients', other.token)).body.some((u: any) => u.id === 'patient-1'),
          false,
        );
      },
    );
    await suite.test(
      'updated buffer capacity is used when an existing slot gains an opening',
      async () => {
        const settings = await repo.getSettings('clinic-1');
        await repo.saveSettings({ ...settings, bufferMinutes: 20 }, 'clinic-1');
        const slot = (await appointments.getDoctorSlotAvailability('doc-1', future)).find(
          (s) => s.available && s.time !== booking.appointment.time,
        )!;
        assert.ok(slot);
        const earlier = await appointments.createAppointment({
          patientId: 'patient-2',
          patientName: 'Second',
          patientPhone: '9900000003',
          doctorId: 'doc-1',
          date: future,
          time: slot.time,
        });
        let later: any;
        try {
          await repo.saveSettings({ ...settings, bufferMinutes: 2 }, 'clinic-1');
          assert.ok(
            (await appointments.getDoctorSlotAvailability('doc-1', future)).find(
              (s) => s.time === slot.time,
            )?.available,
          );
          later = await appointments.createAppointment({
            patientId: 'patient-3',
            patientName: 'Third',
            patientPhone: '9900000004',
            doctorId: 'doc-1',
            date: future,
            time: slot.time,
          });
          assert.ok(later.appointment.id);
        } finally {
          await appointments.cancelAppointment(earlier.appointment.id);
          if (later) await appointments.cancelAppointment(later.appointment.id);
        }
      },
    );
    await suite.test('CHECK constraints reject negative fees and impossible slot occupancy', async () => {
      await assert.rejects(
        () => pool.execute('UPDATE doctors SET consultationFee=-1 WHERE id=?', ['doc-1']),
        (error: any) => error.code === 'ER_CHECK_CONSTRAINT_VIOLATED',
      );
      await assert.rejects(
        () => pool.execute('INSERT INTO appointment_slots(doctorId,slotDate,slotMinute,bookedCount,capacity) VALUES (?,?,?,?,?)',
          ['doc-1', '2099-12-31', 0, 2, 1]),
        (error: any) => error.code === 'ER_CHECK_CONSTRAINT_VIOLATED',
      );
      assert.equal((await rows("SELECT COUNT(*) n FROM appointment_slots WHERE slotDate='2099-12-31'"))[0].n, 0);
    });
    await suite.test('function returns NULL for missing, reversed and implausible timings', async () => {
      const result = (await rows(`SELECT fn_consultation_minutes(NULL,UTC_TIMESTAMP()) missing,
        fn_consultation_minutes('2026-10-13 10:00:00','2026-10-13 09:59:00') reversed,
        fn_consultation_minutes('2026-10-13 10:00:00','2026-10-13 12:00:01') excessive,
        fn_consultation_minutes('2026-10-13 10:00:00','2026-10-13 10:00:00') zero`))[0];
      assert.deepEqual({ ...result }, { missing: null, reversed: null, excessive: null, zero: 0 });
    });
    await suite.test('concurrent bookings from different patients cannot overfill the last slot', async () => {
      const settings = await repo.getSettings('clinic-1');
      await repo.saveSettings({ ...settings, bufferMinutes: 20 }, 'clinic-1');
      const slot = (await appointments.getDoctorSlotAvailability('doc-1', future)).find((s) => s.available)!;
      assert.ok(slot);
      const results = await Promise.allSettled(['patient-1', 'patient-2', 'patient-3'].map((patientId) =>
        appointments.createAppointment({ patientId, patientName: 'Synthetic concurrency case',
          patientPhone: '9900000002', doctorId: 'doc-1', date: future, time: slot.time })));
      const successes = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      try {
        assert.equal(successes.length, 1);
        assert.equal(results.filter((r) => r.status === 'rejected').length, 2);
        const occupancy = (await rows(`SELECT bookedCount,capacity FROM appointment_slots
          WHERE doctorId='doc-1' AND slotDate=? AND slotMinute=(SELECT slotMinute FROM appointments WHERE id=?)`,
          [future, successes[0].value.appointment.id]))[0];
        assert.equal(occupancy.bookedCount, 1);
        assert.equal(occupancy.capacity, 1);
      } finally {
        for (const result of successes) await appointments.cancelAppointment(result.value.appointment.id);
      }
    });
    await suite.test('a booking submitted through the HTTP API is visible in SQL and cancels both records', async () => {
      const slot = (await appointments.getDoctorSlotAvailability('doc-1', future)).find((s) => s.available)!;
      assert.ok(slot);
      const response = await api('/appointments', patient.token, 'POST', { doctorId: 'doc-1', date: future, time: slot.time });
      assert.equal(response.status, 201);
      const id = response.body.appointment.id;
      try {
        const records = await rows(`SELECT a.patientId,a.status,t.status tokenStatus FROM appointments a
          JOIN queue_tokens t ON t.appointmentId=a.id WHERE a.id=?`, [id]);
        assert.equal(records.length, 1);
        assert.equal(records[0].patientId, 'patient-1');
        assert.equal(records[0].status, 'booked');
        assert.equal(records[0].tokenStatus, 'waiting');
        assert.equal((await api(`/appointments/${id}/cancel`, patient.token, 'POST', { reason: 'Synthetic API verification' })).status, 200);
        const cancelled = (await rows(`SELECT a.status,t.status tokenStatus FROM appointments a
          JOIN queue_tokens t ON t.appointmentId=a.id WHERE a.id=?`, [id]))[0];
        assert.equal(cancelled.status, 'cancelled');
        assert.equal(cancelled.tokenStatus, 'cancelled');
      } finally {
        if ((await repo.getAppointmentById(id))?.status !== 'cancelled') await appointments.cancelAppointment(id);
      }
    });
    await suite.test('local demo administrator manages all clinics without expanding other staff access', async () => {
      const previous = process.env.DBMS_DEMO_ALL_CLINICS;
      process.env.DBMS_DEMO_ALL_CLINICS = 'true';
      try {
        const session = await api('/auth/login', undefined, 'POST', {
          identifier: 'demo.staff@example.invalid', password: 'DemoClinic123!',
        });
        assert.equal(session.body.user.demoAllClinics, true);
        const allQueues = await api('/queues/all', session.body.token);
        assert.equal(allQueues.body.length, (await repo.getDoctors()).length);
        assert.equal((await api('/patients', session.body.token)).body.length, (await repo.getPatients()).length);
        const otherDoctor = (await repo.getDoctors()).find((d) => d.clinicId !== 'clinic-1')!;
        assert.equal((await api('/doctors/' + otherDoctor.id, session.body.token, 'PATCH',
          { consultationFee: otherDoctor.consultationFee })).status, 200);
        const joined = await api('/queues/join', session.body.token, 'POST', {
          doctorId: otherDoctor.id, patientName: 'Synthetic all-clinic demonstration',
          patientPhone: '9900099999', isWalkIn: true,
        });
        assert.equal(joined.status, 201);
        assert.equal((await repo.getUserById(joined.body.patientId))?.clinicId, otherDoctor.clinicId);
        assert.equal((await api('/queues/doctor/' + otherDoctor.id, session.body.token)).body.tokens
          .some((t: any) => t.id === joined.body.id), true);
        assert.equal((await api('/appointments/search?pageSize=100', session.body.token)).body.total,
          (await repo.getAppointments()).length);
        const settings = await api('/settings?clinicId=' + otherDoctor.clinicId, session.body.token);
        assert.equal(settings.status, 200);
        assert.equal((await api('/settings?clinicId=' + otherDoctor.clinicId, session.body.token, 'PUT',
          { averageConsultationMinutes: settings.body.averageConsultationMinutes })).status, 200);
        assert.equal((await api('/analytics?clinicId=' + otherDoctor.clinicId, session.body.token)).body.clinicId,
          otherDoctor.clinicId);
        assert.equal((await api('/queues/doctor/doc-1', other.token)).status, 403);
        assert.equal((await api('/settings?clinicId=clinic-1', other.token)).status, 403);
        assert.equal((await api('/auth/me', other.token)).body.demoAllClinics, false);
        assert.equal((await api('/auth/me', patient.token)).body.demoAllClinics, false);
        process.env.DBMS_DEMO_ALL_CLINICS = 'false';
        assert.equal((await api('/auth/me', session.body.token)).body.demoAllClinics, false);
        assert.equal((await api('/queues/doctor/' + otherDoctor.id, session.body.token)).status, 403);
        process.env.DBMS_DEMO_ALL_CLINICS = 'true';
        const { canManageAllDemoClinics } = await import('../src/lib/demoAccess.js');
        const user = (await repo.getUserById('admin-1'))!;
        const oldProvider = process.env.DATABASE_PROVIDER;
        process.env.DATABASE_PROVIDER = 'dynamodb';
        assert.equal(canManageAllDemoClinics(user), false);
        process.env.DATABASE_PROVIDER = oldProvider;
        const oldMode = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        assert.equal(canManageAllDemoClinics(user), false);
        process.env.NODE_ENV = oldMode;
      } finally {
        if (previous === undefined) delete process.env.DBMS_DEMO_ALL_CLINICS;
        else process.env.DBMS_DEMO_ALL_CLINICS = previous;
      }
    });
  } finally {
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
    // This is exclusively the unique database created by this test invocation.
    assert.match(database, /^qureflow_test_[a-f0-9]{32}$/);
    adminSql('DROP DATABASE ' + database);
  }
});
