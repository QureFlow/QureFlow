import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  ScanCommand,
  QueryCommand,
  TransactWriteCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'node:crypto';
import { docClient, DYNAMODB_TABLE_NAME } from '../config/aws.js';
import {
  Clinic,
  Doctor,
  User,
  QueueToken,
  Appointment,
  QueueSettings,
  TokenStatus,
} from '../models/types.js';
import { operationMetadata } from '../lib/context.js';
import { clinicDate, clockMinutes } from '../lib/time.js';
import { phoneDigits } from '../lib/validation.js';
import { AppError } from '../lib/errors.js';
import { readModelItems } from '../lib/readModels.js';
import {
  AppointmentFilters,
  DoctorFilters,
  filterAppointments,
  filterDoctors,
  page,
} from '../lib/directory.js';
type Item = Record<string, any>;
const clean = <T>(item: Item): T => {
  const {
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
  } = item;
  return data as T;
};
export class DynamoDbRepository {
  private tableName = DYNAMODB_TABLE_NAME;
  private readModelsEnabled = false;
  private key(pk: string, sk = 'METADATA') {
    return { pk, sk };
  }
  /**
   * Tables written before the indexed read models were backfilled still need full-table
   * fallbacks. Once the marker exists it never disappears, so a positive answer is cached.
   */
  private async readModels(): Promise<boolean> {
    if (!this.readModelsEnabled)
      this.readModelsEnabled = Boolean(await this.get('READ_MODELS', 'V1'));
    return this.readModelsEnabled;
  }
  private async get(pk: string, sk = 'METADATA'): Promise<Item | null> {
    return (
      (
        await docClient.send(
          new GetCommand({
            TableName: this.tableName,
            Key: this.key(pk, sk),
            ConsistentRead: true,
          }),
        )
      ).Item || null
    );
  }
  private async scan(filter: string, values: Item, names?: Item): Promise<Item[]> {
    const items: Item[] = [];
    let cursor: Item | undefined;
    do {
      const page = await docClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: filter,
          ExpressionAttributeValues: values,
          ExpressionAttributeNames: names,
          ExclusiveStartKey: cursor,
          ConsistentRead: true,
        }),
      );
      items.push(...(page.Items || []));
      cursor = page.LastEvaluatedKey;
    } while (cursor);
    return items;
  }
  private async query(pk: string, prefix: string): Promise<Item[]> {
    const items: Item[] = [];
    let cursor: Item | undefined;
    do {
      const page = await docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: prefix ? 'pk = :pk AND begins_with(sk, :prefix)' : 'pk = :pk',
          ExpressionAttributeValues: prefix ? { ':pk': pk, ':prefix': prefix } : { ':pk': pk },
          ExclusiveStartKey: cursor,
          ConsistentRead: true,
        }),
      );
      items.push(...(page.Items || []));
      cursor = page.LastEvaluatedKey;
    } while (cursor);
    return items;
  }
  private put(Item: Item, extra: Item = {}) {
    return { Put: { TableName: this.tableName, Item, ...extra } };
  }
  private audit(
    entityType: string,
    entityId: string,
    action: string,
    clinicId?: string,
    details: Item = {},
  ) {
    const meta = operationMetadata(),
      id = randomUUID();
    return this.put({
      pk: `AUDIT#${clinicId || 'SYSTEM'}`,
      sk: `${meta.timestamp}#${id}`,
      id,
      entityType,
      entityId,
      action,
      clinicId,
      ...meta,
      details,
    });
  }
  private async write(items: any[]): Promise<void> {
    try {
      await docClient.send(
        new TransactWriteCommand({ TransactItems: items, ClientRequestToken: randomUUID() }),
      );
    } catch (error: any) {
      if (
        error.name === 'TransactionCanceledException' ||
        error.name === 'ConditionalCheckFailedException'
      )
        throw new AppError(
          409,
          'This record changed, the patient already has an active visit, or the slot is full. Refresh and try again.',
          'CONFLICT',
        );
      throw error;
    }
  }
  private async activeDoctorCounts(): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    for (const d of await this.getDoctors())
      if (d.status === 'active') counts.set(d.clinicId, (counts.get(d.clinicId) || 0) + 1);
    return counts;
  }
  async getClinics(): Promise<Clinic[]> {
    const [rows, counts] = await Promise.all([
      (await this.readModels())
        ? this.query('CATALOG#CLINICS', '')
        : this.scan('begins_with(pk, :p) AND sk = :m', { ':p': 'CLINIC#', ':m': 'METADATA' }),
      this.activeDoctorCounts(),
    ]);
    return rows
      .map(clean<Clinic>)
      .map((c) => ({ ...c, activeDoctorsCount: counts.get(c.id) || 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async getClinicById(id: string): Promise<Clinic | null> {
    const row = await this.get(`CLINIC#${id}`);
    if (!row) return null;
    return {
      ...clean<Clinic>(row),
      activeDoctorsCount: (await this.activeDoctorCounts()).get(id) || 0,
    };
  }
  async saveClinic(clinic: Clinic): Promise<Clinic> {
    const next = { ...clinic, updatedAt: new Date().toISOString() };
    await this.write([
      this.put({
        ...this.key(`CLINIC#${clinic.id}`),
        ...next,
      }),
      this.audit('clinic', clinic.id, 'updated', clinic.id),
      ...readModelItems('clinic', next).map((item) => this.put(item)),
    ]);
    return clinic;
  }
  async getSettings(clinicId?: string): Promise<QueueSettings> {
    const row =
      (clinicId ? await this.get(`SETTINGS#${clinicId}`) : null) ||
      (await this.get('SETTINGS#GLOBAL'));
    return row
      ? clean<QueueSettings>(row)
      : {
          averageConsultationMinutes: 10,
          bufferMinutes: 2,
          allowWalkIns: true,
          allowEmergencyPriority: true,
          notifyOnTwoAhead: false,
          autoTokenPrefixByDoctor: true,
          clinicName: 'QureFlow Clinic',
          contactNumber: '',
        };
  }
  async saveSettings(settings: QueueSettings, clinicId?: string): Promise<QueueSettings> {
    await this.write([
      this.put({
        ...this.key(`SETTINGS#${clinicId || 'GLOBAL'}`),
        ...settings,
        updatedAt: new Date().toISOString(),
      }),
      this.audit('settings', clinicId || 'global', 'updated', clinicId),
    ]);
    return settings;
  }
  async getDoctors(filters?: DoctorFilters): Promise<Doctor[]> {
    const doctors = (
      (await this.readModels())
        ? await this.query('CATALOG#DOCTORS', '')
        : await this.scan('begins_with(pk, :p) AND sk = :m', { ':p': 'DOCTOR#', ':m': 'METADATA' })
    ).map(clean<Doctor>);
    return filters ? filterDoctors(doctors, filters) : doctors;
  }
  async searchDoctors(filters: DoctorFilters & { page: number; pageSize: number }) {
    const doctors = await this.getDoctors(filters);
    return { doctors: page(doctors, filters.page, filters.pageSize), total: doctors.length };
  }
  async directoryOptions() {
    const active = (await this.getDoctors()).filter((d) => d.status === 'active');
    const distinct = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));
    return {
      specialties: distinct(active.map((d) => d.specialization)),
      languages: distinct(active.flatMap((d) => d.languages || [])),
      doctorCount: active.length,
      clinicCount: new Set(active.map((d) => d.clinicId)).size,
    };
  }
  async getDoctorById(id: string): Promise<Doctor | null> {
    const row = await this.get(`DOCTOR#${id}`);
    return row ? clean<Doctor>(row) : null;
  }
  async saveDoctor(doctor: Doctor): Promise<Doctor> {
    const next = { ...doctor, updatedAt: new Date().toISOString() };
    await this.write([
      this.put({
        ...this.key(`DOCTOR#${doctor.id}`),
        ...next,
      }),
      this.audit('doctor', doctor.id, 'updated', doctor.clinicId),
      ...readModelItems('doctor', next).map((item) => this.put(item)),
    ]);
    return doctor;
  }
  async saveUser(user: User): Promise<User> {
    const previous = await this.getUserById(user.id);
    const phone = phoneDigits(user.phone),
      email = user.email.trim().toLowerCase();
    const next = {
      ...user,
      phone,
      email,
      version: (user.version || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    const items: any[] = [
      this.put(
        { ...this.key(`USER#${user.id}`), phoneLookup: phone, emailLookup: email, ...next },
        previous
          ? {
              ConditionExpression: 'attribute_not_exists(#v) OR #v = :v',
              ExpressionAttributeNames: { '#v': 'version' },
              ExpressionAttributeValues: { ':v': user.version || 0 },
            }
          : { ConditionExpression: 'attribute_not_exists(pk)' },
      ),
    ];
    // Each identity claim makes a lookup a single GetItem and makes the value unique.
    for (const [kind, value, old] of [
      ['PHONE', phone, previous?.phone ? phoneDigits(previous.phone) : ''],
      ['EMAIL', email, previous?.email?.toLowerCase() || ''],
      ['STAFF', user.staffId?.trim().toLowerCase() || '', previous?.staffId?.toLowerCase() || ''],
      ['COGNITO', user.cognitoSub || '', previous?.cognitoSub || ''],
    ]) {
      if (value)
        items.push(
          this.put(
            { ...this.key(`IDENTITY#${kind}#${value}`), userId: user.id },
            {
              ConditionExpression: 'attribute_not_exists(pk) OR userId = :id',
              ExpressionAttributeValues: { ':id': user.id },
            },
          ),
        );
      if (old && old !== value)
        items.push({
          Delete: {
            TableName: this.tableName,
            Key: this.key(`IDENTITY#${kind}#${old}`),
            ConditionExpression: 'attribute_not_exists(pk) OR userId = :id',
            ExpressionAttributeValues: { ':id': user.id },
          },
        });
    }
    items.push(this.audit('user', user.id, previous ? 'updated' : 'created', user.clinicId));
    if (user.role === 'patient') {
      items.push(this.put({ pk: 'CATALOG#PATIENTS', sk: user.id, userId: user.id }));
      if (user.clinicId)
        items.push(
          this.put({ pk: `PATIENTS#CLINIC#${user.clinicId}`, sk: user.id, userId: user.id }),
        );
    }
    await this.write(items);
    return next;
  }
  async getUserById(id: string): Promise<User | null> {
    const row = await this.get(`USER#${id}`);
    return row ? clean<User>(row) : null;
  }
  /** Records a claim found by a legacy scan so the next lookup is a single read. */
  private async backfillClaim(kind: string, value: string, userId: string) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: { ...this.key(`IDENTITY#${kind}#${value}`), userId },
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
    } catch (e: any) {
      if (e.name !== 'ConditionalCheckFailedException') throw e;
    }
  }
  async findUserByIdentifier(identifier: string): Promise<User | null> {
    const id = identifier.trim().toLowerCase(),
      isEmail = id.includes('@'),
      phone = phoneDigits(id);
    const [kind, value] = isEmail
      ? ['EMAIL', id]
      : /^\d{10}$/.test(phone)
        ? ['PHONE', phone]
        : ['STAFF', id];
    const claim = await this.get(`IDENTITY#${kind}#${value}`);
    if (claim) return this.getUserById(claim.userId);
    // After the backfill migration every identity has a claim, so a miss is final.
    if (await this.readModels()) return null;
    const users = await this.scan('begins_with(pk, :p) AND sk = :m', {
      ':p': 'USER#',
      ':m': 'METADATA',
    });
    const found = users.find((u) =>
      kind === 'EMAIL'
        ? u.email?.toLowerCase() === id
        : kind === 'PHONE'
          ? phoneDigits(u.phone || '') === phone
          : u.staffId?.toLowerCase() === id,
    );
    if (!found) return null;
    await this.backfillClaim(kind, value, found.id);
    return clean<User>(found);
  }
  async findUserByCognitoSub(sub: string): Promise<User | null> {
    const claim = await this.get(`IDENTITY#COGNITO#${sub}`);
    if (claim) return this.getUserById(claim.userId);
    if (await this.readModels()) return null;
    const users = await this.scan('begins_with(pk, :p) AND sk = :m AND cognitoSub = :sub', {
      ':p': 'USER#',
      ':m': 'METADATA',
      ':sub': sub,
    });
    if (!users[0]) return null;
    await this.backfillClaim('COGNITO', sub, users[0].id);
    return clean<User>(users[0]);
  }
  async getPatients(search?: string, clinicId?: string): Promise<User[]> {
    if (await this.readModels()) {
      const references = await this.query(
        clinicId ? `PATIENTS#CLINIC#${clinicId}` : 'CATALOG#PATIENTS',
        '',
      );
      const users: User[] = [];
      for (let offset = 0; offset < references.length; offset += 100) {
        let keys = references.slice(offset, offset + 100).map((r) => this.key(`USER#${r.userId}`));
        for (let attempt = 0; keys.length && attempt < 6; attempt++) {
          const result = await docClient.send(
            new BatchGetCommand({
              RequestItems: { [this.tableName]: { Keys: keys, ConsistentRead: true } },
            }),
          );
          users.push(...(result.Responses?.[this.tableName] || []).map(clean<User>));
          keys = (result.UnprocessedKeys?.[this.tableName]?.Keys || []) as {
            pk: string;
            sk: string;
          }[];
        }
        if (keys.length)
          throw new AppError(503, 'Patient records could not all be loaded. Please retry.');
      }
      const q = search?.toLowerCase();
      return users.filter(
        (u) =>
          u.role === 'patient' &&
          (!q || `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q)),
      );
    }
    let list = (
      await this.scan(
        'begins_with(pk, :p) AND sk = :m AND #role = :r',
        { ':p': 'USER#', ':m': 'METADATA', ':r': 'patient' },
        { '#role': 'role' },
      )
    ).map(clean<User>);
    if (clinicId) {
      const seen = new Set(
        (await this.getAppointments({ clinicId }))
          .filter((a) => a.clinicId === clinicId)
          .map((a) => a.patientId),
      );
      for (const d of (await this.getDoctors()).filter((d) => d.clinicId === clinicId))
        for (const t of await this.getAllTokensForQueue(this.getQueueId(d.id)))
          if (t.patientId) seen.add(t.patientId);
      list = list.filter((u) => u.clinicId === clinicId || seen.has(u.id));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || u.phone.includes(q) || u.email.includes(q),
      );
    }
    return list;
  }
  /** Patients a doctor has seen or will see: any visit or appointment with that doctor. */
  async patientsForDoctor(
    search: string | undefined,
    clinicId: string | undefined,
    doctorId: string,
  ) {
    const doctor = await this.getDoctorById(doctorId);
    if (!doctor) return [];
    const [patients, appointments, visits] = await Promise.all([
      this.getPatients(search, clinicId),
      this.getAppointments({ doctorId }),
      this.getRecentTokens(doctor.clinicId, 3650),
    ]);
    const seen = new Set(appointments.map((a) => a.patientId));
    for (const t of visits) if (t.doctorId === doctorId && t.patientId) seen.add(t.patientId);
    for (const t of await this.getAllTokensForQueue(this.getQueueId(doctorId)))
      if (t.patientId) seen.add(t.patientId);
    return patients.filter((p) => seen.has(p.id));
  }
  getQueueId(doctorId: string, date = clinicDate()) {
    return `${date}#${doctorId}`;
  }
  async getNextTokenSequence(queueId: string): Promise<{ seq: number; paddedSeq: string }> {
    const res = await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: this.key(`QUEUE#${queueId}`, 'COUNTER'),
        UpdateExpression: 'ADD currentNumber :one',
        ExpressionAttributeValues: { ':one': 1 },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    const seq = res.Attributes!.currentNumber as number;
    return { seq, paddedSeq: String(seq).padStart(8, '0') };
  }
  async getActivePatientToken(patientId: string, date = clinicDate()): Promise<QueueToken | null> {
    const claim = await this.get(`PATIENT_DAY#${date}#${patientId}`, 'ACTIVE');
    if (claim) return (await this.findTokenById(claim.tokenId))?.token || null;
    if (await this.readModels()) return null;
    for (const d of await this.getDoctors()) {
      const found = (await this.getAllTokensForQueue(this.getQueueId(d.id, date))).find(
        (t) => t.patientId === patientId && ['waiting', 'current'].includes(t.status),
      );
      if (found) return found;
    }
    return null;
  }
  async initializeSlot(
    doctorId: string,
    date: string,
    time: string,
    capacity: number,
  ): Promise<void> {
    const count = (await this.getAppointments({ doctorId, date })).filter(
      (a) => a.time === time && !['cancelled', 'no_show'].includes(a.status),
    ).length;
    try {
      await docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            ...this.key(`SLOT#${date}#${doctorId}#${time}`, 'COUNTER'),
            bookedCount: count,
            capacity,
          },
          ConditionExpression: 'attribute_not_exists(pk)',
        }),
      );
    } catch (e: any) {
      if (e.name !== 'ConditionalCheckFailedException') throw e;
    }
  }
  async createToken(
    token: QueueToken,
    queueId: string,
    seq: number,
    appointment?: Appointment,
    capacity?: number,
  ): Promise<QueueToken> {
    const queueDate = queueId.split('#')[0],
      meta = operationMetadata();
    const next = {
      ...token,
      queueId,
      queueDate,
      tokenSeq: seq,
      version: 1,
      updatedAt: meta.timestamp,
      metadata: {
        ...token.metadata,
        source: token.isWalkIn ? 'reception' : 'online',
        createdBy: meta.actorId,
        requestId: meta.requestId,
        timeZone: 'Asia/Kolkata',
        schemaVersion: 2,
      },
    };
    const key = this.key(`QUEUE#${queueId}`, `TOKEN#${String(seq).padStart(8, '0')}`);
    const items: any[] = [
      this.put({ ...key, ...next }, { ConditionExpression: 'attribute_not_exists(pk)' }),
      ...readModelItems('token', next).map((item) => this.put(item)),
      this.put(
        { ...this.key(`TOKEN#${token.id}`), queuePk: key.pk, queueSk: key.sk },
        { ConditionExpression: 'attribute_not_exists(pk)' },
      ),
      {
        ConditionCheck: {
          TableName: this.tableName,
          Key: this.key(`DOCTOR#${token.doctorId}`),
          ConditionExpression: '#status = :active',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: { ':active': 'active' },
        },
      },
      this.audit('token', token.id, 'created', token.clinicId, {
        status: 'waiting',
        queueDate,
        priority: token.priority,
      }),
    ];
    if (token.patientId)
      items.push(
        this.put({
          pk: `PATIENTS#CLINIC#${token.clinicId}`,
          sk: token.patientId,
          userId: token.patientId,
        }),
        this.put(
          {
            ...this.key(`PATIENT_DAY#${queueDate}#${token.patientId}`, 'ACTIVE'),
            tokenId: token.id,
          },
          { ConditionExpression: 'attribute_not_exists(pk)' },
        ),
      );
    if (appointment) {
      const appointmentView = {
        ...appointment,
        tokenId: token.id,
        version: 1,
        updatedAt: meta.timestamp,
        metadata: {
          source: 'online',
          createdBy: meta.actorId,
          requestId: meta.requestId,
          schemaVersion: 2,
        },
      };
      items.push(...readModelItems('appointment', appointmentView).map((item) => this.put(item)));
      items.push(
        this.put(
          {
            ...this.key(`APPOINTMENT#${appointment.id}`),
            ...appointment,
            tokenId: token.id,
            version: 1,
            updatedAt: meta.timestamp,
            metadata: {
              source: 'online',
              createdBy: meta.actorId,
              requestId: meta.requestId,
              schemaVersion: 2,
            },
          },
          { ConditionExpression: 'attribute_not_exists(pk)' },
        ),
      );
      items.push({
        Update: {
          TableName: this.tableName,
          Key: this.key(
            `SLOT#${appointment.date}#${appointment.doctorId}#${appointment.time}`,
            'COUNTER',
          ),
          UpdateExpression: 'ADD bookedCount :one',
          ConditionExpression: 'bookedCount < :capacity',
          ExpressionAttributeValues: { ':one': 1, ':capacity': capacity },
        },
      });
      items.push(
        this.audit('appointment', appointment.id, 'created', appointment.clinicId, {
          date: appointment.date,
          time: appointment.time,
          status: appointment.status,
        }),
      );
    }
    await this.write(items);
    return next;
  }
  async getAllTokensForQueue(queueId: string): Promise<QueueToken[]> {
    return (await this.query(`QUEUE#${queueId}`, 'TOKEN#'))
      .map(clean<QueueToken>)
      .sort(
        (a, b) =>
          (a.tokenSeq || Number(a.tokenNumber.split('-').pop())) -
          (b.tokenSeq || Number(b.tokenNumber.split('-').pop())),
      );
  }
  async getWaitingTokens(queueId: string): Promise<QueueToken[]> {
    return (await this.getAllTokensForQueue(queueId))
      .filter((t) => t.status === 'waiting')
      .sort(
        (a, b) =>
          (a.priority === 'emergency' ? 0 : 1) - (b.priority === 'emergency' ? 0 : 1) ||
          (a.tokenSeq || Number(a.tokenNumber.split('-').pop())) -
            (b.tokenSeq || Number(b.tokenNumber.split('-').pop())),
      );
  }
  /**
   * Emergencies, walk-ins and appointments whose time has arrived are eligible; a future
   * appointment is never called ahead of its window.
   */
  async getNextEligibleToken(queueId: string, minute: number): Promise<QueueToken | null> {
    const date = queueId.split('#')[0];
    return (
      (await this.getWaitingTokens(queueId)).find(
        (t) =>
          t.priority === 'emergency' ||
          t.isWalkIn ||
          ['Now', 'Walk-in'].includes(t.scheduledTime) ||
          (date === clinicDate() && clockMinutes(t.scheduledTime) <= minute),
      ) || null
    );
  }
  async findTokenById(id: string): Promise<{ token: QueueToken; pk: string; sk: string } | null> {
    const locator = await this.get(`TOKEN#${id}`);
    let item = locator ? await this.get(locator.queuePk, locator.queueSk) : null;
    if (!item && !(await this.readModels()))
      item =
        (
          await this.scan('begins_with(pk, :p) AND begins_with(sk, :t) AND id = :id', {
            ':p': 'QUEUE#',
            ':t': 'TOKEN#',
            ':id': id,
          })
        )[0] || null;
    return item ? { token: clean<QueueToken>(item), pk: item.pk, sk: item.sk } : null;
  }
  async updateTokenStatus(
    pk: string,
    sk: string,
    status: TokenStatus,
    options?: { calledAt?: string; servedAt?: string; reason?: string },
  ): Promise<QueueToken> {
    const row = await this.get(pk, sk);
    if (!row) throw new AppError(404, 'Token not found');
    const old = clean<QueueToken>(row);
    const allowed: Record<TokenStatus, TokenStatus[]> = {
      waiting: ['current', 'skipped', 'cancelled'],
      current: ['completed', 'skipped'],
      completed: [],
      skipped: [],
      cancelled: [],
    };
    if (!allowed[old.status].includes(status))
      throw new AppError(409, `Cannot change a ${old.status} token to ${status}`);
    const meta = operationMetadata(),
      queueDate = old.queueDate || pk.slice(6).split('#')[0];
    const updated: Item = {
      ...row,
      status,
      metadata: {
        ...old.metadata,
        lastUpdatedBy: meta.actorId,
        lastRequestId: meta.requestId,
        ...(status === 'completed' && old.calledAt
          ? {
              consultationMinutes: Math.max(
                0,
                (Date.parse(options?.servedAt || meta.timestamp) - Date.parse(old.calledAt)) /
                  60000,
              ),
            }
          : {}),
        ...(status === 'current' && old.isWalkIn
          ? {
              waitMinutes: Math.max(
                0,
                (Date.parse(options?.calledAt || meta.timestamp) - Date.parse(old.createdAt)) /
                  60000,
              ),
            }
          : {}),
      },
      ...(options?.calledAt ? { calledAt: options.calledAt } : {}),
      ...(options?.servedAt ? { servedAt: options.servedAt } : {}),
      version: (old.version || 0) + 1,
      updatedAt: meta.timestamp,
    };
    delete updated.GSI3PK;
    delete updated.GSI3SK;
    if (['completed', 'skipped', 'cancelled'].includes(status)) delete updated.GSI1SK;
    const items: any[] = [
      this.put(updated, {
        ConditionExpression: '#status = :old AND (attribute_not_exists(#v) OR #v = :v)',
        ExpressionAttributeNames: { '#status': 'status', '#v': 'version' },
        ExpressionAttributeValues: { ':old': old.status, ':v': old.version || 0 },
      }),
      ...readModelItems('token', updated).map((item) => this.put(item)),
      this.audit('token', old.id, 'status_changed', old.clinicId, {
        from: old.status,
        to: status,
        queueDate,
      }),
    ];
    if (status === 'current') {
      items.push(
        this.put(
          { ...this.key(pk, 'CURRENT'), tokenId: old.id },
          { ConditionExpression: 'attribute_not_exists(pk)' },
        ),
      );
      items.push({
        ConditionCheck: {
          TableName: this.tableName,
          Key: this.key(`QUEUE_STATE#${old.doctorId}`, 'ACTIVE'),
          ConditionExpression: 'attribute_not_exists(isPaused) OR isPaused = :no',
          ExpressionAttributeValues: { ':no': false },
        },
      });
    }
    if (old.status === 'current')
      items.push({
        Delete: {
          TableName: this.tableName,
          Key: this.key(pk, 'CURRENT'),
          ConditionExpression: 'attribute_not_exists(pk) OR tokenId = :id',
          ExpressionAttributeValues: { ':id': old.id },
        },
      });
    if (['completed', 'skipped', 'cancelled'].includes(status) && old.patientId)
      items.push({
        Delete: {
          TableName: this.tableName,
          Key: this.key(`PATIENT_DAY#${queueDate}#${old.patientId}`, 'ACTIVE'),
          ConditionExpression: 'attribute_not_exists(pk) OR tokenId = :id',
          ExpressionAttributeValues: { ':id': old.id },
        },
      });
    if (old.appointmentId) {
      const apt = await this.getAppointmentById(old.appointmentId);
      if (apt) {
        const aptStatus =
          status === 'current' ? 'in_consultation' : status === 'skipped' ? 'no_show' : status;
        items.push(
          ...readModelItems('appointment', {
            ...apt,
            status: aptStatus,
            version: (apt.version || 0) + 1,
            updatedAt: meta.timestamp,
            metadata: {
              ...apt.metadata,
              lastUpdatedBy: meta.actorId,
              lastRequestId: meta.requestId,
              ...(options?.reason ? { cancellationReason: options.reason } : {}),
            },
          }).map((item) => this.put(item)),
        );
        items.push(
          this.put(
            {
              ...this.key(`APPOINTMENT#${apt.id}`),
              ...apt,
              status: aptStatus,
              version: (apt.version || 0) + 1,
              updatedAt: meta.timestamp,
              metadata: {
                ...apt.metadata,
                lastUpdatedBy: meta.actorId,
                lastRequestId: meta.requestId,
                ...(options?.reason ? { cancellationReason: options.reason } : {}),
              },
            },
            {
              ConditionExpression: '#status = :old',
              ExpressionAttributeNames: { '#status': 'status' },
              ExpressionAttributeValues: { ':old': apt.status },
            },
          ),
        );
        items.push(
          this.audit('appointment', apt.id, 'status_changed', apt.clinicId, {
            from: apt.status,
            to: aptStatus,
          }),
        );
        if (['cancelled', 'skipped'].includes(status)) {
          const slotKey = `SLOT#${apt.date}#${apt.doctorId}#${apt.time}`;
          if (await this.get(slotKey, 'COUNTER'))
            items.push({
              Update: {
                TableName: this.tableName,
                Key: this.key(slotKey, 'COUNTER'),
                UpdateExpression: 'ADD bookedCount :minus',
                ConditionExpression: 'bookedCount > :zero',
                ExpressionAttributeValues: { ':minus': -1, ':zero': 0 },
              },
            });
        }
      }
    }
    await this.write(items);
    return clean<QueueToken>(updated);
  }
  async isDoctorPaused(doctorId: string): Promise<boolean> {
    const state = await this.get(`QUEUE_STATE#${doctorId}`, 'ACTIVE');
    if (state) return Boolean(state.isPaused);
    const legacy = await this.get('QUEUE_PAUSES', 'ACTIVE');
    return Boolean(legacy?.doctorIds?.includes(doctorId));
  }
  async setDoctorPause(doctorId: string, paused: boolean): Promise<boolean> {
    const doctor = await this.getDoctorById(doctorId);
    if (!doctor) throw new AppError(404, 'Doctor not found');
    await this.write([
      this.put({
        ...this.key(`QUEUE_STATE#${doctorId}`, 'ACTIVE'),
        doctorId,
        isPaused: paused,
        updatedAt: new Date().toISOString(),
      }),
      this.audit('queue', doctorId, paused ? 'paused' : 'resumed', doctor.clinicId),
    ]);
    return paused;
  }
  async saveAppointment(apt: Appointment): Promise<Appointment> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...this.key(`APPOINTMENT#${apt.id}`), ...apt },
      }),
    );
    return apt;
  }
  async getAppointments(filters: AppointmentFilters = {}): Promise<Appointment[]> {
    const partition = filters.patientId
      ? `APPOINTMENTS#PATIENT#${filters.patientId}`
      : filters.doctorId && filters.doctorId !== 'all'
        ? `APPOINTMENTS#DOCTOR#${filters.doctorId}`
        : filters.clinicId
          ? `APPOINTMENTS#CLINIC#${filters.clinicId}`
          : undefined;
    const list =
      partition && (await this.readModels())
        ? (await this.query(partition, filters.date || '')).map(clean<Appointment>)
        : (
            await this.scan('begins_with(pk, :p) AND sk = :m', {
              ':p': 'APPOINTMENT#',
              ':m': 'METADATA',
            })
          ).map(clean<Appointment>);
    return filterAppointments(list, filters);
  }
  async searchAppointments(filters: AppointmentFilters & { page: number; pageSize: number }) {
    const list = await this.getAppointments(filters);
    return {
      appointments: page(list, filters.page, filters.pageSize),
      total: list.length,
      page: filters.page,
      pageSize: filters.pageSize,
    };
  }
  async getAppointmentById(id: string): Promise<Appointment | null> {
    const row = await this.get(`APPOINTMENT#${id}`);
    return row ? clean<Appointment>(row) : null;
  }
  async getAuditEvents(clinicId: string, limit = 100): Promise<Item[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: { ':pk': `AUDIT#${clinicId}` },
        ScanIndexForward: false,
        Limit: limit,
        ConsistentRead: true,
      }),
    );
    return (res.Items || []).map((i) => clean<Item>(i));
  }
  async getRecentTokens(clinicId: string, days = 30): Promise<QueueToken[]> {
    const cutoff = clinicDate(new Date(Date.now() - days * 86400000));
    if (await this.readModels())
      return (await this.query(`VISITS#CLINIC#${clinicId}`, ''))
        .map(clean<QueueToken>)
        .filter((t) => (t.queueDate || t.createdAt.slice(0, 10)) >= cutoff);
    return (
      await this.scan('begins_with(pk, :p) AND begins_with(sk, :t) AND clinicId = :clinic', {
        ':p': 'QUEUE#',
        ':t': 'TOKEN#',
        ':clinic': clinicId,
      })
    )
      .map(clean<QueueToken>)
      .filter((t) => (t.queueDate || t.createdAt.slice(0, 10)) >= cutoff);
  }
  async saveModelMetadata(doctorId: string, clinicId: string, model: Item): Promise<void> {
    await this.write([
      this.put({ ...this.key(`MODEL#${doctorId}`), doctorId, clinicId, ...model }),
      this.audit('prediction_model', doctorId, 'trained', clinicId, {
        method: model.method,
        sampleCount: model.sampleCount,
        validationCount: model.validationCount,
        modelMae: model.modelMae,
      }),
    ]);
  }
}
export const dynamoDbRepo = new DynamoDbRepository();
