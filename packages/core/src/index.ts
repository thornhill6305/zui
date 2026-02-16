// @zui/core — barrel export
export { loadConfig, defaultConfig, saveConfig } from "./config.js";
export { discoverProjects } from "./discovery.js";
export {
  getSessions,
  spawnSession,
  killSession,
  showSessionInPane,
  getSessionWorkdir,
  sessionExists,
  formatDuration,
  detectStatus,
} from "./sessions.js";
export {
  startWebServer, stopWebServer, isWebServerRunning, getWebServerUrl,
  getTailscaleUrl, WEB_SERVER_SESSION,
} from "./web-server.js";
export { deriveWorktreePath, createWorktree, removeWorktree } from "./worktrees.js";
export { runCommand, runCommandOk } from "./shell.js";
export { parseIndex, formatSessionLine } from "./cli.js";
export { projectDisplayName } from "./types.js";
export type { Config, ProjectConfig, Session, Project, AgentConfig, SessionStatus } from "./types.js";

// Agent provider system
export { getProvider, allProviders } from "./agents/index.js";
export type { AgentProvider } from "./agents/index.js";
