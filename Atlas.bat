@echo off
title Atlas
cd /d E:\Antigravity\Atlas\backend
start /min cmd /c "venv\Scripts\activate && uvicorn main:app --port 8000"
cd /d E:\Antigravity\Atlas\frontend
start /min cmd /c "npm run dev"
timeout /t 4 /nobreak > nul
start http://localhost:5173
exit