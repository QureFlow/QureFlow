# Verification on this computer

Executed 13 October 2026 against local synthetic data. The current run is identified by [local/latest.json](local/latest.json). Imported evidence outside local/ is historical unless explicitly refreshed.

- 24 MySQL integration cases passed (25 TAP entries including the parent).
- 8 frontend insights checks and 10 announcement checks passed.
- Web frontend/backend build, mobile build and Capacitor Android sync passed.
- Six mobile connection tests passed. Gradle built the actual APK; its signature, package and embedded assets passed verification, and the APK download endpoint returned matching bytes with the Android package MIME type.
- 65 AWS regression checks passed against isolated DynamoDB Local; the disposable table was removed. See aws-test-output-local.txt.
- Dataset verification: 6 clinics, 48 doctors, 737 patients, 6,195 appointments and 6,195 tokens. No orphan links, state mismatches, duplicate active patient/day visits or duplicate current doctor/day consultations.
- Both SQL demonstration files executed successfully. The transaction demonstration observed trigger synchronization, occupancy release, audit events, and zero remaining disposable rows after rollback.
- MySQL server: 8.4.11, schema qureflow_dbms, loopback port 3307.
- The initial APK preflight failed because the SDK was missing. The SDK and Java 21 were subsequently installed with user authorization, and Gradle `assembleDebug` passed. The signed APK is `artifacts/QureFlow-debug.apk`; signature/package/assets verification is recorded in `local/apk-verification.json`. Native device testing is not claimed because no phone/emulator was attached. See ../ANDROID.md for installation and acceptance steps.

Fresh run artifacts include test-cases.md, mysql-tests.txt, schema.json, data-dictionary.md, er-diagram.mmd, 003-sql.txt, 004-sql.txt and per-command results.json. See ../DBMS-DEMONSTRATION.md for inputs and expected outputs corresponding to every test ID.

The app API health endpoint reports mysql. No live AWS data or Cognito flows were accessed, and no report was generated.

During the final run, the Windows PowerShell validation helper could not find `Get-FileHash`. It was changed to compute SHA-256 through .NET and the exact validation command was rerun successfully; the latest result records this re-verification. The APK signature and build themselves passed throughout.

Eight browser checks were executed on this computer, including staff/patient sign-in, staff logout, analytics, a 390px patient layout without horizontal overflow, SQL doctor search, booking selection surviving Android sync, a browser-created booking surviving reload, and cancellation persisting in SQL. The additional cancelled demonstration visit brings the current dataset to 6,196 linked appointments/tokens; the initial seed count above remains 6,195.

The latest evidence directory includes `browser-results.json`, `browser-booking-before.txt`, `browser-booking-after.txt`, `dataset-after-browser.txt`, and fresh screenshots in `screenshots/`. `backend/sql/005_browser_booking_verification.sql` reproduces the browser booking query. Captured SQL showed appointment/token states booked/waiting with bookedCount 1, then cancelled/cancelled with bookedCount 0.
