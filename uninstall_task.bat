@echo off
title Desinstalador de Tarea Comunio Bot
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Este script requiere permisos de ADMINISTRADOR.
    echo Ejecutalo como administrador.
    pause
    exit /b 1
)

echo Eliminando tarea programada 'ComunioBotDaemon'...
schtasks /End /TN "ComunioBotDaemon" >nul 2>&1
schtasks /Delete /TN "ComunioBotDaemon" /F

echo Tarea eliminada correctamente.
pause
