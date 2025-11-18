@echo off
echo 🚀 Starting CosmicRaid Local Services Manually
echo.

echo 1️⃣ Starting ngrok tunnel on port 3300...
start "ngrok" ngrok http 3300

echo    ⏳ Waiting 5 seconds for ngrok to start...
timeout /t 5 /nobreak > nul

echo.
echo 2️⃣ Starting dev server on port 3300...
echo    💡 This will open in a new window
start "CosmicRaid Dev Server" cmd /k "npm run dev:hosted"

echo.
echo ✅ Services started!
echo 📡 Check ngrok dashboard: http://localhost:4040
echo 🎬 Dev server will be at: http://localhost:3300
echo.
echo 💡 After both services are running, run: node fix-tunnel.js
pause