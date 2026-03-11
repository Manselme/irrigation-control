@echo off
setlocal ENABLEDELAYEDEXPANSION

echo ==========================================
echo  Système de contrôle d'irrigation - Setup
echo ==========================================
echo.

REM --- Vérification de Node.js ---
where node >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] Node.js n'est pas installe ou n'est pas dans le PATH.
  echo         Installez Node.js depuis https://nodejs.org puis relancez ce script.
  goto :END
) else (
  for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
  echo [OK] Node.js detecte : !NODE_VERSION!
)

REM --- Vérification de npm ---
where npm >nul 2>&1
if errorlevel 1 (
  echo [ERREUR] npm n'est pas installe ou n'est pas dans le PATH.
  echo         npm est fourni avec Node.js. Verifiez votre installation.
  goto :END
) else (
  for /f "tokens=*" %%v in ('npm -v') do set NPM_VERSION=%%v
  echo [OK] npm detecte : !NPM_VERSION!
)

echo.
echo Installation des dependances npm...
echo (cette operation peut prendre quelques minutes)
echo.
npm install
if errorlevel 1 (
  echo.
  echo [ERREUR] npm install a echoue. Verifiez les messages ci-dessus.
  goto :END
)

REM --- Copie .env.example vers .env.local si absent ---
if not exist ".env.local" (
  if exist ".env.example" (
    echo.
    echo Copie de .env.example vers .env.local ...
    copy /Y ".env.example" ".env.local" >nul
    echo [OK] Fichier .env.local cree.
    echo.
    echo IMPORTANT : ouvrez le fichier .env.local et renseignez vos
    echo           valeurs Firebase (NEXT_PUBLIC_FIREBASE_*) avant de lancer l'app.
  ) else (
    echo.
    echo [INFO] Aucun fichier .env.example trouve. Vous devrez creer .env.local manuellement.
  )
) else (
  echo.
  echo [OK] Fichier .env.local deja present. Aucune copie effectuee.
)

echo.
echo ==========================================
echo  Setup termine
echo ==========================================
echo.
echo Pour lancer le serveur de developpement :
echo    npm run dev
echo.
echo Conseille :
echo  - Utiliser Visual Studio Code
echo  - Installer les extensions : ESLint, Tailwind CSS IntelliSense, Prettier
echo.

:END
echo Appuyez sur une touche pour fermer...
pause >nul
endlocal

