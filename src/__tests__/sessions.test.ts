// src/__tests__/sessions.test.ts
import { describe, it, expect } from "vitest";
import { formatDuration, detectStatus } from "../sessions.js";

describe("formatDuration", () => {
  it("formats seconds", () => { expect(formatDuration(45)).toBe("45s"); });
  it("formats minutes", () => { expect(formatDuration(125)).toBe("2m 5s"); });
  it("formats hours", () => { expect(formatDuration(3661)).toBe("1h 1m"); });
  it("formats zero", () => { expect(formatDuration(0)).toBe("0s"); });
  it("formats exactly one hour", () => { expect(formatDuration(3600)).toBe("1h 0m"); });
});

describe("detectStatus", () => {
  it("detects waiting y/n", () => { expect(detectStatus("Allow tool use? (y/n)")).toBe("[WAIT]"); });
  it("detects waiting approve", () => { expect(detectStatus("Do you approve this?")).toBe("[WAIT]"); });
  it("detects error", () => { expect(detectStatus("Error: file not found")).toBe("[ERR]"); });
  it("detects traceback error", () => { expect(detectStatus("Traceback (most recent call)")).toBe("[ERR]"); });
  it("detects idle prompt", () => { expect(detectStatus("claude>")).toBe("[IDLE]"); });
  it("detects idle dollar", () => { expect(detectStatus("user@host:~$")).toBe("[IDLE]"); });
  it("detects working", () => { expect(detectStatus("Implementing login flow...")).toBe("[WORK]"); });
});
