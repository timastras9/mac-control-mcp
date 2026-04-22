#!/bin/bash
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}Mac Control MCP — Installer${NC}"
echo ""

# Check Node.js
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

# Determine install directory
INSTALL_DIR="${MAC_CONTROL_DIR:-$HOME/.mac-control-mcp}"

if [ -d "$INSTALL_DIR" ]; then
  echo -e "  Updating existing install at ${BOLD}$INSTALL_DIR${NC}"
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || true
else
  echo -e "  Installing to ${BOLD}$INSTALL_DIR${NC}"
  git clone https://github.com/TimAstras/mac-control-mcp.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# Install dependencies
echo ""
echo -e "${CYAN}Installing dependencies...${NC}"
npm install --production

# Install Playwright Chromium
echo ""
echo -e "${CYAN}Installing Playwright browser...${NC}"
npx playwright install chromium

# Configure Claude Desktop
CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"

echo ""
echo -e "${CYAN}Configuring Claude Desktop...${NC}"

if [ ! -d "$CONFIG_DIR" ]; then
  mkdir -p "$CONFIG_DIR"
fi

SERVER_PATH="$INSTALL_DIR/server.js"

if [ -f "$CONFIG_FILE" ]; then
  # Check if mac-control already exists
  if grep -q '"mac-control"' "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} mac-control already in Claude Desktop config"
  else
    # Add mac-control to existing mcpServers
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
  # Create new config
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

echo ""
echo -e "${GREEN}${BOLD}Installation complete!${NC}"
echo ""
echo -e "  ${BOLD}Restart Claude Desktop${NC} to activate the MCP server."
echo ""
echo -e "  Cowork will now have access to these tools:"
echo -e "    browser_navigate, browser_click, browser_type, browser_screenshot,"
echo -e "    browser_read, browser_evaluate, browser_tabs, browser_switch_tab,"
echo -e "    browser_new_tab, browser_close_tab, browser_wait, browser_scroll,"
echo -e "    open_app, run_command"
echo ""
echo -e "  ${CYAN}To uninstall:${NC}"
echo -e "    rm -rf $INSTALL_DIR"
echo -e "    Remove \"mac-control\" from $CONFIG_FILE"
