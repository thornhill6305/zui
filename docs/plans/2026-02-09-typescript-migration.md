# ZUI TypeScript Migration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate ZUI from Python (curses) to TypeScript (Ink/React) while preserving all existing functionality.

**Architecture:** Replace Python curses TUI with Ink (React for CLIs) components. Keep the same module boundaries: config, sessions, discovery, worktrees, ui. Shell interactions (tmux, git) use Node.js `child_process`. Config parsing uses `smol-toml`.

**Tech Stack:** TypeScript, Ink 5, React 18, smol-toml, Vitest, tsup, tsx

---

### Task 1: Project Scaffolding

**Files:**
- Create: `src/` directory structure
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

**Step 1: Create package.json**

```json
{
  "name": "zui-agent-manager",
  "version": "0.1.0",
  "description": "TUI for managing AI coding agents (Claude Code) in tmux sessions",
  "type": "module",
  "bin": {
    "zui": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ink": "^5.2.0",
    "ink-text-input": "^6.0.0",
    "react": "^18.3.0",
    "smol-toml": "^1.3.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^18.3.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "license": "MIT",
  "engines": {
    "node": ">=20"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create tsup.config.ts**

```typescript
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.tsx"],
  format: ["esm"],
  target: "node20",
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  dts: false,
});
```

**Step 4: Create vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
  },
});
```

**Step 5: Create directory structure**

```
src/
├── index.tsx
├── app.tsx
├── config.ts
├── sessions.ts
├── discovery.ts
├── worktrees.ts
├── shell.ts
└── ui/
    ├── theme.ts
    ├── layout.ts
    ├── Header.tsx
    ├── Footer.tsx
    ├── SessionList.tsx
    ├── EmptyState.tsx
    ├── StatusMessage.tsx
    ├── ConfirmDialog.tsx
    ├── InputDialog.tsx
    ├── ProjectPicker.tsx
    ├── SettingsDialog.tsx
    └── HelpDialog.tsx
```

Create placeholder `src/index.tsx`:

```tsx
console.log("zui placeholder");
```

**Step 6: Install dependencies and verify**

Run: `npm install`
Run: `npx tsc --noEmit` (should pass with no errors)
Run: `npm test` (should pass with 0 tests)

**Step 7: Commit**

```bash
git add package.json tsconfig.json tsup.config.ts vitest.config.ts src/
git commit -m "feat: scaffold TypeScript project with Ink, React, Vitest"
```

---

### Task 2: Shell Utility & Core Types

**Files:**
- Create: `src/shell.ts`
- Create: `src/types.ts`
- Test: `src/__tests__/shell.test.ts`

**Step 1: Write failing tests for shell utility**

```typescript
// src/__tests__/shell.test.ts
import { describe, it, expect } from "vitest";
import { runCommand } from "../shell.js";

describe("runCommand", () => {
  it("returns stdout from a successful command", () => {
    const result = runCommand("echo", ["hello"]);
    expect(result).toBe("hello");
  });

  it("returns empty string on command failure", () => {
    const result = runCommand("false", []);
    expect(result).toBe("");
  });

  it("returns empty string on timeout", () => {
    const result = runCommand("sleep", ["10"], { timeout: 100 });
    expect(result).toBe("");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/shell.test.ts`
Expected: FAIL — module not found

**Step 3: Implement shell.ts**

```typescript
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
```

**Step 4: Create types.ts**

```typescript
// src/types.ts
export interface ProjectConfig {
  path: string;
  worktreePattern: string;
}

export interface Config {
  socket: string;
  projects: ProjectConfig[];
  defaultArgs: string[];
  yoloArgs: string[];
  hookPostWorktreeCreate: string;
  refreshInterval: number;
  layoutRightWidth: number;
  layoutLazygitHeight: number;
  confirmCleanup: boolean;
}

export interface Session {
  name: string;
  running: string;
  idle: string;
  status: "[WORK]" | "[WAIT]" | "[ERR]" | "[IDLE]";
  preview: string;
}

export interface Project {
  name: string;
  path: string;
  branch: string;
  isWorktree: boolean;
  parentRepo: string;
}

export function projectDisplayName(p: Project): string {
  if (p.branch && p.branch !== p.name) {
    return `${p.name} (${p.branch})`;
  }
  return p.name;
}
```

**Step 5: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/shell.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/shell.ts src/types.ts src/__tests__/shell.test.ts
git commit -m "feat: add shell utility and core types"
```

---

### Task 3: Config Module

**Files:**
- Create: `src/config.ts`
- Test: `src/__tests__/config.test.ts`

Port `zui/config.py` to TypeScript. Uses `smol-toml` for parsing. The Python version has a fallback TOML parser — we don't need that since we're using a proper library.

**Step 1: Write failing tests**

```typescript
// src/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, defaultConfig, saveConfig } from "../config.js";
import type { Config } from "../types.js";

describe("defaultConfig", () => {
  it("has empty socket", () => {
    const cfg = defaultConfig();
    expect(cfg.socket).toBe("");
  });

  it("has empty projects", () => {
    const cfg = defaultConfig();
    expect(cfg.projects).toEqual([]);
  });

  it("has yolo args", () => {
    const cfg = defaultConfig();
    expect(cfg.yoloArgs).toEqual(["--dangerously-skip-permissions"]);
  });

  it("has refresh interval of 2", () => {
    const cfg = defaultConfig();
    expect(cfg.refreshInterval).toBe(2);
  });
});

