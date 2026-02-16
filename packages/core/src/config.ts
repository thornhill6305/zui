// src/config.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { Config, ProjectConfig, AgentConfig } from "./types.js";
import { claudeProvider } from "./agents/claude.js";
import { codexProvider } from "./agents/codex.js";

const CONFIG_PATHS = [
  join(homedir(), ".config", "zui", "config.toml"),
  join(homedir(), ".zui.toml"),
];

function defaultAgents(): Record<string, AgentConfig> {
  return {
    claude: { defaultArgs: claudeProvider.defaultArgs, yoloArgs: claudeProvider.yoloArgs },
    codex: { defaultArgs: codexProvider.defaultArgs, yoloArgs: codexProvider.yoloArgs },
  };
}

export function defaultConfig(): Config {
  const agents = defaultAgents();
  return {
    socket: "",
    projects: [],
    scanDirs: [],
    defaultAgent: "claude",
    agents,
    defaultArgs: agents.claude!.defaultArgs,
    yoloArgs: agents.claude!.yoloArgs,
    hookPostWorktreeCreate: "",
    refreshInterval: 2,
    layoutRightWidth: 70,
    layoutLazygitHeight: 40,
    confirmCleanup: true,
    webPort: 3030,
    webHost: "127.0.0.1",
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
  if (typeof data.default_agent === "string") cfg.defaultAgent = data.default_agent;

  const layout = data.layout as Record<string, unknown> | undefined;
  if (layout && typeof layout === "object") {
    if (typeof layout.right_width === "number") cfg.layoutRightWidth = layout.right_width;
    if (typeof layout.lazygit_height === "number") cfg.layoutLazygitHeight = layout.lazygit_height;
  }

  // New agents section
  const agents = data.agents as Record<string, unknown> | undefined;
  if (agents && typeof agents === "object") {
    for (const [agentId, agentData] of Object.entries(agents)) {
      if (agentData && typeof agentData === "object") {
        const ad = agentData as Record<string, unknown>;
        const existing = cfg.agents[agentId] ?? { defaultArgs: [], yoloArgs: [] };
        if (Array.isArray(ad.default_args)) existing.defaultArgs = ad.default_args as string[];
        if (Array.isArray(ad.yolo_args)) existing.yoloArgs = ad.yolo_args as string[];
        cfg.agents[agentId] = existing;
      }
    }
  }

  // Legacy migration: if [claude] exists but [agents] was not in TOML, migrate
  const claude = data.claude as Record<string, unknown> | undefined;
  if (claude && typeof claude === "object") {
    if (!agents) {
      // Auto-migrate old [claude] → [agents.claude]
      const claudeAgent = cfg.agents.claude ?? { defaultArgs: [], yoloArgs: [...claudeProvider.yoloArgs] };
      if (Array.isArray(claude.default_args)) claudeAgent.defaultArgs = claude.default_args as string[];
      if (Array.isArray(claude.yolo_args)) claudeAgent.yoloArgs = claude.yolo_args as string[];
      cfg.agents.claude = claudeAgent;
    }
    // Also populate deprecated top-level fields for backward compat
    if (Array.isArray(claude.default_args)) cfg.defaultArgs = claude.default_args as string[];
    if (Array.isArray(claude.yolo_args)) cfg.yoloArgs = claude.yolo_args as string[];
  }

  // Sync deprecated top-level fields from agents.claude
  if (cfg.agents.claude) {
    cfg.defaultArgs = cfg.agents.claude.defaultArgs;
    cfg.yoloArgs = cfg.agents.claude.yoloArgs;
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

  const web = data.web as Record<string, unknown> | undefined;
  if (web && typeof web === "object") {
    if (typeof web.port === "number") cfg.webPort = web.port;
    if (typeof web.host === "string") cfg.webHost = web.host;
  }

  if (Array.isArray(data.scan_dirs)) {
    for (const d of data.scan_dirs) {
      if (typeof d === "string") {
        cfg.scanDirs.push(d.replace(/^~/, homedir()));
      }
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

export function saveConfig(cfg: Config, savePath?: string): void {
  const path = savePath ?? CONFIG_PATHS[0]!;
  mkdirSync(dirname(path), { recursive: true });

  // Read-modify-write to preserve sections we don't edit
  let existing: Record<string, unknown> = {};
  try {
    if (existsSync(path)) {
      existing = parseToml(readFileSync(path, "utf-8")) as Record<string, unknown>;
    }
  } catch {
    // start fresh if existing file is malformed
  }

  existing.socket = cfg.socket;
  existing.refresh_interval = cfg.refreshInterval;
  existing.default_agent = cfg.defaultAgent;

  // Write agents section
  const agentsSection: Record<string, unknown> = {};
  for (const [agentId, agentCfg] of Object.entries(cfg.agents)) {
    agentsSection[agentId] = {
      default_args: agentCfg.defaultArgs,
      yolo_args: agentCfg.yoloArgs,
    };
  }
  existing.agents = agentsSection;

  const layout = (typeof existing.layout === "object" && existing.layout !== null
    ? existing.layout : {}) as Record<string, unknown>;
  layout.right_width = cfg.layoutRightWidth;
  layout.lazygit_height = cfg.layoutLazygitHeight;
  existing.layout = layout;

  const webSection = (typeof existing.web === "object" && existing.web !== null
    ? existing.web : {}) as Record<string, unknown>;
  webSection.port = cfg.webPort;
  webSection.host = cfg.webHost;
  existing.web = webSection;

  writeFileSync(path, stringifyToml(existing) + "\n");
}
