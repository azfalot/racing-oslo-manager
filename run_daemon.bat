@echo off
title Comunio Telegram Manager Daemon
echo =================================================================
echo Iniciando Comunio Telegram Daemon en segundo plano...
echo Mantenga esta ventana abierta para que el bot responda en Telegram
echo =================================================================
node src/daemon.js
pause
