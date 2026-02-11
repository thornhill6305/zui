// src/worktrees.ts
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import type { Config } from "./types.js";
import { runCommandOk } from "./shell.js";

export function deriveWorktreePath(repoPath: string, branch: string, baseDir?: string): string {
  const repoName = basename(repoPath.replace(/\/+$/, ""));
  const safeBranch = branch.replace(/[/\\]/g, "-");
  const worktreeName = `${repoName}-${safeBranch}`;
  const dir = baseDir ?? dirname(repoPath);
  return join(dir, worktreeName);
}

export function createWorktree(
  repoPath: string,
  branch: string,
  config: Config,
  baseDir?: string,
): [boolean, string] {
  const worktreePath = deriveWorktreePath(repoPath, branch, baseDir);

  if (existsSync(worktreePath)) {
    return [false, `Path already exists: ${worktreePath}`];
  }

  let ok = runCommandOk("git", ["-C", repoPath, "worktree", "add", worktreePath, "-b", branch]);

  if (!ok) {
    ok = runCommandOk("git", ["-C", repoPath, "worktree", "add", worktreePath, branch]);
    if (!ok) {
      return [false, "git worktree add failed"];
    }
  }

  if (config.hookPostWorktreeCreate) {
    runHook(config.hookPostWorktreeCreate, worktreePath);
  }

  return [true, worktreePath];
}

export function removeWorktree(
  parentRepo: string,
  worktreePath: string,
  branch: string,
  force: boolean = false,
): [boolean, string] {
  const args = ["-C", parentRepo, "worktree", "remove", worktreePath];
  if (force) args.push("--force");

  const ok = runCommandOk("git", args);
  if (!ok) {
    return [false, "git worktree remove failed"];
  }

  const flag = force ? "-D" : "-d";
  const branchOk = runCommandOk("git", ["-C", parentRepo, "branch", flag, branch]);
  if (!branchOk) {
    return [true, "Worktree removed but branch not deleted"];
  }

  return [true, `Removed worktree and branch ${branch}`];
}

function runHook(command: string, cwd: string): void {
  try {
    spawn(command, { shell: true, cwd, stdio: "ignore", detached: true }).unref();
  } catch {
    // Hook failure is non-fatal
  }
}
