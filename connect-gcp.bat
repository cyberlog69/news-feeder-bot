@echo off
:: ============================================================================
::  Google Cloud VM Smart 1-Click SSH Connect Script
::  Connects directly to praveenkumarkp332@newsfeedrvm in us-east1-c
:: ============================================================================

title GCP VM - newsfeedrvm
color 0A

set "VM_NAME=newsfeedrvm"
set "GCP_USER=praveenkumarkp332"
set "ZONE=us-east1-c"

cls
echo ================================================================
echo      CONNECTING TO GOOGLE CLOUD VM: %GCP_USER%@%VM_NAME%
echo ================================================================
echo.
echo [i] Launching secure Google Cloud connection in zone %ZONE%...
echo.

call gcloud compute ssh %GCP_USER%@%VM_NAME% --zone=%ZONE%

echo.
echo ================================================================
echo  SSH session ended. Press any key to close this window.
echo ================================================================
pause >nul
