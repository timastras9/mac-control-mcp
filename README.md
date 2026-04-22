# Mac Control MCP

Full Mac control for Claude agents (Cowork / Claude Desktop). Browser automation with persistent login sessions, app launching, and shell commands — all through the Model Context Protocol.

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/TimAstras/mac-control-mcp/Main/install.sh | bash
```

Or clone and install manually:

```bash
git clone https://github.com/TimAstras/mac-control-mcp.git ~/.mac-control-mcp
cd ~/.mac-control-mcp
npm install
npx playwright install chromium
```

Then add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mac-control": {
      "command": "node",
      "args": ["/Users/YOU/.mac-control-mcp/server.js"]
    }
  }
}
```

Restart Claude Desktop.

## Requirements

- macOS
- Node.js 18+
- Google Chrome (falls back to bundled Chromium)
- Claude Desktop

## Tools

### Browser

| Tool | Description |
|------|-------------|
| `browser_navigate` | Go to a URL. Opens Chrome if not running. |
| `browser_click` | Click by CSS selector or visible text |
| `browser_type` | Type into input fields, optional Enter |
| `browser_screenshot` | Capture page screenshot (returns image) |
| `browser_read` | Read text content of page or element |
| `browser_evaluate` | Run JavaScript on the page |
| `browser_tabs` | List all open tabs |
| `browser_switch_tab` | Switch to tab by index |
| `browser_new_tab` | Open new tab, optionally navigate |
| `browser_close_tab` | Close current tab |
| `browser_wait` | Wait for element to appear |
| `browser_scroll` | Scroll up/down/top/bottom |

### System

| Tool | Description |
|------|-------------|
| `open_app` | Open any Mac application by name |
| `run_command` | Run shell commands, return output |

## How It Works

Uses Playwright with a **persistent Chrome profile** at `~/.mac-control-mcp/browser-data/`. All your Google logins, cookies, and sessions are preserved — no re-authentication needed.

The `--disable-blink-features=AutomationControlled` flag prevents sites from detecting automation.

## Uninstall

```bash
rm -rf ~/.mac-control-mcp
```

Remove `"mac-control"` from your Claude Desktop config.

## License

MIT — NSI Corp
