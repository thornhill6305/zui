// src/types.ts
export interface ProjectConfig {
  path: string;
  worktreePattern: string;
}

export interface Config {
  socket: string;
  projects: ProjectConfig[];
  scanDirs: string[];
  defaultArgs: string[];
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
  status: "[WORK]" | "[WAIT]" | "[ERR]" | "[IDLE]";
  preview: string;
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
