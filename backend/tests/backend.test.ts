import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Isolation is established BEFORE imports load dotenv or initialize an AWS client.
process.env.NODE_ENV = 'test';
process.env.AUTH_PROVIDER = 'local';
process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:18000';
process.env.DYNAMODB_TABLE_NAME = `QureFlowTest-${randomUUID()}`;
process.env.JWT_SECRET = randomBytes(48).toString('hex');
const results: { name: string; passed: boolean; durationMs: number; error?: string }[] = [];
async function check(name: string, test: () => Promise<unknown> | unknown) {
  const start = Date.now();
  try {
    await test();
    results.push({ name, passed: true, durationMs: Date.now() - start });
    console.log(`PASS ${name}`);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    results.push({ name, passed: false, durationMs: Date.now() - start, error });
    console.error(`FAIL ${name}: ${error}`);
  }
}

async function run() {
  const { seedLocalDemo, requireLocalDatabase } = await import('../src/demo/localDatabase.js');
  const { dynamoDbRepo: repo } = await import('../src/repositories/dynamoDbRepo.js');
  const { authService: auth } = await import('../src/services/authService.js');
  const { queueService: queue } = await import('../src/services/queueService.js');
  const { appointmentService: appointments } =
    await import('../src/services/appointmentService.js');
  const { clinicDate } = await import('../src/lib/time.js');
  const { app } = await import('../src/server.js');
  const { trainDurationModel, predictDuration } =
    await import('../src/services/predictionService.js');
  const { DynamoDBClient, DeleteTableCommand } = await import('@aws-sdk/client-dynamodb');
  requireLocalDatabase();
  await seedLocalDemo(false);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const port = (server.address() as any).port,
    base = `http://127.0.0.1:${port}/api`;
  const api = async (endpoint: string, token?: string, method = 'GET', body?: any) => {
    const response = await fetch(base + endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const admin = await auth.login('demo.staff@example.invalid', 'DemoClinic123!'),
    otherAdmin = await auth.login('demo.staff2@example.invalid', 'DemoClinic123!'),
    patient = await auth.login('demo.patient@example.invalid', 'DemoPatient123!');
  const day = clinicDate(),
    future = clinicDate(new Date(Date.now() + 86400000));
  const join = (id: string, doctorId = 'doc-1', priority: 'normal' | 'emergency' = 'normal') =>
    queue.joinQueue({
      doctorId,
      patientId: id,
      patientName: 'Test patient',
      patientPhone: '9900012345',
      isWalkIn: true,
      priority,
    });
  let ownToken: any, secondToken: any, booked: any;
  try {
    await check('Test database uses a loopback endpoint and a unique disposable table', () => {
      assert.match(process.env.DYNAMODB_TABLE_NAME!, /^QureFlowTest-/);
      requireLocalDatabase();
    });
    await check('Public doctor and clinic directories are served from DynamoDB', async () => {
      assert.equal((await api('/doctors')).body.length, 10);
      assert.equal((await api('/clinics')).body.length, 3);
    });
    await check('Health responses omit infrastructure names and set no-store', async () => {
      const r = await api('/health');
      assert.equal(r.status, 200);
      assert.equal(r.body.dynamoDbTable, undefined);
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.ok(r.headers.get('x-request-id'));
      assert.equal(r.headers.get('x-powered-by'), null);
    });
    await check('Unknown API endpoints return JSON 404 rather than the SPA', async () =>
      assert.equal((await api('/does-not-exist')).status, 404),
    );
    for (const endpoint of ['/appointments', '/queues/all', '/patients', '/analytics'])
      await check(`Unauthenticated GET ${endpoint} is rejected`, async () =>
        assert.equal((await api(endpoint)).status, 401),
      );
    await check('Unauthenticated booking and queue joins are rejected', async () => {
      assert.equal((await api('/appointments', undefined, 'POST', {})).status, 401);
      assert.equal((await api('/queues/join', undefined, 'POST', {})).status, 401);
    });
    await check('A password cannot be omitted at login', async () =>
      assert.equal(
        (await api('/auth/login', undefined, 'POST', { identifier: 'demo.staff@example.invalid' }))
          .status,
        400,
      ),
    );
    await check('Wrong passwords and demo aliases cannot bypass authentication', async () => {
      await assert.rejects(auth.login('demo.staff@example.invalid', 'wrong'));
      await assert.rejects(auth.login('admin', 'anything'));
    });
    await check('Identifier lookup never matches blank phone fields', async () =>
      assert.equal(await repo.findUserByIdentifier('not-an-existing-user'), null),
    );
    await check('Forged and expired JWTs are rejected', async () => {
      const jwt = (await import('jsonwebtoken')).default;
      assert.equal((await api('/auth/me', 'not-a-token')).status, 401);
      const forged = jwt.sign({ sub: 'admin-1' }, 'wrong-secret', {
        issuer: 'qureflow',
        audience: 'qureflow-api',
      });
      assert.equal((await api('/auth/me', forged)).status, 401);
      const expired = jwt.sign({ sub: 'admin-1' }, process.env.JWT_SECRET!, {
        issuer: 'qureflow',
        audience: 'qureflow-api',
        expiresIn: -1,
      });
      assert.equal((await api('/auth/me', expired)).status, 401);
    });
    await check(
      'Authentication responses omit password hashes and private provider fields',
      async () => {
        const r = await api('/auth/me', admin.token);
        assert.equal(r.body.passwordHash, undefined);
        assert.equal(r.body.cognitoSub, undefined);
        assert.equal(r.body.pk, undefined);
      },
    );
    await check('Weak passwords and impossible birth dates are rejected', async () => {
      assert.equal(
        (
          await api('/auth/register', undefined, 'POST', {
            name: 'Example',
            phone: '9900055555',
            email: 'test@example.invalid',
            password: 'weak',
          })
        ).status,
        400,
      );
      assert.equal(
        (await api('/patients/patient-1', patient.token, 'PATCH', { dob: '2026-02-30' })).status,
        400,
      );
    });
    await check('Passwords require a symbol and fit the bcrypt UTF-8 byte limit', async () => {
      const { passwordSchema } = await import('../src/lib/validation.js');
      assert.equal(passwordSchema.safeParse('StrongPassword123').success, false);
      assert.equal(passwordSchema.safeParse('Aa1!' + 'é'.repeat(36)).success, false);
      assert.equal(passwordSchema.safeParse('StrongPassword123!').success, true);
    });
    await check(
      'Registration forces the patient role and rejects injected staff fields',
      async () =>
        assert.equal(
          (
            await api('/auth/register', undefined, 'POST', {
              name: 'Example',
              phone: '9900055555',
              email: 'test@example.invalid',
              password: 'StrongPassword123!',
              role: 'admin',
            })
          ).status,
          400,
        ),
    );
    await check('Concurrent registration claims allow only one account per phone', async () => {
      const attempts = await Promise.allSettled(
        [1, 2].map((i) =>
          auth.registerPatient({
            name: 'Parallel patient',
            phone: '9900055555',
            email: `parallel${i}@example.invalid`,
            password: 'StrongPassword123!',
          }),
        ),
      );
      assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
    });
    await check('Profile mass assignment cannot change role, ID, or password hash', async () => {
      const r = await api('/patients/patient-1', patient.token, 'PATCH', {
        role: 'admin',
        id: 'admin-1',
        passwordHash: 'bad',
      });
      assert.equal(r.status, 400);
      assert.equal((await repo.getUserById('patient-1'))!.role, 'patient');
    });
    await check('Patients cannot read another patient profile or appointments', async () => {
      assert.equal((await api('/patients/demo-patient-1', patient.token)).status, 403);
      assert.equal(
        (await api('/appointments?patientId=demo-patient-1', patient.token)).status,
        403,
      );
    });
    await check('Patients cannot assign priority, change settings, or create doctors', async () => {
      assert.equal((await api('/queues/join', patient.token, 'POST', {})).status, 403);
      assert.equal((await api('/settings', patient.token, 'PUT', {})).status, 403);
      assert.equal((await api('/doctors', patient.token, 'POST', {})).status, 403);
    });
    await check('Staff cannot manage another clinic or queue', async () => {
      assert.equal((await api('/queues/doctor/doc-1', otherAdmin.token)).status, 403);
      assert.equal(
        (await api('/queues/pause', otherAdmin.token, 'POST', { doctorId: 'doc-1', paused: true }))
          .status,
        403,
      );
      assert.equal(
        (await api('/clinics/clinic-1', otherAdmin.token, 'PATCH', { name: 'Taken over' })).status,
        403,
      );
    });
    await check('Patient lists never return password hashes', async () => {
      const r = await api('/patients', admin.token);
      assert.equal(r.status, 200);
      assert.ok(r.body.every((u: any) => u.passwordHash === undefined && u.pk === undefined));
    });
    await check('Queue settings enforce types and preserve omitted settings', async () => {
      assert.equal(
        (await api('/settings', admin.token, 'PUT', { allowWalkIns: 'false' })).status,
        400,
      );
      assert.equal(
        (await api('/settings', admin.token, 'PUT', { averageConsultationMinutes: 0 })).status,
        400,
      );
      const r = await api('/settings', admin.token, 'PUT', { averageConsultationMinutes: 12 });
      assert.equal(r.status, 200);
      assert.equal(r.body.allowWalkIns, true);
      assert.equal(r.body.averageConsultationMinutes, 12);
    });
    await check('A valid patient profile update persists', async () => {
      const r = await api('/patients/patient-1', patient.token, 'PATCH', {
        name: 'Updated Demo Patient',
      });
      assert.equal(r.status, 200);
      assert.equal((await repo.getUserById('patient-1'))!.name, 'Updated Demo Patient');
    });
    await check('Patient contact updates cannot take over a staff identity', async () =>
      assert.equal(
        (
          await api('/patients/patient-1', patient.token, 'PATCH', {
            email: 'demo.staff@example.invalid',
          })
        ).status,
        409,
      ),
    );
    await check('Fixed recovery codes cannot reset a local account', async () => {
      assert.equal(
        (
          await api('/auth/confirm-forgot-password', undefined, 'POST', {
            identifier: 'demo.patient@example.invalid',
            code: '123456',
            newPassword: 'MaliciousPassword123!',
          })
        ).status,
        400,
      );
      await auth.login('demo.patient@example.invalid', 'DemoPatient123!');
    });
    await check('Password recovery does not reveal whether an account exists', async () => {
      const known = await api('/auth/forgot-password', undefined, 'POST', {
          identifier: 'demo.patient@example.invalid',
        }),
        unknown = await api('/auth/forgot-password', undefined, 'POST', {
          identifier: 'unknown@example.invalid',
        });
      assert.deepEqual(known.body, unknown.body);
    });
    await check(
      'Atomic counter allocations produce distinct sequences under concurrency',
      async () => {
        const values = await Promise.all(
          Array.from({ length: 12 }, () => repo.getNextTokenSequence(`${day}#counter-test`)),
        );
        assert.equal(new Set(values.map((v) => v.seq)).size, 12);
      },
    );
    await check('Concurrent joins produce one active patient token', async () => {
      const attempts = await Promise.allSettled([join('patient-1'), join('patient-1')]);
      assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 1);
      ownToken = (attempts.find((r) => r.status === 'fulfilled') as any).value;
    });
    await check('Token metadata stores date, source, version, and correlation ID', () => {
      assert.equal(ownToken.queueDate, day);
      assert.equal(ownToken.metadata.source, 'reception');
      assert.ok(ownToken.metadata.requestId);
      assert.equal(ownToken.version, 1);
    });
    await check('Queue joins reject nonexistent patients without allocating a visit', async () =>
      assert.rejects(join('nonexistent-patient')),
    );
    await check('Doctor permissions require assignment and restrict patient records', async () => {
      await repo.saveUser({
        id: 'test-doctor',
        name: 'Test Doctor',
        email: 'doctor@example.invalid',
        phone: '',
        role: 'doctor',
        clinicId: 'clinic-1',
        doctorId: 'doc-1',
        createdAt: new Date().toISOString(),
        passwordHash: (await import('bcryptjs')).default.hashSync('DoctorPassword123!', 4),
      });
      const doctor = await auth.login('doctor@example.invalid', 'DoctorPassword123!');
      assert.equal((await api('/queues/doctor/doc-2', doctor.token)).status, 403);
      assert.equal((await api('/patients/demo-patient-3', doctor.token)).status, 403);
      assert.equal((await api('/patients/patient-1', doctor.token)).status, 200);
      assert.ok(
        (await api('/patients', doctor.token)).body.every((u: any) => u.id === 'patient-1'),
      );
      const profile = (await repo.getUserById('test-doctor'))!;
      await repo.saveUser({ ...profile, doctorId: undefined });
      assert.equal((await api('/appointments', doctor.token)).status, 403);
      assert.equal((await api('/patients', doctor.token)).status, 403);
    });
    await check('An active token prevents a duplicate visit with another doctor', async () =>
      assert.rejects(join('patient-1', 'doc-2')),
    );
    secondToken = await join('demo-patient-1');
    await check(
      'Patients see their own token while other patient details are redacted',
      async () => {
        const r = await api('/queues/doctor/doc-1', patient.token);
        const other = r.body.tokens.find((t: any) => t.tokenNumber === secondToken.tokenNumber);
        assert.equal(other.patientName, '');
        assert.equal(other.patientPhone, '');
        assert.equal(other.patientId, undefined);
        assert.notEqual(other.id, secondToken.id);
      },
    );
    await check('Patients cannot cancel another patient token', async () =>
      assert.equal(
        (await api(`/tokens/${secondToken.id}/cancel`, patient.token, 'POST', {})).status,
        403,
      ),
    );
    await check('Paused queues reject call-next without changing any token', async () => {
      await repo.setDoctorPause('doc-1', true);
      assert.equal(
        (await api('/queues/call-next', admin.token, 'POST', { doctorId: 'doc-1' })).status,
        409,
      );
      assert.equal((await repo.findTokenById(ownToken.id))!.token.status, 'waiting');
      await repo.setDoctorPause('doc-1', false);
    });
    const emergency = await join('demo-patient-2', 'doc-1', 'emergency');
    await check('Priority tokens are called before earlier normal walk-ins', async () => {
      const visible = await api('/queues/doctor/doc-1', patient.token);
      assert.equal(
        visible.body.tokens.filter((t: any) => t.status === 'waiting')[0].tokenNumber,
        emergency.tokenNumber,
      );
      const called = await queue.callNextPatient('doc-1');
      assert.equal(called!.id, emergency.id);
    });
    await check('Calling next cannot silently complete the current consultation', async () => {
      await assert.rejects(queue.callNextPatient('doc-1'));
      assert.equal((await repo.findTokenById(emergency.id))!.token.status, 'current');
    });
    await check('Patients cannot self-complete a consultation', async () =>
      assert.equal(
        (await api(`/tokens/${ownToken.id}/serve`, patient.token, 'POST', {})).status,
        403,
      ),
    );
    await check('Serving a waiting token or cancelling a current token is rejected', async () => {
      await assert.rejects(queue.markPatientServed(ownToken.id));
      await assert.rejects(queue.cancelToken(emergency.id));
    });
    await check('Completion records served time and rejects a repeated transition', async () => {
      await queue.markPatientServed(emergency.id);
      const record = (await repo.findTokenById(emergency.id))!.token;
      assert.equal(record.status, 'completed');
      assert.ok(record.calledAt && record.servedAt);
      await assert.rejects(queue.markPatientServed(emergency.id));
    });
    await check('Concurrent staff calls create at most one current consultation', async () => {
      const attempts = await Promise.allSettled([
        queue.callNextPatient('doc-1'),
        queue.callNextPatient('doc-1'),
      ]);
      assert.equal(attempts.filter((r) => r.status === 'fulfilled' && r.value).length, 1);
      assert.equal(
        (await queue.getDoctorQueue('doc-1')).tokens.filter((t) => t.status === 'current').length,
        1,
      );
    });
    await check('Current patients have zero people ahead and zero estimated wait', async () => {
      const status = await queue.getPatientActiveStatus('patient-1');
      assert.equal(status!.token.status, 'current');
      assert.equal(status!.patientsAhead, 0);
      assert.equal(status!.estimatedWaitMinutes, 0);
      assert.equal(status!.prediction!.isEstimate, true);
    });
    await queue.markPatientServed(ownToken.id);
    await queue.cancelToken(secondToken.id);
    await check('Terminal tokens release the active visit claim', async () =>
      assert.equal(await repo.getActivePatientToken('patient-1'), null),
    );
    await check('Invalid, past, and out-of-horizon booking dates are rejected', async () => {
      for (const date of ['2026-02-30', '2000-01-01', '2099-01-01'])
        assert.equal(
          (
            await api('/appointments', patient.token, 'POST', {
              doctorId: 'doc-1',
              date,
              time: '09:00 AM',
            })
          ).status,
          400,
        );
    });
    await check('Booking rejects times outside the doctor schedule', async () =>
      assert.equal(
        (
          await api('/appointments', patient.token, 'POST', {
            doctorId: 'doc-1',
            date: future,
            time: '11:59 PM',
          })
        ).status,
        409,
      ),
    );
    await check(
      'Slots accommodate long consultations and reject undersized final windows',
      async () => {
        const doc = (await repo.getDoctorById('doc-10'))!;
        await repo.saveDoctor({
          ...doc,
          startTime: '09:00 AM',
          endTime: '10:15 AM',
          slotDurationMinutes: 30,
        });
        const slots = await appointments.getDoctorSlotAvailability(doc.id, future);
        assert.equal(slots[0].slotDurationMinutes, 60);
        assert.equal(slots[0].available, true);
        assert.equal(slots[1].available, false);
        await repo.saveDoctor(doc);
      },
    );
    await check('Valid bookings atomically store the appointment and linked token', async () => {
      const r = await api('/appointments', patient.token, 'POST', {
        patientId: 'patient-1',
        patientName: 'Forged name',
        patientPhone: '9999999999',
        doctorId: 'doc-1',
        date: future,
        time: '09:00 AM',
        notes: 'Demo visit',
      });
      assert.equal(r.status, 201);
      booked = r.body;
      assert.equal(booked.appointment.patientName, 'Updated Demo Patient');
      assert.equal(booked.token.appointmentId, booked.appointment.id);
      assert.equal(booked.appointment.tokenId, booked.token.id);
      assert.equal(
        (await repo.getAppointmentById(booked.appointment.id))!.tokenNumber,
        booked.token.tokenNumber,
      );
    });
    await check('Future bookings do not appear as active visits today', async () =>
      assert.equal(await queue.getPatientActiveStatus('patient-1'), null),
    );
    await check('Booking on behalf of another patient is rejected', async () =>
      assert.equal(
        (
          await api('/appointments', patient.token, 'POST', {
            patientId: 'demo-patient-4',
            doctorId: 'doc-1',
            date: future,
            time: '09:30 AM',
          })
        ).status,
        403,
      ),
    );
    await check('Failed duplicate booking leaves no orphan appointment', async () => {
      const before = (await repo.getAppointments({ patientId: 'patient-1' })).length;
      await assert.rejects(
        appointments.createAppointment({
          patientId: 'patient-1',
          patientName: 'Test',
          patientPhone: '9900000002',
          doctorId: 'doc-1',
          date: future,
          time: '09:30 AM',
        }),
      );
      assert.equal((await repo.getAppointments({ patientId: 'patient-1' })).length, before);
    });
    await check('Concurrent bookings cannot exceed the slot capacity', async () => {
      const attempts = await Promise.allSettled(
        [3, 4, 5, 6, 7, 8].map((i) =>
          appointments.createAppointment({
            patientId: `demo-patient-${i}`,
            patientName: 'Capacity test',
            patientPhone: '9900012345',
            doctorId: 'doc-2',
            date: future,
            time: '09:30 AM',
          }),
        ),
      );
      const saved = await repo.getAppointments({ doctorId: 'doc-2', date: future });
      assert.ok(saved.length > 0 && saved.length <= 2);
      assert.equal(saved.length, attempts.filter((r) => r.status === 'fulfilled').length);
      for (const apt of saved) {
        const tokens = await repo.getAllTokensForQueue(repo.getQueueId('doc-2', future));
        assert.ok(tokens.some((t) => t.appointmentId === apt.id));
      }
    });
    await check(
      'Cancellation atomically updates appointment, token, and slot availability',
      async () => {
        const r = await api(
          `/appointments/${booked.appointment.id}/cancel`,
          patient.token,
          'POST',
          { reason: 'Test cancellation' },
        );
        assert.equal(r.status, 200);
        const cancelled = (await repo.getAppointmentById(booked.appointment.id))!;
        assert.equal(cancelled.status, 'cancelled');
        assert.equal(cancelled.notes, 'Demo visit');
        assert.equal(cancelled.metadata?.cancellationReason, 'Test cancellation');
        assert.equal((await repo.findTokenById(booked.token.id))!.token.status, 'cancelled');
        assert.equal(
          (await appointments.getDoctorSlotAvailability('doc-1', future)).find(
            (s) => s.time === '09:00 AM',
          )!.available,
          true,
        );
      },
    );
    await check(
      'Audit events include actor, transitions, and request IDs without credentials or contact details',
      async () => {
        const events = await repo.getAuditEvents('clinic-1');
        assert.ok(events.some((e) => e.action === 'status_changed'));
        assert.ok(events.every((e) => e.requestId && e.actorId));
        const raw = JSON.stringify(events);
        assert.ok(!raw.includes('passwordHash') && !raw.includes('patientPhone'));
      },
    );
    await check('Analytics is staff-only and restricted to the assigned clinic', async () => {
      assert.equal((await api('/analytics', patient.token)).status, 403);
      const r = await api('/analytics', otherAdmin.token);
      assert.equal(r.status, 200);
      assert.equal(r.body.clinicId, 'clinic-2');
      assert.ok(r.body.doctors.every((d: any) => ['doc-5', 'doc-6', 'doc-7'].includes(d.id)));
    });
    await check('Learning falls back when there are too few completed consultations', () => {
      assert.equal(trainDurationModel([], 10).method, 'configured');
    });
    const samples = Array.from({ length: 80 }, (_, i) => {
      const isWalkIn = i % 2 === 0,
        priority = i % 7 === 0 ? 'emergency' : 'normal',
        calledAt = new Date(Date.now() - (80 - i) * 3600000).toISOString(),
        minutes = 6 + (isWalkIn ? 3 : 0) + (priority === 'emergency' ? 4 : 0);
      return {
        ...ownToken,
        id: `model-test-${i}`,
        status: 'completed',
        isWalkIn,
        priority,
        calledAt,
        servedAt: new Date(Date.parse(calledAt) + minutes * 60000).toISOString(),
      };
    });
    await check('Learned models validate on a chronological holdout before activation', () => {
      const model = trainDurationModel(samples, 15);
      assert.equal(model.method, 'hierarchical_lognormal');
      assert.equal(model.trainingCount, 64);
      assert.equal(model.validationCount, 16);
      assert.ok(model.modelMae! < model.baselineMae!);
      assert.ok(predictDuration(model, samples[0]) >= 1);
      // Walk-in and emergency effects are learned in the right direction.
      const normal = { ...samples[1], isWalkIn: false, priority: 'normal' as const };
      assert.ok(
        predictDuration(model, { ...normal, isWalkIn: true }) > predictDuration(model, normal),
      );
      assert.ok(
        predictDuration(model, { ...normal, priority: 'emergency' }) >
          predictDuration(model, normal),
      );
    });
    await check('Invalid consultation durations are excluded from learning', () => {
      const invalid = samples.map((t) => ({ ...t, servedAt: t.calledAt }));
      assert.equal(trainDurationModel(invalid, 10).sampleCount, 0);
    });
    await check('Models that underperform the configured baseline are rejected', () => {
      const flat = samples.map((t) => ({
        ...t,
        servedAt: new Date(Date.parse(t.calledAt) + 10 * 60000).toISOString(),
      }));
      assert.equal(trainDurationModel(flat, 10).method, 'configured');
    });
    await check('The Lambda adapter executes actual Express routes', async () => {
      const { handler } = await import('../src/lambda.js');
      const output: any = await handler(
        {
          version: '2.0',
          routeKey: 'GET /api/appointments',
          rawPath: '/api/appointments',
          rawQueryString: '',
          headers: { host: 'localhost' },
          requestContext: {
            http: {
              method: 'GET',
              path: '/api/appointments',
              sourceIp: '127.0.0.1',
              protocol: 'HTTP/1.1',
            },
            requestId: randomUUID(),
          },
          isBase64Encoded: false,
        },
        {} as any,
      );
      assert.equal(output.statusCode, 401);
    });
    await check('Hostile origins do not receive CORS permission', async () => {
      const response = await fetch(base + '/health', {
        headers: { Origin: 'https://untrusted.example' },
      });
      assert.equal(response.headers.get('access-control-allow-origin'), null);
    });
    await check(
      'Indexed catalog, clinic visit and appointment reads match existing primary records',
      async () => {
        const { docClient, DYNAMODB_TABLE_NAME } = await import('../src/config/aws.js');
        const { PutCommand } = await import('@aws-sdk/lib-dynamodb');
        const before = await repo.getAppointments({ clinicId: 'clinic-1' });
        const beforeVisits = await repo.getRecentTokens('clinic-1', 30);
        await docClient.send(
          new PutCommand({ TableName: DYNAMODB_TABLE_NAME, Item: { pk: 'READ_MODELS', sk: 'V1' } }),
        );
        assert.equal((await repo.getDoctors()).length, 10);
        assert.equal((await repo.getClinics()).length, 3);
        assert.deepEqual(
          (await repo.getAppointments({ clinicId: 'clinic-1' }))
            .map((a) => [a.id, a.status])
            .sort(),
          before.map((a) => [a.id, a.status]).sort(),
        );
        assert.deepEqual(
          (await repo.getRecentTokens('clinic-1', 30)).map((t) => [t.id, t.status]).sort(),
          beforeVisits.map((t) => [t.id, t.status]).sort(),
        );
        const directory = await api('/patients', admin.token);
        assert.equal(directory.status, 200);
        assert.ok(directory.body.length > 0);
        assert.ok(directory.body.every((p: any) => !p.passwordHash && p.role === 'patient'));
        const scoped = await api('/appointments', otherAdmin.token);
        assert.ok(scoped.body.every((a: any) => a.clinicId === 'clinic-2'));
      },
    );
    await check(
      'Token transitions atomically update clinic and appointment read models',
      async () => {
        const p = await auth.registerPatient({
          name: 'Indexed Read Patient',
          phone: '9900099901',
          email: 'indexed.read@example.invalid',
          password: 'IndexedPatient123!',
        });
        const token = await join(p.user.id, 'doc-9');
        assert.ok((await repo.getPatients(undefined, 'clinic-3')).some((u) => u.id === p.user.id));
        await queue.cancelToken(token.id);
        const visit = (await repo.getRecentTokens('clinic-3', 30)).find((t) => t.id === token.id);
        assert.equal(visit?.status, 'cancelled');
        const booking = await api('/appointments', p.token, 'POST', {
          doctorId: 'doc-9',
          date: future,
          time: '10:00 AM',
        });
        assert.equal(booking.status, 201);
        assert.ok(
          (await repo.getAppointments({ patientId: p.user.id })).some(
            (a) => a.id === booking.body.appointment.id && a.status === 'booked',
          ),
        );
        await queue.cancelToken(booking.body.token.id);
        for (const filter of [
          { patientId: p.user.id },
          { doctorId: 'doc-9' },
          { clinicId: 'clinic-3' },
        ])
          assert.equal(
            (await repo.getAppointments(filter)).find((a) => a.id === booking.body.appointment.id)
              ?.status,
            'cancelled',
          );
      },
    );
    await check(
      'Doctor directory search filters, orders and pages the DynamoDB catalog',
      async () => {
        const general = await api(
          '/doctors/search?specialization=' + encodeURIComponent('General Medicine'),
        );
        assert.equal(general.status, 200);
        assert.equal(general.body.total, 2);
        assert.ok(general.body.doctors.every((d: any) => d.specialization === 'General Medicine'));
        const page = await api('/doctors/search?sort=experience&pageSize=3&page=2');
        assert.equal(page.body.total, 10);
        assert.equal(page.body.doctors.length, 3);
        const all = (await api('/doctors/search?sort=experience&pageSize=50')).body.doctors;
        assert.ok(
          all.every((d: any, i: number) => !i || all[i - 1].experienceYears >= d.experienceYears),
        );
        assert.deepEqual(
          page.body.doctors.map((d: any) => d.id),
          all.slice(3, 6).map((d: any) => d.id),
        );
        const byFee = (await api('/doctors/search?sort=fee&pageSize=50')).body.doctors;
        assert.ok(
          byFee.every(
            (d: any, i: number) => !i || byFee[i - 1].consultationFee <= d.consultationFee,
          ),
        );
        assert.deepEqual((await api('/doctors/search?page=999')).body.doctors, []);
        assert.equal((await api('/doctors/search?page=999')).body.total, 10);
        assert.equal((await api('/doctors/search?query=sharma')).body.total, 1);
        assert.equal(
          (await api('/doctors/search?sort=' + encodeURIComponent('name; DROP'))).status,
          400,
        );
        assert.equal((await api('/doctors/search?pageSize=10000')).status, 400);
        assert.equal((await api('/doctors/search?unexpected=1')).status, 400);
      },
    );
    await check(
      'Directory options and clinic doctor counts are derived from active doctors',
      async () => {
        const options = (await api('/doctors/options')).body;
        assert.equal(options.doctorCount, 10);
        assert.equal(options.clinicCount, 3);
        assert.ok(options.specialties.includes('Orthopedics'));
        const clinics = (await api('/clinics')).body;
        assert.equal(clinics.find((c: any) => c.id === 'clinic-1').activeDoctorsCount, 5);
        assert.equal((await api('/clinics/clinic-3')).body.activeDoctorsCount, 2);
      },
    );
    await check('Staff appointment search pages results within the assigned clinic', async () => {
      const cancelled = await api('/appointments/search?status=cancelled&pageSize=1', admin.token);
      assert.equal(cancelled.status, 200);
      assert.ok(cancelled.body.total >= 1);
      assert.equal(cancelled.body.appointments.length, 1);
      assert.equal(cancelled.body.appointments[0].status, 'cancelled');
      assert.equal(cancelled.body.appointments[0].clinicId, 'clinic-1');
      const everything = await api('/appointments/search?pageSize=100', admin.token);
      assert.ok(everything.body.appointments.every((a: any) => a.clinicId === 'clinic-1'));
      assert.ok(
        everything.body.appointments.every(
          (a: any, i: number, list: any[]) => !i || list[i - 1].date >= a.date,
        ),
      );
      assert.equal(
        (await api('/appointments/search?query=zz-no-such-patient', admin.token)).body.total,
        0,
      );
      assert.equal((await api('/appointments/search', patient.token)).status, 403);
      assert.ok(
        (await api('/appointments/search?pageSize=100', otherAdmin.token)).body.appointments.every(
          (a: any) => a.clinicId === 'clinic-2',
        ),
      );
    });
    await check('Cognito subjects and staff IDs resolve through identity claims', async () => {
      const { docClient, DYNAMODB_TABLE_NAME } = await import('../src/config/aws.js');
      const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
      const user = (await repo.getUserById('demo-patient-3'))!;
      await repo.saveUser({ ...user, cognitoSub: 'test-sub-123' });
      const claim = await docClient.send(
        new GetCommand({
          TableName: DYNAMODB_TABLE_NAME,
          Key: { pk: 'IDENTITY#COGNITO#test-sub-123', sk: 'METADATA' },
        }),
      );
      assert.equal(claim.Item?.userId, 'demo-patient-3');
      assert.equal((await repo.findUserByCognitoSub('test-sub-123'))?.id, 'demo-patient-3');
      assert.equal(await repo.findUserByCognitoSub('unknown-sub'), null);
      assert.equal((await repo.findUserByIdentifier('demo-admin'))?.id, 'admin-1');
      const other = (await repo.getUserById('demo-patient-4'))!;
      await assert.rejects(repo.saveUser({ ...other, cognitoSub: 'test-sub-123' }));
    });
    await check('Wait estimates include an 80% range around the expected wait', async () => {
      const t1 = await join('demo-patient-11', 'doc-8');
      const t2 = await join('demo-patient-12', 'doc-8');
      try {
        const status = (await queue.getPatientActiveStatus('demo-patient-12'))!;
        assert.equal(status.patientsAhead, 1);
        assert.ok(status.estimatedWaitMinutes > 0);
        assert.ok(status.estimatedWaitRange!.low <= status.estimatedWaitMinutes);
        assert.ok(status.estimatedWaitRange!.high >= status.estimatedWaitMinutes);
        assert.equal(status.prediction?.modelVersion, 'consultation-lognormal-v2');
      } finally {
        await queue.cancelToken(t1.id);
        await queue.cancelToken(t2.id);
      }
    });
    await check(
      'The wait projection counts bookings whose time arrives during the wait',
      async () => {
        const { estimateWait, trainDurationModel: train } =
          await import('../src/services/predictionService.js');
        const model = train([], 10);
        const now = Date.parse(`${day}T10:00:00+05:30`);
        const token = (id: string, seq: number, scheduledTime: string, isWalkIn: boolean) => ({
          ...ownToken,
          id,
          tokenSeq: seq,
          tokenNumber: `T-${seq}`,
          scheduledTime,
          isWalkIn,
          priority: 'normal',
          status: 'waiting',
        });
        const walkIn = token('walk', 5, 'Walk-in', true);
        const alone = estimateWait({ model, target: walkIn, waiting: [], bufferMinutes: 2, now });
        const booked = [token('b1', 1, '10:15 AM', false), token('b2', 2, '10:30 AM', false)];
        const behind = estimateWait({
          model,
          target: walkIn,
          waiting: booked,
          bufferMinutes: 2,
          now,
        });
        // The walk-in is called at 10:00, before either booking becomes eligible.
        assert.equal(alone.minutes, 0);
        assert.equal(behind.minutes, 0);
        const earlier = [token('w3', 3, 'Walk-in', true), token('w4', 4, 'Walk-in', true)];
        const walkInsOnly = estimateWait({
          model,
          target: walkIn,
          waiting: earlier,
          bufferMinutes: 2,
          now,
        });
        const busy = estimateWait({
          model,
          target: walkIn,
          waiting: [...earlier, ...booked],
          bufferMinutes: 2,
          now,
        });
        // After two earlier walk-ins (about 23 minutes) the 10:15 booking is eligible and goes first.
        assert.ok(
          walkInsOnly.minutes >= 22 && walkInsOnly.minutes <= 25,
          `got ${walkInsOnly.minutes}`,
        );
        assert.ok(busy.minutes >= walkInsOnly.minutes + 10, `got ${busy.minutes}`);
        const later = token('b9', 9, '11:30 AM', false);
        const bookedWait = estimateWait({
          model,
          target: later,
          waiting: [],
          bufferMinutes: 2,
          now,
        });
        assert.ok(
          bookedWait.minutes >= 89,
          'a booked patient is not called before the appointment',
        );
      },
    );
    await check(
      'Concurrent bookings from different patients cannot overfill the last place',
      async () => {
        const settings = await repo.getSettings('clinic-3');
        await repo.saveSettings({ ...settings, bufferMinutes: 20 }, 'clinic-3');
        try {
          const slot = (await appointments.getDoctorSlotAvailability('doc-8', future)).find(
            (s) => s.available,
          )!;
          assert.ok(slot);
          const results = await Promise.allSettled(
            ['demo-patient-13', 'demo-patient-14', 'demo-patient-15'].map((patientId) =>
              appointments.createAppointment({
                patientId,
                patientName: 'Synthetic concurrency case',
                patientPhone: '9900000002',
                doctorId: 'doc-8',
                date: future,
                time: slot.time,
              }),
            ),
          );
          const booked = results.filter(
            (r) => r.status === 'fulfilled',
          ) as PromiseFulfilledResult<any>[];
          assert.equal(booked.length, 1);
          for (const r of booked) await appointments.cancelAppointment(r.value.appointment.id);
        } finally {
          await repo.saveSettings(settings, 'clinic-3');
        }
      },
    );
    await check('Only the synthetic local administrator can manage all demo clinics', async () => {
      const { canManageAllDemoClinics } = await import('../src/lib/demoAccess.js');
      process.env.DEMO_ALL_CLINICS = 'true';
      try {
        const session = await api('/auth/login', undefined, 'POST', {
          identifier: 'demo.staff@example.invalid',
          password: 'DemoClinic123!',
        });
        assert.equal(session.body.user.demoAllClinics, true);
        const queues = await api('/queues/all', session.body.token);
        assert.equal(queues.body.length, (await repo.getDoctors()).length);
        assert.equal(
          (await api('/analytics?clinicId=clinic-2', session.body.token)).body.clinicId,
          'clinic-2',
        );
        assert.equal((await api('/queues/doctor/doc-1', otherAdmin.token)).status, 403);
        assert.equal((await api('/settings?clinicId=clinic-1', otherAdmin.token)).status, 403);
        assert.equal((await api('/auth/me', otherAdmin.token)).body.demoAllClinics, false);
        assert.equal((await api('/auth/me', patient.token)).body.demoAllClinics, false);
        const adminUser = (await repo.getUserById('admin-1'))!;
        const endpoint = process.env.DYNAMODB_ENDPOINT;
        process.env.DYNAMODB_ENDPOINT = 'https://dynamodb.eu-north-1.amazonaws.com';
        assert.equal(canManageAllDemoClinics(adminUser), false);
        process.env.DYNAMODB_ENDPOINT = endpoint;
        process.env.NODE_ENV = 'production';
        assert.equal(canManageAllDemoClinics(adminUser), false);
        process.env.NODE_ENV = 'test';
        process.env.DEMO_ALL_CLINICS = 'false';
        assert.equal((await api('/queues/doctor/doc-5', session.body.token)).status, 403);
      } finally {
        process.env.NODE_ENV = 'test';
        delete process.env.DEMO_ALL_CLINICS;
      }
    });
    await check('Staff analytics report replayed wait accuracy for each method', async () => {
      const r = await api('/analytics', admin.token);
      assert.equal(r.status, 200);
      assert.ok(r.body.waitAccuracy.methods.formula);
      assert.ok(r.body.waitAccuracy.methods.learned);
    });
    await check('Session revocation takes effect on the next request', async () => {
      const user = (await repo.getUserById('patient-1'))!;
      await repo.saveUser({ ...user, sessionVersion: (user.sessionVersion || 0) + 1 });
      assert.equal((await api('/auth/me', patient.token)).status, 401);
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    const client = new DynamoDBClient({
      region: 'eu-north-1',
      endpoint: process.env.DYNAMODB_ENDPOINT,
      credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
    });
    requireLocalDatabase();
    await client.send(new DeleteTableCommand({ TableName: process.env.DYNAMODB_TABLE_NAME }));
    client.destroy();
    const dir = path.resolve(
      process.cwd(),
      process.cwd().endsWith('backend') ? '../docs/verification' : 'docs/verification',
    );
    await mkdir(dir, { recursive: true });
    const summary = {
      executedAt: new Date().toISOString(),
      database: 'Amazon DynamoDB Local',
      isolatedTableDeleted: true,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      results,
    };
    await writeFile(path.join(dir, 'test-results.json'), JSON.stringify(summary, null, 2));
    console.log(`\n${summary.passed} passed, ${summary.failed} failed. Isolated table deleted.`);
    process.exitCode = summary.failed ? 1 : 0;
  }
}
run().catch((err) => {
  console.error(err.name, err.message);
  process.exitCode = 1;
});
