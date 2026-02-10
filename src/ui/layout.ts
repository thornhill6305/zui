// src/ui/layout.ts
import { runCommand, runCommandOk } from "../shell.js";

export function focusRightPane(): void {
  runCommand("tmux", ["select-pane", "-R"]);
}

export function getPaneCount(): number {
  const result = runCommand("tmux", ["display-message", "-p", "#{window_panes}"]);
  return /^\d+$/.test(result) ? parseInt(result, 10) : 1;
}

export function showLazygitPane(
  workdir: string,
  rightWidth: number = 70,
  lazygitHeight: number = 40,
): boolean {
  const numPanes = getPaneCount();
  const quoted = workdir.replace(/'/g, "'\\''");

  if (numPanes < 2) {
    return runCommandOk("tmux", [
      "split-window", "-d", "-h", "-l", `${rightWidth}%`,
      `cd '${quoted}' && lazygit`,
    ]);
  }

  if (numPanes === 2) {
    return runCommandOk("tmux", [
      "split-window", "-d", "-t", "{right}", "-v", "-l", `${lazygitHeight}%`,
      `cd '${quoted}' && lazygit`,
    ]);
  }

  runCommand("tmux", ["kill-pane", "-t", "{bottom-right}"]);
  return runCommandOk("tmux", [
    "split-window", "-d", "-t", "{right}", "-v", "-l", `${lazygitHeight}%`,
    `cd '${quoted}' && lazygit`,
  ]);
}

export function killBottomRightPane(): void {
  runCommand("tmux", ["kill-pane", "-t", "{bottom-right}"]);
}

export function closeRightPane(): boolean {
  if (getPaneCount() <= 1) return false;
  return runCommandOk("tmux", ["kill-pane", "-a", "-t", "zui-manager:zui.0"]);
}

export function focusBottomRightPane(): void {
  runCommand("tmux", ["select-pane", "-t", "{bottom-right}"]);
}

export function killZuiSession(): void {
  runCommand("tmux", ["kill-session", "-t", "zui-manager"]);
}
