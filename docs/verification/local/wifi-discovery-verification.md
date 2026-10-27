# Wi-Fi discovery verification

Verified on 16 October 2026 (IST) in the local MySQL worktree.

## Hotspot discovery fallback: 19 October 2026 (IST)

Version 1.3 / code 4 adds a nonce-matched local UDP discovery fallback alongside
mDNS for the phone-hosted hotspot case. Requests are bounded to local Wi-Fi/AP
interfaces, do not scan hosts and contain no authentication credentials.
Replies contain only public installation routing metadata. Workers and sockets
are stopped on cancellation or timeout; responses still require an anonymous
API health/identity match.

Five discovery tests and all 18 mobile tests pass. A live unicast request and a
directed broadcast on the laptop Wi-Fi both received a response from the running
backend; the returned API identity matched its health response. Backend compile,
Gradle build, APK signature and packaged hotspot protocol checks pass.
Independent review found no blockers. Actual Android hotspot routing requires
installing the new APK on the user's phone; it is not marked device-verified.

## Directory recovery fix: 19 October 2026 (IST)

The phone could reach the running health endpoint and the API returned 48 doctors.
A React component regression reproduced a cancelled doctor search leaving the
directory empty after native connection verification completed.

Version 1.2 / code 3 refreshes directory options, filtered searches and shared
read-only data after verification, preserving filters. It adds an explicit
directory retry. Mutation requests are not replayed.

All 18 mobile tests pass, including the reproduced component regression.
Web/backend/mobile builds, Gradle assembleDebug and APK inspection pass.
A focused independent review found no blockers. Final phone UI acceptance
still requires installing this new APK.

## Follow-up: Docker restored, 18 October 2026 (IST)

- Docker engine 29.7.2 is reachable; the MySQL 8.4 container is healthy.
- All 24 MySQL integration cases pass (25 Node test entries including the parent).
  Fresh output is in wifi-mysql-tests.txt.
- Both discovery tests pass beside the running backend. The test now uses a
  temporary installation identity, avoiding a name collision with the live clinic.
- A separate mDNS browser found the actual API on port 5001; its LAN health
  response matched the advertised identity and allowed the Android app origin.
- The frontend returns HTTP 200 at http://localhost:5174 and the MySQL backend
  is running on port 5001 with Wi-Fi discovery enabled.
- No APK code changed in this follow-up. The previously built APK remains current.

The Docker/MySQL limitation recorded below is resolved. Physical-phone
acceptance remains pending; the AWS local-DynamoDB suite was not rerun.

## Passed

- 17 mobile/client tests: automatic discovery, saved endpoint, changed IP, reused IP,
  multiple installations, anonymous health probes, invalid responses, private URL
  validation, request suspension/cancellation, no mutation replay and session preservation.
- Two discovery tests: bounded Unicode DNS labels and an actual mDNS exchange
  resolving to the Express health endpoint, including Android-origin CORS.
- Eight insights tests and ten announcement tests.
- TypeScript, web/backend build, mobile build and Gradle assembleDebug.
- APK signature, package inspection, packaged frontend/native discovery and absence
  of the local SQL credentials from the frontend.
- Focused independent review; reported lifecycle, interface-selection and DNS-label
  issues were fixed and rechecked.

Current APK: version 1.3 / code 4, package com.qureflow.dbms.
SHA-256: CB073EA40A28AF177B95D190EE9A39115A2EE5DEDC5AC5A64173648603FEDECF

Logs: wifi-mobile-tests.txt, wifi-discovery-tests.txt, wifi-web-build.txt,
wifi-android-build.txt, apk-signature.txt, apk-package.txt and apk-verification.json.

## Previous run limitations (16 October)

No Android phone or emulator was attached (adb devices returned an empty list).
Phone-to-computer Wi-Fi acceptance therefore remains unexecuted. The real mDNS
test ran on this computer; it does not prove that a particular router allows
device-to-device multicast.

Docker Desktop failed before its Linux engine started, reporting an inaccessible
sailor-ingest.sock. The regular Docker restart also failed to stop its stale
processes. Automatic approval review blocked a force-restart attempt with the
reason “blocked by policy”; no more specific reason was supplied. No factory
reset, database deletion, or firewall changes were performed.

The MySQL suite could not run without Docker's engine. The AWS regression command
also could not run because isolated DynamoDB at 127.0.0.1:18000 was unavailable.
These are environment limitations, not passing database regression results.
The normal backend was consequently not running at the end of that run.
The follow-up above records its successful startup after Docker was reopened.

The previous developer's APK uses a different signing certificate. It must be
uninstalled before this build is installed; the server's SQL records are retained.
No commits, pushes, cloud database writes or deployments were performed.
