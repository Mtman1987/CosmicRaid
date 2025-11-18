@echo off
title Cosmic Raid Local Services
echo 🚀 Starting Cosmic Raid Local Services...

REM Kill existing processes
taskkill /f /im ngrok.exe >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3300') do taskkill /f /pid %%a >nul 2>&1

REM Wait a moment
timeout /t 2 /nobreak >nul

REM Start the service
start "Service" cmd /k "npm run dev:hosted"

REM Wait for service to start
timeout /t 8 /nobreak >nul

echo ✅ Service running on http://localhost:3300
echo 📋 To create tunnel, get new authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
echo 📋 Then run: ngrok http 3300
echo.
echo 🔧 For now, use LOCAL_CONVERSION_SERVICE_URL=http://localhost:3300 for local testing

pause