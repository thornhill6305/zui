// src/shell.ts
import { execFileSync } from "node:child_process";

export function runCommand(
  cmd: string,
  args: string[],
  opts?: { timeout?: number; cwd?: string },
): string {
  try {
    const result = execFileSync(cmd, args, {
      encoding: "utf-8",
      timeout: opts?.timeout ?? 5000,
      cwd: opts?.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return result.trim();
  } catch {
    return "";
  }
}

export function runCommandOk(
  cmd: string,
  args: string[],
  opts?: { timeout?: number; cwd?: string },
): boolean {
  try {
    execFileSync(cmd, args, {
      timeout: opts?.timeout ?? 5000,
      cwd: opts?.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return true;
  } catch {
    return false;
  }
}
