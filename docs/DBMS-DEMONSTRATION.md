# QureFlow DBMS demonstration guide

This guide connects the BCSE302P template's technical requirements to the working MySQL application and reproducible evidence. Use local synthetic data throughout. The report, student details, certificate and faculty approval remain separate authoring tasks.

## Start and inspect

```powershell
npm run db:up
npm run dev:dbms
```

Open http://localhost:5174. Staff: `demo.staff@example.invalid` / `DemoClinic123!`. Patient: `demo.patient@example.invalid` / `DemoPatient123!`. Doctor and reception use `demo.doctor@example.invalid` and `demo.reception@example.invalid`, with the staff password.

For the classroom demonstration, the default synthetic staff administrator manages all six local clinics: all patients, doctors, appointments and today's queues are visible in that one session. The sidebar says "All demo clinics". Use the doctor selector in Live Queue Manager, and the clinic selectors in Queue Settings and Operations & Insights. Other clinic administrator, doctor and reception accounts retain their assigned-clinic restrictions. This capability is explicitly enabled by the local MySQL entry point; set `DBMS_DEMO_ALL_CLINICS=false` before starting it to disable the classroom override. It is unavailable in AWS or production mode. Refresh or sign in again after restarting the backend to receive the current session capabilities.

Workbench: Standard TCP/IP, host `127.0.0.1`, port `3307`, username `qureflow`, password `qureflow_local_only`, schema `qureflow_dbms`. Or run `npm run db:shell` and enter that password. `npm run db:stop` preserves the named Docker volume. Do not use `down -v` during preparation or demonstrations.

## Template coverage

| Template section | Working implementation or evidence |
|---|---|
| 1 Problem and scope | Clinic appointment and queue management; patients, reception, doctors and clinic administrators |
| 2 Requirements | Windows, Node 24 verified here, Docker Desktop, MySQL 8.4; React/Vite, TypeScript/Express, mysql2; Android Studio/SDK needed for APK |
| 3.1 ER diagram | Latest run's `er-diagram.mmd`, generated from real foreign keys; Workbench Database > Reverse Engineer provides an editable EER view |
| 3.2 Relational schema | Latest run's `data-dictionary.md` and `schema.json` include actual types, keys, nullability, defaults and CHECK definitions |
| 3.3 DDL | `backend/sql/001_schema.sql` |
| 3.4 Normalization | Discussion below; identify intentional operational redundancy |
| 4.1 Function | `fn_consultation_minutes`; valid duration and NULL for invalid timing; SQL output and TC18/TC22 |
| 4.2 Procedures | `sp_daily_patient_flow` with clinic/from/until IN parameters; 14-day results include zero-volume days |
| 4.3 Packages | MySQL has no Oracle PL/SQL package specification/body object. The routines are grouped by schema and source file; this is not an Oracle package. Confirm how the instructor wants this non-applicable section handled |
| 4.4 Triggers | BEFORE UPDATE validates transitions; AFTER INSERT audits creation; AFTER UPDATE synchronizes appointment state, releases occupancy, and audits transitions |
| 4.5 Cursor | Explicit roster cursor in `sp_doctor_workload_cursor`, with NOT FOUND handler, OPEN/FETCH/CLOSE; read-only JSON output |
| 5 Frontend/integration | React → authenticated Express API → parameterized mysql2 SQL; generated Capacitor Android project reuses React |
| 6 Tests/output | 24 MySQL cases, 8 frontend cases, 10 announcement cases; current run logs and SQL outputs |
| 7 Results | Six clinics, 48 doctors, 737 synthetic patients and 6,195 linked visits at initial local verification |
| 8 Future scope | Native device acceptance, production authentication and deployment require separate verification |
| 9 References | MySQL/Capacitor/Android primary documentation linked in README and Android guide |

## ER relationships and dependencies

Each doctor belongs to exactly one clinic and one specialty; a clinic/specialty may have zero or many doctors. Doctor languages form an M:N relationship through `doctor_languages`, whose composite primary key prevents duplicate membership. `doctor_days` and `doctor_interests` likewise remove repeating lists. Each appointment has one patient and one doctor; either can have many historical appointments. A queue token has one patient and doctor, and zero or one linked appointment. The UNIQUE nullable `appointmentId` allows at most one token per appointment. Clinic settings, queue state and prediction models have at most one row per clinic/doctor key. User clinic/doctor assignment is optional in the schema and role-specific authorization is enforced in the API.

Representative functional dependencies: `clinicId → clinic attributes`, `specialtyId → specialty name`, `languageId → language name`, `doctorId → clinicId, specialtyId, name, fee, schedule bounds`, `userId → identity and profile attributes`, `appointmentId → patientId, doctorId, date, slotMinute, status`, and `(doctorId, slotDate, slotMinute) → capacity, bookedCount`. Unique email/phone values are alternative identifiers when present; nullable columns are not unconditional candidate keys.

Unnormalized source records would repeat clinic details and contain lists of languages and consultation days. 1NF gives every relationship row atomic values; `doctor_languages` and `doctor_days` remove repeating groups. 2NF keeps language names in `languages` and doctor attributes in `doctors`, so neither depends on only part of a membership key. 3NF separates clinic and specialty details rather than repeating them for each doctor, removing transitive dependencies such as `doctorId → clinicId → clinic name` from `doctors`.

