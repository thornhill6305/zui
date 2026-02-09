// src/discovery.ts
import { existsSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { homedir } from "node:os";
import type { Config, Project } from "./types.js";
import { runCommand } from "./shell.js";

export function discoverProjects(config: Config): Project[] {
  if (config.projects.length > 0) {
    return discoverFromConfig(config);
  }
  return discoverAuto();
}

function discoverFromConfig(config: Config): Project[] {
  const projects: Project[] = [];

  for (const projCfg of config.projects) {
    const path = projCfg.path.replace(/^~/, homedir());
    if (!existsSync(path)) continue;

    const branch = getBranch(path);
    projects.push({ name: basename(path), path, branch, isWorktree: false, parentRepo: "" });

    for (const wt of getWorktrees(path)) {
      if (wt.path !== path) projects.push(wt);
    }

    if (projCfg.worktreePattern) {
      const resolved = projCfg.worktreePattern.replace(/^~/, homedir());
      const patternDir = dirname(resolved);
      const prefix = basename(resolved).replace("*", "");
      if (existsSync(patternDir)) {
        for (const entry of readdirSync(patternDir).sort()) {
          const full = join(patternDir, entry);
          if (entry.startsWith(prefix) && isGitDir(full) && full !== path) {
            if (!projects.some((p) => p.path === full)) {
              projects.push({
                name: entry,
                path: full,
                branch: getBranch(full),
                isWorktree: true,
                parentRepo: path,
              });
            }
          }
        }
      }
    }
  }

  return projects;
}

function discoverAuto(): Project[] {
  const projects: Project[] = [];
  const seenPaths = new Set<string>();

  const cwd = process.cwd();
  if (isGitDir(cwd)) {
    addRepoAndWorktrees(cwd, projects, seenPaths);
  }

  const home = homedir();
  try {
    for (const entry of readdirSync(home).sort()) {
      const full = join(home, entry);
      if (seenPaths.has(full)) continue;
      if (!entry.startsWith(".") && existsSync(join(full, ".git"))) {
        addRepoAndWorktrees(full, projects, seenPaths);
      }
    }
  } catch {
    // permission error etc.
  }

  return projects;
}

function addRepoAndWorktrees(path: string, projects: Project[], seenPaths: Set<string>): void {
  if (seenPaths.has(path)) return;
  seenPaths.add(path);

  projects.push({ name: basename(path), path, branch: getBranch(path), isWorktree: false, parentRepo: "" });

  for (const wt of getWorktrees(path)) {
    if (!seenPaths.has(wt.path)) {
      seenPaths.add(wt.path);
      projects.push(wt);
    }
  }
}

function getWorktrees(repoPath: string): Project[] {
  const output = runCommand("git", ["-C", repoPath, "worktree", "list", "--porcelain"]);
  if (!output) return [];

  const worktrees: Project[] = [];
  let currentPath: string | null = null;
  let currentBranch: string | null = null;

  for (const line of output.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (currentPath && currentPath !== repoPath) {
        worktrees.push({
          name: basename(currentPath),
          path: currentPath,
          branch: currentBranch ?? "",
          isWorktree: true,
          parentRepo: repoPath,
        });
      }
      currentPath = line.slice("worktree ".length);
      currentBranch = null;
    } else if (line.startsWith("branch ")) {
      const ref = line.slice("branch ".length);
      currentBranch = ref.replace(/^refs\/heads\//, "");
    }
  }

  if (currentPath && currentPath !== repoPath) {
    worktrees.push({
      name: basename(currentPath),
      path: currentPath,
      branch: currentBranch ?? "",
      isWorktree: true,
      parentRepo: repoPath,
    });
  }

  return worktrees;
}

function getBranch(path: string): string {
  return runCommand("git", ["-C", path, "branch", "--show-current"], { timeout: 3000 });
}

function isGitDir(path: string): boolean {
  return existsSync(join(path, ".git"));
}
