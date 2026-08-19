@echo off
:: ============================================================================
::  Google Cloud VM Smart 1-Click SSH Connect Script
::  Auto-detects dynamic/ephemeral IP changes automatically!
:: ============================================================================

title GCP VM - newsfeedrvm (News Feeder Bot)
color 0A

:: ── CONFIGURATION ────────────────────────────────────────────────────────────
set "VM_NAME=newsfeedrvm"
set "GCP_USER=praveenkumarkp332"
set "ZONE="
:: ─────────────────────────────────────────────────────────────────────────────

cls
echo ================================================================
echo           CONNECTING TO GOOGLE CLOUD VM (%VM_NAME%)           
echo ================================================================
echo.

set "CACHE_FILE=%USERPROFILE%\.gcp_newsbot_ip"
set "GCP_IP="

:: ── Strategy 1: Check if Google Cloud CLI is available to fetch live IP ──────
where gcloud >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [i] Querying live IP from Google Cloud API...
    for /f "tokens=*" %%i in ('gcloud compute instances list --filter="name=(%VM_NAME%)" --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2^>nul') do (
        set "GCP_IP=%%i"
    )
)

:: ── Strategy 2: If gcloud found the IP, save to cache ────────────────────────
if defined GCP_IP (
    echo %GCP_IP%> "%CACHE_FILE%"
    echo [v] Live IP discovered: %GCP_IP%
) else (
    :: Fallback: read from cache file if available
    if exist "%CACHE_FILE%" (
        set /p GCP_IP=<"%CACHE_FILE%"
        echo [i] Using cached IP: %GCP_IP%
    )
)

:: ── Strategy 3: Prompt if IP is still unknown ────────────────────────────────
if not defined GCP_IP (
    echo [!] Could not auto-detect IP.
    set /p "GCP_IP=Enter current GCP VM External IP: "
    if defined GCP_IP (
        echo %GCP_IP%> "%CACHE_FILE%"
    )
)

echo.
echo [i] Target:   %GCP_USER%@%GCP_IP%
echo.

:: Detect SSH Keys
set "KEY_FLAG="
if exist "%USERPROFILE%\.ssh\id_ed25519" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_ed25519"
) else if exist "%USERPROFILE%\.ssh\id_rsa" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_rsa"
)

echo [^>] Establishing SSH connection...
echo.

ssh -o StrictHostKeyChecking=accept-new %KEY_FLAG% %GCP_USER%@%GCP_IP%

if %ERRORLEVEL% neq 0 (
    echo.
    echo [!] Connection failed. The VM IP may have changed after restart.
    if exist "%CACHE_FILE%" del "%CACHE_FILE%"
)

echo.
echo ================================================================
echo  SSH session ended.
echo ================================================================
pause
