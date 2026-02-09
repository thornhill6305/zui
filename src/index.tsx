// src/index.tsx
import { execFileSync } from "node:child_process";
import process from "node:process";
import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { loadConfig } from "./config.js";

function shellQuote(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function main(): void {
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
  const config = loadConfig();
  render(React.createElement(App, { config }));
}

main();
