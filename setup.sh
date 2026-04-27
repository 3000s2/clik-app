#!/bin/bash
echo "============================================"
echo "  Click - Customs & Freight Setup (SQLite)"
echo "============================================"
if ! command -v node &> /dev/null; then echo "[ERROR] Node.js not found. Install from https://nodejs.org"; exit 1; fi
echo "[OK] Node.js $(node --version)"
echo ""
echo "[INFO] Installing dependencies (includes native SQLite module)..."
echo "[INFO] macOS: Xcode Command Line Tools required (xcode-select --install)"
echo ""
npm install || { echo "[ERROR] npm install failed. Try: xcode-select --install (macOS)"; exit 1; }
echo ""
echo "Setup complete!"
echo "  Data: ~/Library/Application Support/click-customs-freight/data/click.db"
echo ""
echo "  npm run electron:dev         - Run desktop app (dev)"
echo "  npm run electron:build:mac   - Build .dmg installer"
echo ""
read -p "Run desktop app now? (y/n): " choice
if [ "$choice" = "y" ] || [ "$choice" = "Y" ]; then npm run electron:dev; fi
