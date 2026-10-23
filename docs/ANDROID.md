# Android: automatic same-Wi-Fi connection

Install `artifacts/QureFlow-debug.apk` (version 1.3, code 4). The root
`QureFlow-debug.apk` is an identical convenience copy. The previous APK is
preserved locally as `artifacts/QureFlow-before-wifi-discovery.apk`.

## Start the computer

From this checkout, with Docker Desktop running:

```powershell
npm ci
npm ci --prefix backend
npm run db:up
npm run dev:dbms
```

Install dependencies after pulling this change. Keep the computer awake and its
API/database running. Connect the phone and computer to the same regular Wi-Fi,
then open **QureFlow DBMS**. One healthy server is selected automatically.
Normal startup does not require typing an IP address.

The first search takes several seconds. Later launches check the remembered
computer first. A changed address is rediscovered. With several QureFlow
computers, choose by display name. Set `DBMS_SERVER_NAME` before backend startup
to give a computer a friendly name.

Version 1.3 can update this computer's versions 1.1 and 1.2 normally.
**The original developer's version 1.0 uses a different debug signing certificate;
uninstall that version before installing this APK if Android rejects the update.**
This clears the phone's login/connection. Records in the computer's MySQL
database remain.

## Connection behaviour

The MySQL API advertises `_qureflow._tcp` using mDNS/DNS-SD (UDP 5353).
Android NsdManager resolves the service and the app probes private IPv4 addresses.
A bounded candidate list supports older Android and Docker/VPN adapters.
The computer refreshes the advertisement when interface addresses change.

Version 1.3 also sends bounded directed UDP discovery requests on Wi-Fi/hotspot
interfaces to port 45831. This runs alongside mDNS for phones hosting the hotspot.
Replies must match the request nonce; the API health/identity check still runs
before any session credentials are sent. This does not scan IP addresses or
change the database connection.

Only product, database, version, installation ID and local candidate addresses
are advertised. The ID is stored in ignored `backend/.qureflow-server.local`.
Keep this file for a stable installation identity; do not copy it to a separate
independent installation. Patient data, logins and SQL credentials are not broadcast.

Anonymous health probes verify the expected product/database/identity before
the API is selected. Returning users stay with their remembered installation.
Switching to another installation requires an explicit choice and fresh login.
API requests pause and in-flight calls are cancelled while connection identity
is checked. Revalidation happens on app resume, native network changes and
request failures. Temporary verification preserves the login; an invalid session
is cleared. Interrupted bookings are never replayed automatically: check
appointments before repeating the action. Doctor searches and shared directory
data reload automatically after verification; existing search filters are kept.
If a directory request fails, use **Retry loading doctors**.

This is local HTTP discovery for the DBMS demonstration. Installation IDs are
routing identifiers, not cryptographic server authentication. Production use
requires authenticated HTTPS and a deliberate clinic enrolment flow.

## Troubleshooting

- Keep both devices on the same subnet. Guest/client-isolated Wi-Fi may block
  communication even when the Wi-Fi name matches.
- If a firewall blocks discovery, allow the Node API TCP port (default 5001)
  and discovery UDP 5353/45831 on the trusted LAN. MySQL stays on loopback port 3307.
- The app offers **Search again** and retries while the no-server screen is visible.
  **Advanced connection settings** retains manual and USB support.
- For USB debugging, run `adb reverse tcp:5001 tcp:5001` and use
  `http://127.0.0.1:5001` in advanced settings.
- Run the updated backend as well as the updated APK. The old backend does not
  advertise itself.

## Build and verify

Use a JDK compatible with Java 21 and Gradle 8.14.3, Android SDK API 36,
Build Tools 36.0.0 and Platform Tools. Set JAVA_HOME/ANDROID_HOME when needed.
The default SDK location is `%LOCALAPPDATA%\Android\Sdk`.

```powershell
npm run test:mobile
npm run test:discovery
npm run android:apk
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-apk.ps1
```

Web and mobile outputs remain separate. Local HTTP/mixed content is enabled
only in the debug Android build; release protections remain.

## Phone acceptance checks

These require an Android phone; build/signature inspection does not prove device behaviour.

| Check | Expected |
|---|---|
| Fresh install, API running, same Wi-Fi | Finds computer without typing IP |
| Close and reopen APK | Reuses healthy remembered computer |
| Change computer IP | Finds same installation at new address |
| Switch phone Wi-Fi while app stays open | Pauses calls and revalidates |
| Two QureFlow computers | Offers named choices; remembers selected installation |
| Stop API, then restart it | Shows connection state and finds it on a later search |
| Interrupt a booking | Never silently repeats it; check appointments before retry |
| Open/leave advanced settings without changing server | Preserves valid session |
| Book/cancel an appointment | Server validation and MySQL persistence still apply |
| Android 7–13 with Docker/VPN on computer | Probes announced LAN candidates |
| Phone hosts hotspot, laptop joins it | Attempts direct broadcast discovery as well as mDNS |

Verification details and environment limitations:
`docs/verification/local/wifi-discovery-verification.md`.

References: [Android NSD](https://developer.android.com/develop/connectivity/wifi/use-nsd),
[Capacitor local plugins](https://capacitorjs.com/docs/android/custom-code).
