@echo off
:: ============================================================================
::  Google Cloud VM Smart 1-Click SSH Connect Script
::  Connects directly to praveenkumarkp332@newsfeedrvm in us-east1-c
:: ============================================================================

title GCP VM - newsfeedrvm (News Feeder Bot)
color 0A

:: ── CONFIGURATION ────────────────────────────────────────────────────────────
set "VM_NAME=newsfeedrvm"
set "GCP_USER=praveenkumarkp332"
set "ZONE=us-east1-c"
:: ─────────────────────────────────────────────────────────────────────────────

cls
echo ================================================================
echo      CONNECTING TO GOOGLE CLOUD VM (%GCP_USER%@%VM_NAME%)       
echo ================================================================
echo.

:: ── Strategy 1: Native gcloud compute ssh with explicit user & zone ──────────
where gcloud >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [i] Google Cloud CLI detected.
    echo [^>] Connecting to %GCP_USER%@%VM_NAME% (%ZONE%)...
    echo.
    gcloud compute ssh %GCP_USER%@%VM_NAME% --zone=%ZONE%
    if %ERRORLEVEL% equ 0 goto :done
    echo.
    echo [!] gcloud SSH failed. Attempting direct OpenSSH fallback...
    echo.
)

:: ── Strategy 2: Direct OpenSSH fallback ──────────────────────────────────────
set "CACHE_FILE=%USERPROFILE%\.gcp_newsbot_ip"
set "GCP_IP=35.229.60.152"

:: Auto-query live IP from gcloud if available
where gcloud >nul 2>nul
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('gcloud compute instances list --filter="name=(%VM_NAME%)" --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2^>nul') do (
        set "GCP_IP=%%i"
    )
)

echo [v] Connecting via OpenSSH to %GCP_USER%@%GCP_IP%...
echo.

:: Auto-detect Google Cloud or standard SSH keys
set "KEY_FLAG="
if exist "%USERPROFILE%\.ssh\google_compute_engine" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\google_compute_engine"
) else if exist "%USERPROFILE%\.ssh\id_ed25519" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_ed25519"
) else if exist "%USERPROFILE%\.ssh\id_rsa" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_rsa"
)

ssh -o StrictHostKeyChecking=accept-new %KEY_FLAG% %GCP_USER%@%GCP_IP%

:done
echo.
echo ================================================================
echo  SSH session ended.
echo ================================================================
pause
