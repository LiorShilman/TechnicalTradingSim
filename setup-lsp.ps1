# ===============================================
# LSP Setup Script for Trading Simulator Project
# ===============================================
# PowerShell script for Windows
# Automatically installs and configures TypeScript LSP
# ===============================================

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting LSP Setup for Trading Simulator..." -ForegroundColor Cyan
Write-Host ""

# Check if Claude Code is installed
Write-Host "[1/6] Checking Claude Code installation..." -ForegroundColor Blue
try {
    $claudeVersion = claude --version 2>&1
    Write-Host "✅ Claude Code is installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: Claude Code CLI is not installed" -ForegroundColor Red
    Write-Host "Please install Claude Code first: https://claude.ai/code" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

# Check if project directories exist
Write-Host "[2/6] Verifying project structure..." -ForegroundColor Blue
if (-not (Test-Path "client") -or -not (Test-Path "server")) {
    Write-Host "❌ Error: Must run this script from project root" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Project structure verified" -ForegroundColor Green
Write-Host ""

# Install npm dependencies
Write-Host "[3/6] Installing npm dependencies..." -ForegroundColor Blue
Write-Host "Installing client dependencies..."
Push-Location client
npm install
Pop-Location
Write-Host ""
Write-Host "Installing server dependencies..."
Push-Location server
npm install
Pop-Location
Write-Host "✅ npm dependencies installed" -ForegroundColor Green
Write-Host ""

# Add marketplace if not exists
Write-Host "[4/6] Configuring Claude Code marketplace..." -ForegroundColor Blue
$marketplaceList = claude plugin marketplace list 2>&1 | Out-String
if ($marketplaceList -match "claude-code-lsps") {
    Write-Host "⚠️  Marketplace already configured" -ForegroundColor Yellow
} else {
    Write-Host "Adding claude-code-lsps marketplace..."
    claude plugin marketplace add boostvolt/claude-code-lsps
    Write-Host "✅ Marketplace added" -ForegroundColor Green
}
Write-Host ""

# Install vtsls plugin
Write-Host "[5/6] Installing TypeScript LSP plugin..." -ForegroundColor Blue
if ((Test-Path ".claude/settings.json") -and (Get-Content ".claude/settings.json" | Select-String "vtsls")) {
    Write-Host "⚠️  vtsls plugin already installed" -ForegroundColor Yellow
} else {
    Write-Host "Installing vtsls@claude-code-lsps..."
    claude plugin install vtsls@claude-code-lsps --scope project
    Write-Host "✅ vtsls plugin installed" -ForegroundColor Green
}
Write-Host ""

# Verify configuration
Write-Host "[6/6] Verifying LSP configuration..." -ForegroundColor Blue

# Check .claude/settings.json
if (Test-Path ".claude/settings.json") {
    Write-Host "✅ .claude/settings.json exists" -ForegroundColor Green
    $settings = Get-Content ".claude/settings.json" -Raw
    if ($settings -match '"vtsls@claude-code-lsps": true') {
        Write-Host "✅ vtsls plugin is enabled" -ForegroundColor Green
    } else {
        Write-Host "❌ vtsls plugin not enabled in settings" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ .claude/settings.json not found" -ForegroundColor Red
    exit 1
}

# Check ESLint configs
if (Test-Path "client/.eslintrc.cjs") {
    Write-Host "✅ Client ESLint config exists" -ForegroundColor Green
} else {
    Write-Host "❌ Client ESLint config missing" -ForegroundColor Red
    exit 1
}

if (Test-Path "server/eslint.config.js") {
    Write-Host "✅ Server ESLint config exists" -ForegroundColor Green
} else {
    Write-Host "❌ Server ESLint config missing" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🎉 LSP Setup Complete!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "What's installed:"
Write-Host "  ✅ TypeScript LSP (vtsls) - Type-aware navigation"
Write-Host "  ✅ ESLint - Code quality analysis"
Write-Host "  ✅ Client dependencies - React + Vite"
Write-Host "  ✅ Server dependencies - Express + TypeScript"
Write-Host ""
Write-Host "LSP Capabilities:"
Write-Host "  • Type-aware code navigation"
Write-Host "  • Intelligent autocomplete"
Write-Host "  • Real-time diagnostics"
Write-Host "  • Go to definition / Find references"
Write-Host ""
Write-Host "Test your setup:"
Write-Host "  PS> cd client; npm run lint"
Write-Host "  PS> cd server; npm run lint"
Write-Host "  PS> cd client; npx tsc --noEmit"
Write-Host ""
Write-Host "Documentation:"
Write-Host "  • LSP_SETUP.md - Configuration guide"
Write-Host "  • LSP_TEST_RESULTS.md - Test results"
Write-Host ""
Write-Host "⚠️  Note: You may need to restart your Claude Code session" -ForegroundColor Yellow
Write-Host "    for the LSP plugin to fully activate."
Write-Host ""