describe("loadConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `zui-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses a full config file", () => {
    const content = `
socket = "/tmp/custom.sock"
refresh_interval = 5

[[projects]]
path = "/tmp/myrepo"

[claude]
yolo_args = ["--dangerously-skip-permissions", "--verbose"]

[hooks]
post_worktree_create = "npm install"
`;
    const file = join(tmpDir, "config.toml");
    writeFileSync(file, content);

    const cfg = loadConfig(file);
    expect(cfg.socket).toBe("/tmp/custom.sock");
    expect(cfg.refreshInterval).toBe(5);
    expect(cfg.projects).toHaveLength(1);
    expect(cfg.projects[0]!.path).toBe("/tmp/myrepo");
    expect(cfg.yoloArgs).toEqual(["--dangerously-skip-permissions", "--verbose"]);
    expect(cfg.hookPostWorktreeCreate).toBe("npm install");
  });

  it("returns defaults for non-existent file", () => {
    const cfg = loadConfig("/tmp/does-not-exist.toml");
    expect(cfg.socket).toBe("");
    expect(cfg.projects).toEqual([]);
  });

  it("parses layout section", () => {
    const content = `
[layout]
right_width = 80
lazygit_height = 50
`;
    const file = join(tmpDir, "config.toml");
    writeFileSync(file, content);

    const cfg = loadConfig(file);
    expect(cfg.layoutRightWidth).toBe(80);
    expect(cfg.layoutLazygitHeight).toBe(50);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/config.test.ts`
Expected: FAIL — module not found

**Step 3: Implement config.ts**

```typescript
// src/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { parse as parseToml } from "smol-toml";
import type { Config, ProjectConfig } from "./types.js";

const CONFIG_PATHS = [
  join(homedir(), ".config", "zui", "config.toml"),
  join(homedir(), ".zui.toml"),
];

export function defaultConfig(): Config {
  return {
    socket: "",
    projects: [],
    defaultArgs: [],
    yoloArgs: ["--dangerously-skip-permissions"],
    hookPostWorktreeCreate: "",
    refreshInterval: 2,
    layoutRightWidth: 70,
    layoutLazygitHeight: 40,
    confirmCleanup: true,
  };
}

export function loadConfig(path?: string): Config {
  if (path) {
    return existsSync(path) ? parseConfigFile(path) : defaultConfig();
  }
  for (const p of CONFIG_PATHS) {
    if (existsSync(p)) {
      return parseConfigFile(p);
    }
  }
  return defaultConfig();
}

function parseConfigFile(path: string): Config {
  const cfg = defaultConfig();
  let data: Record<string, unknown>;
  try {
    const raw = readFileSync(path, "utf-8");
    data = parseToml(raw) as Record<string, unknown>;
  } catch {
    return cfg;
  }

  if (typeof data.socket === "string") cfg.socket = data.socket;
  if (typeof data.refresh_interval === "number") cfg.refreshInterval = data.refresh_interval;

  const layout = data.layout as Record<string, unknown> | undefined;
  if (layout && typeof layout === "object") {
    if (typeof layout.right_width === "number") cfg.layoutRightWidth = layout.right_width;
    if (typeof layout.lazygit_height === "number") cfg.layoutLazygitHeight = layout.lazygit_height;
  }

  const claude = data.claude as Record<string, unknown> | undefined;
  if (claude && typeof claude === "object") {
    if (Array.isArray(claude.default_args)) cfg.defaultArgs = claude.default_args as string[];
    if (Array.isArray(claude.yolo_args)) cfg.yoloArgs = claude.yolo_args as string[];
  }

  const cleanup = data.cleanup as Record<string, unknown> | undefined;
  if (cleanup && typeof cleanup === "object") {
    if (typeof cleanup.confirm === "boolean") cfg.confirmCleanup = cleanup.confirm;
  }

  const hooks = data.hooks as Record<string, unknown> | undefined;
  if (hooks && typeof hooks === "object") {
    if (typeof hooks.post_worktree_create === "string") {
      cfg.hookPostWorktreeCreate = hooks.post_worktree_create;
    }
  }

  const projects = data.projects as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(projects)) {
    for (const proj of projects) {
      if (typeof proj.path === "string") {
        const resolved = proj.path.replace(/^~/, homedir());
        cfg.projects.push({
          path: resolved,
          worktreePattern: typeof proj.worktree_pattern === "string" ? proj.worktree_pattern : "",
        });
      }
    }
  }

  return cfg;
}

export function saveConfig(cfg: Config): void {
  const path = CONFIG_PATHS[0]!;
  mkdirSync(dirname(path), { recursive: true });

  const lines: string[] = [];
  lines.push(`socket = "${cfg.socket}"`);
  lines.push(`refresh_interval = ${cfg.refreshInterval}`);
  lines.push("");
  lines.push("[layout]");
  lines.push(`right_width = ${cfg.layoutRightWidth}`);
  lines.push(`lazygit_height = ${cfg.layoutLazygitHeight}`);

  writeFileSync(path, lines.join("\n") + "\n");
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config.ts src/__tests__/config.test.ts
git commit -m "feat: add config module with TOML parsing"
```

---

### Task 4: Sessions Module

**Files:**
- Create: `src/sessions.ts`
- Test: `src/__tests__/sessions.test.ts`

Port `zui/sessions.py` to TypeScript. The tmux-interacting functions can't be unit tested without tmux, so we test the pure helper functions: `formatDuration`, `detectStatus`.

**Step 1: Write failing tests**

```typescript
// src/__tests__/sessions.test.ts
import { describe, it, expect } from "vitest";
import { formatDuration, detectStatus } from "../sessions.js";

describe("formatDuration", () => {
  it("formats seconds", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes", () => {
    expect(formatDuration(125)).toBe("2m 5s");
  });

  it("formats hours", () => {
    expect(formatDuration(3661)).toBe("1h 1m");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("formats exactly one hour", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
  });
});

describe("detectStatus", () => {
  it("detects waiting y/n", () => {
    expect(detectStatus("Allow tool use? (y/n)")).toBe("[WAIT]");
  });

  it("detects waiting approve", () => {
    expect(detectStatus("Do you approve this?")).toBe("[WAIT]");
  });

  it("detects error", () => {
    expect(detectStatus("Error: file not found")).toBe("[ERR]");
  });

  it("detects traceback error", () => {
    expect(detectStatus("Traceback (most recent call)")).toBe("[ERR]");
  });

  it("detects idle prompt", () => {
    expect(detectStatus("claude>")).toBe("[IDLE]");
  });

  it("detects idle dollar", () => {
    expect(detectStatus("user@host:~$")).toBe("[IDLE]");
  });

  it("detects working", () => {
    expect(detectStatus("Implementing login flow...")).toBe("[WORK]");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/sessions.test.ts`
Expected: FAIL

**Step 3: Implement sessions.ts**

```typescript
// src/sessions.ts
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Config, Session } from "./types.js";
import { runCommand, runCommandOk } from "./shell.js";

function tmuxBase(socket: string): string[] {
  return socket ? ["tmux", "-S", socket] : ["tmux"];
}

export function runTmux(args: string[], socket: string): string {
  return runCommand(tmuxBase(socket)[0]!, [...tmuxBase(socket).slice(1), ...args]);
}

function getOwnSessionName(socket: string): string | null {
  const tmuxEnv = process.env.TMUX ?? "";
  if (!tmuxEnv) return null;
  const paneId = process.env.TMUX_PANE ?? "";
  if (!paneId) return null;
  const output = runTmux(
    ["display-message", "-t", paneId, "-p", "#{session_name}"],
    socket,
  );
  return output || null;
}

export function getSessions(config: Config): Session[] {
  const output = runTmux(
    ["list-sessions", "-F", "#{session_name}|#{session_created}|#{session_activity}"],
    config.socket,
  );
  if (!output) return [];

  const sessions: Session[] = [];
  const now = Date.now() / 1000;
  const ownSession = getOwnSessionName(config.socket);

  for (const line of output.split("\n")) {
    if (!line) continue;
    const parts = line.split("|");
    if (parts.length < 3) continue;

    const name = parts[0]!;
    if (name === ownSession) continue;

    const created = parseInt(parts[1]!, 10);
    const lastActivity = parseInt(parts[2]!, 10);
    if (isNaN(created) || isNaN(lastActivity)) continue;

    const runningSecs = Math.floor(now - created);
    const runningStr = formatDuration(runningSecs);

    const idleSecs = Math.floor(now - lastActivity);
    const idleStr = idleSecs < 60 ? `${idleSecs}s ago` : `${Math.floor(idleSecs / 60)}m ago`;

    const preview = getPreview(name, config.socket);
    const status = detectStatus(preview);

    sessions.push({
      name,
      running: runningStr,
      idle: idleStr,
      status,
      preview: preview ? preview.slice(0, 80) : "(no output)",
    });
  }

  return sessions;
}

export function spawnSession(
  workdir: string,
  config: Config,
  yolo: boolean = false,
): [boolean, string] {
  const dirName = workdir.replace(/\/+$/, "").split("/").pop()!;
  let branch = "";
  try {
    const result = execFileSync("git", ["-C", workdir, "branch", "--show-current"], {
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    branch = result.trim().replace(/\//g, "-");
  } catch {
    // no branch info
  }

  let sessionName = branch ? `${dirName}-${branch}` : dirName;
  sessionName = sessionName.replace(/[^a-zA-Z0-9_-]/g, "-");

  // Check for existing session
  const base = tmuxBase(config.socket);
  if (runCommandOk(base[0]!, [...base.slice(1), "has-session", "-t", sessionName])) {
    return [false, `Session ${sessionName} already exists`];
  }

  const args = yolo ? config.yoloArgs : config.defaultArgs;
  const claudeCmd = args.length ? `claude ${args.join(" ")}` : "claude";

  const ok = runCommandOk(base[0]!, [
    ...base.slice(1),
    "new-session", "-d", "-s", sessionName, "-c", workdir, claudeCmd,
  ]);

  return ok ? [true, sessionName] : [false, "Failed to create session"];
}

export function killSession(name: string, config: Config): boolean {
  const base = tmuxBase(config.socket);
  return runCommandOk(base[0]!, [...base.slice(1), "kill-session", "-t", name]);
}

export function showSessionInPane(sessionName: string, config: Config): boolean {
  const paneCountOut = runCommand("tmux", ["display-message", "-p", "#{window_panes}"]);
  const numPanes = /^\d+$/.test(paneCountOut) ? parseInt(paneCountOut, 10) : 1;

  if (numPanes > 1) {
    runCommand("tmux", ["kill-pane", "-t", "{right}"]);
  }

  const base = config.socket ? `tmux -S ${config.socket}` : "tmux";
  const cmd = `unset TMUX; ${base} attach -t ${sessionName}`;
  const ok = runCommandOk("tmux", [
    "split-window", "-d", "-h", "-l", `${config.layoutRightWidth}%`, cmd,
  ]);

  if (ok) {
    const workdir = getSessionWorkdir(sessionName, config) ?? "~";
    const branch = getGitBranch(workdir);
    const shortPath = workdir.replace(process.env.HOME ?? "", "~");
    const title = branch ? `${shortPath} (${branch})` : shortPath;
    runCommand("tmux", ["select-pane", "-t", "{right}", "-T", title]);
  }

  return ok;
}

export function getSessionWorkdir(sessionName: string, config: Config): string | null {
  const base = tmuxBase(config.socket);
  const path = runCommand(base[0]!, [
    ...base.slice(1), "display-message", "-t", sessionName, "-p", "#{pane_current_path}",
  ]);
  return path && existsSync(path) ? path : null;
}

export function sessionExists(name: string, config: Config): boolean {
  const base = tmuxBase(config.socket);
  return runCommandOk(base[0]!, [...base.slice(1), "has-session", "-t", name]);
}

function getGitBranch(path: string): string | null {
  if (!path || !existsSync(path)) return null;
  const result = runCommand("git", ["-C", path, "rev-parse", "--abbrev-ref", "HEAD"]);
  return result || null;
}

// ── Exported pure helpers (testable) ──

export function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function getPreview(session: string, socket: string): string {
  const output = runTmux(
    ["capture-pane", "-p", "-t", session, "-S", "-5"],
    socket,
  );
  if (!output) return "";
  const lines = output.split("\n").filter((l) => l.trim());
  return lines.at(-1)?.trim() ?? "";
}

export function detectStatus(preview: string): Session["status"] {
  const lower = preview.toLowerCase();

  const waitPatterns = ["? ", "allow", "approve", "y/n", "(y)", "press enter", "continue?", "proceed?"];
  if (waitPatterns.some((p) => lower.includes(p))) return "[WAIT]";

  const errPatterns = ["error:", "failed", "exception", "traceback"];
  if (errPatterns.some((p) => lower.includes(p))) return "[ERR]";

  if (preview.endsWith(">") || preview.endsWith("$") || (lower.includes("claude") && preview.includes(">"))) {
    return "[IDLE]";
  }

  return "[WORK]";
}
```

**Step 4: Run tests to verify they pass**

Run: `npx vitest run src/__tests__/sessions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/sessions.ts src/__tests__/sessions.test.ts
git commit -m "feat: add sessions module with tmux management"
```

---

### Task 5: Discovery Module

**Files:**
- Create: `src/discovery.ts`
- Test: `src/__tests__/discovery.test.ts`

Port `zui/discovery.py` to TypeScript.

**Step 1: Write failing tests**

```typescript
// src/__tests__/discovery.test.ts
import { describe, it, expect } from "vitest";
import { projectDisplayName } from "../types.js";
import type { Project } from "../types.js";

describe("projectDisplayName", () => {
  it("returns name only when no branch", () => {
    const p: Project = { name: "myapp", path: "/tmp/myapp", branch: "", isWorktree: false, parentRepo: "" };
    expect(projectDisplayName(p)).toBe("myapp");
  });

  it("returns name with branch", () => {
    const p: Project = { name: "myapp", path: "/tmp/myapp", branch: "feat/auth", isWorktree: false, parentRepo: "" };
    expect(projectDisplayName(p)).toBe("myapp (feat/auth)");
  });

  it("returns name only when branch matches name", () => {
    const p: Project = { name: "main", path: "/tmp/main", branch: "main", isWorktree: false, parentRepo: "" };
    expect(projectDisplayName(p)).toBe("main");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/discovery.test.ts`
Expected: FAIL

**Step 3: Implement discovery.ts**

```typescript
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

  // 1. Check cwd
  const cwd = process.cwd();
  if (isGitDir(cwd)) {
    addRepoAndWorktrees(cwd, projects, seenPaths);
  }

  // 2. Scan home directory (one level deep)
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

  // Last entry
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
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/discovery.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/discovery.ts src/__tests__/discovery.test.ts
git commit -m "feat: add discovery module for project scanning"
```

---

### Task 6: Worktrees Module

**Files:**
- Create: `src/worktrees.ts`
- Test: `src/__tests__/worktrees.test.ts`

Port `zui/worktrees.py` to TypeScript.

**Step 1: Write failing tests**

```typescript
// src/__tests__/worktrees.test.ts
import { describe, it, expect } from "vitest";
import { deriveWorktreePath } from "../worktrees.js";

describe("deriveWorktreePath", () => {
  it("derives path from simple branch", () => {
    expect(deriveWorktreePath("/home/user/myapp", "feat/auth")).toBe(
      "/home/user/myapp-feat-auth",
    );
  });

  it("derives path from nested branch", () => {
    expect(deriveWorktreePath("/home/user/myapp", "feat/ui/modal")).toBe(
      "/home/user/myapp-feat-ui-modal",
    );
  });

  it("derives path from plain branch", () => {
    expect(deriveWorktreePath("/home/user/myapp", "bugfix")).toBe(
      "/home/user/myapp-bugfix",
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/worktrees.test.ts`
Expected: FAIL

**Step 3: Implement worktrees.ts**

```typescript
// src/worktrees.ts
import { existsSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import type { Config } from "./types.js";
import { runCommand, runCommandOk } from "./shell.js";

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

  // Try with -b (new branch)
  let ok = runCommandOk("git", ["-C", repoPath, "worktree", "add", worktreePath, "-b", branch]);

  if (!ok) {
    // Branch might already exist, try without -b
    ok = runCommandOk("git", ["-C", repoPath, "worktree", "add", worktreePath, branch]);
    if (!ok) {
      return [false, "git worktree add failed"];
    }
  }

  // Run post-create hook if configured
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
  const args = ["git", "-C", parentRepo, "worktree", "remove", worktreePath];
  if (force) args.push("--force");

  // Using runCommand to get stderr on failure
  const ok = runCommandOk(args[0]!, args.slice(1));
  if (!ok) {
    return [false, "git worktree remove failed"];
  }

  // Delete the branch
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
```

**Step 4: Run tests**

Run: `npx vitest run src/__tests__/worktrees.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/worktrees.ts src/__tests__/worktrees.test.ts
git commit -m "feat: add worktrees module for git worktree operations"
```

---

### Task 7: UI Layout Module

**Files:**
- Create: `src/ui/layout.ts`

Port `zui/ui/layout.py` to TypeScript. These are tmux commands — no unit tests needed (same approach as Python version).

**Step 1: Implement layout.ts**

```typescript
// src/ui/layout.ts
import { runCommand, runCommandOk } from "../shell.js";

export function focusRightPane(): void {
  runCommand("tmux", ["select-pane", "-R"]);
}

export function getPaneCount(): number {
  const result = runCommand("tmux", ["display-message", "-p", "#{window_panes}"]);
  return /^\d+$/.test(result) ? parseInt(result, 10) : 1;
}

export function killRightPane(): void {
  if (getPaneCount() > 1) {
    runCommand("tmux", ["kill-pane", "-t", "{right}"]);
  }
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

  // 3+ panes — kill bottom-right and recreate
  runCommand("tmux", ["kill-pane", "-t", "{bottom-right}"]);
  return runCommandOk("tmux", [
    "split-window", "-d", "-t", "{right}", "-v", "-l", `${lazygitHeight}%`,
    `cd '${quoted}' && lazygit`,
  ]);
}

export function killBottomRightPane(): void {
  runCommand("tmux", ["kill-pane", "-t", "{bottom-right}"]);
}

export function killZuiSession(): void {
  runCommand("tmux", ["kill-session", "-t", "zui-manager"]);
}
```

**Step 2: Commit**

```bash
git add src/ui/layout.ts
git commit -m "feat: add UI layout module for tmux pane management"
```

---

### Task 8: UI Theme & Ink Components

**Files:**
- Create: `src/ui/theme.ts`
- Create: `src/ui/Header.tsx`
- Create: `src/ui/Footer.tsx`
- Create: `src/ui/SessionList.tsx`
- Create: `src/ui/EmptyState.tsx`
- Create: `src/ui/StatusMessage.tsx`
- Create: `src/ui/ConfirmDialog.tsx`
- Create: `src/ui/InputDialog.tsx`
- Create: `src/ui/ProjectPicker.tsx`
- Create: `src/ui/SettingsDialog.tsx`
- Create: `src/ui/HelpDialog.tsx`

This is the largest task. It ports all curses widgets to Ink React components. Each component is self-contained.

**Step 1: Create theme.ts**

```typescript
// src/ui/theme.ts
export const colors = {
  header: { bg: "cyan", fg: "black" },
  footer: { bg: "cyan", fg: "black" },
  selected: { bg: "white", fg: "black" },
  statusWork: "cyan",
  statusWait: "yellow",
  statusErr: "red",
  statusIdle: "green",
  dim: "gray",
} as const;

export function statusColor(status: string): string {
  if (status.includes("WAIT")) return colors.statusWait;
  if (status.includes("ERR")) return colors.statusErr;
  if (status.includes("IDLE")) return colors.statusIdle;
  return colors.statusWork;
}
```

**Step 2: Create Header.tsx**

```tsx
// src/ui/Header.tsx
import React from "react";
import { Box, Text } from "ink";

export function Header(): React.ReactElement {
  return (
    <Box justifyContent="center" width="100%">
      <Text bold backgroundColor="cyan" color="black">
        {"  zui - Agent Manager  "}
      </Text>
    </Box>
  );
}
```

**Step 3: Create Footer.tsx**

```tsx
// src/ui/Footer.tsx
import React from "react";
import { Box, Text } from "ink";

export function Footer(): React.ReactElement {
  return (
    <Box justifyContent="center" width="100%">
      <Text backgroundColor="cyan" color="black">
        {" Ent:View g:Git Tab:Pane n:New y:YOLO w:Tree s:Set h:Help k:Kill x:Clean q:Quit "}
      </Text>
    </Box>
  );
}
```

**Step 4: Create EmptyState.tsx**

```tsx
// src/ui/EmptyState.tsx
import React from "react";
import { Box, Text } from "ink";

export function EmptyState(): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      <Text bold>No Claude sessions running</Text>
      <Text> </Text>
      <Text>Press 'n' to start a new session</Text>
    </Box>
  );
}
```

**Step 5: Create StatusMessage.tsx**

```tsx
// src/ui/StatusMessage.tsx
import React from "react";
import { Box, Text } from "ink";

interface Props {
  message: string;
}

export function StatusMessage({ message }: Props): React.ReactElement | null {
  if (!message) return null;
  const isError = message.startsWith("Error");
  return (
    <Box paddingLeft={2}>
      <Text bold inverse={isError}>{message}</Text>
    </Box>
  );
}
```

**Step 6: Create SessionList.tsx**

```tsx
// src/ui/SessionList.tsx
import React from "react";
import { Box, Text } from "ink";
import type { Session } from "../types.js";
import { statusColor } from "./theme.js";

interface Props {
  sessions: Session[];
  selectedIndex: number;
}

export function SessionList({ sessions, selectedIndex }: Props): React.ReactElement {
  return (
    <Box flexDirection="column" width="100%">
      {/* Column headers */}
      <Box paddingLeft={2} gap={1}>
        <Text bold>{"Session".padEnd(30)}</Text>
        <Text bold>{"Status".padEnd(8)}</Text>
        <Text bold>{"Running".padEnd(10)}</Text>
        <Text bold>Preview</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text>{"─".repeat(76)}</Text>
      </Box>

      {/* Session rows */}
      {sessions.map((session, i) => {
        const selected = i === selectedIndex;
        const marker = selected ? "> " : "  ";
        return (
          <Box key={session.name}>
            <Text bold={selected} inverse={selected}>
              {marker}
              {session.name.padEnd(30).slice(0, 30)}
            </Text>
            <Text bold={selected} inverse={selected} color={statusColor(session.status)}>
              {" "}{session.status.padEnd(8)}
            </Text>
            <Text bold={selected} inverse={selected}>
              {session.running.padEnd(10)}
            </Text>
            <Text bold={selected} inverse={selected} dimColor>
              {session.preview.slice(0, 40)}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
```

**Step 7: Create ConfirmDialog.tsx**

```tsx
// src/ui/ConfirmDialog.tsx
import React from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ message, onConfirm, onCancel }: Props): React.ReactElement {
  useInput((input, key) => {
    if (input === "y" || input === "Y") onConfirm();
    if (input === "n" || input === "N" || key.escape) onCancel();
  });

  return (
    <Box borderStyle="round" paddingX={2} paddingY={1} justifyContent="center">
      <Text>{message} (y/n)</Text>
    </Box>
  );
}
```

**Step 8: Create InputDialog.tsx**

```tsx
// src/ui/InputDialog.tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";

interface Props {
  title: string;
  prompt: string;
  defaultValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function InputDialog({ title, prompt, defaultValue = "", onSubmit, onCancel }: Props): React.ReactElement {
  const [value, setValue] = useState(defaultValue);

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>{title}</Text>
      <Box>
        <Text>{prompt} </Text>
        <TextInput value={value} onChange={setValue} onSubmit={() => onSubmit(value)} />
      </Box>
    </Box>
  );
}
```

**Step 9: Create ProjectPicker.tsx**

```tsx
// src/ui/ProjectPicker.tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Project } from "../types.js";
import { projectDisplayName } from "../types.js";

interface Props {
  projects: Project[];
  title?: string;
  onSelect: (index: number) => void;
  onCancel: () => void;
}

export function ProjectPicker({ projects, title = "Select Project", onSelect, onCancel }: Props): React.ReactElement {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.escape) onCancel();
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(projects.length - 1, s + 1));
    if (key.return) onSelect(selected);
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>{title}</Text>
      <Text>Pick a project:</Text>
      <Text> </Text>
      {projects.map((proj, i) => (
        <Box key={proj.path}>
          <Text bold={i === selected}>
            {i === selected ? "> " : "  "}
            {projectDisplayName(proj)}
          </Text>
        </Box>
      ))}
      <Text> </Text>
      <Text dimColor>Up/Down: Pick | Enter: Select | Esc: Cancel</Text>
    </Box>
  );
}
```

**Step 10: Create SettingsDialog.tsx**

```tsx
// src/ui/SettingsDialog.tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Config } from "../types.js";

interface Props {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
  onCancel: () => void;
}

interface Setting {
  label: string;
  key: keyof Config;
  value: number;
  min: number;
  max: number;
  suffix: string;
}

export function SettingsDialog({ config, onSave, onCancel }: Props): React.ReactElement {
  const [settings, setSettings] = useState<Setting[]>([
    { label: "Right panel width:", key: "layoutRightWidth", value: config.layoutRightWidth, min: 50, max: 90, suffix: "%" },
    { label: "Lazygit height:", key: "layoutLazygitHeight", value: config.layoutLazygitHeight, min: 20, max: 60, suffix: "%" },
    { label: "Refresh interval:", key: "refreshInterval", value: config.refreshInterval, min: 1, max: 10, suffix: "s" },
  ]);
  const [selected, setSelected] = useState(0);

  useInput((_input, key) => {
    if (key.escape) onCancel();
    if (key.upArrow) setSelected((s) => Math.max(0, s - 1));
    if (key.downArrow) setSelected((s) => Math.min(settings.length - 1, s + 1));
    if (key.rightArrow) {
      setSettings((prev) => prev.map((s, i) =>
        i === selected ? { ...s, value: Math.min(s.max, s.value + 1) } : s
      ));
    }
    if (key.leftArrow) {
      setSettings((prev) => prev.map((s, i) =>
        i === selected ? { ...s, value: Math.max(s.min, s.value - 1) } : s
      ));
    }
    if (key.return) {
      const updates: Partial<Config> = {};
      for (const s of settings) {
        (updates as Record<string, number>)[s.key] = s.value;
      }
      onSave(updates);
    }
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      <Text bold>Settings</Text>
      <Text> </Text>
      {settings.map((s, i) => (
        <Box key={s.key} gap={1}>
          <Text bold={i === selected}>
            {i === selected ? "> " : "  "}
            {s.label.padEnd(20)}
          </Text>
          <Text>[{s.value}]{s.suffix}</Text>
        </Box>
      ))}
      <Text> </Text>
      <Text dimColor>Up/Down: Select | Left/Right: Adjust | Enter: Save | Esc: Cancel</Text>
    </Box>
  );
}
```

**Step 11: Create HelpDialog.tsx**

```tsx
// src/ui/HelpDialog.tsx
import React from "react";
import { Box, Text, useInput } from "ink";

interface Props {
  onClose: () => void;
}

const sections = [
  { title: "─── ZUI Keybindings ───", items: [] as [string, string][] },
  { title: "Navigation", items: [
    ["↑/↓", "Move selection up/down"],
    ["Enter", "View selected session in right pane"],
    ["Tab", "Focus right pane (session output)"],
  ] as [string, string][] },
  { title: "Session Management", items: [
    ["n", "New Claude session (pick project)"],
    ["y", "New YOLO session (auto-accept)"],
    ["k", "Kill selected session"],
    ["x", "Cleanup worktree"],
  ] as [string, string][] },
  { title: "Git & Worktrees", items: [
    ["g", "Toggle lazygit pane"],
    ["w", "Create new worktree"],
  ] as [string, string][] },
  { title: "Other", items: [
    ["s", "Open settings"],
    ["r", "Refresh session list"],
    ["h", "This help screen"],
    ["q/Esc", "Quit ZUI"],
  ] as [string, string][] },
];

export function HelpDialog({ onClose }: Props): React.ReactElement {
  useInput((input, key) => {
    if (key.escape || input === "q" || input === "h") onClose();
  });

  return (
    <Box flexDirection="column" borderStyle="round" paddingX={2} paddingY={1}>
      {sections.map((section) => (
        <Box key={section.title} flexDirection="column">
          <Text bold>{section.title}</Text>
          {section.items.map(([key, desc]) => (
            <Box key={key} gap={1}>
              <Text bold>{"  "}{key.padEnd(12)}</Text>
              <Text>{desc}</Text>
            </Box>
          ))}
          {section.items.length > 0 && <Text> </Text>}
        </Box>
      ))}
      <Text dimColor>Esc/q/h: Close</Text>
    </Box>
  );
}
```

**Step 12: Commit**

```bash
git add src/ui/
git commit -m "feat: add Ink UI components (theme, header, footer, dialogs, lists)"
```

---

### Task 9: Main App Component

**Files:**
- Create: `src/app.tsx`

This is the main Ink application component. It orchestrates all state and UI rendering, equivalent to `zui/app.py`.

**Step 1: Implement app.tsx**

```tsx
// src/app.tsx
import React, { useState, useEffect, useCallback } from "react";
import { Box, useApp, useInput } from "ink";
import type { Config, Session, Project } from "./types.js";
import { getSessions, spawnSession, killSession, showSessionInPane, getSessionWorkdir, sessionExists } from "./sessions.js";
import { discoverProjects } from "./discovery.js";
import { createWorktree, removeWorktree } from "./worktrees.js";
import { saveConfig } from "./config.js";
import { focusRightPane, getPaneCount, killBottomRightPane, showLazygitPane, killZuiSession } from "./ui/layout.js";
import { Header } from "./ui/Header.js";
import { Footer } from "./ui/Footer.js";
import { SessionList } from "./ui/SessionList.js";
import { EmptyState } from "./ui/EmptyState.js";
import { StatusMessage } from "./ui/StatusMessage.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { InputDialog } from "./ui/InputDialog.js";
import { ProjectPicker } from "./ui/ProjectPicker.js";
import { SettingsDialog } from "./ui/SettingsDialog.js";
import { HelpDialog } from "./ui/HelpDialog.js";

type Dialog =
  | { type: "none" }
  | { type: "confirm"; message: string; onConfirm: () => void }
  | { type: "input"; title: string; prompt: string; defaultValue: string; onSubmit: (v: string) => void }
  | { type: "picker"; projects: Project[]; title: string; onSelect: (i: number) => void }
  | { type: "settings" }
  | { type: "help" };

interface AppProps {
  config: Config;
}

export function App({ config: initialConfig }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [config, setConfig] = useState(initialConfig);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [dialog, setDialog] = useState<Dialog>({ type: "none" });

  const setStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), 3000);
  }, []);

  // Refresh sessions periodically
  useEffect(() => {
    const refresh = () => {
      const s = getSessions(config);
      setSessions(s);
    };
    refresh();
    const interval = setInterval(refresh, config.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [config]);

  // Initial project discovery
  useEffect(() => {
    setProjects(discoverProjects(config));
  }, [config]);

  // Clamp selection
  useEffect(() => {
    if (sessions.length > 0 && selected >= sessions.length) {
      setSelected(sessions.length - 1);
    }
  }, [sessions, selected]);

  // Key handling (only when no dialog is open)
  useInput((input, key) => {
    if (dialog.type !== "none") return;

    if (input === "q" || key.escape) {
      killZuiSession();
      exit();
      return;
    }

    if (input === "r") {
      setSessions(getSessions(config));
      setStatus("Refreshed");
    }

    if (key.upArrow && sessions.length > 0) {
      setSelected((s) => Math.max(0, s - 1));
    }
    if (key.downArrow && sessions.length > 0) {
      setSelected((s) => Math.min(sessions.length - 1, s + 1));
    }

    if (key.return && sessions.length > 0) {
      viewSession();
    }

    if (input === "n") launchSession(false);
    if (input === "y") launchSession(true);
    if (input === "k" && sessions.length > 0) killSessionAction();
    if (input === "x") cleanupWorktree();
    if (input === "g" && sessions.length > 0) toggleLazygit();
    if (input === "w") createWorktreeAction();
    if (input === "s") setDialog({ type: "settings" });
    if (input === "h") setDialog({ type: "help" });
    if (key.tab) focusRightPane();
  });

  function viewSession() {
    const session = sessions[selected];
    if (!session) return;
    if (showSessionInPane(session.name, config)) {
      focusRightPane();
      setStatus(`Showing: ${session.name}`);
    } else {
      setStatus("Error: Failed to open pane");
    }
  }

  function launchSession(yolo: boolean) {
    const refreshedProjects = discoverProjects(config);
    setProjects(refreshedProjects);

    if (refreshedProjects.length === 0) {
      setDialog({
        type: "input",
        title: yolo ? "New YOLO Session" : "New Claude Session",
        prompt: "Workdir:",
        defaultValue: process.cwd(),
        onSubmit: (workdir) => {
          setDialog({ type: "none" });
          const [ok, result] = spawnSession(workdir, config, yolo);
          if (ok) {
            showSessionInPane(result, config);
            focusRightPane();
            setStatus(`${yolo ? "YOLO" : "Launched"}: ${result}`);
          } else {
            setStatus(result);
          }
          setSessions(getSessions(config));
        },
      });
      return;
    }

    const title = yolo ? "YOLO Launch" : "Launch Claude";
    setDialog({
      type: "picker",
      projects: refreshedProjects,
      title,
      onSelect: (idx) => {
        setDialog({ type: "none" });
        const proj = refreshedProjects[idx]!;

        // Check if session already exists
        const branch = proj.branch ? proj.branch.replace(/\//g, "-") : "";
        const candidate = branch ? `${proj.name}-${branch}` : proj.name;
        if (sessionExists(candidate, config)) {
          showSessionInPane(candidate, config);
          focusRightPane();
          setStatus(`Showing: ${candidate}`);
          setSessions(getSessions(config));
          return;
        }

        const [ok, result] = spawnSession(proj.path, config, yolo);
        if (ok) {
          showSessionInPane(result, config);
          focusRightPane();
          setStatus(`${yolo ? "YOLO" : "Launched"}: ${result}`);
        } else {
          setStatus(result);
        }
        setSessions(getSessions(config));
      },
    });
  }

  function killSessionAction() {
    const session = sessions[selected];
    if (!session) return;
    setDialog({
      type: "confirm",
      message: `Kill ${session.name}?`,
      onConfirm: () => {
        setDialog({ type: "none" });
        if (killSession(session.name, config)) {
          setStatus(`Killed: ${session.name}`);
        } else {
          setStatus(`Error: Failed to kill ${session.name}`);
        }
        setSessions(getSessions(config));
      },
    });
  }

  function cleanupWorktree() {
    const refreshedProjects = discoverProjects(config);
    const worktrees = refreshedProjects.filter((p) => p.isWorktree);

    if (worktrees.length === 0) {
      setStatus("No worktrees to clean");
      return;
    }

    setDialog({
      type: "picker",
      projects: worktrees,
      title: "Clean Worktree",
      onSelect: (idx) => {
        const proj = worktrees[idx]!;

        const doCleanup = () => {
          setDialog({ type: "none" });
          // Kill matching session
          const baseName = proj.path.split("/").pop()!;
          for (const sess of sessions) {
            if (sess.name.includes(baseName) || sess.name.endsWith(baseName)) {
              killSession(sess.name, config);
              break;
            }
          }
          const [ok, msg] = removeWorktree(proj.parentRepo, proj.path, proj.branch);
          setStatus(ok ? `Cleaned: ${proj.name}` : `Error: ${msg}`);
          setSessions(getSessions(config));
        };

        if (config.confirmCleanup) {
          setDialog({
            type: "confirm",
            message: `Clean ${proj.name}? (remove worktree + delete branch)`,
            onConfirm: doCleanup,
          });
        } else {
          doCleanup();
        }
      },
    });
  }

  function toggleLazygit() {
    const numPanes = getPaneCount();
    if (numPanes >= 3) {
      killBottomRightPane();
      setStatus("Git: hidden");
      return;
    }
    const session = sessions[selected];
    if (!session) return;
    const workdir = getSessionWorkdir(session.name, config);
    if (!workdir) {
      setStatus("Error: Can't find session workdir");
      return;
    }
    if (numPanes < 2) {
      if (showSessionInPane(session.name, config)) {
        setTimeout(() => {
          showLazygitPane(workdir, config.layoutRightWidth, config.layoutLazygitHeight);
          setStatus(`View + Git: ${session.name}`);
        }, 200);
      }
    } else {
      showLazygitPane(workdir, config.layoutRightWidth, config.layoutLazygitHeight);
      setStatus(`Git: ${workdir.split("/").pop()}`);
    }
  }

  function createWorktreeAction() {
    const refreshedProjects = discoverProjects(config);
    const repos = refreshedProjects.filter((p) => !p.isWorktree);

    if (repos.length === 0) {
      setStatus("No git repos found");
      return;
    }

    const pickBranch = (repo: Project) => {
      setDialog({
        type: "input",
        title: "New Worktree",
        prompt: "Branch:",
        defaultValue: "feat/",
        onSubmit: (branch) => {
          setDialog({ type: "none" });
          if (!branch.trim()) {
            setStatus("Cancelled");
            return;
          }
          const [ok, result] = createWorktree(repo.path, branch.trim(), config);
          if (ok) {
            setStatus(`Created: ${result.split("/").pop()} (${branch.trim()})`);
            setProjects(discoverProjects(config));
          } else {
            setStatus(`Error: ${result}`);
          }
        },
      });
    };

    if (repos.length === 1) {
      pickBranch(repos[0]!);
    } else {
      setDialog({
        type: "picker",
        projects: repos,
        title: "New Worktree - Pick Repo",
        onSelect: (idx) => pickBranch(repos[idx]!),
      });
    }
  }

  function handleSettingsSave(updates: Partial<Config>) {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setDialog({ type: "none" });
    try {
      saveConfig(newConfig);
      setStatus("Settings saved");
    } catch (e) {
      setStatus(`Error saving: ${e}`);
    }
  }

  // ── Render ──
  return (
    <Box flexDirection="column" height="100%">
      <Header />

      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <SessionList sessions={sessions} selectedIndex={selected} />
      )}

      <StatusMessage message={statusMessage} />
      <Footer />

      {/* Dialogs */}
      {dialog.type === "confirm" && (
        <ConfirmDialog
          message={dialog.message}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "input" && (
        <InputDialog
          title={dialog.title}
          prompt={dialog.prompt}
          defaultValue={dialog.defaultValue}
          onSubmit={dialog.onSubmit}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "picker" && (
        <ProjectPicker
          projects={dialog.projects}
          title={dialog.title}
          onSelect={dialog.onSelect}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "settings" && (
        <SettingsDialog
          config={config}
          onSave={handleSettingsSave}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "help" && (
        <HelpDialog onClose={() => setDialog({ type: "none" })} />
      )}
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add src/app.tsx
git commit -m "feat: add main App component with full TUI functionality"
```

---

### Task 10: Entry Point & Build

**Files:**
- Create: `src/index.tsx`

Port `zui/__main__.py` to TypeScript. Handles tmux auto-wrapping and launching the Ink app.

**Step 1: Implement index.tsx**

```tsx
// src/index.tsx
import { execFileSync, execSync } from "node:child_process";
import process from "node:process";
import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { loadConfig } from "./config.js";

function main(): void {
  if (!process.stdin.isTTY) {
    console.error("zui requires a terminal. Run it directly in a terminal window.");
    process.exit(1);
  }

  // If not inside tmux, launch ourselves inside a new tmux session
  if (!process.env.TMUX) {
    try {
      execFileSync("tmux", ["kill-session", "-t", "zui-manager"], {
        stdio: "ignore",
      });
    } catch {
      // session might not exist
    }

    // Re-exec inside tmux
    const argv = process.argv.slice(1);
    const nodeCmd = `${process.argv[0]} ${argv.join(" ")}`;
    try {
      execSync(
        `tmux new-session -s zui-manager -n zui "${nodeCmd}"`,
        { stdio: "inherit" },
      );
    } catch {
      // tmux session ended
    }
    process.exit(0);
  }

  // Inside tmux — run the TUI
  const config = loadConfig();
  render(React.createElement(App, { config }));
}

main();
```

**Step 2: Verify build works**

Run: `npm run build`
Expected: Produces `dist/index.js` with shebang

**Step 3: Verify the app starts**

Run: `npm run dev` (inside a terminal)
Expected: App launches (may fail without tmux, but should not crash with a JS error)

**Step 4: Commit**

```bash
git add src/index.tsx tsup.config.ts
git commit -m "feat: add entry point with tmux auto-wrapping and Ink render"
```

---

## Dependency Graph

```
Task 1 (scaffolding)
  └─> Task 2 (types + shell)
        ├─> Task 3 (config)      ─┐
        ├─> Task 4 (sessions)     │
        ├─> Task 5 (discovery)    ├─> Task 9 (app.tsx) ─> Task 10 (entry + build)
        ├─> Task 6 (worktrees)    │
        ├─> Task 7 (layout)       │
        └─> Task 8 (UI components)┘
```

Tasks 3-8 are **independent** and can run in parallel after Task 2 completes.
