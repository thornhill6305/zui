// src/types.ts
import type { AgentConfig, SessionStatus } from "./agents/types.js";

export type { AgentConfig, SessionStatus };

export interface ProjectConfig {
  path: string;
  worktreePattern: string;
}

export interface Config {
  socket: string;
  projects: ProjectConfig[];
  scanDirs: string[];
  defaultAgent: string;
  agents: Record<string, AgentConfig>;
  /** @deprecated Use agents["claude"].defaultArgs instead */
  defaultArgs: string[];
  /** @deprecated Use agents["claude"].yoloArgs instead */
  yoloArgs: string[];
  hookPostWorktreeCreate: string;
  refreshInterval: number;
  layoutRightWidth: number;
  layoutLazygitHeight: number;
  confirmCleanup: boolean;
  webPort: number;
  webHost: string;
}

export interface Session {
  name: string;
  running: string;
  idle: string;
  status: SessionStatus;
  preview: string;
  agent: string;
}

export interface Project {
  name: string;
  path: string;
  branch: string;
  isWorktree: boolean;
  parentRepo: string;
}

export function projectDisplayName(p: Project): string {
  if (p.branch && p.branch !== p.name) {
    return `${p.name} (${p.branch})`;
  }
  return p.name;
}
