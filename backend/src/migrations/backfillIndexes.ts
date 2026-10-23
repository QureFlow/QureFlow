import { BatchWriteCommand, PutCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, DYNAMODB_TABLE_NAME, AWS_REGION } from '../config/aws.js';
import { readModelItems } from '../lib/readModels.js';
import { phoneDigits } from '../lib/validation.js';

/*
 * Builds the indexed read models and identity claims for records written before they existed,
 * then sets the READ_MODELS marker so the service stops falling back to table scans.
 *
 * Dry run (reads only):   npm run migrate:backfill --prefix backend
 * Apply:                  npm run migrate:backfill --prefix backend -- --apply --confirm-table=<table>
 *
 * Index items are derived copies of the primary records, so rerunning is safe. Identity claims
 * are only created where none exists; a claim held by another account is reported, not changed.
 */
type Item = Record<string, any>;
const apply = process.argv.includes('--apply');
const confirmed = process.argv.find((a) => a.startsWith('--confirm-table='))?.split('=')[1];

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
const strip = ({
  pk,
  sk,
  GSI1PK,
  GSI1SK,
  GSI2PK,
  GSI2SK,
  GSI3PK,
  GSI3SK,
  phoneLookup,
  emailLookup,
  ...data
}: Item) => data;

async function run() {
  if (apply && confirmed !== DYNAMODB_TABLE_NAME)
    throw new Error(
      `Refusing to write: pass --confirm-table=${DYNAMODB_TABLE_NAME} to confirm the target table.`,
    );
  console.log(
    `[backfill] ${apply ? 'APPLY' : 'DRY RUN'} on table ${DYNAMODB_TABLE_NAME} (${process.env.DYNAMODB_ENDPOINT || AWS_REGION})`,
  );
  const all = await scanAll();
  const existing = new Map(all.map((i) => [`${i.pk}|${i.sk}`, i]));
  const puts: Item[] = [],
    claims: Item[] = [],
    conflicts: string[] = [];
  const memberships = (clinicId: string | undefined, userId: string | undefined) => {
    if (clinicId && userId) puts.push({ pk: `PATIENTS#CLINIC#${clinicId}`, sk: userId, userId });
  };
  for (const item of all) {
    const data = strip(item);
    if (item.sk === 'METADATA' && item.pk.startsWith('CLINIC#'))
      puts.push(...readModelItems('clinic', data));
    else if (item.sk === 'METADATA' && item.pk.startsWith('DOCTOR#'))
      puts.push(...readModelItems('doctor', data));
    else if (item.sk === 'METADATA' && item.pk.startsWith('APPOINTMENT#')) {
      puts.push(...readModelItems('appointment', data));
      memberships(data.clinicId, data.patientId);
    } else if (item.pk.startsWith('QUEUE#') && item.sk.startsWith('TOKEN#')) {
      puts.push(...readModelItems('token', data));
      memberships(data.clinicId, data.patientId);
      if (!existing.has(`TOKEN#${data.id}|METADATA`))
        puts.push({ pk: `TOKEN#${data.id}`, sk: 'METADATA', queuePk: item.pk, queueSk: item.sk });
    } else if (item.sk === 'METADATA' && item.pk.startsWith('USER#')) {
      if (data.role === 'patient') {
        puts.push({ pk: 'CATALOG#PATIENTS', sk: data.id, userId: data.id });
        memberships(data.clinicId, data.id);
      }
      for (const [kind, value] of [
        ['PHONE', data.phone ? phoneDigits(data.phone) : ''],
        ['EMAIL', data.email?.trim().toLowerCase() || ''],
        ['STAFF', data.staffId?.trim().toLowerCase() || ''],
        ['COGNITO', data.cognitoSub || ''],
      ]) {
        if (!value) continue;
        const claim = existing.get(`IDENTITY#${kind}#${value}|METADATA`);
        if (!claim)
          claims.push({ pk: `IDENTITY#${kind}#${value}`, sk: 'METADATA', userId: data.id });
        else if (claim.userId !== data.id)
          conflicts.push(`${kind} claim for user ${data.id} is held by ${claim.userId}`);
      }
    }
  }
  const unique = [...new Map(puts.map((i) => [`${i.pk}|${i.sk}`, i])).values()];
  console.log(`[backfill] Scanned ${all.length} items.`);
  console.log(
    `[backfill] Index items to write: ${unique.length}; identity claims to create: ${claims.length}.`,
  );
  for (const c of conflicts) console.warn(`[backfill] Conflict (left unchanged): ${c}`);
  if (!apply) {
    console.log('[backfill] Dry run only. Nothing was written.');
    return;
  }
  for (let offset = 0; offset < unique.length; offset += 25) {
    let pending = unique.slice(offset, offset + 25).map((Item) => ({ PutRequest: { Item } }));
    for (let retry = 0; pending.length && retry < 8; retry++) {
      const result = await docClient.send(
        new BatchWriteCommand({ RequestItems: { [DYNAMODB_TABLE_NAME]: pending } }),
      );
      pending = (result.UnprocessedItems?.[DYNAMODB_TABLE_NAME] || []) as any;
      if (pending.length) await new Promise((r) => setTimeout(r, 100 * 2 ** retry));
    }
    if (pending.length)
      throw new Error('Some index items could not be written; rerun the backfill.');
  }
  for (const claim of claims)
    try {
      await docClient.send(
        new PutCommand({
          TableName: DYNAMODB_TABLE_NAME,
          Item: claim,
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
    } catch (e: any) {
      if (e.name !== 'ConditionalCheckFailedException') throw e;
    }
  if (conflicts.length) {
    console.warn(
      '[backfill] Resolve the conflicts above, then rerun. The READ_MODELS marker was not set.',
    );
    process.exitCode = 1;
    return;
  }
  await docClient.send(
    new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: {
        pk: 'READ_MODELS',
        sk: 'V1',
        enabledAt: new Date().toISOString(),
        source: 'backfillIndexes',
      },
    }),
  );
  console.log('[backfill] Done. Indexed reads are enabled.');
}
run().catch((e) => {
  console.error('[backfill] Failed:', e.message);
  process.exitCode = 1;
});
