@echo off
title TAKATA - Serveur (laisser cette fenetre ouverte)
color 0A
cd /d "%~dp0"
echo ============================================
echo   TAKATA - Serveur de l'application
echo   App : http://localhost:8080
echo   Ce serveur redemarre tout seul en cas de bug.
echo   Laissez cette fenetre ouverte pendant le travail.
echo ============================================
node server-watchdog.js
pause