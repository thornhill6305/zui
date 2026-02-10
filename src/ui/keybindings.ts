// src/ui/keybindings.ts
import { runCommand, runCommandOk } from "../shell.js";

const ALT_KEYS = [
  "M-0", "M-1", "M-2", "M-3", "M-4", "M-5", "M-6", "M-7", "M-8", "M-9",
  "M-Enter", "M-Tab",
  "M-n", "M-y", "M-k", "M-x", "M-g", "M-w", "M-s", "M-h", "M-q", "M-c",
];

export function getFirstPaneIndex(): string {
  const result = runCommand("tmux", ["show-options", "-gv", "pane-base-index"]);
  return /^\d+$/.test(result) ? result : "0";
}

export function registerAltBindings(): void {
  const first = getFirstPaneIndex();
  const condition = `[ "#{session_name}" = "zui-manager" ] && [ "#{pane_index}" != "${first}" ]`;
  for (const key of ALT_KEYS) {
    const target = `zui-manager:zui.${first}`;
    const action = key === "M-Tab"
      ? `select-pane -t ${target}`
      : `send-keys -t ${target} ${key}`;
    const fallback = `send-keys ${key}`;
    runCommandOk("tmux", ["bind-key", "-n", key, "if-shell", condition, action, fallback]);
  }
}

export function unregisterAltBindings(): void {
  for (const key of ALT_KEYS) {
    runCommandOk("tmux", ["unbind-key", "-n", key]);
  }
}
