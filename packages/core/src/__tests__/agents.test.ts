// src/__tests__/agents.test.ts
import { describe, it, expect } from "vitest";
import { claudeProvider } from "../agents/claude.js";
import { codexProvider } from "../agents/codex.js";
import { getProvider, allProviders } from "../agents/index.js";

describe("claudeProvider", () => {
  describe("buildCommand", () => {
    it("builds bare command with no args", () => {
      expect(claudeProvider.buildCommand([])).toBe("claude");
    });

    it("builds command with args", () => {
      expect(claudeProvider.buildCommand(["--verbose"])).toBe("claude --verbose");
    });

    it("builds command with multiple args", () => {
      expect(claudeProvider.buildCommand(["--dangerously-skip-permissions", "--verbose"])).toBe(
        "claude --dangerously-skip-permissions --verbose",
      );
    });
  });

  describe("detectStatus", () => {
    it("detects waiting y/n", () => {
      expect(claudeProvider.detectStatus("Allow tool use? (y/n)")).toBe("[WAIT]");
    });

    it("detects waiting approve", () => {
      expect(claudeProvider.detectStatus("Do you approve this?")).toBe("[WAIT]");
    });

    it("detects waiting press enter", () => {
      expect(claudeProvider.detectStatus("Press Enter to continue")).toBe("[WAIT]");
    });

    it("detects error", () => {
      expect(claudeProvider.detectStatus("Error: file not found")).toBe("[ERR]");
    });

    it("detects traceback error", () => {
      expect(claudeProvider.detectStatus("Traceback (most recent call)")).toBe("[ERR]");
    });

    it("detects failed error", () => {
      expect(claudeProvider.detectStatus("Command failed with exit code 1")).toBe("[ERR]");
    });

    it("detects idle prompt", () => {
      expect(claudeProvider.detectStatus("claude>")).toBe("[IDLE]");
    });

    it("detects idle dollar", () => {
      expect(claudeProvider.detectStatus("user@host:~$")).toBe("[IDLE]");
    });

    it("detects working", () => {
      expect(claudeProvider.detectStatus("Implementing login flow...")).toBe("[WORK]");
    });
  });

  it("has correct id", () => {
    expect(claudeProvider.id).toBe("claude");
  });

  it("has correct displayName", () => {
    expect(claudeProvider.displayName).toBe("Claude Code");
  });

  it("has default yoloArgs", () => {
    expect(claudeProvider.yoloArgs).toEqual(["--dangerously-skip-permissions"]);
  });
});

describe("codexProvider", () => {
  describe("buildCommand", () => {
    it("builds bare command with no args", () => {
      expect(codexProvider.buildCommand([])).toBe("codex");
    });

    it("builds command with args", () => {
      expect(codexProvider.buildCommand(["--yolo"])).toBe("codex --yolo");
    });

    it("builds command with multiple args", () => {
      expect(codexProvider.buildCommand(["--model", "gpt-5-codex"])).toBe("codex --model gpt-5-codex");
    });
  });

  describe("detectStatus", () => {
    it("detects waiting approve", () => {
      expect(codexProvider.detectStatus("approve? (y/n)")).toBe("[WAIT]");
    });

    it("detects waiting allow", () => {
      expect(codexProvider.detectStatus("[allow] [deny]")).toBe("[WAIT]");
    });

    it("detects error", () => {
      expect(codexProvider.detectStatus("error: something went wrong")).toBe("[ERR]");
    });

    it("detects panic error", () => {
      expect(codexProvider.detectStatus("panic: unexpected state")).toBe("[ERR]");
    });

    it("detects idle prompt with chevron", () => {
      expect(codexProvider.detectStatus("codex>")).toBe("[IDLE]");
    });

    it("detects idle prompt with angle bracket", () => {
      expect(codexProvider.detectStatus("ready >")).toBe("[IDLE]");
    });

    it("detects working", () => {
      expect(codexProvider.detectStatus("Generating code...")).toBe("[WORK]");
    });
  });

  it("has correct id", () => {
    expect(codexProvider.id).toBe("codex");
  });

  it("has correct displayName", () => {
    expect(codexProvider.displayName).toBe("Codex CLI");
  });

  it("has default yoloArgs", () => {
    expect(codexProvider.yoloArgs).toEqual(["--yolo"]);
  });
});

describe("registry", () => {
  it("getProvider returns claude", () => {
    expect(getProvider("claude")).toBe(claudeProvider);
  });

  it("getProvider returns codex", () => {
    expect(getProvider("codex")).toBe(codexProvider);
  });

  it("getProvider throws for unknown", () => {
    expect(() => getProvider("unknown")).toThrow("Unknown agent provider: unknown");
  });

  it("allProviders returns both", () => {
    const providers = allProviders();
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.id)).toContain("claude");
    expect(providers.map((p) => p.id)).toContain("codex");
  });
});
