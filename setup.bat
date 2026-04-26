@echo off
echo ============================================
echo   Click - Customs ^& Freight Setup (SQLite)
echo ============================================
echo.
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    echo         Required: Node.js 18+ with npm
    pause & exit /b 1
)
echo [OK] Node.js found

:: Check for native build tools (needed for better-sqlite3)
echo.
echo [INFO] Installing dependencies (includes native SQLite module)...
echo [INFO] If this fails, you may need to install Windows Build Tools:
echo         npm install -g windows-build-tools
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] npm install failed.
    echo [TIP]  Try: npm install -g windows-build-tools
    echo         Then run this script again.
    pause & exit /b 1
)
echo.
echo ============================================
echo   Setup complete!
echo ============================================
echo.
echo   Data stored in: %%APPDATA%%\click-customs-freight\data\click.db
echo.
echo   npm run electron:dev         - Run desktop app (dev)
echo   npm run electron:build:win   - Build .exe installer
echo.
set /p choice="Run desktop app now? (Y/N): "
if /i "%choice%"=="Y" call npm run electron:dev
pause
