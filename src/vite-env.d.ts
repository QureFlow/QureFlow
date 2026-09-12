/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AWS_REGION?: string;
  readonly VITE_USE_MOCK_BACKEND?: string;
  readonly VITE_COGNITO_USER_POOL_ID?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  readonly VITE_COGNITO_IDENTITY_POOL_ID?: string;
  readonly VITE_DYNAMO_PATIENTS_TABLE?: string;
  readonly VITE_DYNAMO_STAFF_TABLE?: string;
  readonly VITE_DYNAMO_DOCTORS_TABLE?: string;
  readonly VITE_DYNAMO_CLINICS_TABLE?: string;
  readonly VITE_DYNAMO_APPOINTMENTS_TABLE?: string;
  readonly VITE_DYNAMO_QUEUES_TABLE?: string;
  readonly VITE_API_GATEWAY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
