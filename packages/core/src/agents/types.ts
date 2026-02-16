// src/agents/types.ts
export type SessionStatus = "[WORK]" | "[WAIT]" | "[ERR]" | "[IDLE]";

export interface AgentProvider {
  /** Unique key used in config and session metadata */
  id: string;
  /** Human-readable name */
  displayName: string;
  /** Build the shell command string for tmux */
  buildCommand(args: string[]): string;
  /** Detect session status from the last line of tmux output */
  detectStatus(preview: string): SessionStatus;
  /** Default args when spawning normally */
  defaultArgs: string[];
  /** Args used in yolo/auto-approve mode */
  yoloArgs: string[];
}

export interface AgentConfig {
  defaultArgs: string[];
  yoloArgs: string[];
}
