/**
 * Amazon DynamoDB Service & Schema Contract
 * 
 * This file specifies the DynamoDB Table Schemas, Primary Keys (PK),
 * Sort Keys (SK), Global Secondary Indexes (GSI), and query/mutation wrappers.
 * 
 * Your backend engineer can either:
 * A. Use AWS SDK v3 DynamoDB DocumentClient (`@aws-sdk/lib-dynamodb`)
 * B. Connect via AWS AppSync GraphQL resolvers or API Gateway Lambdas
 */

import { awsConfig } from '../config/awsConfig';
import { Doctor, Appointment, QueueToken, DoctorQueueState } from '../types';
import { doctorService } from './doctorService';
import { appointmentService } from './appointmentService';
import { queueService } from './queueService';

/**
 * ============================================================================
 * DYNAMODB TABLE SCHEMAS (FOR YOUR BACKEND FRIEND):
 * ============================================================================
 * 
 * 1. Patients Table:
 *    - Table Name: awsConfig.dynamoDb.tables.patients (Default: 'QueueLess_Patients')
 *    - Partition Key (PK): patientId (String - Cognito Sub / Phone)
 *    - Attributes: name, phone, email, dob, gender, createdAt
 * 
 * 2. Staff Table:
 *    - Table Name: awsConfig.dynamoDb.tables.staff (Default: 'QueueLess_Staff')
 *    - Partition Key (PK): staffId (String - e.g. 'REC-204')
 *    - Attributes: name, email, role, clinicId, phone, shift
 * 
 * 3. Doctors Table:
 *    - Table Name: awsConfig.dynamoDb.tables.doctors (Default: 'QueueLess_Doctors')
 *    - Partition Key (PK): doctorId (String - e.g. 'doc-1')
 *    - GSI: specialty-index (PK: specialty, SK: name)
 *    - Attributes: name, specialty, opdRoom, consultationFee, dailyLimit, schedule
 * 
 * 4. Appointments Table:
 *    - Table Name: awsConfig.dynamoDb.tables.appointments (Default: 'QueueLess_Appointments')
 *    - Partition Key (PK): appointmentId (String)
 *    - GSI 1: patientId-index (PK: patientId, SK: appointmentDate)
 *    - GSI 2: doctorId-index (PK: doctorId, SK: appointmentDate)
 * 
 * 5. Queues Table:
 *    - Table Name: awsConfig.dynamoDb.tables.queues (Default: 'QueueLess_Queues')
 *    - Partition Key (PK): queueDate_doctorId (String - 'YYYY-MM-DD#doctorId')
 *    - Sort Key (SK): tokenNumber (Number)
 *    - Attributes: tokenId, patientId, status, checkInTime, calledTime
 * ============================================================================
 */

export const dynamoDbService = {
  /**
   * Doctors Query (DynamoDB Scan / Query)
   */
  async getDoctors(): Promise<Doctor[]> {
    console.log(`[DynamoDB] Querying ${awsConfig.dynamoDb.tables.doctors}`);
    return doctorService.getDoctors();
  },

  async getDoctorById(id: string): Promise<Doctor | null> {
    console.log(`[DynamoDB] GetItem from ${awsConfig.dynamoDb.tables.doctors} for key ${id}`);
    return doctorService.getDoctorById(id);
  },

  /**
   * Appointments Operations (DynamoDB PutItem / Query)
   */
  async createAppointment(data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    doctorId: string;
    date: string;
    time: string;
    notes?: string;
  }): Promise<{ appointment: Appointment; token: QueueToken }> {
    console.log(`[DynamoDB] PutItem to ${awsConfig.dynamoDb.tables.appointments}`);
    return appointmentService.createAppointment(data);
  },

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    console.log(`[DynamoDB] Query ${awsConfig.dynamoDb.tables.appointments} GSI patientId-index: ${patientId}`);
    return appointmentService.getAppointments({ patientId });
  },

  async getAppointmentsByDoctor(doctorId: string): Promise<Appointment[]> {
    console.log(`[DynamoDB] Query ${awsConfig.dynamoDb.tables.appointments} GSI doctorId-index: ${doctorId}`);
    return appointmentService.getAppointments({ doctorId });
  },

  /**
   * Live Queue Operations (DynamoDB Query / UpdateItem)
   */
  async getLiveQueueForDoctor(doctorId: string): Promise<DoctorQueueState> {
    console.log(`[DynamoDB] Query ${awsConfig.dynamoDb.tables.queues} for doctor ${doctorId}`);
    return queueService.getDoctorQueue(doctorId);
  },

  async callNextToken(doctorId: string): Promise<QueueToken | null> {
    console.log(`[DynamoDB] UpdateItem in ${awsConfig.dynamoDb.tables.queues} calling next for doctor ${doctorId}`);
    return queueService.callNextPatient(doctorId);
  },
};
