@echo off
rem ============================================================
rem  ODYSSEY - one-click launcher
rem  Starts a tiny local server (needed for ES modules) and
rem  opens the game in your default browser.
rem ============================================================
title ODYSSEY - The Long Way Home
cd /d "%~dp0"

echo Starting ODYSSEY...
start "" http://127.0.0.1:8391/index.html
node preview\server.js

echo.
echo (Server stopped - close this window when done playing.)
pause
