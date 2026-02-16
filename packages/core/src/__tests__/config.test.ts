// src/__tests__/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, readFileSync, mkdirSync, rmSync } from "node:fs";
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

  it("has yolo args (deprecated field)", () => {
    const cfg = defaultConfig();
    expect(cfg.yoloArgs).toEqual(["--dangerously-skip-permissions"]);
  });

  it("has refresh interval of 2", () => {
    const cfg = defaultConfig();
    expect(cfg.refreshInterval).toBe(2);
  });

  it("has defaultAgent set to claude", () => {
    const cfg = defaultConfig();
    expect(cfg.defaultAgent).toBe("claude");
  });

  it("has agents map with claude and codex", () => {
    const cfg = defaultConfig();
    expect(cfg.agents).toHaveProperty("claude");
    expect(cfg.agents).toHaveProperty("codex");
    expect(cfg.agents.claude!.yoloArgs).toEqual(["--dangerously-skip-permissions"]);
    expect(cfg.agents.codex!.yoloArgs).toEqual(["--yolo"]);
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

  it("parses a full config file (legacy format)", () => {
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
    // Legacy field
    expect(cfg.yoloArgs).toEqual(["--dangerously-skip-permissions", "--verbose"]);
    // Migrated to agents
    expect(cfg.agents.claude!.yoloArgs).toEqual(["--dangerously-skip-permissions", "--verbose"]);
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

  it("parses new agents section", () => {
    const content = `
default_agent = "codex"

[agents.claude]
default_args = ["--verbose"]
yolo_args = ["--dangerously-skip-permissions"]

[agents.codex]
default_args = ["--full-auto"]
yolo_args = ["--yolo"]
`;
    const file = join(tmpDir, "config.toml");
    writeFileSync(file, content);

    const cfg = loadConfig(file);
    expect(cfg.defaultAgent).toBe("codex");
    expect(cfg.agents.claude!.defaultArgs).toEqual(["--verbose"]);
    expect(cfg.agents.claude!.yoloArgs).toEqual(["--dangerously-skip-permissions"]);
    expect(cfg.agents.codex!.defaultArgs).toEqual(["--full-auto"]);
    expect(cfg.agents.codex!.yoloArgs).toEqual(["--yolo"]);
  });

  it("migrates legacy [claude] section to agents.claude", () => {
    const content = `
[claude]
default_args = ["--verbose"]
yolo_args = ["--dangerously-skip-permissions", "--verbose"]
`;
    const file = join(tmpDir, "config.toml");
    writeFileSync(file, content);

    const cfg = loadConfig(file);
    expect(cfg.defaultAgent).toBe("claude");
    expect(cfg.agents.claude!.defaultArgs).toEqual(["--verbose"]);
    expect(cfg.agents.claude!.yoloArgs).toEqual(["--dangerously-skip-permissions", "--verbose"]);
    // Deprecated fields still populated
    expect(cfg.defaultArgs).toEqual(["--verbose"]);
    expect(cfg.yoloArgs).toEqual(["--dangerously-skip-permissions", "--verbose"]);
  });

  it("agents section takes precedence over legacy [claude]", () => {
    const content = `
default_agent = "claude"

[claude]
default_args = ["--old"]

[agents.claude]
default_args = ["--new"]
yolo_args = ["--dangerously-skip-permissions"]
`;
    const file = join(tmpDir, "config.toml");
    writeFileSync(file, content);

    const cfg = loadConfig(file);
    // agents section was present, so [claude] migration is skipped
    expect(cfg.agents.claude!.defaultArgs).toEqual(["--new"]);
  });

  it("preserves codex defaults when only claude is configured", () => {
    const content = `
[claude]
yolo_args = ["--dangerously-skip-permissions", "--verbose"]
`;
    const file = join(tmpDir, "config.toml");
    writeFileSync(file, content);

    const cfg = loadConfig(file);
    expect(cfg.agents.codex!.yoloArgs).toEqual(["--yolo"]);
    expect(cfg.agents.codex!.defaultArgs).toEqual([]);
  });
});

describe("saveConfig", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `zui-test-save-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preserves existing config sections on save", () => {
    const file = join(tmpDir, "config.toml");
    const existing = `socket = ""
refresh_interval = 2

[claude]
default_args = ["--verbose"]

[hooks]
post_worktree_create = "npm install"

[layout]
right_width = 70
lazygit_height = 40
`;
    writeFileSync(file, existing);

    const cfg = defaultConfig();
    cfg.layoutRightWidth = 80;
    saveConfig(cfg, file);

    const saved = readFileSync(file, "utf-8");
    expect(saved).toContain("right_width = 80");
    expect(saved).toContain("claude");
    expect(saved).toContain("hooks");
  });

  it("writes agents section and default_agent", () => {
    const file = join(tmpDir, "config.toml");
    const cfg = defaultConfig();
    cfg.defaultAgent = "codex";
    cfg.agents.claude = { defaultArgs: ["--verbose"], yoloArgs: ["--dangerously-skip-permissions"] };
    cfg.agents.codex = { defaultArgs: [], yoloArgs: ["--yolo"] };

    saveConfig(cfg, file);

    const saved = readFileSync(file, "utf-8");
    expect(saved).toContain('default_agent = "codex"');
    expect(saved).toContain("[agents.claude]");
    expect(saved).toContain("[agents.codex]");
  });

  it("round-trips config through save and load", () => {
    const file = join(tmpDir, "config.toml");
    const cfg = defaultConfig();
    cfg.defaultAgent = "codex";
    cfg.agents.claude = { defaultArgs: ["--verbose"], yoloArgs: ["--dangerously-skip-permissions"] };
    cfg.agents.codex = { defaultArgs: ["--full-auto"], yoloArgs: ["--yolo"] };

    saveConfig(cfg, file);
    const loaded = loadConfig(file);

    expect(loaded.defaultAgent).toBe("codex");
    expect(loaded.agents.claude!.defaultArgs).toEqual(["--verbose"]);
    expect(loaded.agents.codex!.defaultArgs).toEqual(["--full-auto"]);
    expect(loaded.agents.codex!.yoloArgs).toEqual(["--yolo"]);
  });
});
