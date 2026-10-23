import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { pool, rows, transaction } from '../dbms/connection.js';
import type {
  Clinic,
  Doctor,
  User,
  QueueToken,
  Appointment,
  QueueSettings,
  TokenStatus,
} from '../models/types.js';
import { operationMetadata } from '../lib/context.js';
import { clinicDate, clockMinutes, timeLabel } from '../lib/time.js';
import { phoneDigits } from '../lib/validation.js';
import { AppError } from '../lib/errors.js';

type Item = Record<string, any>;
const json = (value: unknown) => JSON.stringify(value ?? {});
const instant = (value?: string) => (value ? new Date(value) : new Date());
const normalize = (row: Item): Item =>
  Object.fromEntries(
    Object.entries(row)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value]),
  );
const userRow = (row: Item): User =>
  ({ ...normalize(row), phone: row.phone || '', email: row.email || '' }) as User;
const doctorRow = (row: Item): Doctor =>
  ({
    ...normalize(row),
    startTime: timeLabel(row.startMinute),
    endTime: timeLabel(row.endMinute),
    nextAvailableSlot: timeLabel(row.startMinute),
    isAvailableToday: Boolean(row.isAvailableToday),
    consultationDays: row.consultationDays || [],
    languages: row.languages || [],
    clinicalInterests: row.clinicalInterests || [],
  }) as Doctor;
const tokenRow = (row: Item): QueueToken =>
  ({
    ...normalize(row),
    scheduledTime: row.scheduledMinute === null ? 'Walk-in' : timeLabel(row.scheduledMinute),
    isWalkIn: Boolean(row.isWalkIn),
    queueId: row.queueDate + '#' + row.doctorId,
  }) as QueueToken;
const appointmentRow = (row: Item): Appointment =>
  ({
    ...normalize(row),
    time: timeLabel(row.slotMinute),
    isWalkIn: Boolean(row.isWalkIn),
  }) as Appointment;

