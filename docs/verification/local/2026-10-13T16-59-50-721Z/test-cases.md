# Executed MySQL test cases

Executed at 2026-10-13T16:59:50.793Z. Each case uses a disposable qureflow_test database.

| TC ID | Description | Input | Expected output | Actual output | Status |
|---|---|---|---|---|---|
| TC01 | directory joins specialty, clinic and normalized language with SQL ordering | Specialty+Hindi filter, fee order; experience page 2 | Correct joined doctor, language and descending experience page | All expected assertions passed | Pass |
| TC02 | SQL injection values cannot change search or select arbitrary sort expressions | `' OR 1=1 --` search and SQL expression as sort | Zero injected results; invalid sort HTTP 400; doctors intact | All expected assertions passed | Pass |
| TC03 | empty search and out-of-range pages preserve a correct total | Unknown specialty, page 999, pageSize 10000 | Empty results with accurate totals; invalid size HTTP 400 | All expected assertions passed | Pass |
| TC04 | unauthenticated access and cross-clinic writes remain denied | Anonymous queue read; clinic-2 edits clinic-1; unrelated patient read | HTTP 401/403 | All expected assertions passed | Pass |
| TC05 | simultaneous registrations cannot create two active visits for one patient | Two simultaneous queue joins for same patient | Exactly one active visit | All expected assertions passed | Pass |
| TC06 | foreign keys reject orphan visits | Queue insert with missing patient FK | ER_NO_REFERENCED_ROW_2 | All expected assertions passed | Pass |
| TC07 | emergency priority is selected by SQL before a normal token | Normal and explicit emergency priority tokens | Emergency token selected first | All expected assertions passed | Pass |
| TC08 | database unique constraint prevents a second simultaneous consultation | Second current token for same doctor/date | Rejected; exactly one consultation | All expected assertions passed | Pass |
| TC09 | patient queue responses conceal other patient identity | Patient reads queue and attempts another patient's cancellation | Other identity hidden; cancellation HTTP 403 | All expected assertions passed | Pass |
| TC10 | trigger records state changes and rejects reopening completed visits | Complete visit, try reopening it | Audit recorded; illegal transition rejected | All expected assertions passed | Pass |
| TC11 | pause is respected and the next call resumes correctly | Pause, call next, resume, call next | Paused call rejected; resumed call succeeds | All expected assertions passed | Pass |
| TC12 | appointment and token are created atomically with capacity accounting | Book available future slot | Appointment and token linked; bookedCount=1 | All expected assertions passed | Pass |
| TC13 | capacity conflicts roll back without orphan appointments | Fill slot then attempt another booking | Conflict rolls back; no orphan appointment | All expected assertions passed | Pass |
| TC14 | cancellation trigger updates linked appointment and releases its slot | Cancel linked booking | Both states cancelled; bookedCount=0; active visit released | All expected assertions passed | Pass |
| TC15 | unique identities and optimistic profile versions prevent conflicting updates | Stale profile version and duplicate email | Both rejected | All expected assertions passed | Pass |
| TC16 | a new conflicting identity cannot overwrite an existing account | New user ID with existing identity | Original account unchanged; conflicting user absent | All expected assertions passed | Pass |
| TC17 | staff appointment filters and SQL pagination use the assigned clinic | Staff appointment filters, pageSize=1, clinic and patient role | Correct cancelled page; other clinic empty; patient HTTP 403 | All expected assertions passed | Pass |
| TC18 | stored function, daily procedure, views and cursor return verifiable results | Function, daily procedure, views, cursor and analytics endpoint | 12.5 minutes; 14 days; correct completed counts and roster | All expected assertions passed | Pass |
| TC19 | parameterized patient and appointment filters stay within the clinic | Injection in patient filter and clinic-scoped appointment read | Empty injected search; authorized clinic records only | All expected assertions passed | Pass |
| TC20 | updated buffer capacity is used when an existing slot gains an opening | Change buffer to expand existing slot capacity | Newly opened space can be booked | All expected assertions passed | Pass |
| TC21 | CHECK constraints reject negative fees and impossible slot occupancy | Negative fee and bookedCount above capacity | ER_CHECK_CONSTRAINT_VIOLATED; invalid slot absent | All expected assertions passed | Pass |
| TC22 | function returns NULL for missing, reversed and implausible timings | Missing/reversed/>2h/zero duration | NULL/NULL/NULL/0 | All expected assertions passed | Pass |
| TC23 | concurrent bookings from different patients cannot overfill the last slot | Three different patients book one remaining place concurrently | One succeeds; two reject; bookedCount=capacity=1 | All expected assertions passed | Pass |
| TC24 | a booking submitted through the HTTP API is visible in SQL and cancels both records | POST booking; SQL join; POST cancellation; SQL join | HTTP 201 with linked rows; HTTP 200 and both cancelled | All expected assertions passed | Pass |
