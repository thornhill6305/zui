// src/ui/keybindings.ts
import { runCommandOk } from "../shell.js";

const ALT_KEYS = [
  "M-0", "M-1", "M-2", "M-3", "M-4", "M-5", "M-6", "M-7", "M-8", "M-9",
  "M-Enter", "M-Tab",
  "M-n", "M-y", "M-k", "M-x", "M-g", "M-w", "M-s", "M-h", "M-q", "M-c",
];

const CONDITION = '[ "#{session_name}" = "zui-manager" ] && [ "#{pane_index}" != "0" ]';

export function registerAltBindings(): void {
  for (const key of ALT_KEYS) {
    const action = key === "M-Tab"
      ? "select-pane -t zui-manager:zui.0"
      : `send-keys -t zui-manager:zui.0 ${key}`;
    runCommandOk("tmux", ["bind-key", "-n", key, "if-shell", CONDITION, action, ""]);
  }
}

export function unregisterAltBindings(): void {
  for (const key of ALT_KEYS) {
    runCommandOk("tmux", ["unbind-key", "-n", key]);
  }
}
