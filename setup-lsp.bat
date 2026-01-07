@echo off
REM ===============================================
REM LSP Setup Script for Trading Simulator Project
REM ===============================================
REM Windows Batch script
REM Automatically installs and configures TypeScript LSP
REM ===============================================

setlocal enabledelayedexpansion

echo.
echo ================================================
echo     LSP Setup for Trading Simulator
echo ================================================
echo.

REM Check if Claude Code is installed
echo [1/6] Checking Claude Code installation...
where claude >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Claude Code CLI is not installed
    echo Please install Claude Code first: https://claude.ai/code
    exit /b 1
)
echo [OK] Claude Code is installed
echo.

REM Check if project directories exist
echo [2/6] Verifying project structure...
if not exist "client" (
    echo [ERROR] client directory not found
    echo Must run this script from project root
    exit /b 1
)
if not exist "server" (
    echo [ERROR] server directory not found
    echo Must run this script from project root
    exit /b 1
)
echo [OK] Project structure verified
echo.

REM Install npm dependencies
echo [3/6] Installing npm dependencies...
echo Installing client dependencies...
cd client
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install client dependencies
    exit /b 1
)
cd ..
echo.
echo Installing server dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install server dependencies
    exit /b 1
)
cd ..
echo [OK] npm dependencies installed
echo.

REM Add marketplace if not exists
echo [4/6] Configuring Claude Code marketplace...
claude plugin marketplace list | findstr /C:"claude-code-lsps" >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Marketplace already configured
) else (
    echo Adding claude-code-lsps marketplace...
    claude plugin marketplace add boostvolt/claude-code-lsps
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to add marketplace
        exit /b 1
    )
    echo [OK] Marketplace added
)
echo.

REM Install vtsls plugin
echo [5/6] Installing TypeScript LSP plugin...
if exist ".claude\settings.json" (
    findstr /C:"vtsls" .claude\settings.json >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] vtsls plugin already installed
    ) else (
        echo Installing vtsls@claude-code-lsps...
        claude plugin install vtsls@claude-code-lsps --scope project
        if !errorlevel! neq 0 (
            echo [ERROR] Failed to install vtsls plugin
            exit /b 1
        )
        echo [OK] vtsls plugin installed
    )
) else (
    echo Installing vtsls@claude-code-lsps...
    claude plugin install vtsls@claude-code-lsps --scope project
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install vtsls plugin
        exit /b 1
    )
    echo [OK] vtsls plugin installed
)
echo.

REM Verify configuration
echo [6/6] Verifying LSP configuration...

REM Check .claude/settings.json
if not exist ".claude\settings.json" (
    echo [ERROR] .claude\settings.json not found
    exit /b 1
)
echo [OK] .claude\settings.json exists

findstr /C:"vtsls@claude-code-lsps" .claude\settings.json >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] vtsls plugin not enabled in settings
    exit /b 1
)
echo [OK] vtsls plugin is enabled

REM Check ESLint configs
if not exist "client\.eslintrc.cjs" (
    echo [ERROR] Client ESLint config missing
    exit /b 1
)
echo [OK] Client ESLint config exists

if not exist "server\eslint.config.js" (
    echo [ERROR] Server ESLint config missing
    exit /b 1
)
echo [OK] Server ESLint config exists

echo.
echo ================================================
echo          LSP Setup Complete!
echo ================================================
echo.
echo What's installed:
echo   - TypeScript LSP (vtsls) - Type-aware navigation
echo   - ESLint - Code quality analysis
echo   - Client dependencies - React + Vite
echo   - Server dependencies - Express + TypeScript
echo.
echo LSP Capabilities:
echo   - Type-aware code navigation
echo   - Intelligent autocomplete
echo   - Real-time diagnostics
echo   - Go to definition / Find references
echo.
echo Test your setup:
echo   cd client ^&^& npm run lint
echo   cd server ^&^& npm run lint
echo   cd client ^&^& npx tsc --noEmit
echo.
echo Documentation:
echo   - LSP_SETUP.md - Configuration guide
echo   - LSP_TEST_RESULTS.md - Test results
echo.
echo NOTE: You may need to restart your Claude Code session
echo       for the LSP plugin to fully activate.
echo.
pause
