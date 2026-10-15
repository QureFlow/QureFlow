$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$apkPath = Join-Path (Get-Location) 'artifacts\QureFlow-debug.apk'
if (-not (Test-Path -LiteralPath $apkPath)) { throw 'Build the APK first with npm run android:apk.' }
$sdkPath = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
if ($env:ANDROID_HOME) { $sdkPath = $env:ANDROID_HOME }
$jdkPath = Join-Path $env:LOCALAPPDATA 'QureFlow\tools\jdk-21'
if (Test-Path -LiteralPath $jdkPath) { $env:JAVA_HOME = $jdkPath }
$evidenceDir = Join-Path (Get-Location) 'docs\verification\local'
$mobileEnvPath = '.env.mobile'
if (Test-Path -LiteralPath '.env.mobile.local') { $mobileEnvPath = '.env.mobile.local' }
$apiLine = Get-Content -LiteralPath $mobileEnvPath | Where-Object { $_ -match '^VITE_API_GATEWAY_URL=' } | Select-Object -Last 1
$expectedApi = $apiLine.Substring('VITE_API_GATEWAY_URL='.Length).Trim()
if ($env:VITE_API_GATEWAY_URL) { $expectedApi = $env:VITE_API_GATEWAY_URL }
New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
& (Join-Path $sdkPath 'build-tools\36.0.0\apksigner.bat') verify --verbose --print-certs $apkPath *> (Join-Path $evidenceDir 'apk-signature.txt')
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
& (Join-Path $sdkPath 'build-tools\36.0.0\aapt.exe') dump badging $apkPath *> (Join-Path $evidenceDir 'apk-package.txt')
if ($LASTEXITCODE -ne 0) { throw 'APK package inspection failed.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
try {
    $required = @('AndroidManifest.xml','classes.dex','assets/public/index.html','assets/capacitor.config.json')
    foreach ($entry in $required) {
        if (-not $archive.GetEntry($entry)) { throw "APK is missing $entry" }
    }
    $assets = $archive.Entries | Where-Object { $_.FullName -like 'assets/public/assets/*.js' }
    $containsPhoneApi = $false
    foreach ($entry in $assets) {
        $reader = [System.IO.StreamReader]::new($entry.Open())
        try { $text = $reader.ReadToEnd() } finally { $reader.Dispose() }
        if ($text.Contains('qureflow_local_only') -or $text.Contains('qureflow_local_root_only')) {
            throw 'MySQL credentials were found in packaged frontend assets.'
        }
        if ($text.Contains($expectedApi)) { $containsPhoneApi = $true }
    }
    if (-not $containsPhoneApi) { throw 'Expected phone API URL is missing from this APK.' }
} finally { $archive.Dispose() }
$hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
$apkStream = [System.IO.File]::OpenRead($apkPath)
try {
    $apkSha256 = [BitConverter]::ToString($hashAlgorithm.ComputeHash($apkStream)).Replace('-', '')
} finally {
    $apkStream.Dispose()
    $hashAlgorithm.Dispose()
}
$report = [ordered]@{
    verifiedAt = [DateTime]::UtcNow.ToString('o')
    apk = $apkPath
    bytes = (Get-Item -LiteralPath $apkPath).Length
    sha256 = $apkSha256
    package = 'com.qureflow.dbms'
    signatureVerified = $true
    packagedFrontendVerified = $true
    mysqlCredentialsAbsent = $true
    defaultPhoneApi = $expectedApi
    nativeDeviceTested = $false
}
$report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $evidenceDir 'apk-verification.json') -Encoding utf8
$report | ConvertTo-Json
