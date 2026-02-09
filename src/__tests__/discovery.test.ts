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
