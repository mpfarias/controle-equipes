@echo off
title COPOM Mulher - Servidor
cd /d "%~dp0sistema"
set OPEN_BROWSER=0
echo [COPOM Mulher] A iniciar PostgreSQL local (5433) e servidor web (3001)...
call npm run up
pause
