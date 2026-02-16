// src/agents/claude.ts
import type { AgentProvider, SessionStatus } from "./types.js";

export const claudeProvider: AgentProvider = {
  id: "claude",
  displayName: "Claude Code",

  buildCommand(args: string[]): string {
    return args.length ? `claude ${args.join(" ")}` : "claude";
  },

  detectStatus(preview: string): SessionStatus {
    const lower = preview.toLowerCase();

    const waitPatterns = ["? ", "allow", "approve", "y/n", "(y)", "press enter", "continue?", "proceed?"];
    if (waitPatterns.some((p) => lower.includes(p))) return "[WAIT]";

    const errPatterns = ["error:", "failed", "exception", "traceback"];
    if (errPatterns.some((p) => lower.includes(p))) return "[ERR]";

    if (preview.endsWith(">") || preview.endsWith("$") || (lower.includes("claude") && preview.includes(">"))) {
      return "[IDLE]";
    }

    return "[WORK]";
  },

  defaultArgs: [],
  yoloArgs: ["--dangerously-skip-permissions"],
};
