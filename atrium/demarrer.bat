@echo off
REM Lanceur d'Atrium — Windows.
REM Double-cliquez sur ce fichier. Il installe ce qu'il faut a la premiere
REM utilisation, demarre l'application et ouvre votre navigateur.
setlocal
cd /d "%~dp0"

echo.
echo   Atrium
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js est requis et ne semble pas installe.
  echo   Installez-le depuis https://nodejs.org ^(version 20 ou plus^), puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo   Premiere utilisation : installation en cours ^(une a deux minutes^)...
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo   L'installation a echoue. Verifiez votre connexion et relancez.
    pause
    exit /b 1
  )
  echo.
)

echo   Demarrage...
echo   Adresse : http://localhost:3000
echo   Pour arreter : fermez cette fenetre, ou Ctrl+C.
echo.

start "" /b cmd /c "timeout /t 12 >nul & start http://localhost:3000"
call npm run dev
