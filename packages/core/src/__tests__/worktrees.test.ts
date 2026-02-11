// src/__tests__/worktrees.test.ts
import { describe, it, expect } from "vitest";
import { deriveWorktreePath } from "../worktrees.js";

describe("deriveWorktreePath", () => {
  it("derives path from simple branch", () => {
    expect(deriveWorktreePath("/home/user/myapp", "feat/auth")).toBe("/home/user/myapp-feat-auth");
  });

  it("derives path from nested branch", () => {
    expect(deriveWorktreePath("/home/user/myapp", "feat/ui/modal")).toBe("/home/user/myapp-feat-ui-modal");
  });

  it("derives path from plain branch", () => {
    expect(deriveWorktreePath("/home/user/myapp", "bugfix")).toBe("/home/user/myapp-bugfix");
  });
});
