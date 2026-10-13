# Executed MySQL verification — 13 October 2026

All data and writes in this verification use isolated local synthetic databases. The original AWS checkout on main is unchanged. There are no commits, pushes or deployed changes.

- `npm test`: 20 MySQL integration cases pass (21 Node test entries including the parent suite). A unique test database is created and removed each run.
- `npm run test:aws`: 65 existing DynamoDB Local regression checks pass; its isolated table is removed.
- `node --test tests/frontend-insights.test.cjs`: 8 pass.
- `npm run test:announcements`: 10 pass.
- `npm run build`: frontend and backend compile.
- `npm run seed`: default command selects MySQL; repeated execution preserves the dataset.
- `npm start`: compiled application launches MySQL; health and SQL search were verified on a temporary port override.
- `npm run verify:dbms --prefix backend`: 6 clinics, 48 doctors, 737 patients, 6,195 linked appointments/tokens; no orphan links, mismatched states, duplicate active patient visits or duplicate current consultations.
- All statements in `backend/sql/003_demonstration_queries.sql` executed against the demo. Their captured output is in `mysql-query-output.txt`, including joins, aggregates, function, procedures, cursor, triggers, foreign keys and EXPLAIN.

Evidence files:
- [MySQL test output](mysql-test-output.txt)
- [Dataset verification](mysql-verification.json)
- [Executed SQL output](mysql-query-output.txt)
- [Gynecology directory sorted by fee](mysql-screenshots/01-gynecology-sql.jpg)
- [MySQL staff dashboard](mysql-screenshots/02-staff-dashboard.jpg)
- [Completed appointments selected by SQL](mysql-screenshots/03-completed-appointments-sql.jpg)
- [SQL-backed daily analytics](mysql-screenshots/04-mysql-insights.jpg)

The capacity regression was observed failing before the fix, then passed after the stored slot capacity was refreshed. Duplicate account identity insertion was also observed failing its protection test, then fixed to reject conflicts without overwriting an account.

These checks verify the local DBMS variant; they do not claim validation against real hospital data.
