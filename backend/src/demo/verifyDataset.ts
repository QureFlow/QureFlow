import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// This verifier can only read the named, loopback demonstration database.
process.env.DYNAMODB_ENDPOINT = 'http://127.0.0.1:18000';
process.env.DYNAMODB_TABLE_NAME = 'QureFlowDemo';
process.env.AUTH_PROVIDER = 'local';
async function verify() {
  const { requireLocalDatabase } = await import('./localDatabase.js');
  const { dynamoDbRepo: repo } = await import('../repositories/dynamoDbRepo.js');
  const { analyticsService } = await import('../services/analyticsService.js');
  const { docClient, DYNAMODB_TABLE_NAME } = await import('../config/aws.js');
  const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
  requireLocalDatabase();
  const [clinics, doctors, patients, appointments] = await Promise.all([
    repo.getClinics(),
    repo.getDoctors(),
    repo.getPatients(),
    repo.getAppointments(),
  ]);
  assert.equal(clinics.length, 6);
  assert.equal(doctors.length, 48);
  assert.equal(new Set(doctors.map((d) => d.specialization)).size, 12);
  assert.ok(patients.length >= 720);
  assert.ok(
    doctors.every(
      (d) =>
        d.bio &&
        d.languages?.length &&
        d.roomNumber &&
        d.registrationId &&
        d.metadata?.synthetic === true,
    ),
  );
  assert.ok(
    clinics.every(
      (c) => doctors.filter((d) => d.clinicId === c.id).length === 8 && c.activeDoctorsCount === 8,
    ),
  );
  const visits = (await Promise.all(clinics.map((c) => repo.getRecentTokens(c.id, 90)))).flat();
  const richVisits = visits.filter((t) => t.id.startsWith('demo-v3-'));
  assert.equal(richVisits.length, 5040);
  const byAppointment = new Map(appointments.map((a) => [a.id, a]));
  const active = new Set<string>(),
    current = new Set<string>();
  for (const token of richVisits) {
    const appointment = byAppointment.get(token.appointmentId!);
    assert.ok(
      appointment &&
        appointment.tokenId === token.id &&
        appointment.patientId === token.patientId &&
        appointment.doctorId === token.doctorId,
    );
    assert.equal(appointment.clinicId, token.clinicId);
    assert.equal(appointment.date, token.queueDate);
    const expected =
      token.status === 'current'
        ? 'in_consultation'
        : token.status === 'skipped'
          ? 'no_show'
          : token.id.includes('-future-') && token.status === 'waiting'
            ? 'booked'
            : token.status;
    assert.equal(appointment.status, expected);
    assert.ok(
      token.metadata?.schemaVersion === 3 &&
        token.metadata?.requestId &&
        token.metadata?.roomNumber,
    );
    if (token.status === 'completed') {
      const duration = (Date.parse(token.servedAt!) - Date.parse(token.calledAt!)) / 60000;
      assert.ok(
        duration >= 2 &&
          duration <= 60 &&
          Date.parse(token.createdAt) <= Date.parse(token.calledAt!),
      );
    }
    if (['waiting', 'current'].includes(token.status)) {
      const key = `${token.queueDate}#${token.patientId}`;
      assert.ok(!active.has(key), `Duplicate active patient visit: ${key}`);
      active.add(key);
    }
    if (token.status === 'current') {
      assert.ok(!current.has(token.queueId!));
      current.add(token.queueId!);
    }
  }
  const scopedCounts = await Promise.all(
    clinics.map(async (c) => ({
      clinicId: c.id,
      patients: (await repo.getPatients(undefined, c.id)).length,
      appointments: (await repo.getAppointments({ clinicId: c.id })).length,
    })),
  );
  assert.ok(scopedCounts.every((c) => c.patients >= 120 && c.appointments >= 840));
  const overview = await analyticsService.overview('clinic-1');
  assert.equal(overview.doctors.length, 8);
  const models = await analyticsService.getModels('clinic-1');
  assert.ok([...models.values()].every((m) => m.sampleCount >= 40));
  const marker = (
    await docClient.send(
      new GetCommand({ TableName: DYNAMODB_TABLE_NAME, Key: { pk: 'DEMO#SEED', sk: 'V3' } }),
    )
  ).Item!;
  const result = {
    executedAt: new Date().toISOString(),
    database: 'Amazon DynamoDB Local',
    table: 'QureFlowDemo',
    readOnly: true,
    passed: true,
    clinics: clinics.length,
    doctors: doctors.length,
    specialties: 12,
    patientProfiles: patients.length,
    appointments: appointments.length,
    visits: visits.length,
    addedVisits: richVisits.length,
    metadataSchemaVersion: marker.metadataSchemaVersion,
    clinicDirectory: scopedCounts,
    models: [...models].map(([doctorId, m]) => ({
      doctorId,
      method: m.method,
      sampleCount: m.sampleCount,
      syntheticCount: m.syntheticSamples,
      validationMaeMinutes: m.modelMae,
    })),
    assertions: [
      'Directory size and profile metadata',
      'Eight doctors per facility',
      '5,040 linked generated visits and appointments',
      'Status, clinic, date and patient consistency',
      'Valid consultation timestamps',
      'One active visit per patient per day',
      'One current consultation per doctor queue',
      'Clinic scoped patient and appointment queries',
      'Operational model training with sufficient observations',
    ],
  };
  const dir = path.resolve(
    process.cwd(),
    process.cwd().endsWith('backend') ? '../docs/verification' : 'docs/verification',
  );
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'dataset-results.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}
verify().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
});
