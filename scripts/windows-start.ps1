$ErrorActionPreference = "Stop"
$root = "C:\chzzk"
$paperDir = "$root\paper"
$scripts = "$root\scripts"

function Ensure-ScheduledTask {
    param(
        [string]$Name,
        [string]$BatPath
    )
    $existing = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $Name -Confirm:$false
    }
    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BatPath`"" -WorkingDirectory (Split-Path $BatPath)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
    Register-ScheduledTask -TaskName $Name -Action $action -Principal $principal -Settings $settings -Force | Out-Null
}

# Bridge build (sync)
$envFile = "$root\.env"
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { return }
    $name = $Matches[1]
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$name" -Value $value
}
$env:CHZZK_TOKEN_STORE = "$root\bridge\.chzzk-tokens.json"

Set-Location "$root\bridge"
if (-not (Test-Path node_modules)) { npm install }
npm run build
if ($env:CHZZK_REFRESH_TOKEN -and -not (Test-Path $env:CHZZK_TOKEN_STORE)) {
    npm run auth -- --refresh-token $env:CHZZK_REFRESH_TOKEN
}
Write-Host "Bridge built"

Ensure-ScheduledTask -Name "ChzzkPaper" -BatPath "$scripts\start-paper.bat"
$bridgeStarter = "$scripts\start-bridge.ps1"
$bridgeAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$bridgeStarter`"" -WorkingDirectory "$root\bridge"
$bridgePrincipal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
$bridgeSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
$existingBridge = Get-ScheduledTask -TaskName "ChzzkBridge" -ErrorAction SilentlyContinue
if ($existingBridge) { Unregister-ScheduledTask -TaskName "ChzzkBridge" -Confirm:$false }
Register-ScheduledTask -TaskName "ChzzkBridge" -Action $bridgeAction -Principal $bridgePrincipal -Settings $bridgeSettings -Force | Out-Null

# Stop stale tasks/processes on paper ports
Get-NetTCPConnection -LocalPort 25565,29371 -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

Start-ScheduledTask -TaskName "ChzzkPaper"
Write-Host "Scheduled ChzzkPaper"

$healthUrl = "http://127.0.0.1:29371/chzzk/donations/health"
$ready = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
        if ($resp.StatusCode -eq 200 -and $resp.Content -match '"status"\s*:\s*"ok"') {
            $ready = $true
            break
        }
    }
    catch {
        Start-Sleep -Seconds 2
    }
}
if (-not $ready) {
    throw "Paper webhook not ready. Check $paperDir\logs\latest.log"
}
Write-Host "Webhook health OK"

Start-ScheduledTask -TaskName "ChzzkBridge"
Write-Host "Scheduled ChzzkBridge"

Start-Sleep -Seconds 3
netstat -ano | findstr "25565 29371"
Write-Host "Done. Minecraft: 100.71.5.113:25565"
