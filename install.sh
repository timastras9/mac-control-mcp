#!/bin/bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║     Mac Control MCP — Installer      ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""

# ─── Check Node.js ───
if ! command -v node &> /dev/null; then
  echo -e "${RED}Node.js not found.${NC} Install it from https://nodejs.org or:"
  echo "  brew install node"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}Node.js 18+ required.${NC} You have $(node -v)."
  exit 1
fi

echo -e "${GREEN}✓${NC} Node.js $(node -v)"

# ─── Check Google Chrome ───
if [ -d "/Applications/Google Chrome.app" ]; then
  echo -e "${GREEN}✓${NC} Google Chrome found"
else
  echo -e "${YELLOW}!${NC} Google Chrome not found — will use bundled Chromium"
fi

# ─── Clone / Update ───
INSTALL_DIR="${MAC_CONTROL_DIR:-$HOME/.mac-control-mcp}"

if [ -d "$INSTALL_DIR/.git" ]; then
  echo -e "  Updating existing install at ${BOLD}$INSTALL_DIR${NC}"
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || true
else
  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
  fi
  echo -e "  Installing to ${BOLD}$INSTALL_DIR${NC}"
  git clone https://github.com/timastras9/mac-control-mcp.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ─── Install dependencies ───
echo ""
echo -e "${CYAN}Installing dependencies...${NC}"
npm install --production 2>&1 | tail -1

# ─── Install Playwright Chromium ───
echo -e "${CYAN}Installing Playwright browser...${NC}"
npx playwright install chromium 2>&1 | tail -1
echo -e "${GREEN}✓${NC} Dependencies installed"

# ─── Configure Claude Desktop ───
CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

echo ""
echo -e "${CYAN}Configuring Claude Desktop...${NC}"

if [ ! -d "$CONFIG_DIR" ]; then
  mkdir -p "$CONFIG_DIR"
fi

SERVER_PATH="$INSTALL_DIR/server.js"

if [ -f "$CONFIG_FILE" ]; then
  if grep -q '"mac-control"' "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} mac-control already in Claude Desktop config"
  else
    node -e "
      const fs = require('fs');
      const config = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf-8'));
      if (!config.mcpServers) config.mcpServers = {};
      config.mcpServers['mac-control'] = {
        command: 'node',
        args: ['$SERVER_PATH']
      };
      fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
    "
    echo -e "${GREEN}✓${NC} Added mac-control to Claude Desktop config"
  fi
else
  cat > "$CONFIG_FILE" << CONF
{
  "mcpServers": {
    "mac-control": {
      "command": "node",
      "args": ["$SERVER_PATH"]
    }
  }
}
CONF
  echo -e "${GREEN}✓${NC} Created Claude Desktop config with mac-control"
fi

# ─── Accessibility Permissions ───
echo ""
echo -e "${CYAN}${BOLD}Setting up Accessibility permissions...${NC}"
echo ""

# Check if osascript already has accessibility
HAS_ACCESS=false
if osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' &>/dev/null; then
  HAS_ACCESS=true
fi

if [ "$HAS_ACCESS" = true ]; then
  echo -e "${GREEN}✓${NC} Accessibility permissions already granted"
else
  echo -e "${YELLOW}Accessibility permission needed for full Mac control.${NC}"
  echo -e "  (keystroke, click_at, list_windows, get_active_app)"
  echo ""
  echo -e "  Opening ${BOLD}System Settings > Privacy & Security > Accessibility${NC}..."
  echo ""

  # Open the Accessibility pane directly
  open "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"

  sleep 2

  echo -e "  ${BOLD}Follow these steps:${NC}"
  echo ""
  echo -e "  1. Click the ${BOLD}+${NC} button at the bottom of the list"
  echo -e "  2. Press ${BOLD}Cmd+Shift+G${NC} to open 'Go to Folder'"
  echo -e "  3. Type: ${BOLD}/usr/bin/osascript${NC} and hit Enter"
  echo -e "  4. Select ${BOLD}osascript${NC} and click ${BOLD}Open${NC}"
  echo -e "  5. Make sure the toggle next to it is ${GREEN}ON${NC}"
  echo ""
  echo -e "  ${YELLOW}Also add Node.js:${NC}"
  echo -e "  1. Click ${BOLD}+${NC} again"
  echo -e "  2. Press ${BOLD}Cmd+Shift+G${NC}"

  # Find the actual node binary path (resolve symlinks)
  NODE_PATH=$(which node)
  NODE_REAL=$(readlink -f "$NODE_PATH" 2>/dev/null || python3 -c "import os; print(os.path.realpath('$NODE_PATH'))")
  echo -e "  3. Type: ${BOLD}${NODE_REAL}${NC} and hit Enter"
  echo -e "  4. Select ${BOLD}node${NC} and click ${BOLD}Open${NC}"
  echo -e "  5. Make sure the toggle is ${GREEN}ON${NC}"
  echo ""

  # Wait for user
  read -p "  Press Enter once you've added both... "

  # Verify
  if osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' &>/dev/null; then
    echo ""
    echo -e "  ${GREEN}✓${NC} Accessibility permissions verified!"
  else
    echo ""
    echo -e "  ${YELLOW}!${NC} Could not verify permissions yet."
    echo -e "    You may need to ${BOLD}restart Terminal${NC} for them to take effect."
    echo -e "    The browser tools will work fine — only keystroke/click_at/list_windows"
    echo -e "    need Accessibility."
  fi
fi

# ─── Done ───
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║       Installation complete!          ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Restart Claude Desktop${NC} to activate."
echo ""
echo -e "  ${CYAN}22 tools available:${NC}"
echo -e "  Browser: navigate, click, type, screenshot, read, evaluate,"
echo -e "           tabs, switch_tab, new_tab, close_tab, wait, scroll"
echo -e "  System:  open_app, run_command, read_screen, notification,"
echo -e "           clipboard_read, clipboard_write"
echo -e "  Desktop: keystroke, click_at, get_active_app, list_windows"
echo ""
echo -e "  ${CYAN}To uninstall:${NC}"
echo -e "    rm -rf $INSTALL_DIR"
echo -e "    Remove \"mac-control\" from $CONFIG_FILE"
echo ""
