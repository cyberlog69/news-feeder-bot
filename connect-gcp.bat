@echo off
:: ============================================================================
::  Google Cloud VM Smart 1-Click SSH Connect Script
::  Auto-connects with Google Cloud Key Management & Auto-IP Discovery!
:: ============================================================================

title GCP VM - newsfeedrvm (News Feeder Bot)
color 0A

:: ── CONFIGURATION ────────────────────────────────────────────────────────────
set "VM_NAME=newsfeedrvm"
set "GCP_USER=praveenkumarkp332"
:: ─────────────────────────────────────────────────────────────────────────────

cls
echo ================================================================
echo           CONNECTING TO GOOGLE CLOUD VM (%VM_NAME%)           
echo ================================================================
echo.

:: ── Strategy 1: Use native Google Cloud CLI SSH (100% foolproof & managed) ───
where gcloud >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [i] Google Cloud CLI detected.
    echo [^>] Connecting securely via gcloud compute ssh...
    echo.
    gcloud compute ssh %VM_NAME%
    if %ERRORLEVEL% equ 0 goto :done
    echo.
    echo [!] gcloud SSH failed. Attempting direct OpenSSH fallback...
    echo.
)

:: ── Strategy 2: Direct OpenSSH with key auto-discovery ───────────────────────
set "CACHE_FILE=%USERPROFILE%\.gcp_newsbot_ip"
set "GCP_IP="

:: Discover IP from gcloud if possible
where gcloud >nul 2>nul
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('gcloud compute instances list --filter="name=(%VM_NAME%)" --format="get(networkInterfaces[0].accessConfigs[0].natIP)" 2^>nul') do (
        set "GCP_IP=%%i"
    )
)

:: Fallback to cache if gcloud query was empty
if not defined GCP_IP (
    if exist "%CACHE_FILE%" (
        set /p GCP_IP=<"%CACHE_FILE%"
    )
)

:: Prompt if still unknown
if not defined GCP_IP (
    set /p "GCP_IP=Enter current GCP VM External IP: "
)

if defined GCP_IP (
    echo %GCP_IP%> "%CACHE_FILE%"
    echo [v] Target IP: %GCP_IP%
)

:: Auto-detect Google Cloud or standard SSH keys
set "KEY_FLAG="
if exist "%USERPROFILE%\.ssh\google_compute_engine" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\google_compute_engine"
) else if exist "%USERPROFILE%\.ssh\id_ed25519" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_ed25519"
) else if exist "%USERPROFILE%\.ssh\id_rsa" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_rsa"
)

echo [^>] Connecting via OpenSSH...
echo.

ssh -o StrictHostKeyChecking=accept-new %KEY_FLAG% %GCP_USER%@%GCP_IP%

:done
echo.
echo ================================================================
echo  SSH session ended.
echo ================================================================
pause
