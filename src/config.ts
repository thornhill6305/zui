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
