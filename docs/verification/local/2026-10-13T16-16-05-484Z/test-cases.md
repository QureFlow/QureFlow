# Executed MySQL test cases

Executed at 2026-10-13T16:16:05.487Z. Each case uses a disposable qureflow_test database.

| TC ID | Description | Actual result | Status |
|---|---|---|---|
| TC01 | directory joins specialty, clinic and normalized language with SQL ordering | All assertions passed | Pass |
| TC02 | SQL injection values cannot change search or select arbitrary sort expressions | All assertions passed | Pass |
| TC03 | empty search and out-of-range pages preserve a correct total | All assertions passed | Pass |
| TC04 | unauthenticated access and cross-clinic writes remain denied | All assertions passed | Pass |
| TC05 | simultaneous registrations cannot create two active visits for one patient | All assertions passed | Pass |
| TC06 | foreign keys reject orphan visits | All assertions passed | Pass |
| TC07 | emergency priority is selected by SQL before a normal token | All assertions passed | Pass |
| TC08 | database unique constraint prevents a second simultaneous consultation | All assertions passed | Pass |
| TC09 | patient queue responses conceal other patient identity | All assertions passed | Pass |
| TC10 | trigger records state changes and rejects reopening completed visits | All assertions passed | Pass |
| TC11 | pause is respected and the next call resumes correctly | All assertions passed | Pass |
| TC12 | appointment and token are created atomically with capacity accounting | All assertions passed | Pass |
| TC13 | capacity conflicts roll back without orphan appointments | All assertions passed | Pass |
| TC14 | cancellation trigger updates linked appointment and releases its slot | All assertions passed | Pass |
| TC15 | unique identities and optimistic profile versions prevent conflicting updates | All assertions passed | Pass |
| TC16 | a new conflicting identity cannot overwrite an existing account | All assertions passed | Pass |
| TC17 | staff appointment filters and SQL pagination use the assigned clinic | All assertions passed | Pass |
| TC18 | stored function, daily procedure, views and cursor return verifiable results | All assertions passed | Pass |
| TC19 | parameterized patient and appointment filters stay within the clinic | All assertions passed | Pass |
| TC20 | updated buffer capacity is used when an existing slot gains an opening | All assertions passed | Pass |
| TC21 | CHECK constraints reject negative fees and impossible slot occupancy | All assertions passed | Pass |
| TC22 | function returns NULL for missing, reversed and implausible timings | All assertions passed | Pass |
| TC23 | concurrent bookings from different patients cannot overfill the last slot | All assertions passed | Pass |
| TC24 | a booking submitted through the HTTP API is visible in SQL and cancels both records | All assertions passed | Pass |
