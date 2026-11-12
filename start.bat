@echo off
rem Double-click to preview the Mountain Courtyard hero locally.
cd /d "%~dp0"
start "" http://localhost:5173/
python serve.py --port 5173
pause
