# scripts/run-docker.ps1
$ErrorActionPreference = "Stop"

# Resolve root directory of the repository
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$rootDir = (Get-Item (Join-Path $scriptDir "..")).FullName
Set-Location $rootDir

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   Chzzk Minecraft Local Docker Testing Tool" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Check or Create .env file at root
$envFile = Join-Path $rootDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "No .env file found. Creating a default .env file for local testing..." -ForegroundColor Yellow
    $defaultEnv = @"
# --- Minecraft Configuration ---
EULA=true
MINECRAFT_WEBHOOK_SECRET=dev-secret-key-1234

# --- CHZZK Configuration ---
CHZZK_CLIENT_ID=mock-client-id
CHZZK_CLIENT_SECRET=mock-client-secret
CHZZK_CHANNEL_ID=mock-channel-id
CHZZK_REFRESH_TOKEN=
"@
    Set-Content -Path $envFile -Value $defaultEnv -Encoding utf8
    Write-Host "Created .env with default values." -ForegroundColor Green
} else {
    Write-Host "Found existing .env file." -ForegroundColor Green
}

# 2. Load environment variables into the script session
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { return }
    $name = $Matches[1]
    $value = $Matches[2].Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$name" -Value $value
}

function Show-Menu {
    Write-Host ""
    Write-Host "Please select an option:" -ForegroundColor Yellow
    Write-Host "1) Start FULL Stack (Paper Server + Chzzk Bridge) in Docker" -ForegroundColor White
    Write-Host "2) Start PAPER-ONLY (No Chzzk credentials required, ideal for local webhook simulation)" -ForegroundColor White
    Write-Host "3) Send Simulated Donation (signed webhook) to Paper Server" -ForegroundColor White
    Write-Host "4) Check Webhook Server Health" -ForegroundColor White
    Write-Host "5) Stop and Cleanup Docker Containers" -ForegroundColor White
    Write-Host "6) Exit" -ForegroundColor White
    Write-Host ""
}

while ($true) {
    Show-Menu
    $choice = Read-Host "Enter option [1-6]"

    switch ($choice) {
        "1" {
            Write-Host "Starting FULL Stack (Paper + Bridge)..." -ForegroundColor Cyan
            docker compose -f docker-compose.yml up --build -d
            Write-Host "Docker containers are starting in background!" -ForegroundColor Green
            Write-Host "Use Option 4 to check readiness, or 'docker compose logs -f' to view logs." -ForegroundColor Gray
        }
        "2" {
            Write-Host "Starting PAPER-ONLY Stack..." -ForegroundColor Cyan
            docker compose -f docker-compose.paper.yml up --build -d
            Write-Host "Paper container is starting in background!" -ForegroundColor Green
            Write-Host "Use Option 4 to check readiness, or 'docker compose -f docker-compose.paper.yml logs -f' to view logs." -ForegroundColor Gray
        }
        "3" {
            try {
                $healthUrl = "http://127.0.0.1:29371/chzzk/donations/health"
                $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
                if ($resp.StatusCode -ne 200 -or $resp.Content -notmatch '"status"\s*:\s*"ok"') {
                    Write-Host "Warning: Webhook server health check failed. Containers might not be fully started yet." -ForegroundColor Yellow
                }
            } catch {
                Write-Host "Warning: Webhook server is not reachable at 127.0.0.1:29371. Ensure containers are running." -ForegroundColor Yellow
            }

            Write-Host "Select Donation Tier Amount to Simulate:" -ForegroundColor Yellow
            Write-Host "1) 1,000  (RANDOM_BUFF)"
            Write-Host "2) 2,000  (RANDOM_ITEM)"
            Write-Host "3) 3,000  (RANDOM_MOB)"
            Write-Host "4) 5,000  (COMBAT_MOB)"
            Write-Host "5) 10,000 (THREE_COMBAT_MOBS)"
            Write-Host "6) 30,000 (TNT)"
            Write-Host "7) 50,000 (RANDOM_TELEPORT)"
            Write-Host "8) 100,000 (KILL_TARGET)"
            $tierChoice = Read-Host "Select tier [1-8]"
            $amounts = @(1000, 2000, 3000, 5000, 10000, 30000, 50000, 100000)
            if ($tierChoice -as [int] -and ($tierChoice -ge 1 -and $tierChoice -le 8)) {
                $amount = $amounts[$tierChoice - 1]
                Write-Host "Preparing to send simulated $amount KRW donation..." -ForegroundColor Cyan
                
                $bridgeDir = Join-Path $rootDir "bridge"
                if (-not (Test-Path (Join-Path $bridgeDir "node_modules"))) {
                    Write-Host "Installing bridge node_modules first..." -ForegroundColor Gray
                    Push-Location $bridgeDir
                    npm install
                    Pop-Location
                }
                
                $env:MINECRAFT_WEBHOOK_URL = "http://127.0.0.1:29371/chzzk/donations"
                npm --prefix bridge run e2e:webhook -- --amount $amount
            } else {
                Write-Host "Invalid tier choice." -ForegroundColor Red
            }
        }
        "4" {
            Write-Host "Checking health of Paper Webhook server..." -ForegroundColor Cyan
            try {
                $healthUrl = "http://127.0.0.1:29371/chzzk/donations/health"
                $resp = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 3
                if ($resp.StatusCode -eq 200 -and $resp.Content -match '"status"\s*:\s*"ok"') {
                    Write-Host "SUCCESS: Webhook server is ONLINE and healthy!" -ForegroundColor Green
                    Write-Host "Response: $($resp.Content)" -ForegroundColor Gray
                } else {
                    Write-Host "FAILED: Webhook server returned status $($resp.StatusCode) or invalid content." -ForegroundColor Red
                    Write-Host "Response: $($resp.Content)" -ForegroundColor Gray
                }
            } catch {
                Write-Host "FAILED: Unable to connect to webhook server at 127.0.0.1:29371." -ForegroundColor Red
                Write-Host "Please ensure your containers are started and Paper server is fully loaded." -ForegroundColor Gray
            }
        }
        "5" {
            Write-Host "Stopping and cleaning up containers..." -ForegroundColor Cyan
            docker compose -f docker-compose.yml down -v
            docker compose -f docker-compose.paper.yml down -v
            Write-Host "Stopped all containers and removed temporary volumes." -ForegroundColor Green
        }
        "6" {
            Write-Host "Exiting. Happy testing!" -ForegroundColor Green
            break
        }
        default {
            Write-Host "Invalid choice. Please select 1-6." -ForegroundColor Red
        }
    }
}
