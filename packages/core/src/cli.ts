// src/cli.ts — Pure functions for CLI subcommands (testable without tmux)
import type { Session } from "./types.js";

/**
 * Parse a 1-based index argument, returning a 0-based index or an error message.
 */
export function parseIndex(arg: string | undefined, sessionCount: number): number | string {
  if (sessionCount === 0) return "No sessions running";
  if (arg === undefined || arg === "") return "Usage: zui f <number>";
  const n = Number(arg);
  if (!Number.isInteger(n) || n < 1) return `Invalid index: ${arg}`;
  if (n > sessionCount) return `Index ${n} out of range (1-${sessionCount})`;
  return n - 1;
}

/**
 * Format a single session line for `zui ls` output.
 * index is 0-based, displayed as 1-based.
 */
export function formatSessionLine(session: Session, index: number): string {
  const num = String(index + 1).padStart(3);
  const name = session.name.padEnd(30).slice(0, 30);
  const status = session.status.padEnd(7);
  const running = session.running.padStart(7);
  const preview = session.preview.slice(0, 40);
  return `${num}  ${name} ${status} ${running}  ${preview}`;
}
