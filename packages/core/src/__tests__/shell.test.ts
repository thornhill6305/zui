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
