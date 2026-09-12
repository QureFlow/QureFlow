# QueueLess Rural — Backend Integration Guide (AWS Cognito & DynamoDB)

Welcome! This frontend is fully built, styled, route-guarded, and validated. It is production-ready for healthcare OPD clinics.

This document outlines everything you need to connect **AWS Cognito** (Authentication) and **Amazon DynamoDB** (Database).

---

## 1. Quick Start Architecture

```
[ Frontend: React + TypeScript + Tailwind ]
                    |
      +-------------+-------------+
      |                           |
[ AWS Cognito ]           [ Amazon DynamoDB ]
- Patient User Pool       - Patients Table
- Staff User Pool / Group - Staff Table
- SMS OTP Verification    - Doctors Table
- JWT Tokens (ID/Access)  - Appointments Table
                          - Live Queues Table
```

The frontend uses an abstraction layer located in:
- `src/config/awsConfig.ts`: Central AWS credentials and resource IDs
- `src/services/awsCognitoAuth.ts`: Cognito authentication hooks
- `src/services/dynamoDbService.ts`: DynamoDB schemas, queries, and mutations
- `src/services/authService.ts`: Local mock fallback for seamless testing

---

## 2. AWS Cognito Setup

### 2.1 User Pool Configuration
1. Create a Cognito User Pool in **AWS Region `ap-south-1`** (Mumbai) or your chosen region.
2. **Sign-in attributes**:
   - Enable **Phone number** and **Email address**.
3. **Required standard attributes**:
   - `name` (Full Name)
   - `phone_number`
   - `email`
4. **Custom attributes**:
   - `custom:role` (String, mutable: `patient` | `admin` | `staff`)
   - `custom:gender` (String: `Male` | `Female` | `Other`)
   - `custom:dob` (String: `YYYY-MM-DD`)

### 2.2 Cognito User Groups
Create two User Groups in the User Pool:
- `Patients`: Default group for public patient sign-ups.
- `Admins` / `HospitalStaff`: Privileged group for reception staff and hospital administrators.

### 2.3 Critical Security Rule (Staff Registration)
> **IMPORTANT**: Public self-registration is allowed **ONLY for Patients**.
> Staff / Admin self-registration is permanently disabled in the UI.
> Staff accounts must be created using the AWS CLI or Cognito Admin API:
> ```bash
> aws cognito-idp admin-create-user \
>   --user-pool-id <YOUR_USER_POOL_ID> \
>   --username "admin@bolpurhealth.org" \
>   --user-attributes Name="name",Value="Bishakha Roy" Name="email",Value="admin@bolpurhealth.org" Name="custom:role",Value="admin" \
>   --temporary-password "TemporaryPass123!"
> 
> aws cognito-idp admin-add-user-to-group \
>   --user-pool-id <YOUR_USER_POOL_ID> \
>   --username "admin@bolpurhealth.org" \
>   --group-name "Admins"
> ```

---

## 3. Amazon DynamoDB Table Schemas

Create the following 5 tables in DynamoDB (On-Demand billing recommended):

### Table 1: `QueueLess_Patients`
- **Partition Key (PK)**: `patientId` (String) — Cognito `sub` or phone number
- **Attributes**: `name`, `phone`, `email`, `dob`, `gender`, `registeredAt`

### Table 2: `QueueLess_Staff`
- **Partition Key (PK)**: `staffId` (String) — e.g. `REC-204`
- **Attributes**: `name`, `email`, `role`, `clinicId`, `shift`

### Table 3: `QueueLess_Doctors`
- **Partition Key (PK)**: `doctorId` (String) — e.g. `doc-1`
- **Global Secondary Index (GSI)**: `specialty-index` (PK: `specialty`, SK: `name`)
- **Attributes**: `name`, `specialty`, `qualifications`, `experienceYears`, `opdRoom`, `dailyTokenLimit`, `consultationFee`, `availableDays`

### Table 4: `QueueLess_Appointments`
- **Partition Key (PK)**: `appointmentId` (String) — UUID
- **GSI 1**: `patientId-appointmentDate-index` (PK: `patientId`, SK: `appointmentDate`)
- **GSI 2**: `doctorId-appointmentDate-index` (PK: `doctorId`, SK: `appointmentDate`)
- **Attributes**: `patientId`, `patientName`, `patientPhone`, `doctorId`, `doctorName`, `clinicId`, `appointmentDate`, `timeSlot`, `status`, `tokenNumber`

### Table 5: `QueueLess_Queues`
- **Partition Key (PK)**: `queueDate_doctorId` (String) — e.g. `2026-09-12#doc-1`
- **Sort Key (SK)**: `tokenNumber` (Number) — e.g. `1`, `2`, `3`
- **Attributes**: `tokenId`, `appointmentId`, `patientName`, `status` (`waiting` | `in-consultation` | `completed` | `skipped`), `estimatedWaitMins`, `calledAt`

---

## 4. Environment Configuration

Copy `.env.example` to `.env` in the project root:

```ini
VITE_AWS_REGION=ap-south-1
VITE_COGNITO_USER_POOL_ID=ap-south-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_DYNAMO_PATIENTS_TABLE=QueueLess_Patients
VITE_DYNAMO_STAFF_TABLE=QueueLess_Staff
VITE_DYNAMO_DOCTORS_TABLE=QueueLess_Doctors
VITE_DYNAMO_CLINICS_TABLE=QueueLess_Clinics
VITE_DYNAMO_APPOINTMENTS_TABLE=QueueLess_Appointments
VITE_DYNAMO_QUEUES_TABLE=QueueLess_Queues
VITE_API_GATEWAY_URL=https://<api-id>.execute-api.ap-south-1.amazonaws.com/prod
VITE_USE_MOCK_BACKEND=false
```

---

## 5. Connecting Frontend to AWS

In `src/context/AuthContext.tsx`:
Replace the mock calls with `awsCognitoAuth.signInPatient` and `awsCognitoAuth.signUpPatient`.

All routes (`/patient/doctors`, `/patient/book`, `/patient/token`, `/admin/*`) are already strictly protected by `<PatientRoute>` and `<AdminRoute>`.
Unauthenticated users cannot see doctor listings or patient dashboards until authenticated.
Staff registration is disabled on the frontend.
Logout cleanly wipes local session tokens and redirects strictly to `/`.
