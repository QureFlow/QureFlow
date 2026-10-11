# QureFlow

QureFlow manages outpatient appointments, reception walk-ins, and doctor queues. Its objective is to reduce time spent waiting at clinics through scheduled visits, visible queue progress, and estimates derived from recorded consultation times.

This version keeps **Amazon DynamoDB and Amazon Cognito** for the AWS project. A relational DBMS version belongs in a separate copy later. No course report or Word template has been generated or modified.

## Run the isolated demonstration

Install Node.js and Docker Desktop, then run these commands from this repository:

```powershell
npm ci
npm ci --prefix backend
docker compose up -d
npm run dev:demo
```

Open http://localhost:5173. The demo uses **DynamoDB Local on loopback port 18000**, table `QureFlowDemo`, and explicit local password authentication. It does not use your AWS table or Cognito pool. Its expanded directory has **six fictional clinics, 48 doctors, 12 specialties, and 737 patient profiles**. The V3 expansion adds **5,040 linked visits and appointments** over 24 historical days, today's consultation queues, and three future days, alongside the original 600 history samples and earlier demo actions. Profiles include languages, clinical interests, room numbers, fictional registration references, record IDs, contact preferences, and provenance. Subsequent starts preserve existing demo records. The Compose volume preserves data across container restarts; keep it for repeat demonstrations.

| Portal | Email | Local demo password |
| --- | --- | --- |
| Staff, clinic 1 | demo.staff@example.invalid | DemoClinic123! |
| Staff, clinic 2 | demo.staff2@example.invalid | DemoClinic123! |
| Patient | demo.patient@example.invalid | DemoPatient123! |
| Staff, clinics 3–6 | demo.staff3@example.invalid through demo.staff6@example.invalid | DemoClinic123! |
| Assigned doctor, clinic 1 | demo.doctor@example.invalid | DemoClinic123! |
| Reception, clinic 1 | demo.reception@example.invalid | DemoClinic123! |

The demo buttons only fill these credentials; authentication still checks the database and password. These accounts and passwords are exclusively synthetic fixtures. For a clean synthetic environment, use a new local table name rather than deleting your existing table.

If port 18000 is already occupied by the previously started `qureflow-dynamodb-local` demo container, reuse it, or stop that container before starting Compose. The manually started container is in memory; Compose uses a persistent volume.

## Features implemented

- Atomic DynamoDB transactions connect appointments, tokens, slot occupancy, audit events, and active-visit claims. Conditional writes prevent duplicate patient visits, capacity overruns, and two simultaneous consultations for one doctor.
- Server-verified sessions enforce patient ownership, staff clinic assignments, and doctors' assigned queues and patients. Patient queue views conceal other patients' identity and contact details.
- Real doctor schedules, consultation lengths, clinic buffers, calendar validation, and an explicit booking horizon determine available slots. Cancellation updates the linked appointment and token together.
- Metadata records actors, correlation IDs, schema versions, queue dates, registration source, consultation durations, and model validation results. Audit events omit password and contact snapshots.
- Clinic analytics shows actual database counts, trends, cancellations, no-shows, and model quality. A ridge regression duration model activates only with enough valid observations and better validation error than the configured baseline.
- API errors remain visible in the UI; failures never silently create sample bookings or authenticate a user. Mobile queue tracking, reception operations, and clinic settings use the same backend.
- A new teal and ivory interface includes a rebuilt homepage, patient and staff dashboards, searchable care directory with specialty/location/language filters and sorting, detailed doctor profiles, consultation room controls, and a paginated database-backed patient directory. Counts and history come from persisted records.
- Catalog, patient membership, appointment, and clinic visit read models use partition queries instead of whole-table scans after explicit backfill activation. Transactional writes keep the indexed appointment and visit records synchronized. The local demo enables these views; existing cloud tables retain the legacy fallback until migration.

## Verification

```powershell
npm test
npm run build
npm run verify:demo --prefix backend
npm audit
npm audit --prefix backend
```

Tests require DynamoDB Local on port 18000. They create a uniquely named `QureFlowTest-*` table and delete only that isolated table after execution. They cover authentication, ownership, clinic isolation, concurrent mutations, booking capacity, queue transitions, indexed read consistency, audit data, prediction validation, and the Lambda adapter. Latest execution: **65 passed, zero failed**. `verify:demo` separately reads the expanded demo and checks its directory, linked visit states, profile metadata, active-visit uniqueness, and learning pipeline. The application build and both dependency audits also passed.

Generated `node_modules` and frontend `dist` files have been removed from Git tracking; their local installed/build copies remain available. Lockfiles define reproducible installations.

See [test results and executed UI screenshots](docs/verification/README.md), [DynamoDB design](docs/DATA_MODEL.md), and [AWS integration](BACKEND_INTEGRATION.md).

## Use your AWS configuration

Use the existing ignored environment files, or configure the variables described in `backend/.env.example` and `.env.example`. `npm run dev` uses that configuration; `npm run dev:demo` explicitly overrides it for local fixtures. Never put AWS keys, a Cognito client secret, or a signing secret in frontend `VITE_*` variables. Prefer an AWS workload role for deployed infrastructure.

Production startup requires a strong `JWT_SECRET`. Cognito patient sessions validate access-token signatures, expiry, pool, and client, then read the application profile for authorization. Existing separately provisioned local staff profiles remain supported, but staff provisioning and Cognito migration need a deliberate deployment plan.

For the compiled unified Express host, run `npm run build` followed by `npm start`. Lambda entry point is `backend/dist/lambda.handler`; the adapter forwards real API requests to Express. An AWS deployment still needs its API Gateway integration, IAM role, environment, and frontend routing configured.

The read-only AWS check confirmed an active DynamoDB table and readable directories containing three clinics and ten doctors. Cognito app-client inspection returned `AccessDeniedException`; no permissions were broadened. Repeat this inspection with `npm run verify:aws --prefix backend`. Its evidence is saved without credentials or resource account IDs.

**This is a tested development implementation, not a completed commercial healthcare release.** Live Cognito flows, cloud transactional writes, and the deployed API were not exercised. Read [release readiness](docs/RELEASE_READINESS.md) before deploying against real patient records or selling the product.
