import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import bcrypt from 'bcryptjs';
import { CLINICS, DOCTORS } from '../seed.js';
import { dynamoDbRepo } from '../repositories/dynamoDbRepo.js';
import { docClient, DYNAMODB_TABLE_NAME, AWS_REGION } from '../config/aws.js';
import { clinicDate } from '../lib/time.js';
import { queueService, doctorPrefix } from '../services/queueService.js';
import { QueueToken } from '../models/types.js';
import { expandLocalDemo } from './richFixtures.js';
export const requireLocalDatabase = () => {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  if (
    !endpoint ||
    !['localhost', '127.0.0.1', '[::1]'].includes(new URL(endpoint).hostname) ||
    !/^QureFlow(Demo|Test)/.test(DYNAMODB_TABLE_NAME)
  )
    throw new Error(
      'Demo and tests require a loopback DynamoDB endpoint and a QureFlowDemo/QureFlowTest table.',
    );
};
export async function ensureLocalTable() {
  requireLocalDatabase();
  const client = new DynamoDBClient({
    region: AWS_REGION,
    endpoint: process.env.DYNAMODB_ENDPOINT,
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
  });
  try {
    await client.send(new DescribeTableCommand({ TableName: DYNAMODB_TABLE_NAME }));
  } catch (e: any) {
    if (e.name !== 'ResourceNotFoundException') throw e;
    await client.send(
      new CreateTableCommand({
        TableName: DYNAMODB_TABLE_NAME,
        KeySchema: [
          { AttributeName: 'pk', KeyType: 'HASH' },
          { AttributeName: 'sk', KeyType: 'RANGE' },
        ],
        AttributeDefinitions: [
          { AttributeName: 'pk', AttributeType: 'S' },
          { AttributeName: 'sk', AttributeType: 'S' },
        ],
        BillingMode: 'PAY_PER_REQUEST',
      }),
    );
  }
  client.destroy();
}
export async function seedLocalDemo(history = true) {
  requireLocalDatabase();
  await ensureLocalTable();
  const marker = { pk: 'DEMO#SEED', sk: 'V2' };
  if (
    (await docClient.send(new GetCommand({ TableName: DYNAMODB_TABLE_NAME, Key: marker }))).Item
  ) {
    if (history) await expandLocalDemo();
    return;
  }
  for (const clinic of CLINICS)
    await dynamoDbRepo.saveClinic({
      ...clinic,
      name: `QureFlow Demo ${clinic.id.split('-')[1]} Clinic`,
      email: `clinic${clinic.id.split('-')[1]}@example.invalid`,
    } as any);
  for (const doctor of DOCTORS)
    await dynamoDbRepo.saveDoctor({
      ...doctor,
      clinicName: `QureFlow Demo ${doctor.clinicId.split('-')[1]} Clinic`,
      consultationDays: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      isAvailableToday: true,
      metadata: { synthetic: true },
    } as any);
  for (const clinic of CLINICS)
    await dynamoDbRepo.saveSettings(
      {
        averageConsultationMinutes: 10,
        bufferMinutes: 2,
        allowWalkIns: true,
        allowEmergencyPriority: true,
        notifyOnTwoAhead: false,
        autoTokenPrefixByDoctor: true,
        clinicName: `QureFlow Demo ${clinic.id.split('-')[1]} Clinic`,
        contactNumber: 'Demo reception',
      },
      clinic.id,
    );
  const staffHash = await bcrypt.hash('DemoClinic123!', 12),
    patientHash = await bcrypt.hash('DemoPatient123!', 12);
  await dynamoDbRepo.saveUser({
    id: 'admin-1',
    name: 'Demo Clinic Administrator',
    phone: '9900000000',
    email: 'demo.staff@example.invalid',
    staffId: 'DEMO-ADMIN',
    role: 'admin',
    clinicId: 'clinic-1',
    passwordHash: staffHash,
    createdAt: new Date().toISOString(),
    metadata: { synthetic: true },
  });
  await dynamoDbRepo.saveUser({
    id: 'admin-2',
    name: 'Demo Second Clinic Administrator',
    phone: '9900000001',
    email: 'demo.staff2@example.invalid',
    staffId: 'DEMO-ADMIN-2',
    role: 'admin',
    clinicId: 'clinic-2',
    passwordHash: staffHash,
    createdAt: new Date().toISOString(),
    metadata: { synthetic: true },
  });
  await dynamoDbRepo.saveUser({
    id: 'patient-1',
    name: 'Demo Patient',
    phone: '9900000002',
    email: 'demo.patient@example.invalid',
    role: 'patient',
    passwordHash: patientHash,
    createdAt: new Date().toISOString(),
    metadata: { synthetic: true },
  });
  for (let i = 1; i <= 16; i++)
    await dynamoDbRepo.saveUser({
      id: `demo-patient-${i}`,
      name: `Demo Patient ${String(i).padStart(2, '0')}`,
      phone: `99000${String(100 + i).padStart(5, '0')}`,
      email: `patient${i}@example.invalid`,
      role: 'patient',
      clinicId: 'clinic-1',
      createdAt: new Date().toISOString(),
      metadata: { synthetic: true },
    });
  if (history) {
    const items: any[] = [];
    for (const doctor of DOCTORS)
      for (let i = 0; i < 60; i++) {
        const dayAgo = 1 + Math.floor(i / 4),
          hour = 9 + (i % 4),
          date = clinicDate(new Date(Date.now() - dayAgo * 86400000));
        const called = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00+05:30`);
        const isWalkIn = i % 2 === 0,
          emergency = i % 9 === 0,
          duration =
            7 + (isWalkIn ? 2 : 0) + (emergency ? 4 : 0) + (hour - 9) * 0.8 + ((i % 5) - 2) * 0.25;
        const token: QueueToken = {
          id: `demo-history-${doctor.id}-${i}`,
          tokenNumber: `${doctorPrefix(doctor.id)}-${String(i + 1).padStart(3, '0')}`,
          patientId: `demo-patient-${(i % 16) + 1}`,
          patientName: `Demo Patient ${(i % 16) + 1}`,
          patientPhone: '',
          doctorId: doctor.id,
          doctorName: doctor.name,
          clinicId: doctor.clinicId,
          clinicName: `QureFlow Demo ${doctor.clinicId.split('-')[1]} Clinic`,
          scheduledTime: 'Walk-in',
          priority: emergency ? 'emergency' : 'normal',
          isWalkIn,
          status: 'completed',
          createdAt: new Date(called.getTime() - (8 + (i % 11)) * 60000).toISOString(),
          calledAt: called.toISOString(),
          servedAt: new Date(called.getTime() + duration * 60000).toISOString(),
          queueDate: date,
          tokenSeq: i + 1,
          metadata: { synthetic: true, source: 'synthetic_fixture', schemaVersion: 2 },
        };
        items.push({
          PutRequest: {
            Item: {
              pk: `QUEUE#${date}#${doctor.id}`,
              sk: `TOKEN#${String(i + 1).padStart(8, '0')}`,
              ...token,
            },
          },
        });
      }
    for (let i = 0; i < items.length; i += 25) {
      let pending = items.slice(i, i + 25);
      for (let attempt = 0; pending.length && attempt < 6; attempt++) {
        const result = await docClient.send(
          new BatchWriteCommand({ RequestItems: { [DYNAMODB_TABLE_NAME]: pending } }),
        );
        pending = (result.UnprocessedItems?.[DYNAMODB_TABLE_NAME] as any[]) || [];
        if (pending.length) await new Promise((r) => setTimeout(r, 50 * 2 ** attempt));
      }
      if (pending.length) throw new Error('Could not seed all local fixture records.');
    }
    for (let i = 1; i <= 10; i++)
      await queueService.joinQueue({
        doctorId: i < 7 ? 'doc-1' : 'doc-2',
        patientId: `demo-patient-${i}`,
        patientName: `Demo Patient ${String(i).padStart(2, '0')}`,
        patientPhone: `99000${String(100 + i).padStart(5, '0')}`,
        isWalkIn: true,
        priority: i === 8 ? 'emergency' : 'normal',
      });
  }
  await docClient.send(
    new PutCommand({
      TableName: DYNAMODB_TABLE_NAME,
      Item: { ...marker, createdAt: new Date().toISOString(), synthetic: true, history },
    }),
  );
  if (history) await expandLocalDemo();
}
