# QureFlow

QureFlow is a queue and appointment platform for outpatient clinics and hospitals. Patients book
a slot or are registered at reception, then follow their place in the doctor's queue and an
estimated waiting time from their phone instead of waiting in a crowded hall. Staff run the
queue — call next, skip, pause, register walk-ins and emergencies — and see how accurate the
estimates have been.

- **Patient portal:** doctor directory with search and filters, live slot availability,
  booking and cancellation, a live token with patients ahead, the doctor's current token and an
  estimated wait with its likely range.
- **Staff portal:** per-doctor queues, walk-in and emergency registration, appointment search,
  patient directory, clinic settings, analytics and an audit trail.
- **Android app:** the same interface packaged with Capacitor ([docs/ANDROID.md](docs/ANDROID.md)).

## Architecture

```text
React (Vite) web / Android ──► Express API ──► Amazon DynamoDB (single table)
                               (or API Gateway → Lambda)
                                    └────────► Amazon Cognito (patient identity)
```

- **Amazon DynamoDB** holds every record in one table. Bookings, queue transitions and
  cancellations are `TransactWriteItems` with condition checks, so a slot cannot be overbooked,
  a patient cannot hold two active visits, and a doctor cannot have two current consultations.
  Directory, appointment, patient and visit views are partition-queried read models kept in sync
  inside the same transactions. See [docs/DATA_MODEL.md](docs/DATA_MODEL.md).
- **Amazon Cognito** handles patient sign-up, verification, sign-in and password recovery. The
  API verifies Cognito access tokens with `aws-jwt-verify` and resolves the profile through an
  identity claim (a single read).
- **Clinic isolation and privacy:** every route checks the role and clinic server-side; patients
  see other patients only as token numbers; audit events exclude credentials and contact details.

## Waiting-time estimation

Each doctor's consultation durations are modelled as log-normal, learned from that doctor's
completed consultations with recency weighting (recent weeks count more) and shrinkage toward a
clinic-wide model (new doctors borrow from colleagues). Features are walk-in, emergency, first
visit vs. follow-up, and time of day. A patient's wait is then projected by replaying QureFlow's
own calling rule forward — emergency first, then token order among patients who are eligible at
each moment — so bookings whose time arrives during the wait are counted. Patients ahead are
weighted by the chance they are actually seen, the running consultation's remaining time is a
conditional expectation, and the 80% range is calibrated on the clinic's own recent errors.
Once a clinic has recorded at least 50 called patients, gradient-boosted trees that take the
projected wait as an input learn what the projection misses (for example emergencies that
arrive later) and correct it; the correction is retrained every 30 minutes.

Every method is checked before it is used: the most recent 20% of each doctor's consultations
are held out, and the learned model replaces the configured average only if it is more accurate.
Staff analytics replays the last week to show each method's actual error. Estimates never affect
clinical priority.

Offline evaluation on simulated sessions (6 clinics, 48 doctors, 60 days, rolling-origin
backtest; synthetic data, not a clinical study) compares it with estimators used by queue
systems and hospitals and with learned predictors from the literature:

```powershell
npm run evaluate:model
```

Results are written to [docs/evaluation/wait-model-evaluation.json](docs/evaluation/wait-model-evaluation.json).

## Run locally with synthetic data

Requires Node.js 20+ and Docker Desktop.

```powershell
npm ci
npm ci --prefix backend
npm run db:up
npm run dev:demo
```

Open http://localhost:5180. The demo uses DynamoDB Local on loopback port 18000 with the table
`QureFlowDemo` and local password authentication; it never touches AWS. The first start builds a
synthetic dataset (6 fictional clinics, 48 doctors, 12 specialties, ~740 patients, 14 days of
simulated sessions, today's queues and three booked future days); this takes several minutes.

| Account | Email | Password |
| --- | --- | --- |
| Administrator (all demo clinics) | demo.staff@example.invalid | DemoClinic123! |
| Administrator, clinic 2–6 | demo.staff2@example.invalid … demo.staff6@example.invalid | DemoClinic123! |
| Doctor | demo.doctor@example.invalid | DemoClinic123! |
| Reception | demo.reception@example.invalid | DemoClinic123! |
| Patient | demo.patient@example.invalid | DemoPatient123! |

These synthetic accounts exist only in the local demo table. `npm run demo:reset --prefix backend`
deletes that local table so the next start rebuilds it.

## Run against AWS

Configure `backend/.env` from [backend/.env.example](backend/.env.example): region, table name,
Cognito user pool and app client (plus the client secret if the client has one), a strong
`JWT_SECRET`, and the allowed frontend origins. Use the AWS credential chain or an IAM role;
never put AWS keys or the Cognito secret in a `VITE_*` variable.

```powershell
npm run verify:aws --prefix backend      # read-only infrastructure check
npm run migrate:backfill --prefix backend # dry run: indexes and identity claims to create
npm run dev
```

Tables created before the indexed read models fall back to scans until the backfill is applied
(`npm run migrate:backfill --prefix backend -- --apply --confirm-table=<table>`). For a single
host, `npm run build` then `npm start`; for serverless, the Lambda handler is
`backend/dist/lambda.handler`. More detail: [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md).

## Tests

```powershell
npm run db:up
npm test                 # API integration tests on a disposable DynamoDB Local table
npm run test:frontend    # mobile connection, insights and announcement tests
npm run test:discovery   # Wi-Fi discovery
npm run build
```

The integration suite creates a uniquely named `QureFlowTest-*` table and deletes it afterwards.
It covers authentication, ownership, clinic isolation, concurrent bookings and queue
transitions, slot capacity, read-model consistency, directory and appointment search, identity
claims, the waiting-time model and the Lambda adapter. Results:
[docs/verification/test-results.json](docs/verification/test-results.json).

## Status

QureFlow is a tested development build, not a certified medical device or a finished commercial
release. Read [docs/RELEASE_READINESS.md](docs/RELEASE_READINESS.md) before using it with real
patient records.
