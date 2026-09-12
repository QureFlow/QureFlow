/**
 * AWS Infrastructure & Services Configuration
 * 
 * This file centralizes all AWS environment variables and resource identifiers for:
 * 1. AWS Cognito User Pool (Authentication, JWT Tokens, Role-Based Groups)
 * 2. Amazon DynamoDB Tables (Patients, Staff, Doctors, Appointments, Queues)
 * 3. API Gateway / AppSync GraphQL Endpoints
 * 
 * For your backend engineer:
 * - Create a .env file based on .env.example
 * - Provide real AWS resource identifiers below or in .env
 */

export interface AwsConfig {
  region: string;
  cognito: {
    userPoolId: string;
    userPoolClientId: string;
    identityPoolId?: string;
    groups: {
      patientGroup: string;
      adminGroup: string;
      staffGroup: string;
    };
  };
  dynamoDb: {
    tables: {
      patients: string;
      staff: string;
      doctors: string;
      clinics: string;
      appointments: string;
      queues: string;
    };
  };
  api: {
    baseUrl: string;
    timeoutMs: number;
  };
}

export const awsConfig: AwsConfig = {
  region: import.meta.env.VITE_AWS_REGION || 'ap-south-1', // Default: Mumbai region (India) for rural health
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'ap-south-1_xxxxxxxxx',
    userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx',
    identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
    groups: {
      patientGroup: 'Patients',
      adminGroup: 'Admins',
      staffGroup: 'HospitalStaff',
    },
  },
  dynamoDb: {
    tables: {
      patients: import.meta.env.VITE_DYNAMO_PATIENTS_TABLE || 'QueueLess_Patients',
      staff: import.meta.env.VITE_DYNAMO_STAFF_TABLE || 'QueueLess_Staff',
      doctors: import.meta.env.VITE_DYNAMO_DOCTORS_TABLE || 'QueueLess_Doctors',
      clinics: import.meta.env.VITE_DYNAMO_CLINICS_TABLE || 'QueueLess_Clinics',
      appointments: import.meta.env.VITE_DYNAMO_APPOINTMENTS_TABLE || 'QueueLess_Appointments',
      queues: import.meta.env.VITE_DYNAMO_QUEUES_TABLE || 'QueueLess_Queues',
    },
  },
  api: {
    baseUrl: import.meta.env.VITE_API_GATEWAY_URL || 'https://api.queless-rural.health.org/v1',
    timeoutMs: 15000,
  },
};

/**
 * Helper to check if live AWS configuration is active
 */
export const isLiveAwsEnabled = (): boolean => {
  return (
    Boolean(import.meta.env.VITE_COGNITO_USER_POOL_ID) &&
    Boolean(import.meta.env.VITE_COGNITO_CLIENT_ID) &&
    import.meta.env.VITE_USE_MOCK_BACKEND !== 'true'
  );
};
