// src/agents/codex.ts
import type { AgentProvider, SessionStatus } from "./types.js";

export const codexProvider: AgentProvider = {
  id: "codex",
  displayName: "Codex CLI",

  buildCommand(args: string[]): string {
    return args.length ? `codex ${args.join(" ")}` : "codex";
  },

  detectStatus(preview: string): SessionStatus {
    const lower = preview.toLowerCase();

    const waitPatterns = ["approve?", "allow", "y/n", "press enter", "[allow]", "[deny]", "approve this"];
    if (waitPatterns.some((p) => lower.includes(p))) return "[WAIT]";

    const errPatterns = ["error:", "failed", "error", "panic"];
    if (errPatterns.some((p) => lower.includes(p))) return "[ERR]";

    if (preview.includes("\u276F") || preview.includes(">") || lower.includes("codex>")) return "[IDLE]";

    return "[WORK]";
  },

  defaultArgs: [],
  yoloArgs: ["--yolo"],
};