Do not claim that every operational relation is fully normalized or BCNF: `queue_tokens` repeats patient/doctor/date from its optional appointment link, appointment/token identifiers include operational snapshots, and `clinic_settings.clinicName` is a configurable display copy. Counters, occupancy and prediction JSON are deliberate operational state. Triggers and transactions maintain the tested appointment/status/occupancy relationships; unrelated raw SQL edits are not a supported booking workflow.

## SQL presentation sequence

1. Run `backend/sql/003_demonstration_queries.sql`: tables, joined specialty search, language/availability filter, sorting/pagination, queue ordering, GROUP BY/AVG, views, function, procedure, cursor, triggers, constraints and EXPLAIN.
2. Run the whole `backend/sql/004_transaction_demonstration.sql` in one session: create disposable synthetic records, cancel the token, observe the appointment status and slot count, inspect audit rows, then ROLLBACK. The final four counts must all be zero. A far-future date separates these records from real demonstration bookings; if interrupted, rollback the connection before continuing.
3. Run `npm test` for negative cases and concurrency. These use a separate UUID-named test database, which is removed after the suite, leaving the demo intact.
4. Book tomorrow through the patient app, then inspect `appointment_details` by the returned appointment ID. Cancel through the app and rerun the query. TC24 performs this API-to-SQL integration automatically. The browser workflow was also executed on this computer; `005_browser_booking_verification.sql` and `browser-booking-before.txt` / `browser-booking-after.txt` capture token A-002 and slot occupancy before/after cancellation. Native device verification remains pending.

No patient or staff endpoint accepts arbitrary SQL. Workbench/terminal is the manual SQL interface. Emergency ordering follows explicit staff-entered priority; predictions do not perform clinical triage.

## Test cases in the template's format

Actual output/status are generated for every run in `test-cases.md` and `mysql-tests.txt`. The table below supplies reproducible inputs and expected assertions; it does not replace executing the tests.

| TC ID | Description/input | Expected output |
|---|---|---|
| TC01 | Specialty+Hindi filter, fee order; experience page 2 | Correct joined doctor, language and descending experience page |
| TC02 | `' OR 1=1 --` search and SQL expression as sort | Zero injected results; invalid sort HTTP 400; doctors intact |
| TC03 | Unknown specialty, page 999, pageSize 10000 | Empty results with accurate totals; invalid size HTTP 400 |
| TC04 | Anonymous queue read; clinic-2 edits clinic-1; unrelated patient read | HTTP 401/403 |
| TC05 | Two simultaneous queue joins for same patient | Exactly one active visit |
| TC06 | Queue insert with missing patient FK | ER_NO_REFERENCED_ROW_2 |
| TC07 | Normal and explicit emergency priority tokens | Emergency token selected first |
| TC08 | Second current token for same doctor/date | Rejected; exactly one consultation |
| TC09 | Patient reads queue and attempts another patient's cancellation | Other identity hidden; cancellation HTTP 403 |
| TC10 | Complete visit, try reopening it | Audit recorded; illegal transition rejected |
| TC11 | Pause, call next, resume, call next | Paused call rejected; resumed call succeeds |
| TC12 | Book available future slot | Appointment and token linked; bookedCount=1 |
| TC13 | Fill slot then attempt another booking | Conflict rolls back; no orphan appointment |
| TC14 | Cancel linked booking | Both states cancelled; bookedCount=0; active visit released |
| TC15 | Stale profile version and duplicate email | Both rejected |
| TC16 | New user ID with existing identity | Original account unchanged; conflicting user absent |
| TC17 | Staff appointment filters, pageSize=1, clinic and patient role | Correct cancelled page; other clinic empty; patient HTTP 403 |
| TC18 | Function, daily procedure, views, cursor and analytics endpoint | 12.5 minutes; 14 days; correct completed counts and roster |
| TC19 | Injection in patient filter and clinic-scoped appointment read | Empty injected search; authorized clinic records only |
| TC20 | Change buffer to expand existing slot capacity | Newly opened space can be booked |
| TC21 | Negative fee and bookedCount above capacity | ER_CHECK_CONSTRAINT_VIOLATED; invalid slot absent |
| TC22 | Missing/reversed/>2h/zero duration | NULL/NULL/NULL/0 |
| TC23 | Three different patients book one remaining place concurrently | One succeeds; two reject; bookedCount=capacity=1 |
| TC24 | POST booking; SQL join; POST cancellation; SQL join | HTTP 201 with linked rows; HTTP 200 and both cancelled |

## Reproduce evidence

Run `npm run verify:local`. It keeps timestamped logs and a current `docs/verification/local/latest.json`. The latest directory contains actual SQL output, schema, ER source, data dictionary, test case statuses and command exit codes. The SDK and Java 21 are now installed; the APK build and signature verification have passed. Native device acceptance remains separate. See [Android checks](ANDROID.md).

Run `npm run evidence:serve` and open http://127.0.0.1:5175 for a read-only view of the captured test results and SQL output. It serves saved evidence, not live SQL execution. Use Workbench to execute statements yourself.
