@echo off
set NODE_ENV=production
set PORT=3001
cd /d "%~dp0"
node dist/main