export interface DoctorFilters {
  query?: string;
  specialization?: string;
  clinicId?: string;
  language?: string;
  availableTodayOnly?: boolean;
  status?: string;
  sort?: string;
  limit?: number;
  offset?: number;
}
const sortColumns: Record<string, string> = {
  name: 'd.name ASC, d.id ASC',
  fee: 'd.consultationFee ASC, d.name ASC, d.id ASC',
  experience: 'd.experienceYears DESC, d.name ASC, d.id ASC',
};
export class MysqlRepository {
  private async audit(
    c: PoolConnection,
    entityType: string,
    entityId: string,
    action: string,
    clinicId?: string,
    details: Item = {},
  ) {
    const meta = operationMetadata();
    await c.execute(
      'INSERT INTO audit_events(id,clinicId,entityType,entityId,action,actorId,requestId,details) VALUES (?,?,?,?,?,?,?,?)',
      [
        randomUUID(),
        clinicId || null,
        entityType,
        entityId,
        action,
        meta.actorId,
        meta.requestId,
        json(details),
      ],
    );
  }
  private async context(c: PoolConnection) {
    const meta = operationMetadata();
    await c.execute('SET @qf_actor=?, @qf_request=?', [meta.actorId, meta.requestId]);
  }
  async getClinics(): Promise<Clinic[]> {
    return (
      await rows(
        "SELECT c.*, (SELECT COUNT(*) FROM doctors d WHERE d.clinicId=c.id AND d.status='active') activeDoctorsCount FROM clinics c ORDER BY c.name",
      )
    ).map((row) => normalize(row) as Clinic);
  }
  async getClinicById(id: string): Promise<Clinic | null> {
    const list = await rows(
      "SELECT c.*, (SELECT COUNT(*) FROM doctors d WHERE d.clinicId=c.id AND d.status='active') activeDoctorsCount FROM clinics c WHERE c.id=?",
      [id],
    );
    return list[0] ? (normalize(list[0]) as Clinic) : null;
  }
  async saveClinic(clinic: Clinic): Promise<Clinic> {
    await transaction(async (c) => {
      await c.execute(
        'INSERT INTO clinics(id,name,address,district,state,phone,email,openingHours,emergencyContact,metadata) VALUES (?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),address=VALUES(address),district=VALUES(district),state=VALUES(state),phone=VALUES(phone),email=VALUES(email),openingHours=VALUES(openingHours),emergencyContact=VALUES(emergencyContact),metadata=VALUES(metadata),updatedAt=UTC_TIMESTAMP(3)',
        [
          clinic.id,
          clinic.name,
          clinic.address,
          clinic.district,
          clinic.state,
          clinic.phone,
          clinic.email,
          clinic.openingHours,
          clinic.emergencyContact || '',
          json(clinic.metadata),
        ],
      );
      await this.audit(c, 'clinic', clinic.id, 'updated', clinic.id);
    });
    return clinic;
  }
  async getSettings(clinicId?: string): Promise<QueueSettings> {
    const list = await rows('SELECT * FROM clinic_settings WHERE clinicId=?', [
      clinicId || 'clinic-1',
    ]);
    if (!list[0])
      return {
        averageConsultationMinutes: 10,
        bufferMinutes: 2,
        allowWalkIns: true,
        allowEmergencyPriority: true,
        notifyOnTwoAhead: false,
        autoTokenPrefixByDoctor: true,
        clinicName: 'QureFlow Clinic',
        contactNumber: '',
      };
    const row: Item = normalize(list[0]);
    for (const key of [
      'allowWalkIns',
      'allowEmergencyPriority',
      'notifyOnTwoAhead',
      'autoTokenPrefixByDoctor',
    ])
      row[key] = Boolean(row[key]);
    return row as QueueSettings;
  }
  async saveSettings(s: QueueSettings, clinicId = 'clinic-1'): Promise<QueueSettings> {
    await transaction(async (c) => {
      await c.execute(
        'INSERT INTO clinic_settings(clinicId,averageConsultationMinutes,bufferMinutes,allowWalkIns,allowEmergencyPriority,notifyOnTwoAhead,autoTokenPrefixByDoctor,clinicName,contactNumber) VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE averageConsultationMinutes=VALUES(averageConsultationMinutes),bufferMinutes=VALUES(bufferMinutes),allowWalkIns=VALUES(allowWalkIns),allowEmergencyPriority=VALUES(allowEmergencyPriority),notifyOnTwoAhead=VALUES(notifyOnTwoAhead),autoTokenPrefixByDoctor=VALUES(autoTokenPrefixByDoctor),clinicName=VALUES(clinicName),contactNumber=VALUES(contactNumber)',
        [
          clinicId,
          s.averageConsultationMinutes,
          s.bufferMinutes ?? 2,
          s.allowWalkIns,
          s.allowEmergencyPriority,
          s.notifyOnTwoAhead,
          s.autoTokenPrefixByDoctor,
          s.clinicName,
          s.contactNumber,
        ],
      );
      await this.audit(c, 'settings', clinicId, 'updated', clinicId);
    });
    return s;
  }
  private doctorWhere(f: DoctorFilters) {
    const conditions: string[] = [],
      values: any[] = [];
    if (f.query?.trim()) {
      const q = '%' + f.query.trim() + '%';
      conditions.push(
        '(d.name LIKE ? OR d.specialization LIKE ? OR d.clinicName LIKE ? OR d.bio LIKE ? OR EXISTS(SELECT 1 FROM doctor_interests i WHERE i.doctorId=d.id AND i.interest LIKE ?))',
      );
      values.push(q, q, q, q, q);
    }
    for (const key of ['specialization', 'clinicId', 'status'] as const)
      if (f[key] && f[key] !== 'all') {
        conditions.push('d.' + key + '=?');
        values.push(f[key]);
      }
    if (f.language && f.language !== 'all') {
      conditions.push(
        'EXISTS(SELECT 1 FROM doctor_languages dl JOIN languages l ON l.id=dl.languageId WHERE dl.doctorId=d.id AND l.name=?)',
      );
      values.push(f.language);
    }
    if (f.availableTodayOnly) conditions.push('d.isAvailableToday=TRUE');
    return { sql: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '', values };
  }
  async getDoctors(filters: DoctorFilters = {}): Promise<Doctor[]> {
    const where = this.doctorWhere(filters);
    const limit = filters.limit === undefined ? '' : ' LIMIT ? OFFSET ?';
    const values = [
      ...where.values,
      ...(filters.limit === undefined ? [] : [filters.limit, filters.offset || 0]),
    ];
    return (
      await rows(
        'SELECT d.* FROM doctor_directory d' +
          where.sql +
          ' ORDER BY ' +
          (sortColumns[filters.sort || 'name'] || sortColumns.name) +
          limit,
        values,
      )
    ).map(doctorRow);
  }
  async searchDoctors(filters: DoctorFilters) {
    const where = this.doctorWhere(filters);
    const [count, doctors] = await Promise.all([
      rows('SELECT COUNT(*) total FROM doctor_directory d' + where.sql, where.values),
      this.getDoctors(filters),
    ]);
    return { doctors, total: Number(count[0].total) };
  }
  async directoryOptions() {
    const [specialties, languages, counts] = await Promise.all([
      rows(
        "SELECT DISTINCT s.name FROM specialties s JOIN doctors d ON d.specialtyId=s.id WHERE d.status='active' ORDER BY s.name",
      ),
      rows(
        "SELECT DISTINCT l.name FROM languages l JOIN doctor_languages dl ON dl.languageId=l.id JOIN doctors d ON d.id=dl.doctorId WHERE d.status='active' ORDER BY l.name",
      ),
      rows(
        "SELECT COUNT(*) doctorCount,COUNT(DISTINCT clinicId) clinicCount FROM doctors WHERE status='active'",
      ),
    ]);
    return {
      specialties: specialties.map((s) => s.name),
      languages: languages.map((l) => l.name),
      ...counts[0],
    };
  }
  async getDoctorById(id: string): Promise<Doctor | null> {
    const list = await rows('SELECT * FROM doctor_directory WHERE id=?', [id]);
    return list[0] ? doctorRow(list[0]) : null;
  }
  async saveDoctor(d: Doctor): Promise<Doctor> {
    await transaction(async (c) => {
      await c.execute(
        'INSERT INTO specialties(name) VALUES (?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [d.specialization],
      );
      const [specialty]: any = await c.execute('SELECT id FROM specialties WHERE name=?', [
        d.specialization,
      ]);
      await c.execute(
        'INSERT INTO doctors(id,clinicId,specialtyId,name,qualifications,experienceYears,consultationFee,startMinute,endMinute,slotDurationMinutes,status,avatar,bio,roomNumber,department,registrationId,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),specialtyId=VALUES(specialtyId),qualifications=VALUES(qualifications),experienceYears=VALUES(experienceYears),consultationFee=VALUES(consultationFee),startMinute=VALUES(startMinute),endMinute=VALUES(endMinute),slotDurationMinutes=VALUES(slotDurationMinutes),status=VALUES(status),avatar=VALUES(avatar),bio=VALUES(bio),roomNumber=VALUES(roomNumber),department=VALUES(department),registrationId=VALUES(registrationId),metadata=VALUES(metadata)',
        [
          d.id,
          d.clinicId,
          specialty[0].id,
          d.name,
          d.qualifications,
          d.experienceYears,
          d.consultationFee,
          clockMinutes(d.startTime),
          clockMinutes(d.endTime),
          d.slotDurationMinutes,
          d.status,
          d.avatar || null,
          d.bio || null,
          d.roomNumber || null,
          d.department || null,
          d.registrationId || null,
          json(d.metadata),
        ],
      );
      for (const table of ['doctor_days', 'doctor_languages', 'doctor_interests'])
        await c.execute('DELETE FROM ' + table + ' WHERE doctorId=?', [d.id]);
      for (const day of new Set(d.consultationDays))
        await c.execute('INSERT INTO doctor_days(doctorId,dayOfWeek) VALUES (?,?)', [d.id, day]);
      for (const language of new Set(d.languages || [])) {
        await c.execute(
          'INSERT INTO languages(name) VALUES (?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
          [language],
        );
        await c.execute(
          'INSERT INTO doctor_languages(doctorId,languageId) SELECT ?,id FROM languages WHERE name=?',
          [d.id, language],
        );
      }
      for (const interest of new Set(d.clinicalInterests || []))
        await c.execute('INSERT INTO doctor_interests(doctorId,interest) VALUES (?,?)', [
          d.id,
          interest,
        ]);
      await c.execute('INSERT IGNORE INTO queue_state(doctorId,isPaused) VALUES (?,FALSE)', [d.id]);
      await this.audit(c, 'doctor', d.id, 'updated', d.clinicId);
    });
    return (await this.getDoctorById(d.id))!;
  }
  async saveUser(u: User): Promise<User> {
    await transaction(async (c) => {
      const [existing]: any = await c.execute('SELECT version FROM users WHERE id=? FOR UPDATE', [
        u.id,
      ]);
      const version = existing[0] ? existing[0].version : 0;
      if (existing[0] && (u.version || 0) !== version)
        throw new AppError(409, 'Profile changed. Refresh and retry.');
      const columns = [
        'id',
        'name',
        'phone',
        'email',
        'role',
        'dob',
        'gender',
        'staffId',
        'doctorId',
        'clinicId',
        'passwordHash',
        'cognitoSub',
        'sessionVersion',
        'version',
        'metadata',
        'createdAt',
        'updatedAt',
      ];
      const values = [
        u.id,
        u.name,
        phoneDigits(u.phone) || null,
        u.email.trim().toLowerCase() || null,
        u.role,
        u.dob || null,
        u.gender || null,
        u.staffId || null,
        u.doctorId || null,
        u.clinicId || null,
        u.passwordHash || null,
        u.cognitoSub || null,
        u.sessionVersion || 0,
        version + 1,
        json(u.metadata),
        instant(u.createdAt),
        new Date(),
      ];
      if (existing[0]) {
        await c.execute(
          'UPDATE users SET ' +
            columns
              .slice(1)
              .map((column) => column + '=?')
              .join(',') +
            ' WHERE id=? AND version=?',
          [...values.slice(1), u.id, version],
        );
      } else {
        // An identity conflict must reject the insert, never upsert a different account.
        await c.execute(
          'INSERT INTO users(' +
            columns.join(',') +
            ') VALUES (' +
            columns.map(() => '?').join(',') +
            ')',
          values,
        );
      }
      await this.audit(c, 'user', u.id, existing[0] ? 'updated' : 'created', u.clinicId);
    });
    return (await this.getUserById(u.id))!;
  }
  async getUserById(id: string): Promise<User | null> {
    const list = await rows('SELECT * FROM users WHERE id=?', [id]);
    return list[0] ? userRow(list[0]) : null;
  }
  async findUserByIdentifier(identifier: string): Promise<User | null> {
    const input = identifier.trim().toLowerCase(),
      phone = phoneDigits(input);
    const column = input.includes('@') ? 'email' : /^\d{10}$/.test(phone) ? 'phone' : 'staffId';
    const list = await rows('SELECT * FROM users WHERE ' + column + '=?', [
      column === 'phone' ? phone : input,
    ]);
    return list[0] ? userRow(list[0]) : null;
  }
  async findUserByCognitoSub(sub: string): Promise<User | null> {
    const list = await rows('SELECT * FROM users WHERE cognitoSub=?', [sub]);
    return list[0] ? userRow(list[0]) : null;
  }
  async getPatients(search?: string, clinicId?: string): Promise<User[]> {
    return this.patientsForDoctor(search, clinicId);
  }
  async patientsForDoctor(search?: string, clinicId?: string, doctorId?: string): Promise<User[]> {
    let sql = "SELECT u.* FROM users u WHERE u.role='patient'",
      values: any[] = [];
    if (clinicId) {
      sql +=
        ' AND (u.clinicId=? OR EXISTS(SELECT 1 FROM visit_details t WHERE t.patientId=u.id AND t.clinicId=?))';
      values.push(clinicId, clinicId);
    }
    if (doctorId) {
      sql += ' AND EXISTS(SELECT 1 FROM queue_tokens t WHERE t.patientId=u.id AND t.doctorId=?)';
      values.push(doctorId);
    }
    if (search?.trim()) {
      sql += ' AND (u.name LIKE ? OR u.phone LIKE ? OR u.email LIKE ?)';
      const q = '%' + search.trim() + '%';
      values.push(q, q, q);
    }
    return (await rows(sql + ' ORDER BY u.name,u.id', values)).map(userRow);
  }
  getQueueId(doctorId: string, date = clinicDate()) {
    return date + '#' + doctorId;
  }
  async getNextTokenSequence(queueId: string): Promise<{ seq: number; paddedSeq: string }> {
    const [date, doctorId] = queueId.split('#');
    return transaction(async (c) => {
      await c.execute(
        'INSERT INTO queue_counters(doctorId,queueDate,currentNumber) VALUES (?,?,1) ON DUPLICATE KEY UPDATE currentNumber=currentNumber+1',
        [doctorId, date],
      );
      const [list]: any = await c.execute(
        'SELECT currentNumber FROM queue_counters WHERE doctorId=? AND queueDate=?',
        [doctorId, date],
      );
      const seq = Number(list[0].currentNumber);
      return { seq, paddedSeq: String(seq).padStart(8, '0') };
    });
  }
  async getActivePatientToken(patientId: string, date = clinicDate()): Promise<QueueToken | null> {
    const list = await rows('SELECT * FROM visit_details WHERE activePatientId=? AND queueDate=?', [
      patientId,
      date,
    ]);
    return list[0] ? tokenRow(list[0]) : null;
  }
  async initializeSlot(
    doctorId: string,
    date: string,
    time: string,
    capacity: number,
  ): Promise<void> {
    await pool.execute(
      "INSERT INTO appointment_slots(doctorId,slotDate,slotMinute,bookedCount,capacity) SELECT ?,?,?,COUNT(*),? FROM appointments WHERE doctorId=? AND date=? AND slotMinute=? AND status NOT IN ('cancelled','no_show') ON DUPLICATE KEY UPDATE capacity=GREATEST(bookedCount,VALUES(capacity))",
      [doctorId, date, clockMinutes(time), capacity, doctorId, date, clockMinutes(time)],
    );
  }
  async insertAppointment(c: PoolConnection, a: Appointment) {
    await c.execute(
      'INSERT INTO appointments(id,patientId,doctorId,date,slotMinute,tokenNumber,status,priority,isWalkIn,notes,version,metadata,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        a.id,
        a.patientId,
        a.doctorId,
        a.date,
        clockMinutes(a.time),
        a.tokenNumber,
        a.status,
        a.priority,
        a.isWalkIn,
        a.notes || '',
        a.version || 1,
        json(a.metadata),
        instant(a.createdAt),
        instant(a.updatedAt || a.createdAt),
      ],
    );
  }
  async insertToken(c: PoolConnection, t: QueueToken) {
    await c.execute(
      'INSERT INTO queue_tokens(id,appointmentId,patientId,doctorId,queueDate,tokenSeq,tokenNumber,scheduledMinute,priority,isWalkIn,status,createdAt,calledAt,servedAt,version,updatedAt,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [
        t.id,
        t.appointmentId || null,
        t.patientId || null,
        t.doctorId,
        t.queueDate || clinicDate(),
        t.tokenSeq || Number(t.tokenNumber.split('-').pop()),
        t.tokenNumber,
        ['Now', 'Walk-in'].includes(t.scheduledTime) ? null : clockMinutes(t.scheduledTime),
        t.priority,
        t.isWalkIn,
        t.status,
        instant(t.createdAt),
        t.calledAt ? instant(t.calledAt) : null,
        t.servedAt ? instant(t.servedAt) : null,
        t.version || 1,
        instant(t.updatedAt || t.createdAt),
        json(t.metadata),
      ],
    );
  }
  async createToken(
    t: QueueToken,
    queueId: string,
    seq: number,
    a?: Appointment,
    capacity?: number,
  ): Promise<QueueToken> {
    const meta = operationMetadata(),
      next = {
        ...t,
        queueDate: queueId.split('#')[0],
        queueId,
        tokenSeq: seq,
        version: 1,
        updatedAt: meta.timestamp,
        metadata: {
          ...t.metadata,
          source: t.isWalkIn ? 'reception' : 'online',
          createdBy: meta.actorId,
          requestId: meta.requestId,
          timeZone: 'Asia/Kolkata',
        },
      };
    await transaction(async (c) => {
      await this.context(c);
      const [doc]: any = await c.execute('SELECT status FROM doctors WHERE id=? FOR UPDATE', [
        t.doctorId,
      ]);
      if (!doc[0] || doc[0].status !== 'active')
        throw new AppError(409, 'Doctor is not accepting patients.');
      if (a) {
        const [slots]: any = await c.execute(
          'SELECT bookedCount,capacity FROM appointment_slots WHERE doctorId=? AND slotDate=? AND slotMinute=? FOR UPDATE',
          [t.doctorId, a.date, clockMinutes(a.time)],
        );
        if (
          !slots[0] ||
          slots[0].bookedCount >= Math.min(slots[0].capacity, capacity || slots[0].capacity)
        )
          throw new AppError(409, 'This appointment slot is full.');
        await c.execute(
          'UPDATE appointment_slots SET bookedCount=bookedCount+1 WHERE doctorId=? AND slotDate=? AND slotMinute=?',
          [t.doctorId, a.date, clockMinutes(a.time)],
        );
        await this.insertAppointment(c, {
          ...a,
          tokenId: t.id,
          metadata: { createdBy: meta.actorId, requestId: meta.requestId },
        });
        await this.audit(c, 'appointment', a.id, 'created', a.clinicId, {
          date: a.date,
          status: a.status,
        });
      }
      await this.insertToken(c, next);
    });
    return (await this.findTokenById(t.id))!.token;
  }
  async getAllTokensForQueue(queueId: string): Promise<QueueToken[]> {
    const [date, id] = queueId.split('#');
    return (
      await rows(
        "SELECT * FROM visit_details WHERE doctorId=? AND queueDate=? ORDER BY CASE status WHEN 'current' THEN 0 WHEN 'waiting' THEN 1 ELSE 2 END,priority='emergency' DESC,tokenSeq",
        [id, date],
      )
    ).map(tokenRow);
  }
  async getWaitingTokens(queueId: string): Promise<QueueToken[]> {
    const [date, id] = queueId.split('#');
    return (
      await rows(
        "SELECT * FROM visit_details WHERE doctorId=? AND queueDate=? AND status='waiting' ORDER BY priority='emergency' DESC,tokenSeq",
        [id, date],
      )
    ).map(tokenRow);
  }
  async getNextEligibleToken(queueId: string, minute: number): Promise<QueueToken | null> {
    const [date, id] = queueId.split('#');
    const list = await rows(
      "SELECT * FROM visit_details WHERE doctorId=? AND queueDate=? AND status='waiting' AND (priority='emergency' OR isWalkIn=TRUE OR scheduledMinute IS NULL OR queueDate=? AND scheduledMinute<=?) ORDER BY priority='emergency' DESC,tokenSeq LIMIT 1",
      [id, date, clinicDate(), minute],
    );
    return list[0] ? tokenRow(list[0]) : null;
  }
  async findTokenById(id: string): Promise<{ token: QueueToken; pk: string; sk: string } | null> {
    const list = await rows('SELECT * FROM visit_details WHERE id=?', [id]);
    return list[0] ? { token: tokenRow(list[0]), pk: id, sk: 'TOKEN' } : null;
  }
  async updateTokenStatus(
    pk: string,
    _sk: string,
    status: TokenStatus,
    options?: { calledAt?: string; servedAt?: string; reason?: string },
  ): Promise<QueueToken> {
    await transaction(async (c) => {
      await this.context(c);
      // Lock the doctor before the token: creation, calling and pausing use the same order.
      const [located]: any = await c.execute('SELECT doctorId FROM queue_tokens WHERE id=?', [pk]);
      if (!located[0]) throw new AppError(404, 'Token not found');
      await c.execute('SELECT id FROM doctors WHERE id=? FOR UPDATE', [located[0].doctorId]);
      const [tokens]: any = await c.execute('SELECT * FROM queue_tokens WHERE id=? FOR UPDATE', [
        pk,
      ]);
      const old = tokens[0],
        allowed: Record<TokenStatus, TokenStatus[]> = {
          waiting: ['current', 'skipped', 'cancelled'],
          current: ['completed', 'skipped'],
          completed: [],
          skipped: [],
          cancelled: [],
        };
      if (!allowed[old.status as TokenStatus].includes(status))
        throw new AppError(409, 'Invalid queue status transition.');
      await c.execute(
        'UPDATE queue_tokens SET status=?,calledAt=?,servedAt=?,version=version+1,updatedAt=UTC_TIMESTAMP(3),metadata=JSON_MERGE_PATCH(COALESCE(metadata,JSON_OBJECT()),?) WHERE id=?',
        [
          status,
          options?.calledAt ? instant(options.calledAt) : old.calledAt,
          options?.servedAt ? instant(options.servedAt) : old.servedAt,
          json({
            ...operationMetadata(),
            ...(options?.reason ? { cancellationReason: options.reason } : {}),
          }),
          pk,
        ],
      );
    });
    return (await this.findTokenById(pk))!.token;
  }
  async getPausedDoctors(): Promise<string[]> {
    return (await rows('SELECT doctorId FROM queue_state WHERE isPaused=TRUE')).map(
      (row) => row.doctorId,
    );
  }
  async isDoctorPaused(id: string): Promise<boolean> {
    return Boolean(
      (await rows('SELECT isPaused FROM queue_state WHERE doctorId=?', [id]))[0]?.isPaused,
    );
  }
  async setDoctorPause(id: string, paused: boolean): Promise<boolean> {
    await transaction(async (c) => {
      const [doc]: any = await c.execute('SELECT clinicId FROM doctors WHERE id=? FOR UPDATE', [
        id,
      ]);
      if (!doc[0]) throw new AppError(404, 'Doctor not found');
      await c.execute(
        'INSERT INTO queue_state(doctorId,isPaused) VALUES (?,?) ON DUPLICATE KEY UPDATE isPaused=VALUES(isPaused)',
        [id, paused],
      );
      await this.audit(c, 'queue', id, paused ? 'paused' : 'resumed', doc[0].clinicId);
    });
    return paused;
  }
  async saveAppointment(a: Appointment): Promise<Appointment> {
    await transaction((c) => this.insertAppointment(c, a));
    return a;
  }
  private appointmentWhere(
    f: {
      patientId?: string;
      doctorId?: string;
      date?: string;
      clinicId?: string;
      status?: string;
      query?: string;
    } = {},
  ) {
    const conditions: string[] = [],
      values: any[] = [];
    for (const key of ['patientId', 'doctorId', 'date', 'clinicId', 'status'] as const)
      if (f[key] && f[key] !== 'all') {
        conditions.push(key + '=?');
        values.push(f[key]);
      }
    if (f.query?.trim()) {
      conditions.push(
        '(patientName LIKE ? OR patientPhone LIKE ? OR tokenNumber LIKE ? OR doctorName LIKE ?)',
      );
      const q = '%' + f.query.trim() + '%';
      values.push(q, q, q, q);
    }
    return { sql: conditions.length ? ' WHERE ' + conditions.join(' AND ') : '', values };
  }
  async getAppointments(
    f: {
      patientId?: string;
      doctorId?: string;
      date?: string;
      clinicId?: string;
      status?: string;
      query?: string;
    } = {},
  ): Promise<Appointment[]> {
    const where = this.appointmentWhere(f);
    return (
      await rows(
        'SELECT * FROM appointment_details' + where.sql + ' ORDER BY date DESC,slotMinute DESC,id',
        where.values,
      )
    ).map(appointmentRow);
  }
  async searchAppointments(f: {
    clinicId?: string;
    doctorId?: string;
    date?: string;
    status?: string;
    query?: string;
    page: number;
    pageSize: number;
  }) {
    const where = this.appointmentWhere(f);
    const [count, data] = await Promise.all([
      rows('SELECT COUNT(*) total FROM appointment_details' + where.sql, where.values),
      rows(
        'SELECT * FROM appointment_details' +
          where.sql +
          ' ORDER BY date DESC,slotMinute DESC,id LIMIT ? OFFSET ?',
        [...where.values, f.pageSize, (f.page - 1) * f.pageSize],
      ),
    ]);
    return {
      appointments: data.map(appointmentRow),
      total: Number(count[0].total),
      page: f.page,
      pageSize: f.pageSize,
    };
  }
  async getAppointmentById(id: string): Promise<Appointment | null> {
    const list = await rows('SELECT * FROM appointment_details WHERE id=?', [id]);
    return list[0] ? appointmentRow(list[0]) : null;
  }
  async getAuditEvents(clinicId: string, limit = 100): Promise<Item[]> {
    return (
      await rows(
        'SELECT * FROM audit_events WHERE clinicId=? ORDER BY timestamp DESC,id DESC LIMIT ?',
        [clinicId, limit],
      )
    ).map(normalize);
  }
  async getRecentTokens(clinicId: string, days = 30): Promise<QueueToken[]> {
    return (
      await rows(
        'SELECT * FROM visit_details WHERE clinicId=? AND queueDate>=? ORDER BY queueDate,tokenSeq',
        [clinicId, clinicDate(new Date(Date.now() - days * 86400000))],
      )
    ).map(tokenRow);
  }
  async saveModelMetadata(doctorId: string, clinicId: string, model: Item): Promise<void> {
    await transaction(async (c) => {
      await c.execute(
        'INSERT INTO prediction_models(doctorId,clinicId,model) VALUES (?,?,?) ON DUPLICATE KEY UPDATE model=VALUES(model),updatedAt=UTC_TIMESTAMP(3)',
        [doctorId, clinicId, json(model)],
      );
      await this.audit(c, 'prediction_model', doctorId, 'trained', clinicId, {
        method: model.method,
        sampleCount: model.sampleCount,
        validationCount: model.validationCount,
        modelMae: model.modelMae,
      });
    });
  }
  async flowAnalytics(clinicId: string) {
    const today = clinicDate(),
      cutoff = clinicDate(new Date(Date.now() - 30 * 86400000));
    const summary = (
      await rows(
        "SELECT SUM(queueDate=? AND status='waiting') waiting,SUM(queueDate=? AND status='current') inConsultation,SUM(queueDate=? AND status='completed') completedToday,COUNT(CASE WHEN status='completed' THEN fn_consultation_minutes(calledAt,servedAt) END) consultationsObserved,ROUND(AVG(CASE WHEN status='completed' THEN fn_consultation_minutes(calledAt,servedAt) END),1) averageConsultationMinutes,SUM(status='cancelled') cancellationCount,SUM(status='skipped') noShowCount FROM visit_details WHERE clinicId=? AND queueDate>=? AND queueDate<=?",
        [today, today, today, clinicId, cutoff, today],
      )
    )[0];
    const [sets]: any = await pool.query('CALL sp_daily_patient_flow(?,?,?)', [
      clinicId,
      clinicDate(new Date(Date.now() - 13 * 86400000)),
      today,
    ]);
    return {
      summary: Object.fromEntries(
        Object.entries(summary).map(([key, value]) => [
          key,
          value === null && key !== 'averageConsultationMinutes' ? 0 : value,
        ]),
      ),
      trend: sets[0],
    };
  }
}
export const mysqlRepo = new MysqlRepository();
