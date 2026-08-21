@echo off
title Instalador de Servicio de Windows - Comunio Bot
cd /d "%~dp0"

echo =================================================================
echo  Comunio Bot - Instalacion como Tarea de Sistema (Windows)
echo =================================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Este script requiere permisos de ADMINISTRADOR.
    echo Por favor, haz clic derecho sobre 'install_task.bat' y selecciona:
    echo "Ejecutar como administrador"
    echo.
    pause
    exit /b 1
)

echo [1/3] Finalizando cualquier instancia previa de daemon.js...
wmic process where "CommandLine like '%%daemon.js%%'" call terminate >nul 2>&1
schtasks /End /TN "ComunioBotDaemon" >nul 2>&1

echo [2/3] Creando tarea programada 'ComunioBotDaemon' en Windows...
schtasks /Create /TN "ComunioBotDaemon" /TR "\"C:\Program Files\nodejs\node.exe\" \"d:\racing-oslo-manager\src\daemon.js\"" /SC ONSTART /RU "SYSTEM" /RL HIGHEST /F

if %errorlevel% equ 0 (
    echo.
    echo [3/3] [EXITO] Tarea registrada correctamente.
    echo El bot arrancara automaticamente al iniciar Windows (Session 0)
    echo y permanecera activo en segundo plano sin importar la sesion RDP.
    echo.
    echo Iniciando tarea ahora mismo...
    schtasks /Run /TN "ComunioBotDaemon"
) else (
    echo.
    echo [ERROR] No se pudo crear la tarea programada.
)

pause
