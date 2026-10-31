import { DeleteCommand, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, DYNAMODB_TABLE_NAME } from '../config/aws.js';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { buildDemoDirectory } from './demoDirectory.js';

/*
 * Temporarily lists the synthetic evaluation directory (6 clinics, 48 doctors) in a cloud table
 * until the paper is published. Only directory records and clinic settings are written: no
 * patients, accounts or visit history. Every id is prefixed `demo-` so nothing collides with
 * real clinics, and every record carries metadata.synthetic.
 *
 * Dry run (reads only):  npm run demo:cloud --prefix backend
 * Add:                   npm run demo:cloud --prefix backend -- --apply --confirm-table=<table>
 * Remove:                npm run demo:cloud --prefix backend -- --remove --apply --confirm-table=<table>
 *
 * Removal deletes every item keyed by, or belonging to, a demo clinic or doctor (including any
 * appointments or tokens made with them during the demonstration). User accounts and identity
 * claims are never deleted; any that point at a demo clinic are reported for review.
 */
type Item = Record<string, any>;
const apply = process.argv.includes('--apply');
const remove = process.argv.includes('--remove');
const confirmed = process.argv.find((a) => a.startsWith('--confirm-table='))?.split('=')[1];
const PREFIX = 'demo-';
const demoId = (id: string) => `${PREFIX}${id}`;
const isDemo = (value: unknown) =>
  typeof value === 'string' && /(^|#)demo-(clinic|doc)-\d+/.test(value);
// Department names already used by the cloud directory, so a department is listed once.
const SPECIALTY_NAMES: Record<string, string> = {
  Dermatology: 'Dermatology & Skin Care',
  Gynecology: 'Obstetrics & Gynecology',
  Ophthalmology: 'Ophthalmology (Eye)',
};
const specialtyName = (name: string) => SPECIALTY_NAMES[name] ?? name;

function directory() {
  const { clinics, doctors } = buildDemoDirectory();
  const listedAt = new Date().toISOString();
  return {
    clinics: clinics.map((c) => ({
      ...c,
      id: demoId(c.id),
      metadata: { ...c.metadata, synthetic: true, temporaryDemo: true, listedAt },
    })),
    doctors: doctors.map((d) => ({
      ...d,
      id: demoId(d.id),
      clinicId: demoId(d.clinicId),
      specialization: specialtyName(d.specialization),
      department: specialtyName(d.specialization),
      isAvailableToday: true,
      metadata: { ...d.metadata, synthetic: true, temporaryDemo: true, listedAt },
    })),
  };
}

async function scanAll(): Promise<Item[]> {
  const items: Item[] = [];
  let cursor: Item | undefined;
  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: DYNAMODB_TABLE_NAME,
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
      }),
    );
    items.push(...(page.Items || []));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return items;
}

async function add() {
  const { clinics, doctors } = directory();
  const existing: string[] = [];
  for (const [kind, id] of [
    ...clinics.map((c) => ['CLINIC', c.id]),
    ...doctors.map((d) => ['DOCTOR', d.id]),
  ])
    if (
      (
        await docClient.send(
          new GetCommand({ TableName: DYNAMODB_TABLE_NAME, Key: { pk: `${kind}#${id}`, sk: 'METADATA' } }),
        )
      ).Item
    )
      existing.push(id);
  console.log(
    `[demo] Table ${DYNAMODB_TABLE_NAME}: ${clinics.length} clinics and ${doctors.length} doctors to list` +
      (existing.length ? ` (${existing.length} already listed; they will be refreshed).` : '.'),
  );
  if (!apply) return console.log('[demo] Dry run only. Nothing was written.');
  for (const clinic of clinics) {
    await dynamoDbRepo.saveClinic(clinic);
    await dynamoDbRepo.saveSettings(
      {
        averageConsultationMinutes: 10,
        bufferMinutes: 2,
        allowWalkIns: true,
        allowEmergencyPriority: true,
        notifyOnTwoAhead: false,
        autoTokenPrefixByDoctor: true,
        clinicName: clinic.name,
        contactNumber: 'Demonstration clinic',
      },
      clinic.id,
    );
  }
  for (const doctor of doctors) await dynamoDbRepo.saveDoctor(doctor);
  console.log(`[demo] Listed ${clinics.length} clinics and ${doctors.length} doctors.`);
}

async function removeAll() {
  const items = await scanAll();
  const owned = items.filter(
    (i) =>
      [i.pk, i.sk, i.clinicId, i.doctorId].some(isDemo) &&
      !/^(USER|IDENTITY)#/.test(i.pk),
  );
  const accounts = items.filter((i) => /^USER#/.test(i.pk) && isDemo(i.clinicId));
  console.log(`[demo] Table ${DYNAMODB_TABLE_NAME}: ${owned.length} demo items to delete.`);
  for (const a of accounts)
    console.warn(`[demo] Account ${a.pk} points at ${a.clinicId}; review it manually.`);
  if (!apply) return console.log('[demo] Dry run only. Nothing was deleted.');
  for (const i of owned)
    await docClient.send(
      new DeleteCommand({ TableName: DYNAMODB_TABLE_NAME, Key: { pk: i.pk, sk: i.sk } }),
    );
  console.log(`[demo] Deleted ${owned.length} items.`);
}

async function run() {
  if (apply && confirmed !== DYNAMODB_TABLE_NAME)
    throw new Error(`Pass --confirm-table=${DYNAMODB_TABLE_NAME} to write to this table.`);
  await (remove ? removeAll() : add());
}
run().catch((e) => {
  console.error('[demo] Failed:', e.message);
  process.exitCode = 1;
});
