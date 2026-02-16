// src/ui/layout.ts
import { runCommand, runCommandOk } from "@zui/core";

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
  const baseIdx = runCommand("tmux", ["show-options", "-gv", "pane-base-index"]);
  const first = /^\d+$/.test(baseIdx) ? baseIdx : "0";
  return runCommandOk("tmux", ["kill-pane", "-a", "-t", `zui-manager:zui.${first}`]);
}

export function focusBottomRightPane(): void {
  runCommand("tmux", ["select-pane", "-t", "{bottom-right}"]);
}

export function isWindowZoomed(): boolean {
  const result = runCommand("tmux", ["display-message", "-p", "#{window_zoomed_flag}"]);
  return result.trim() === "1";
}

export function toggleZoom(): boolean {
  if (isWindowZoomed()) {
    return runCommandOk("tmux", ["resize-pane", "-Z"]);
  }
  if (getPaneCount() < 2) return false;
  return runCommandOk("tmux", ["resize-pane", "-Z", "-t", "{right}"]);
}

export function killZuiSession(): void {
  runCommand("tmux", ["kill-session", "-t", "zui-manager"]);
}
