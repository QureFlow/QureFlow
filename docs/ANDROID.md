# Android app

The Android app (`com.qureflow.app`) is the same React interface packaged with Capacitor. It
can reach the API in one of two ways, chosen at build time by `VITE_API_GATEWAY_URL` in
`.env.mobile` (or an ignored `.env.mobile.local`):

| `VITE_API_GATEWAY_URL` | Behaviour |
|---|---|
| An `https://` URL, e.g. your API Gateway stage | The app calls the cloud API directly. No discovery screen. |
| A local address, e.g. `http://10.0.2.2:5000/api` | The app finds a clinic computer on the same Wi-Fi automatically. |

The package ID changed from earlier builds, so an older QureFlow APK installs alongside this
one rather than updating it. Uninstall the old app if you no longer need it.

## Clinic computer on the same Wi-Fi

With Docker Desktop running:

```powershell
npm ci
npm ci --prefix backend
npm run db:up
npm run dev:demo
```

The demo server uses DynamoDB Local with synthetic records only and advertises itself on the
local network (`CLINIC_DISCOVERY=true`). Connect the phone and computer to the same Wi-Fi and
open **QureFlow**. One healthy server is selected automatically. Set `CLINIC_SERVER_NAME`
before starting the backend to give the computer a friendly name.

### How discovery works

- The API advertises `_qureflow._tcp` with mDNS/DNS-SD (UDP 5353). Android `NsdManager`
  resolves it and the app probes the advertised private IPv4 addresses.
- For phones hosting a hotspot, the app also sends bounded, nonce-checked UDP discovery
  requests to port 45831.
- Only the product name, database type, protocol version, an installation ID and candidate
  LAN addresses are advertised. The installation ID is stored in the ignored file
  `backend/.qureflow-server.local`. Patient data and credentials are never broadcast.
- An anonymous health probe verifies the product, protocol and installation ID before any
  session token is sent. Returning users stay with the installation they used before;
  switching installations needs an explicit choice and a fresh sign-in.
- Interrupted bookings are never replayed automatically.

Installation IDs are routing identifiers, not cryptographic server authentication. For
production, use the HTTPS cloud mode above.

### Troubleshooting

- Both devices must be on the same subnet. Guest or client-isolated Wi-Fi blocks discovery.
- Allow the API TCP port (default 5000) and UDP 5353/45831 through the computer's firewall on
  trusted networks only.
- **Advanced connection settings** accepts a manual address. For USB debugging, run
  `adb reverse tcp:5000 tcp:5000` and use `http://127.0.0.1:5000`.

## Build and verify

Requires a Java 21 JDK, Android SDK API 36, Build Tools 36.0.0 and Platform Tools.

```powershell
npm run test:frontend
npm run test:discovery
npm run android:apk
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-apk.ps1
```

`verify-apk.ps1` checks the signature, the packaged API address, the discovery UI, and that no
backend secret (AWS keys, Cognito client secret) is present in the packaged assets. Cleartext
HTTP to local addresses is allowed only in the debug build.

References: [Android NSD](https://developer.android.com/develop/connectivity/wifi/use-nsd),
[Capacitor local plugins](https://capacitorjs.com/docs/android/custom-code).
