# Mac Control MCP

Full Mac control for Claude agents (Cowork / Claude Desktop). Browser automation with persistent login sessions, native desktop control, app launching, and shell commands — all through the Model Context Protocol.

## One-Line Install

```bash
curl -fsSL https://raw.githubusercontent.com/timastras9/mac-control-mcp/Main/install.sh | bash
```

The installer handles everything:
- Clones the repo and installs dependencies
- Downloads Playwright Chromium
- Configures Claude Desktop automatically
- Walks you through macOS Accessibility permissions setup
- Verifies everything works

Or install manually:

```bash
git clone https://github.com/timastras9/mac-control-mcp.git ~/.mac-control-mcp
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
- Google Chrome (optional — falls back to bundled Chromium)
- Claude Desktop

## Accessibility Permissions

Some tools (keystroke, click_at, list_windows, get_active_app) require macOS Accessibility permissions. The installer sets this up automatically, but if you need to do it manually:

1. Open **System Settings > Privacy & Security > Accessibility**
2. Click **+** and press **Cmd+Shift+G**
3. Type `/usr/bin/osascript` and hit Enter — select it and click Open
4. Toggle it **ON**
5. Repeat for your `node` binary (run `which node` to find the path)

## Tools (22)

### Browser (12)

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

### System (6)

| Tool | Description |
|------|-------------|
| `open_app` | Open any Mac application by name |
| `run_command` | Run shell commands, return output |
| `read_screen` | Screenshot the entire Mac screen |
| `notification` | Show a macOS notification |
| `clipboard_read` | Read clipboard contents |
| `clipboard_write` | Write text to clipboard |

### Desktop Control (4) — requires Accessibility

| Tool | Description |
|------|-------------|
| `keystroke` | Send keystrokes to any app (with modifiers) |
| `click_at` | Click at screen x,y coordinates |
| `get_active_app` | Get frontmost app name and window title |
| `list_windows` | List all visible windows with position/size |

## How It Works

Uses Playwright with a **persistent Chrome profile** at `~/.mac-control-mcp/browser-data/`. All your Google logins, cookies, and sessions are preserved — no re-authentication needed.

Desktop control tools use macOS native `osascript` (AppleScript) for keystroke injection, coordinate clicking, and window enumeration.

The `--disable-blink-features=AutomationControlled` flag prevents sites from detecting automation.

## Uninstall

```bash
rm -rf ~/.mac-control-mcp
```

Remove `"mac-control"` from your Claude Desktop config.

## License

MIT — NSI Corp
