import {
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { docClient, DYNAMODB_TABLE_NAME } from '../config/aws.js';
import {
  Clinic,
  Doctor,
  User,
  QueueToken,
  Appointment,
  QueueSettings,
  QueuePriority,
  TokenStatus,
  DoctorQueueState,
} from '../models/types.js';

export class DynamoDbRepository {
  private tableName = DYNAMODB_TABLE_NAME;

  // ==========================================================================
  // CLINIC & SETTINGS
  // ==========================================================================

  async getClinics(): Promise<Clinic[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(pk, :clinicPrefix) AND sk = :meta',
        ExpressionAttributeValues: {
          ':clinicPrefix': 'CLINIC#',
          ':meta': 'METADATA',
        },
      })
    );
    return (res.Items || []) as Clinic[];
  }

  async getClinicById(clinicId: string): Promise<Clinic | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `CLINIC#${clinicId}`, sk: 'METADATA' },
      })
    );
    return (res.Item as Clinic) || null;
  }

  async saveClinic(clinic: Clinic): Promise<Clinic> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `CLINIC#${clinic.id}`,
          sk: 'METADATA',
          ...clinic,
        },
      })
    );
    return clinic;
  }

  async getSettings(): Promise<QueueSettings> {
    const res = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: 'SETTINGS#GLOBAL', sk: 'METADATA' },
      })
    );
    if (res.Item) {
      return res.Item as QueueSettings;
    }
    // Default fallback
    return {
      averageConsultationMinutes: 7,
      allowWalkIns: true,
      allowEmergencyPriority: true,
      notifyOnTwoAhead: true,
      autoTokenPrefixByDoctor: true,
      clinicName: 'Bolpur Rural Sub-Divisional Hospital',
      contactNumber: '+91 3463 252 240',
    };
  }

  async saveSettings(settings: QueueSettings): Promise<QueueSettings> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: 'SETTINGS#GLOBAL',
          sk: 'METADATA',
          ...settings,
        },
      })
    );
    return settings;
  }

  // ==========================================================================
  // DOCTORS
  // ==========================================================================

  async getDoctors(): Promise<Doctor[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(pk, :docPrefix) AND sk = :meta',
        ExpressionAttributeValues: {
          ':docPrefix': 'DOCTOR#',
          ':meta': 'METADATA',
        },
      })
    );
    return (res.Items || []) as Doctor[];
  }

  async getDoctorById(doctorId: string): Promise<Doctor | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `DOCTOR#${doctorId}`, sk: 'METADATA' },
      })
    );
    return (res.Item as Doctor) || null;
  }

  async saveDoctor(doctor: Doctor): Promise<Doctor> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `DOCTOR#${doctor.id}`,
          sk: 'METADATA',
          GSI2PK: `DOCTOR#${doctor.id}`,
          GSI2SK: 'PROFILE',
          ...doctor,
        },
      })
    );
    return doctor;
  }

  // ==========================================================================
  // USERS & PATIENTS
  // ==========================================================================

  async saveUser(user: User): Promise<User> {
    const cleanPhone = user.phone ? user.phone.replace(/[^0-9]/g, '') : '';
    const cleanEmail = user.email ? user.email.toLowerCase().trim() : '';

    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `USER#${user.id}`,
          sk: 'METADATA',
          GSI1PK: `PATIENT#${user.id}`,
          GSI1SK: 'PROFILE',
          phoneLookup: cleanPhone,
          emailLookup: cleanEmail,
          ...user,
        },
      })
    );
    return user;
  }

  async getUserById(userId: string): Promise<User | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `USER#${userId}`, sk: 'METADATA' },
      })
    );
    return (res.Item as User) || null;
  }

  async findUserByIdentifier(identifier: string): Promise<User | null> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanNumeric = identifier.replace(/[^0-9]/g, '');

    // Search for user by email or phone
    const res = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression:
          'begins_with(pk, :userPrefix) AND sk = :meta AND (emailLookup = :email OR phoneLookup = :phone OR staffId = :staffId)',
        ExpressionAttributeValues: {
          ':userPrefix': 'USER#',
          ':meta': 'METADATA',
          ':email': cleanId,
          ':phone': cleanNumeric,
          ':staffId': identifier.toUpperCase(),
        },
      })
    );

    if (res.Items && res.Items.length > 0) {
      return res.Items[0] as User;
    }
    return null;
  }

  async getPatients(search?: string): Promise<User[]> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(pk, :userPrefix) AND sk = :meta AND #role = :patientRole',
        ExpressionAttributeNames: {
          '#role': 'role',
        },
        ExpressionAttributeValues: {
          ':userPrefix': 'USER#',
          ':meta': 'METADATA',
          ':patientRole': 'patient',
        },
      })
    );

    let list = (res.Items || []) as User[];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q) ||
          p.email.toLowerCase().includes(q)
      );
    }
    return list;
  }

  // ==========================================================================
  // QUEUE & TOKEN MANAGEMENT
  // ==========================================================================

  getQueueId(doctorId: string, dateStr?: string): string {
    const today = dateStr || new Date().toISOString().split('T')[0];
    return `${today}#${doctorId}`;
  }

  private getDoctorPrefix(doctorId: string): string {
    const prefixes: Record<string, string> = {
      'doc-1': 'A',
      'doc-2': 'B',
      'doc-3': 'C',
      'doc-4': 'R',
      'doc-5': 'F',
      'doc-6': 'P',
      'doc-7': 'M',
      'doc-8': 'D',
      'doc-9': 'T',
      'doc-10': 'K',
    };
    return prefixes[doctorId] || 'Q';
  }

  /**
   * Concurrency-safe atomic token counter generation.
   * Serialized in DynamoDB with ADD currentNumber :one
   */
  async getNextTokenSequence(queueId: string): Promise<{ seq: number; paddedSeq: string }> {
    const res = await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `QUEUE#${queueId}`, sk: 'COUNTER' },
        UpdateExpression: 'ADD currentNumber :inc',
        ExpressionAttributeValues: { ':inc': 1 },
        ReturnValues: 'UPDATED_NEW',
      })
    );
    const seq = (res.Attributes?.currentNumber as number) || 1;
    const paddedSeq = String(seq).padStart(4, '0');
    return { seq, paddedSeq };
  }

  /**
   * Check if a patient already has an active or waiting token today
   */
  async getActivePatientToken(patientId: string): Promise<QueueToken | null> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'PatientIndex',
        KeyConditionExpression: 'GSI1PK = :patientPk AND begins_with(GSI1SK, :activePrefix)',
        ExpressionAttributeValues: {
          ':patientPk': `PATIENT#${patientId}`,
          ':activePrefix': 'ACTIVE#',
        },
      })
    );

    if (res.Items && res.Items.length > 0) {
      return res.Items[0] as QueueToken;
    }
    return null;
  }

  /**
   * Insert a new token into the queue and indexes
   */
  async createToken(token: QueueToken, queueId: string, seqNum: number): Promise<QueueToken> {
    const priorityCode = token.priority === 'emergency' ? '0' : '2';
    const paddedSeq = String(seqNum).padStart(4, '0');
    const today = new Date().toISOString().split('T')[0];

    const item: Record<string, any> = {
      pk: `QUEUE#${queueId}`,
      sk: `TOKEN#${paddedSeq}`,
      tokenSeq: seqNum,
      queueId,
      ...token,
    };

    // Index in PatientIndex if patientId is present
    if (token.patientId) {
      item.GSI1PK = `PATIENT#${token.patientId}`;
      item.GSI1SK = `ACTIVE#${today}#${queueId}`;
    }

    // Sparse Index in QueueWaitingIndex if status is 'waiting'
    if (token.status === 'waiting') {
      item.GSI3PK = `QUEUE#${queueId}`;
      item.GSI3SK = `WAITING#${priorityCode}#${paddedSeq}`;
    }

    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    );

    return token;
  }

  /**
   * Query waiting tokens for a queue, ordered by priority (0=Emergency, 2=Normal) then sequence
   */
  async getWaitingTokens(queueId: string): Promise<QueueToken[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'QueueWaitingIndex',
        KeyConditionExpression: 'GSI3PK = :queuePk AND begins_with(GSI3SK, :waitPrefix)',
        ExpressionAttributeValues: {
          ':queuePk': `QUEUE#${queueId}`,
          ':waitPrefix': 'WAITING#',
        },
        ScanIndexForward: true, // Lexical ascending: 0 (Emergency) before 2 (Normal), then seq order!
      })
    );

    return (res.Items || []) as QueueToken[];
  }

  /**
   * Retrieve all tokens for a queue
   */
  async getAllTokensForQueue(queueId: string): Promise<QueueToken[]> {
    const res = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :queuePk AND begins_with(sk, :tokenPrefix)',
        ExpressionAttributeValues: {
          ':queuePk': `QUEUE#${queueId}`,
          ':tokenPrefix': 'TOKEN#',
        },
      })
    );
    return (res.Items || []) as QueueToken[];
  }

  /**
   * Find token by ID
   */
  async findTokenById(tokenId: string): Promise<{ token: QueueToken; pk: string; sk: string } | null> {
    const res = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(pk, :queuePrefix) AND begins_with(sk, :tokenPrefix) AND id = :tokenId',
        ExpressionAttributeValues: {
          ':queuePrefix': 'QUEUE#',
          ':tokenPrefix': 'TOKEN#',
          ':tokenId': tokenId,
        },
      })
    );

    if (res.Items && res.Items.length > 0) {
      const item = res.Items[0];
      return {
        token: item as QueueToken,
        pk: item.pk,
        sk: item.sk,
      };
    }
    return null;
  }

  /**
   * Update token status (e.g. current, completed, skipped, cancelled)
   */
  async updateTokenStatus(
    pk: string,
    sk: string,
    newStatus: TokenStatus,
    options?: { calledAt?: string; servedAt?: string }
  ): Promise<QueueToken> {
    let updateExpr = 'SET #status = :status';
    const exprNames: Record<string, string> = { '#status': 'status' };
    const exprValues: Record<string, any> = { ':status': newStatus };

    if (options?.calledAt) {
      updateExpr += ', calledAt = :calledAt';
      exprValues[':calledAt'] = options.calledAt;
    }
    if (options?.servedAt) {
      updateExpr += ', servedAt = :servedAt';
      exprValues[':servedAt'] = options.servedAt;
    }

    // If no longer waiting, remove from QueueWaitingIndex
    let removeExpr = '';
    if (newStatus !== 'waiting') {
      removeExpr = 'REMOVE GSI3PK, GSI3SK';
    }

    // If completed, skipped, or cancelled, remove from active PatientIndex
    if (['completed', 'skipped', 'cancelled'].includes(newStatus)) {
      removeExpr += removeExpr ? ', GSI1SK' : 'REMOVE GSI1SK';
    }

    const fullUpdate = removeExpr ? `${updateExpr} ${removeExpr}` : updateExpr;

    const res = await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk, sk },
        UpdateExpression: fullUpdate,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
        ReturnValues: 'ALL_NEW',
      })
    );

    return res.Attributes as QueueToken;
  }

  /**
   * Doctor Pause state
   */
  async getPausedDoctors(): Promise<string[]> {
    const res = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: 'QUEUE_PAUSES', sk: 'ACTIVE' },
      })
    );
    return (res.Item?.doctorIds as string[]) || [];
  }

  async setDoctorPause(doctorId: string, paused: boolean): Promise<boolean> {
    const list = await this.getPausedDoctors();
    let updated: string[];
    if (paused) {
      updated = list.includes(doctorId) ? list : [...list, doctorId];
    } else {
      updated = list.filter((id) => id !== doctorId);
    }

    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: 'QUEUE_PAUSES',
          sk: 'ACTIVE',
          doctorIds: updated,
          updatedAt: new Date().toISOString(),
        },
      })
    );
    return paused;
  }

  // ==========================================================================
  // APPOINTMENTS
  // ==========================================================================

  async saveAppointment(apt: Appointment): Promise<Appointment> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          pk: `APPOINTMENT#${apt.id}`,
          sk: 'METADATA',
          GSI1PK: `PATIENT#${apt.patientId}`,
          GSI1SK: `APT#${apt.date}#${apt.id}`,
          GSI2PK: `DOCTOR#${apt.doctorId}`,
          GSI2SK: `APT#${apt.date}#${apt.id}`,
          ...apt,
        },
      })
    );
    return apt;
  }

  async getAppointments(filters?: {
    patientId?: string;
    doctorId?: string;
    date?: string;
  }): Promise<Appointment[]> {
    if (filters?.patientId) {
      const res = await docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'PatientIndex',
          KeyConditionExpression: 'GSI1PK = :patientPk AND begins_with(GSI1SK, :aptPrefix)',
          ExpressionAttributeValues: {
            ':patientPk': `PATIENT#${filters.patientId}`,
            ':aptPrefix': 'APT#',
          },
        })
      );
      return (res.Items || []) as Appointment[];
    }

    if (filters?.doctorId && filters.doctorId !== 'all') {
      const res = await docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'DoctorQueueIndex',
          KeyConditionExpression: 'GSI2PK = :docPk AND begins_with(GSI2SK, :aptPrefix)',
          ExpressionAttributeValues: {
            ':docPk': `DOCTOR#${filters.doctorId}`,
            ':aptPrefix': 'APT#',
          },
        })
      );
      return (res.Items || []) as Appointment[];
    }

    // Default: scan all appointments
    const res = await docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        FilterExpression: 'begins_with(pk, :aptPrefix) AND sk = :meta',
        ExpressionAttributeValues: {
          ':aptPrefix': 'APPOINTMENT#',
          ':meta': 'METADATA',
        },
      })
    );
    let list = (res.Items || []) as Appointment[];
    if (filters?.date) {
      list = list.filter((a) => a.date === filters.date);
    }
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAppointmentById(aptId: string): Promise<Appointment | null> {
    const res = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { pk: `APPOINTMENT#${aptId}`, sk: 'METADATA' },
      })
    );
    return (res.Item as Appointment) || null;
  }

  async updateAppointmentStatus(aptId: string, status: string, notes?: string): Promise<void> {
    let updateExpr = 'SET #status = :status';
    const exprNames: Record<string, string> = { '#status': 'status' };
    const exprValues: Record<string, any> = { ':status': status };

    if (notes) {
      updateExpr += ', notes = :notes';
      exprValues[':notes'] = notes;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { pk: `APPOINTMENT#${aptId}`, sk: 'METADATA' },
        UpdateExpression: updateExpr,
        ExpressionAttributeNames: exprNames,
        ExpressionAttributeValues: exprValues,
      })
    );
  }
}

export const dynamoDbRepo = new DynamoDbRepository();
