// src/index.tsx
import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { loadConfig, getSessions, parseIndex, formatSessionLine } from "@zui/core";
import type { Config } from "@zui/core";
import { registerAltBindings, unregisterAltBindings } from "./ui/keybindings.js";

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function parseFocusArg(sub: string | undefined): string | undefined {
  if (!sub) return undefined;
  if (/^\d+$/.test(sub)) return sub;
  const m = sub.match(/^f(\d+)$/);
  if (m) return m[1];
  return undefined;
}

function handleList(config: Config): void {
  const sessions = getSessions(config);
  if (sessions.length === 0) {
    console.log("No sessions running");
    return;
  }
  console.log("  #  Session                        Status  Running  Preview");
  console.log("─".repeat(78));
  for (let i = 0; i < sessions.length; i++) {
    console.log(formatSessionLine(sessions[i]!, i));
  }
}

function handleServe(): void {
  // Resolve the web package relative to this file.
  // In the built bundle, __dirname resolves to packages/tui/dist/.
  // The web package lives at packages/web/ (sibling of packages/tui/).
  const tuiDir = typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  const webDir = join(tuiDir, "..", "..", "web");
  const serverEntry = join(webDir, "server.js");

  if (!existsSync(serverEntry)) {
    console.error(
      `Web server not found at ${serverEntry}\n` +
      "Run 'npm run build:web' from the zui root first.",
    );
    process.exit(1);
  }

  // Parse --port and --host flags
  let port = "3030";
  let host = "0.0.0.0";
  const args = process.argv.slice(3);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
      port = args[++i]!;
    } else if ((args[i] === "--host" || args[i] === "-h") && args[i + 1]) {
      host = args[++i]!;
    }
  }

  console.log(`Starting ZUI web server on http://${host}:${port}`);

  try {
    execSync(`node ${shellQuote(serverEntry)}`, {
      stdio: "inherit",
      env: { ...process.env, PORT: port, HOST: host },
    });
  } catch {
    // Server exited
  }
}

function main(): void {
  // Headless subcommands — no TUI, no tmux wrap needed
  const sub = process.argv[2];

  // `zui 1`, `zui f1` — launch TUI focused on session N
  // `zui f 1`, `zui focus 1` — same with space
  let focusArg = parseFocusArg(sub);
  if (!focusArg && (sub === "f" || sub === "focus")) {
    focusArg = process.argv[3];
  }

  if (sub === "ls" || sub === "list") {
    const config = loadConfig();
    handleList(config);
    process.exit(0);
  }

  if (sub === "serve") {
    handleServe();
    return;
  }

  // TUI requires a terminal
  if (!process.stdin.isTTY) {
    console.error("zui requires a terminal. Run it directly in a terminal window.");
    process.exit(1);
  }

  // If not inside tmux, launch ourselves inside a new tmux session
  if (!process.env.TMUX) {
    try {
      execFileSync("tmux", ["kill-session", "-t", "zui-manager"], {
        stdio: "ignore",
      });
    } catch {
      // session might not exist
    }

    // Re-exec inside tmux (shell-escape argv to prevent injection)
    const shellCmd = process.argv.map(a => shellQuote(a)).join(" ");
    try {
      execFileSync("tmux", [
        "new-session", "-s", "zui-manager", "-n", "zui", shellCmd,
      ], { stdio: "inherit" });
    } catch {
      // tmux session ended
    }
    process.exit(0);
  }

  // Inside tmux — run the TUI
  // Re-parse focus arg (argv survives tmux re-exec)
  if (!focusArg) {
    const innerSub = process.argv[2];
    focusArg = parseFocusArg(innerSub);
    if (!focusArg && (innerSub === "f" || innerSub === "focus")) {
      focusArg = process.argv[3];
    }
  }
  const initialFocus = focusArg ? parseInt(focusArg, 10) : undefined;
  const config = loadConfig();
  registerAltBindings();
  process.on("exit", () => unregisterAltBindings());
  process.on("SIGINT", () => { unregisterAltBindings(); process.exit(); });
  process.on("SIGTERM", () => { unregisterAltBindings(); process.exit(); });
  render(React.createElement(App, { config, initialFocus }));
}

main();
