@echo off
:: ============================================================================
::  Google Cloud VM 1-Click SSH Connect Script
::  Double-click this file anytime to connect directly to your GCP VM!
:: ============================================================================

title GCP VM - newsfeedrvm (News Feeder Bot)
color 0A

:: ── CONFIGURATION (Update GCP_IP with your VM's External IP) ─────────────────
set "GCP_USER=praveenkumarkp332"
set "GCP_IP=YOUR_GCP_VM_EXTERNAL_IP"
:: ─────────────────────────────────────────────────────────────────────────────

cls
echo ================================================================
echo           CONNECTING TO GOOGLE CLOUD VM (newsfeedrvm)           
echo ================================================================
echo.

:: Check if user configured IP
if "%GCP_IP%"=="YOUR_GCP_VM_EXTERNAL_IP" (
    echo [!] GCP_IP is not set in this script yet.
    set /p "GCP_IP=Please enter your GCP VM External IP: "
)

echo [i] Username:  %GCP_USER%
echo [i] Server IP: %GCP_IP%
echo.

:: Check for SSH keys
set "KEY_FLAG="
if exist "%USERPROFILE%\.ssh\id_ed25519" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_ed25519"
) else if exist "%USERPROFILE%\.ssh\id_rsa" (
    set "KEY_FLAG=-i %USERPROFILE%\.ssh\id_rsa"
)

echo [^>] Connecting to GCP...
echo.

ssh %KEY_FLAG% %GCP_USER%@%GCP_IP%

echo.
echo ================================================================
echo  SSH session ended.
echo ================================================================
pause
