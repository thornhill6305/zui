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
});
