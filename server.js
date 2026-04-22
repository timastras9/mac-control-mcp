#!/usr/bin/env node
/**
 * Mac Control MCP — Full Mac control for Claude agents.
 *
 * Tools:
 *   browser_navigate  — Go to a URL
 *   browser_click      — Click an element by selector or text
 *   browser_type       — Type text into a field
 *   browser_screenshot — Take a screenshot
 *   browser_read       — Read page text content
 *   browser_evaluate   — Run JavaScript on the page
 *   browser_tabs       — List open tabs
 *   browser_close_tab  — Close a tab
 *   open_app           — Open any Mac application
 *   run_command        — Run a shell command
 *   read_screen        — Take a full screenshot of the Mac screen
 *
 * Uses Playwright with persistent Chrome profile so Google auth
 * and all cookies are preserved. No login needed.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";
import { execSync, exec } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, resolve } from "path";
import { tmpdir } from "os";
import { homedir } from "os";

const SCREENSHOTS_DIR = join(tmpdir(), "mac-control-screenshots");
if (!existsSync(SCREENSHOTS_DIR)) mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let context = null;
let page = null;

async function ensureBrowser() {
  if (context) {
    try {
      context.pages();
    } catch {
      context = null;
      page = null;
    }
  }

  if (context) {
    if (!page || page.isClosed()) {
      const pages = context.pages();
      page = pages.length > 0 ? pages[pages.length - 1] : await context.newPage();
    }
    return;
  }

  const userDataDir = join(homedir(), ".mac-control-mcp", "browser-data");
  mkdirSync(userDataDir, { recursive: true });

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      channel: "chrome",
      viewport: { width: 1440, height: 900 },
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
  } catch {
    // Fallback to bundled Chromium if Chrome channel fails
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      viewport: { width: 1440, height: 900 },
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-first-run",
        "--no-default-browser-check",
      ],
      ignoreDefaultArgs: ["--enable-automation"],
    });
  }

  const pages = context.pages();
  page = pages.length > 0 ? pages[0] : await context.newPage();
}

async function getPage() {
  await ensureBrowser();
  return page;
}

// ═══ HELPERS ═══

function escapeAppleScript(str) {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getKeyCode(keyName) {
  const codes = {
    return: 36, tab: 48, escape: 53, space: 49, delete: 51,
    up: 126, down: 125, left: 123, right: 124,
    f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
    f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
    home: 115, end: 119, pageup: 116, pagedown: 121,
    enter: 36, backspace: 51, forwarddelete: 117,
  };
  return codes[keyName.toLowerCase()] || 0;
}

// ═══ MCP SERVER ═══

const server = new Server(
  { name: "mac-control-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "browser_navigate",
      description: "Navigate the browser to a URL. Opens Chrome if not running.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to navigate to" },
        },
        required: ["url"],
      },
    },
    {
      name: "browser_click",
      description: "Click an element on the page by CSS selector or visible text.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector or text to click" },
          text: { type: "string", description: "Visible text to find and click (alternative to selector)" },
        },
      },
    },
    {
      name: "browser_type",
      description: "Type text into an input field.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector of the input field" },
          text: { type: "string", description: "Text to type" },
          clear: { type: "boolean", description: "Clear the field before typing (default true)" },
          pressEnter: { type: "boolean", description: "Press Enter after typing (default false)" },
        },
        required: ["selector", "text"],
      },
    },
    {
      name: "browser_screenshot",
      description: "Take a screenshot of the current page.",
      inputSchema: {
        type: "object",
        properties: {
          fullPage: { type: "boolean", description: "Capture full page (default false)" },
        },
      },
    },
    {
      name: "browser_read",
      description: "Read the text content of the current page or a specific element.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector to read (optional, reads whole page if omitted)" },
          maxLength: { type: "number", description: "Max characters to return (default 5000)" },
        },
      },
    },
    {
      name: "browser_evaluate",
      description: "Run JavaScript code on the current page and return the result.",
      inputSchema: {
        type: "object",
        properties: {
          script: { type: "string", description: "JavaScript code to evaluate" },
        },
        required: ["script"],
      },
    },
    {
      name: "browser_tabs",
      description: "List all open browser tabs.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "browser_switch_tab",
      description: "Switch to a different browser tab by index.",
      inputSchema: {
        type: "object",
        properties: {
          index: { type: "number", description: "Tab index (0-based)" },
        },
        required: ["index"],
      },
    },
    {
      name: "browser_new_tab",
      description: "Open a new browser tab, optionally navigating to a URL.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL to open (optional)" },
        },
      },
    },
    {
      name: "browser_close_tab",
      description: "Close the current browser tab.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "browser_wait",
      description: "Wait for an element to appear on the page.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector to wait for" },
          timeout: { type: "number", description: "Max wait time in ms (default 10000)" },
        },
        required: ["selector"],
      },
    },
    {
      name: "browser_scroll",
      description: "Scroll the page up or down.",
      inputSchema: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down", "top", "bottom"], description: "Scroll direction" },
          amount: { type: "number", description: "Pixels to scroll (default 500)" },
        },
        required: ["direction"],
      },
    },
    {
      name: "open_app",
      description: "Open any Mac application by name.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Application name (e.g. 'Safari', 'Terminal', 'Finder')" },
        },
        required: ["name"],
      },
    },
    {
      name: "run_command",
      description: "Run a shell command on the Mac and return the output.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Shell command to execute" },
          timeout: { type: "number", description: "Timeout in ms (default 30000)" },
        },
        required: ["command"],
      },
    },
    {
      name: "read_screen",
      description: "Take a screenshot of the entire Mac screen (not just browser).",
      inputSchema: {
        type: "object",
        properties: {
          display: { type: "number", description: "Display number (default 1, main screen)" },
        },
      },
    },
    {
      name: "keystroke",
      description: "Send keystrokes to the frontmost application via AppleScript. Requires Accessibility permission.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to type" },
          key: { type: "string", description: "Special key name (e.g. 'return', 'tab', 'escape', 'space', 'delete')" },
          modifiers: { type: "array", items: { type: "string", enum: ["command", "shift", "option", "control"] }, description: "Modifier keys to hold" },
          app: { type: "string", description: "Target application name (optional, uses frontmost if omitted)" },
        },
      },
    },
    {
      name: "click_at",
      description: "Click at specific screen coordinates. Requires Accessibility permission.",
      inputSchema: {
        type: "object",
        properties: {
          x: { type: "number", description: "X coordinate" },
          y: { type: "number", description: "Y coordinate" },
          button: { type: "string", enum: ["left", "right"], description: "Mouse button (default left)" },
          doubleClick: { type: "boolean", description: "Double-click (default false)" },
        },
        required: ["x", "y"],
      },
    },
    {
      name: "get_active_app",
      description: "Get the name and window title of the frontmost application.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "list_windows",
      description: "List all visible windows with their app name, title, position, and size.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "notification",
      description: "Show a macOS notification.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title" },
          message: { type: "string", description: "Notification body text" },
          sound: { type: "boolean", description: "Play sound (default true)" },
        },
        required: ["title", "message"],
      },
    },
    {
      name: "clipboard_read",
      description: "Read the current contents of the Mac clipboard.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "clipboard_write",
      description: "Write text to the Mac clipboard.",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to copy to clipboard" },
        },
        required: ["text"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "browser_navigate": {
        const p = await getPage();
        let url = args.url;
        if (!url.startsWith("http")) url = "https://" + url;
        await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        const title = await p.title();
        return result(`Navigated to ${url} — "${title}"`);
      }

      case "browser_click": {
        const p = await getPage();
        if (args.text) {
          await p.getByText(args.text, { exact: false }).first().click({ timeout: 5000 });
          return result(`Clicked text: "${args.text}"`);
        }
        if (args.selector) {
          await p.click(args.selector, { timeout: 5000 });
          return result(`Clicked: ${args.selector}`);
        }
        return error("Provide either 'selector' or 'text'");
      }

      case "browser_type": {
        const p = await getPage();
        if (args.clear !== false) {
          await p.fill(args.selector, args.text);
        } else {
          await p.type(args.selector, args.text);
        }
        if (args.pressEnter) {
          await p.press(args.selector, "Enter");
        }
        return result(`Typed "${args.text.substring(0, 50)}..." into ${args.selector}`);
      }

      case "browser_screenshot": {
        const p = await getPage();
        const path = join(SCREENSHOTS_DIR, `screenshot_${Date.now()}.png`);
        await p.screenshot({ path, fullPage: args.fullPage || false });
        const data = readFileSync(path).toString("base64");
        return {
          content: [
            { type: "text", text: `Screenshot saved: ${path}` },
            { type: "image", data, mimeType: "image/png" },
          ],
        };
      }

      case "browser_read": {
        const p = await getPage();
        const maxLen = args.maxLength || 5000;
        let text;
        if (args.selector) {
          text = await p.locator(args.selector).first().innerText({ timeout: 5000 });
        } else {
          text = await p.innerText("body");
        }
        return result(text.substring(0, maxLen));
      }

      case "browser_evaluate": {
        const p = await getPage();
        const res = await p.evaluate(args.script);
        return result(JSON.stringify(res, null, 2));
      }

      case "browser_tabs": {
        await ensureBrowser();
        const pages = context.pages();
        const tabs = await Promise.all(
          pages.map(async (p, i) => ({
            index: i,
            url: p.url(),
            title: await p.title().catch(() => ""),
            active: p === page,
          }))
        );
        return result(JSON.stringify(tabs, null, 2));
      }

      case "browser_switch_tab": {
        await ensureBrowser();
        const pages = context.pages();
        if (args.index < 0 || args.index >= pages.length) {
          return error(`Tab index ${args.index} out of range (0-${pages.length - 1})`);
        }
        page = pages[args.index];
        await page.bringToFront();
        return result(`Switched to tab ${args.index}: ${page.url()}`);
      }

      case "browser_new_tab": {
        await ensureBrowser();
        page = await context.newPage();
        if (args.url) {
          let url = args.url;
          if (!url.startsWith("http")) url = "https://" + url;
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        }
        return result(`New tab opened${args.url ? ": " + args.url : ""}`);
      }

      case "browser_close_tab": {
        await ensureBrowser();
        if (page) await page.close();
        const pages = context.pages();
        page = pages.length > 0 ? pages[pages.length - 1] : await context.newPage();
        return result("Tab closed");
      }

      case "browser_wait": {
        const p = await getPage();
        await p.waitForSelector(args.selector, { timeout: args.timeout || 10000 });
        return result(`Element found: ${args.selector}`);
      }

      case "browser_scroll": {
        const p = await getPage();
        const amount = args.amount || 500;
        switch (args.direction) {
          case "down": await p.mouse.wheel(0, amount); break;
          case "up": await p.mouse.wheel(0, -amount); break;
          case "top": await p.evaluate("window.scrollTo(0, 0)"); break;
          case "bottom": await p.evaluate("window.scrollTo(0, document.body.scrollHeight)"); break;
        }
        return result(`Scrolled ${args.direction}`);
      }

      case "open_app": {
        execSync(`open -a "${args.name}"`, { timeout: 5000 });
        return result(`Opened ${args.name}`);
      }

      case "run_command": {
        const timeout = args.timeout || 30000;
        const output = execSync(args.command, {
          timeout,
          encoding: "utf-8",
          maxBuffer: 1024 * 1024,
        });
        return result(output.substring(0, 10000));
      }

      case "read_screen": {
        const path = join(SCREENSHOTS_DIR, `screen_${Date.now()}.png`);
        const display = args.display || 1;
        execSync(`screencapture -x -D ${display} "${path}"`, { timeout: 5000 });
        const data = readFileSync(path).toString("base64");
        return {
          content: [
            { type: "text", text: `Screen capture saved: ${path}` },
            { type: "image", data, mimeType: "image/png" },
          ],
        };
      }

      case "keystroke": {
        let script = "";
        const target = args.app ? `application "${args.app}"` : "application (path to frontmost application as text)";

        if (args.key) {
          const mods = (args.modifiers || []).map(m => `${m} down`).join(", ");
          const using = mods ? ` using {${mods}}` : "";
          script = `tell ${target} to activate
tell application "System Events" to key code ${getKeyCode(args.key)}${using}`;
        } else if (args.text) {
          if (args.modifiers && args.modifiers.length > 0) {
            const mods = args.modifiers.map(m => `${m} down`).join(", ");
            script = `tell ${target} to activate
tell application "System Events" to keystroke "${escapeAppleScript(args.text)}" using {${mods}}`;
          } else {
            script = `tell ${target} to activate
tell application "System Events" to keystroke "${escapeAppleScript(args.text)}"`;
          }
        } else {
          return error("Provide either 'text' or 'key'");
        }

        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 5000 });
        return result(`Keystroke sent${args.app ? ` to ${args.app}` : ""}`);
      }

      case "click_at": {
        const btn = args.button === "right" ? "right" : "left";
        const clickCmd = args.doubleClick ? "double click" : "click";
        const btnPart = btn === "right" ? " using secondary mouse button" : "";
        const script = `tell application "System Events" to ${clickCmd} at {${args.x}, ${args.y}}${btnPart}`;
        try {
          execSync(`osascript -e '${script}'`, { timeout: 5000 });
        } catch {
          execSync(`cliclick ${btn === "right" ? "rc" : (args.doubleClick ? "dc" : "c")}:${args.x},${args.y}`, { timeout: 5000 });
        }
        return result(`Clicked at (${args.x}, ${args.y})`);
      }

      case "get_active_app": {
        const appName = execSync(
          `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
          { encoding: "utf-8", timeout: 5000 }
        ).trim();
        let windowTitle = "";
        try {
          windowTitle = execSync(
            `osascript -e 'tell application "System Events" to get title of front window of first application process whose frontmost is true'`,
            { encoding: "utf-8", timeout: 5000 }
          ).trim();
        } catch {}
        return result(JSON.stringify({ app: appName, window: windowTitle }));
      }

      case "list_windows": {
        const script = `
          set windowList to ""
          tell application "System Events"
            set allProcs to every application process whose visible is true
            repeat with proc in allProcs
              set procName to name of proc
              try
                set wins to every window of proc
                repeat with w in wins
                  set wTitle to title of w
                  set wPos to position of w
                  set wSize to size of w
                  set windowList to windowList & procName & " | " & wTitle & " | " & (item 1 of wPos) & "," & (item 2 of wPos) & " | " & (item 1 of wSize) & "x" & (item 2 of wSize) & "\n"
                end repeat
              end try
            end repeat
          end tell
          return windowList`;
        const output = execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, {
          encoding: "utf-8",
          timeout: 10000,
        }).trim();
        const windows = output.split("\n").filter(Boolean).map(line => {
          const [app, title, pos, size] = line.split(" | ");
          const [x, y] = (pos || "0,0").split(",").map(Number);
          const [w, h] = (size || "0x0").split("x").map(Number);
          return { app, title, x, y, width: w, height: h };
        });
        return result(JSON.stringify(windows, null, 2));
      }

      case "notification": {
        const sound = args.sound !== false ? 'sound name "default"' : "";
        const script = `display notification "${escapeAppleScript(args.message)}" with title "${escapeAppleScript(args.title)}" ${sound}`;
        execSync(`osascript -e '${script.replace(/'/g, "'\\''")}'`, { timeout: 5000 });
        return result(`Notification sent: ${args.title}`);
      }

      case "clipboard_read": {
        const text = execSync("pbpaste", { encoding: "utf-8", timeout: 5000 });
        return result(text.substring(0, 10000));
      }

      case "clipboard_write": {
        execSync(`echo "${args.text.replace(/"/g, '\\"')}" | pbcopy`, { timeout: 5000 });
        return result(`Copied ${args.text.length} chars to clipboard`);
      }

      default:
        return error(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return error(`${name} failed: ${e.message}`);
  }
});

function result(text) {
  return { content: [{ type: "text", text }] };
}

function error(text) {
  return { content: [{ type: "text", text: `Error: ${text}` }], isError: true };
}

// ═══ START ═══

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mac-control-mcp] Server running");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});

// Clean up on exit
process.on("SIGINT", async () => {
  if (context) await context.close().catch(() => {});
  process.exit(0);
});
process.on("SIGTERM", async () => {
  if (context) await context.close().catch(() => {});
  process.exit(0);
});
