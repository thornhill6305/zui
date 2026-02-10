import { describe, it, expect } from "vitest";
import { parseIndex, formatSessionLine } from "../cli.js";
import type { Session } from "../types.js";

function makeSession(name: string, overrides?: Partial<Session>): Session {
  return {
    name,
    running: "5m 30s",
    idle: "10s ago",
    status: "[WORK]",
    preview: "Working on something...",
    ...overrides,
  };
}

describe("parseIndex", () => {
  it("returns error when no sessions", () => {
    expect(parseIndex("1", 0)).toBe("No sessions running");
  });

  it("returns error when arg is undefined", () => {
    expect(parseIndex(undefined, 3)).toBe("Usage: zui f <number>");
  });

  it("returns error when arg is empty", () => {
    expect(parseIndex("", 3)).toBe("Usage: zui f <number>");
  });

  it("returns error for non-numeric arg", () => {
    expect(parseIndex("abc", 3)).toBe("Invalid index: abc");
  });

  it("returns error for zero", () => {
    expect(parseIndex("0", 3)).toBe("Invalid index: 0");
  });

  it("returns error for negative", () => {
    expect(parseIndex("-1", 3)).toBe("Invalid index: -1");
  });

  it("returns error for float", () => {
    expect(parseIndex("1.5", 3)).toBe("Invalid index: 1.5");
  });

  it("returns error for out of range", () => {
    expect(parseIndex("5", 3)).toBe("Index 5 out of range (1-3)");
  });

  it("returns 0-based index for valid input", () => {
    expect(parseIndex("1", 3)).toBe(0);
    expect(parseIndex("2", 3)).toBe(1);
    expect(parseIndex("3", 3)).toBe(2);
  });
});

describe("formatSessionLine", () => {
  it("formats a session line with 1-based index", () => {
    const session = makeSession("my-project-main");
    const line = formatSessionLine(session, 0);
    expect(line).toContain("  1");
    expect(line).toContain("my-project-main");
    expect(line).toContain("[WORK]");
    expect(line).toContain("5m 30s");
  });

  it("pads index to 3 characters", () => {
    const session = makeSession("test");
    const line = formatSessionLine(session, 8);
    expect(line).toMatch(/^\s*9/);
  });

  it("truncates long names to 30 chars", () => {
    const session = makeSession("a-very-long-session-name-that-exceeds-thirty-chars");
    const line = formatSessionLine(session, 0);
    // Name column is 30 chars
    expect(line).toContain("a-very-long-session-name-that-");
  });

  it("truncates preview to 40 chars", () => {
    const session = makeSession("test", {
      preview: "x".repeat(60),
    });
    const line = formatSessionLine(session, 0);
    // Preview should be truncated
    const previewInLine = line.slice(line.lastIndexOf("  ") + 2);
    expect(previewInLine.length).toBeLessThanOrEqual(40);
  });
});
