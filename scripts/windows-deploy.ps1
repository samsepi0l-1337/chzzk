$ErrorActionPreference = "Stop"
$root = "C:\chzzk"
$paperDir = "$root\paper"

New-Item -ItemType Directory -Force -Path "$paperDir\plugins\ChzzkDonation" | Out-Null

$paperJar = "$paperDir\paper.jar"
if (-not (Test-Path $paperJar)) {
    $url = "https://api.papermc.io/v2/projects/paper/versions/1.21.1/builds/133/downloads/paper-1.21.1-133.jar"
    Invoke-WebRequest -Uri $url -OutFile $paperJar -UseBasicParsing
    Write-Host "Downloaded Paper"
}
else {
    Write-Host "Paper jar exists"
}

$srcJar = "$root\plugin\build\libs\chzzk-donation-0.1.0.jar"
$dstJar = "$paperDir\plugins\chzzk-donation.jar"
if (-not (Test-Path $srcJar)) {
    throw "Missing plugin jar at $srcJar"
}
Copy-Item -Force $srcJar $dstJar
Write-Host "Plugin jar installed"

$envFile = "$root\.env"
if (-not (Test-Path $envFile)) {
    throw "Missing $envFile"
}
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { return }
    $name = $Matches[1]
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$name" -Value $value
}
if (-not $env:MINECRAFT_WEBHOOK_SECRET) {
    throw "MINECRAFT_WEBHOOK_SECRET missing"
}

$configPath = "$paperDir\plugins\ChzzkDonation\config.yml"
$secret = $env:MINECRAFT_WEBHOOK_SECRET
@"
webhook:
  host: "0.0.0.0"
  port: 29371
  path: "/chzzk/donations"
  shared-secret: |-
    $secret
sidebar:
  enabled: true
"@ | Set-Content -Encoding utf8 $configPath
Write-Host "Wrote plugin config"

"eula=true" | Set-Content -Encoding ascii "$paperDir\eula.txt"

Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
    Where-Object { $_.CommandLine -like "*$paperDir*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like "*$root\bridge*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Write-Host "Setup files OK"
