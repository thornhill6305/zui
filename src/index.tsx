// src/index.tsx
import { execFileSync, execSync } from "node:child_process";
import process from "node:process";
import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { loadConfig } from "./config.js";

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

    // Re-exec inside tmux
    const argv = process.argv.slice(1);
    const nodeCmd = `${process.argv[0]} ${argv.join(" ")}`;
    try {
      execSync(
        `tmux new-session -s zui-manager -n zui "${nodeCmd}"`,
        { stdio: "inherit" },
      );
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
