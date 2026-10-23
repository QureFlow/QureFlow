# DynamoDB data model

QureFlow uses an Amazon DynamoDB single-table design with string keys `pk` and `sk`. Every access path is a primary-key read or a partition query; no global secondary index is required.

## Keys and relationships

| Partition key | Sort key | Purpose |
| --- | --- | --- |
| `CLINIC#<id>` | `METADATA` | Clinic directory record |
| `DOCTOR#<id>` | `METADATA` | Schedule, consultation length, assigned clinic |
| `USER#<id>` | `METADATA` | Application profile, role, identity link, session version |
| `IDENTITY#PHONE#<normalized number>` / `IDENTITY#EMAIL#<email>` / `IDENTITY#STAFF#<staff id>` / `IDENTITY#COGNITO#<sub>` | `METADATA` | Unique identity claim pointing to a user; makes sign-in and token verification a single read |
| `SETTINGS#<clinicId>` | `METADATA` | Clinic-specific queue rules; legacy GLOBAL fallback |
| `QUEUE#<YYYY-MM-DD>#<doctorId>` | `COUNTER` | Atomic daily token sequence |
| Same queue partition | `TOKEN#<8-digit sequence>` | Ordered visit tokens |
| Same queue partition | `CURRENT` | Conditional claim allowing one current consultation |
| `TOKEN#<tokenId>` | `METADATA` | Direct lookup of queue partition and token sort key |
| `PATIENT_DAY#<date>#<patientId>` | `ACTIVE` | One waiting/current visit per patient per day |
| `APPOINTMENT#<id>` | `METADATA` | Booking linked by both appointment ID and token ID |
| `SLOT#<date>#<doctorId>#<time>` | `COUNTER` | Transactional occupancy of a booking window |
| `QUEUE_STATE#<doctorId>` | `ACTIVE` | Independently persisted pause state |
| `AUDIT#<clinicId>` | `<ISO timestamp>#<uuid>` | Clinic operation audit trail |
| `MODEL#<doctorId>` | `METADATA` | Explicitly refreshed model and validation metadata |
| `CATALOG#DOCTORS` / `CATALOG#CLINICS` | `<id>` | Transactionally maintained public directory views |
| `CATALOG#PATIENTS` | `<patientId>` | Patient references; profiles fetched with strongly consistent batch reads |
| `PATIENTS#CLINIC#<clinicId>` | `<patientId>` | Patient membership from registration and clinic visits |
| `APPOINTMENTS#PATIENT#<id>` / `APPOINTMENTS#DOCTOR#<id>` / `APPOINTMENTS#CLINIC#<id>` | `<date>#<appointmentId>` | Scoped appointment views updated with booking and status transactions |
| `VISITS#CLINIC#<clinicId>` | `<date>#<tokenId>` | Clinic analytics visit view updated in token transactions |
| `READ_MODELS` | `V1` | Activation marker written by the backfill migration (and the local demo) once every index exists |

Names and clinic details are deliberately snapshotted into visits for readable history; IDs preserve the logical relationships. These are application-level references, not relational foreign-key constraints. Identity claims enforce uniqueness for new records. Legacy records require reconciliation before a live rollout.

## Mutation invariants

- Booking writes the appointment, token, locator, patient-day claim, slot increment, and audit events in one transaction. The slot increment checks its capacity, and the doctor must still be active.
- Walk-in creation atomically creates the token, locator, patient-day claim, and audit event. A reception-created unclaimed patient profile is a separate operation; its later conversion into a verified account needs an explicit provisioning workflow.
- A token can move from `waiting` to `current`, `skipped`, or `cancelled`; from `current` to `completed` or `skipped`. Terminal states cannot change. Calling next cannot silently complete a consultation.
- Calling a patient claims `CURRENT` and checks the doctor pause state in the transaction. Completion/skip releases that claim. Terminal transitions release the patient-day claim and update any linked appointment in the same transaction.
- Booking cancellation or no-show releases slot occupancy atomically. Completed appointments continue to occupy their historical slot.
- Token and user updates use conditional state/version checks. Token sequences are unique and monotonically allocated per queue; failed transactions may leave harmless sequence gaps.
- Phone numbers use normalized ten-digit Indian mobile format and emails use lowercase. A unique contact claim cannot be assigned to another profile. Public profile responses remove password hashes and private authentication fields.

All queue dates and schedule checks use `Asia/Kolkata`; event timestamps use UTC ISO strings. Slots normally span 30 minutes and expand when a consultation plus buffer needs a longer window. An undersized final window is unavailable.

## Useful metadata

Token metadata includes `source`, `createdBy`, `requestId`, `timeZone`, `schemaVersion`, optional `synthetic`, `lastUpdatedBy`, `lastRequestId`, measured `consultationMinutes`, and walk-in `waitMinutes`. Records include `createdAt`, `updatedAt`, `version`, `queueDate`, and `tokenSeq` where applicable. Appointment metadata records source and creator; transaction-linked audit events record actor, correlation ID, entity, action, and state changes.

User metadata distinguishes demo fixtures and unclaimed reception registrations. Internal identity links and password hashes remain backend-only. Audit entries omit credential, name, and contact snapshots; actor/entity IDs are still sensitive operational identifiers requiring controlled retention.

Model metadata includes the method, version (`consultation-lognormal-v2`), training timestamp, sample counts, the chronological training/validation split, feature names and coefficients, residual spread, the recency half-life, smoothed no-show and walk-in leave rates, and the held-out error of every candidate (configured average, doctor's recent typical duration, learned model). Completed consultations from 1 to 90 minutes are used. The most recent 20% of each doctor's consultations validate models fitted on the earlier 80%; a method is chosen only if it is strictly more accurate than the simpler ones. Doctors with fewer than 10 consultations use the clinic-wide model when the clinic has enough history. Models estimate operational duration, never diagnosis or clinical triage. Normal inference retrains from the last 90 days at most once a minute per clinic; refreshing persists the metadata with an audit event.

## Query limits

Queue operations query the date/doctor partition with strongly consistent reads. Direct user, doctor, clinic, appointment, and token-locator lookups use primary keys. Identity claims eliminate a lookup scan for migrated profiles. New read models query catalog and scoped appointment/visit partitions; patient directory queries read membership references and batch-fetch authoritative profiles. Booking and token transitions update all appointment views and the clinic visit view atomically. All partition queries paginate.

Tables without the activation marker use compatible paginated scan paths; a scan that finds a legacy identity records its claim so the next lookup is a single read. `npm run migrate:backfill --prefix backend` builds every index and claim from the primary records (dry run by default) and then sets the marker, after which missing claims are final and no lookup scans. Global unfiltered appointment reads (all clinics) still scan. Clinic visit queries currently retrieve the clinic partition before applying the history cutoff; add bounded date queries, API pagination, migration verification and AWS load testing before multi-hospital scale. Partition views are application read models, not relational tables or SQL stored routines.

## Expanded demonstration metadata

Fictional doctor profiles contain bio, languages, clinical interests, department, room, demonstration registration ID, appointment modes, follow-up window, accessibility and profile provenance. Clinic records include facility code, timezone, services, amenities and payment methods. Patient records include a fictional record ID, birth date, language, registration channel, district, notification preference and unclaimed-account status. Generated visits include encounter type, arrival/booking channel, room, department, check-in timestamp, measured duration/wait, actor and correlation references, schema version and an explicit synthetic provenance flag. No generated diagnoses or real patient records are included.
