# Android local demonstration

The signed debug APK is in `artifacts/QureFlow-debug.apk`; the Android project is in `android/`. Capacitor 8 packages the existing React UI; the app calls Express, and Express owns every MySQL connection. No MySQL password is packaged in Android. This computer's APK is configured for `http://172.16.145.76:5001/api`. The source `.env.mobile` defaults to the emulator alias `http://10.0.2.2:5001/api`; ignored `.env.mobile.local` overrides it for the physical phone.

## Install the supplied APK

Copy `artifacts/QureFlow-debug.apk` to your Android phone and open it to install. Alternatively, with the phone and computer on the same Wi-Fi and QureFlow running, open `http://172.16.145.76:5001/downloads/qureflow-debug.apk` on the phone to download the APK file. Follow Android's installation prompt for the source used to open this file.

Open **QureFlow DBMS** from the phone's apps. Keep Docker and the API running on the computer. Use the demo patient account `demo.patient@example.invalid` / `DemoPatient123!`, or the staff account `demo.staff@example.invalid` / `DemoClinic123!`.

If the computer's IP changes, tap **Clinic connection** inside the installed app, enter its current address such as `http://172.16.145.76:5001`, then tap **Test and connect**. This verifies the server without sending the previous session token, saves the new address and signs you out. Only local computer addresses are accepted. No APK rebuild is needed for this address change.

## Build and install

On this computer, the official SDK command-line tools, API 36, Build Tools 35/36 and Platform Tools are installed under `%LOCALAPPDATA%\Android\Sdk`. Verified Temurin Java 21 is under `%LOCALAPPDATA%\QureFlow\tools\jdk-21`; the build script detects it automatically. Android Studio is optional for building this APK with the command line. On another computer, Android Studio 2025.2.1 or later can install the matching SDK and JDK; select API 36 and Build Tools 36.0.0 in SDK Manager.

```powershell
npm run db:up
npm run dev:dbms
# In a second terminal:
npm run android:sync
npm run android:open
# Or compile the installable APK from PowerShell:
npm run android:apk
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`.

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\android\app\build\outputs\apk\debug\app-debug.apk
```

Keep the API and Docker running during the demonstration. Rebuild and sync after frontend or API URL changes. Web output remains in `dist`; mobile output is separate in `dist-mobile`.

## Physical phone over USB

Enable USB debugging on your own phone and connect it to the computer. Accept the computer's debugging authorization on the phone, then run:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:5001 tcp:5001
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r .\artifacts\QureFlow-debug.apk
```

In the installed app, set **Clinic connection** to `http://127.0.0.1:5001` for USB. USB avoids opening a firewall port. For a same-network phone instead, set the computer's private IPv4 address in Clinic connection and allow only the API port 5001 on your private network if Windows blocks it. MySQL stays on `127.0.0.1:3307`. CORS allows the packaged origin `https://localhost`; extra development origins can be specified with `DBMS_CORS_ORIGINS`.

Debug-only Android resources permit local HTTP, and `MainActivity` enables HTTP mixed content only for `BuildConfig.DEBUG`. A release deployment requires an HTTPS API configured in `.env.mobile.local`. Android backup is disabled; authentication tokens remain in session storage and logout clears them.

## Device acceptance checks

These require a real emulator or phone; a mobile browser screenshot is not native-device verification.

| ID | Action | Expected result |
|---|---|---|
| M01 | Launch debug APK with computer API running | Directory shows 48 synthetic doctors |
| M02 | Login as demo patient; type with Android keyboard | Inputs remain usable; form scrolls above keyboard |
| M03 | Open doctor and booking; use system Back | Returns through app routes; root Back minimizes app |
| M04 | Book an available slot for tomorrow | Success appears only after API accepts; SQL shows linked appointment and token |
| M05 | Reload app, reopen appointments | Booking persists in MySQL |
| M06 | Cancel booking | Both SQL statuses become cancelled; bookedCount decreases |
| M07 | Login as staff and inspect queue | Correct clinic only; polling reflects current queue |
| M08 | Stop API, then restart it and tap Retry | Connection error is visible; data recovers without duplicate booking |
| M09 | Logout; attempt to reopen protected route | Login is required |

Current verification: Gradle `assembleDebug` passed; APK signature, package manifest, embedded frontend, configured phone API URL and absence of MySQL credentials were verified. Six connection-configuration tests and 24 MySQL regression cases passed. Logs are in `docs/verification/local/android-apk-build.txt`, `apk-signature.txt`, `apk-package.txt`, `apk-verification.json` and `mobile-connection-tests.txt`. No phone/emulator was attached during verification, so the device acceptance table remains unexecuted.

References: [Capacitor installation](https://capacitorjs.com/docs/getting-started), [environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup), [Android networking](https://developer.android.com/studio/run/emulator-networking-address), [Android network security](https://developer.android.com/privacy-and-security/security-config).
