# QureFlow — MySQL DBMS variant

This local branch uses **MySQL 8.4** for the SQL-focused DBMS submission. The primary AWS checkout at `C:\Users\ASUS\Documents\GitHub\QureFlow` remains on `main` and is unchanged. Nothing has been committed, pushed, deployed or written to a cloud database.

## Run this version

Open a terminal in this checkout:

```powershell
cd C:\Users\ASUS\.codex\worktrees\mysql-dbms\QureFlow
npm ci
npm ci --prefix backend
docker compose -p qureflow-dbms -f compose.dbms.yaml up -d --wait
npm run dev:dbms
```

Open **http://localhost:5174**. The API is on port 5001 and MySQL is on loopback port 3307. First startup creates the schema, routines and synthetic demo data automatically. Subsequent starts retain records and skip a completed seed. No AWS account, Cognito pool or cloud keys are required for this variant.

- Staff: `demo.staff@example.invalid` / `DemoClinic123!`
- Patient: `demo.patient@example.invalid` / `DemoPatient123!`
- Other clinics: `demo.staff2@example.invalid` through `demo.staff6@example.invalid`, same staff password.
- Assigned doctor: `demo.doctor@example.invalid` / `DemoClinic123!`
- Reception: `demo.reception@example.invalid` / `DemoClinic123!`

The seeded database contains 6 fictional clinics, 48 doctors, 12 specialties, 737 patient profiles and 6,195 linked appointment/token records. Historical daily volumes vary; today has active queues and three future days contain appointments. Records are synthetic and explicitly labelled.

## What SQL does

There is no ORM and no whole-entity JSON storage. Core entities use relational columns and foreign keys. Optional provenance metadata remains JSON.

- `WHERE`, `JOIN`, `EXISTS`: doctor specialty, clinic, language, availability and text search.
- Whitelisted `ORDER BY` and parameterized `LIMIT/OFFSET`: fee, experience and name sorting; doctor and staff appointment pagination.
- Patient membership and doctor assignment use scoped SQL queries.
- Appointment search, doctor/date/status filters and queue priority/token ordering run in SQL.
- `GROUP BY`, `COUNT`, `SUM`, `AVG`: daily flow and consultation statistics.
- InnoDB transactions and row locks protect booking capacity, token numbering and queue transitions.
- Foreign keys, checks and generated-column unique indexes prevent orphan visits, duplicate active patient visits and multiple current consultations for a doctor.
- A stored function computes valid consultation duration; a stored procedure produces the 14-day chart; triggers validate queue transitions, synchronize appointment state, release slots and record audit events.
- A read-only cursor procedure returns clinic doctor workload for the course demonstration. Set-based queries remain the default for normal operations.

SQL files:
1. [Relational schema and views](backend/sql/001_schema.sql)
2. [Function, procedures, triggers and cursor](backend/sql/002_routines.sql)
3. [Executable demonstration queries](backend/sql/003_demonstration_queries.sql)

MySQL uses stored routines; this version does not claim to implement Oracle PL/SQL packages. No course report has been generated.

## Inspect the database

MySQL Workbench connection: host `127.0.0.1`, port `3307`, user `qureflow`, password `qureflow_local_only`, schema `qureflow_dbms`. These credentials are exclusively for the loopback-only local demonstration.

Or open its terminal:

```powershell
docker compose -p qureflow-dbms -f compose.dbms.yaml exec mysql mysql -uqureflow -p qureflow_dbms
```

Enter `qureflow_local_only` when prompted. Run the queries in `backend/sql/003_demonstration_queries.sql`. Workbench can reverse-engineer the schema into an ER diagram directly from its foreign keys.

## Verify

```powershell
npm test
npm run build
node --test tests/frontend-insights.test.cjs
npm run test:announcements
npm run verify:dbms --prefix backend
```

MySQL tests create a uniquely named `qureflow_test_...` database through the local Compose service, verify actual API/SQL behavior, and delete only that database. They leave the demonstration database intact.

The retained AWS path can be regression-tested against isolated DynamoDB Local on port 18000 using `npm run test:aws`. Use the original `main` checkout for your AWS project, not this DBMS frontend.

Default `npm run dev`, `npm run dev:demo`, `npm run seed`, `npm test` and `npm start` all select MySQL in this checkout. To run the compiled app, use `npm run build` followed by `npm start`, then open http://localhost:5001. Seeding is idempotent and the default seed command refuses remote databases.

## Local-only safeguards and limitations

The separate checkout is on `codex/mysql-dbms`. Changes are uncommitted for your review; you decide how to commit and push a secondary branch. Do not merge this DBMS work into main unless you intentionally want the dual-provider code.

Docker keeps demo records in the dedicated `qureflow-dbms_qureflow-mysql-demo` volume. Stopping the service preserves them. The seeded date history is retained rather than silently resetting user actions.

`mysqlServer.ts` is a local demonstration entry point, not a production deployment command. It uses local password authentication for the DBMS demo; the primary project retains Cognito. SQL values are parameterized, sort expressions are whitelisted, and API roles/ownership remain enforced.

Design reference: [MySQL 8.4 stored routines](https://dev.mysql.com/doc/refman/8.4/en/create-procedure.html), [generated-column indexes](https://dev.mysql.com/doc/refman/8.4/en/generated-column-index-optimizations.html).
