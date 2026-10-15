param([switch]$Install)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$sdkPath = $env:ANDROID_HOME
if (-not $sdkPath) { $sdkPath = $env:ANDROID_SDK_ROOT }
if (-not $sdkPath) { $sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
if (-not (Test-Path (Join-Path $sdkPath 'platforms\android-36\android.jar'))) {
    throw 'Android SDK API 36 is missing. Install Android Studio and API 36 in SDK Manager, then rerun npm run android:apk.'
}
if (-not (Test-Path (Join-Path $sdkPath 'build-tools\36.0.0'))) {
    throw 'Android Build Tools 36.0.0 are missing. Install them in SDK Manager.'
}
# Prefer the compatible JDK bundled with Android Studio.
$studioJdk = 'C:\Program Files\Android\Android Studio\jbr'
if (Test-Path $studioJdk) { $env:JAVA_HOME = $studioJdk }
$portableJdk = Join-Path $env:LOCALAPPDATA 'QureFlow\tools\jdk-21'
if (-not (Test-Path $studioJdk) -and (Test-Path (Join-Path $portableJdk 'bin\javac.exe'))) {
    $env:JAVA_HOME = $portableJdk
}
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME 'bin\javac.exe'))) {
    throw 'Set JAVA_HOME to a JDK 21 installation or install Android Studio with its bundled JDK.'
}
$env:ANDROID_HOME = $sdkPath
& npm.cmd run android:sync
if ($LASTEXITCODE -ne 0) { throw 'Mobile build or Capacitor sync failed.' }
Push-Location android
try {
    & .\gradlew.bat assembleDebug
    if ($LASTEXITCODE -ne 0) { throw 'Gradle debug APK build failed.' }
} finally { Pop-Location }
$apkPath = Join-Path (Get-Location) 'android\app\build\outputs\apk\debug\app-debug.apk'
if (-not (Test-Path -LiteralPath $apkPath)) { throw 'Gradle succeeded but the debug APK is missing.' }
$artifactDir = Join-Path (Get-Location) 'artifacts'
New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
Copy-Item -LiteralPath $apkPath -Destination (Join-Path $artifactDir 'QureFlow-debug.apk') -Force
Write-Host "Debug APK: $apkPath"
Write-Host "Phone download: http://<computer-address>:5001/downloads/qureflow-debug.apk"
if ($Install) {
    & (Join-Path $sdkPath 'platform-tools\adb.exe') install -r $apkPath
    if ($LASTEXITCODE -ne 0) { throw 'APK installation failed. Check the connected device.' }
}
