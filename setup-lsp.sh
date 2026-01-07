#!/bin/bash

# ===============================================
# LSP Setup Script for Trading Simulator Project
# ===============================================
# This script automatically installs and configures
# the TypeScript LSP plugin for Claude Code
# ===============================================

set -e  # Exit on any error

echo "🚀 Starting LSP Setup for Trading Simulator..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Claude Code is installed
echo -e "${BLUE}[1/6]${NC} Checking Claude Code installation..."
if ! command -v claude &> /dev/null; then
    echo -e "${RED}❌ Error: Claude Code CLI is not installed${NC}"
    echo "Please install Claude Code first: https://claude.ai/code"
    exit 1
fi
echo -e "${GREEN}✅ Claude Code is installed${NC}"
echo ""

# Check if project directories exist
echo -e "${BLUE}[2/6]${NC} Verifying project structure..."
if [ ! -d "client" ] || [ ! -d "server" ]; then
    echo -e "${RED}❌ Error: Must run this script from project root${NC}"
    echo "Current directory: $(pwd)"
    exit 1
fi
echo -e "${GREEN}✅ Project structure verified${NC}"
echo ""

# Install npm dependencies
echo -e "${BLUE}[3/6]${NC} Installing npm dependencies..."
echo "Installing client dependencies..."
cd client && npm install && cd ..
echo ""
echo "Installing server dependencies..."
cd server && npm install && cd ..
echo -e "${GREEN}✅ npm dependencies installed${NC}"
echo ""

# Add marketplace if not exists
echo -e "${BLUE}[4/6]${NC} Configuring Claude Code marketplace..."
if claude plugin marketplace list 2>/dev/null | grep -q "claude-code-lsps"; then
    echo -e "${YELLOW}⚠️  Marketplace already configured${NC}"
else
    echo "Adding claude-code-lsps marketplace..."
    claude plugin marketplace add boostvolt/claude-code-lsps
    echo -e "${GREEN}✅ Marketplace added${NC}"
fi
echo ""

# Install vtsls plugin
echo -e "${BLUE}[5/6]${NC} Installing TypeScript LSP plugin..."
if [ -f ".claude/settings.json" ] && grep -q "vtsls" .claude/settings.json; then
    echo -e "${YELLOW}⚠️  vtsls plugin already installed${NC}"
else
    echo "Installing vtsls@claude-code-lsps..."
    claude plugin install vtsls@claude-code-lsps --scope project
    echo -e "${GREEN}✅ vtsls plugin installed${NC}"
fi
echo ""

# Verify configuration
echo -e "${BLUE}[6/6]${NC} Verifying LSP configuration..."

# Check .claude/settings.json
if [ -f ".claude/settings.json" ]; then
    echo -e "${GREEN}✅ .claude/settings.json exists${NC}"
    if grep -q '"vtsls@claude-code-lsps": true' .claude/settings.json; then
        echo -e "${GREEN}✅ vtsls plugin is enabled${NC}"
    else
        echo -e "${RED}❌ vtsls plugin not enabled in settings${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ .claude/settings.json not found${NC}"
    exit 1
fi

# Check ESLint configs
if [ -f "client/.eslintrc.cjs" ]; then
    echo -e "${GREEN}✅ Client ESLint config exists${NC}"
else
    echo -e "${RED}❌ Client ESLint config missing${NC}"
    exit 1
fi

if [ -f "server/eslint.config.js" ]; then
    echo -e "${GREEN}✅ Server ESLint config exists${NC}"
else
    echo -e "${RED}❌ Server ESLint config missing${NC}"
    exit 1
fi

echo ""
echo "=========================================="
echo -e "${GREEN}🎉 LSP Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "What's installed:"
echo "  ✅ TypeScript LSP (vtsls) - Type-aware navigation"
echo "  ✅ ESLint - Code quality analysis"
echo "  ✅ Client dependencies - React + Vite"
echo "  ✅ Server dependencies - Express + TypeScript"
echo ""
echo "LSP Capabilities:"
echo "  • Type-aware code navigation"
echo "  • Intelligent autocomplete"
echo "  • Real-time diagnostics"
echo "  • Go to definition / Find references"
echo ""
echo "Test your setup:"
echo "  $ cd client && npm run lint"
echo "  $ cd server && npm run lint"
echo "  $ cd client && npx tsc --noEmit"
echo ""
echo "Documentation:"
echo "  • LSP_SETUP.md - Configuration guide"
echo "  • LSP_TEST_RESULTS.md - Test results"
echo ""
echo -e "${YELLOW}⚠️  Note: You may need to restart your Claude Code session${NC}"
echo "    for the LSP plugin to fully activate."
echo ""
