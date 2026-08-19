@echo off
:: ============================================================================
::  Google Cloud VM Smart 1-Click SSH Connect Script
::  Connects securely to your Google Cloud VM instance.
::  Settings are stored in .gcp_config (git-ignored) for security.
:: ============================================================================

title GCP VM Connect
color 0A

:: ── Load from .gcp_config or .env if present ─────────────────────────────────
set "VM_NAME="
set "GCP_USER="
set "ZONE="

if exist "%~dp0.gcp_config" (
    for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.gcp_config") do (
        if /i "%%A"=="GCP_VM_NAME" set "VM_NAME=%%B"
        if /i "%%A"=="GCP_USER" set "GCP_USER=%%B"
        if /i "%%A"=="GCP_ZONE" set "ZONE=%%B"
    )
)

if not defined VM_NAME (
    if exist "%~dp0.env" (
        for /f "usebackq tokens=1,* delims==" %%A in ("%~dp0.env") do (
            if /i "%%A"=="GCP_VM_NAME" set "VM_NAME=%%B"
            if /i "%%A"=="GCP_USERNAME" set "GCP_USER=%%B"
            if /i "%%A"=="GCP_ZONE" set "ZONE=%%B"
        )
    )
)

:: ── Fallback Defaults & Setup Prompt ─────────────────────────────────────────
if not defined VM_NAME (
    cls
    echo ================================================================
    echo           FIRST-TIME GCP CONNECTION SETUP                       
    echo ================================================================
    echo.
    set /p "VM_NAME=Enter GCP VM Instance Name [default: newsfeedrvm]: "
    if not defined VM_NAME set "VM_NAME=newsfeedrvm"
    
    set /p "GCP_USER=Enter GCP SSH Username: "
    set /p "ZONE=Enter GCP Zone [default: us-east1-c]: "
    if not defined ZONE set "ZONE=us-east1-c"
    
    (
        echo # Local GCP Connection Settings ^(Ignored by Git for security^)
        echo GCP_VM_NAME=%VM_NAME%
        echo GCP_USER=%GCP_USER%
        echo GCP_ZONE=%ZONE%
    ) > "%~dp0.gcp_config"
    echo.
    echo [v] Configuration saved to .gcp_config
    echo.
)

if not defined ZONE set "ZONE=us-east1-c"

cls
echo ================================================================
echo      CONNECTING TO GOOGLE CLOUD VM: %GCP_USER%@%VM_NAME%
echo ================================================================
echo.
echo [i] Launching secure Google Cloud connection in zone %ZONE%...
echo.

if defined GCP_USER (
    call gcloud compute ssh %GCP_USER%@%VM_NAME% --zone=%ZONE%
) else (
    call gcloud compute ssh %VM_NAME% --zone=%ZONE%
)

echo.
echo ================================================================
echo  SSH session ended. Press any key to close this window.
echo ================================================================
pause >nul
