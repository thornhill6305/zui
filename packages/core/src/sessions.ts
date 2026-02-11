// src/sessions.ts
import { existsSync } from "node:fs";
import type { Config, Session } from "./types.js";
import { runCommand, runCommandOk } from "./shell.js";

function tmuxBase(socket: string): string[] {
  return socket ? ["tmux", "-S", socket] : ["tmux"];
}

function runTmux(args: string[], socket: string): string {
  const base = tmuxBase(socket);
  return runCommand(base[0]!, [...base.slice(1), ...args]);
}

function getOwnSessionName(socket: string): string | null {
  const tmuxEnv = process.env.TMUX ?? "";
  if (!tmuxEnv) return null;
  const paneId = process.env.TMUX_PANE ?? "";
  if (!paneId) return null;
  const output = runTmux(
    ["display-message", "-t", paneId, "-p", "#{session_name}"],
    socket,
  );
  return output || null;
}

export function getSessions(config: Config): Session[] {
  const output = runTmux(
    ["list-sessions", "-F", "#{session_name}|#{session_created}|#{session_activity}"],
    config.socket,
  );
  if (!output) return [];

  const sessions: Session[] = [];
  const now = Date.now() / 1000;
  const ownSession = getOwnSessionName(config.socket);

  for (const line of output.split("\n")) {
    if (!line) continue;
    const parts = line.split("|");
    if (parts.length < 3) continue;

    const name = parts[0]!;
    if (name === ownSession) continue;

    const created = parseInt(parts[1]!, 10);
    const lastActivity = parseInt(parts[2]!, 10);
    if (isNaN(created) || isNaN(lastActivity)) continue;

    const runningSecs = Math.floor(now - created);
    const runningStr = formatDuration(runningSecs);

    const idleSecs = Math.floor(now - lastActivity);
    const idleStr = idleSecs < 60 ? `${idleSecs}s ago` : `${Math.floor(idleSecs / 60)}m ago`;

    const preview = getPreview(name, config.socket);
    const status = detectStatus(preview);

    sessions.push({
      name,
      running: runningStr,
      idle: idleStr,
      status,
      preview: preview ? preview.slice(0, 80) : "(no output)",
    });
  }

  return sessions;
}

export function spawnSession(
  workdir: string,
  config: Config,
  yolo: boolean = false,
): [boolean, string] {
  const dirName = workdir.replace(/\/+$/, "").split("/").pop()!;
  let branch = "";
  const branchResult = runCommand("git", ["-C", workdir, "branch", "--show-current"]);
  if (branchResult) {
    branch = branchResult.replace(/\//g, "-");
  }

  let sessionName = branch ? `${dirName}-${branch}` : dirName;
  sessionName = sessionName.replace(/[^a-zA-Z0-9_-]/g, "-");

  const base = tmuxBase(config.socket);
  if (runCommandOk(base[0]!, [...base.slice(1), "has-session", "-t", sessionName])) {
    return [false, `Session ${sessionName} already exists`];
  }

  const args = yolo ? config.yoloArgs : config.defaultArgs;
  const claudeCmd = args.length ? `claude ${args.join(" ")}` : "claude";

  const ok = runCommandOk(base[0]!, [
    ...base.slice(1),
    "new-session", "-d", "-s", sessionName, "-c", workdir, claudeCmd,
  ]);

  return ok ? [true, sessionName] : [false, "Failed to create session"];
}

export function killSession(name: string, config: Config): boolean {
  const base = tmuxBase(config.socket);
  return runCommandOk(base[0]!, [...base.slice(1), "kill-session", "-t", name]);
}

export function showSessionInPane(sessionName: string, config: Config): boolean {
  const paneCountOut = runCommand("tmux", ["display-message", "-p", "#{window_panes}"]);
  const numPanes = /^\d+$/.test(paneCountOut) ? parseInt(paneCountOut, 10) : 1;

  const socketArgs = config.socket ? ` -S '${config.socket.replace(/'/g, "'\\''")}'` : "";
  const cmd = `unset TMUX; tmux${socketArgs} attach -t '${sessionName.replace(/'/g, "'\\''")}'`;

  let ok: boolean;
  if (numPanes > 1) {
    // Respawn existing right pane in-place — no layout reflow
    ok = runCommandOk("tmux", [
      "respawn-pane", "-k", "-t", "{right}", cmd,
    ]);
  } else {
    ok = runCommandOk("tmux", [
      "split-window", "-d", "-h", "-l", `${config.layoutRightWidth}%`, cmd,
    ]);
  }

  if (ok) {
    const workdir = getSessionWorkdir(sessionName, config) ?? "~";
    const branch = getGitBranch(workdir);
    const shortPath = workdir.replace(process.env.HOME ?? "", "~");
    const title = branch ? `${shortPath} (${branch})` : shortPath;
    runCommand("tmux", ["select-pane", "-t", "{right}", "-T", title]);
  }

  return ok;
}

export function getSessionWorkdir(sessionName: string, config: Config): string | null {
  const base = tmuxBase(config.socket);
  const path = runCommand(base[0]!, [
    ...base.slice(1), "display-message", "-t", sessionName, "-p", "#{pane_current_path}",
  ]);
  return path && existsSync(path) ? path : null;
}

export function sessionExists(name: string, config: Config): boolean {
  const base = tmuxBase(config.socket);
  return runCommandOk(base[0]!, [...base.slice(1), "has-session", "-t", name]);
}

function getGitBranch(path: string): string | null {
  if (!path || !existsSync(path)) return null;
  const result = runCommand("git", ["-C", path, "rev-parse", "--abbrev-ref", "HEAD"]);
  return result || null;
}

export function formatDuration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function getPreview(session: string, socket: string): string {
  const output = runTmux(
    ["capture-pane", "-p", "-t", session, "-S", "-5"],
    socket,
  );
  if (!output) return "";
  const lines = output.split("\n").filter((l) => l.trim());
  return lines.at(-1)?.trim() ?? "";
}

export function detectStatus(preview: string): Session["status"] {
  const lower = preview.toLowerCase();

  const waitPatterns = ["? ", "allow", "approve", "y/n", "(y)", "press enter", "continue?", "proceed?"];
  if (waitPatterns.some((p) => lower.includes(p))) return "[WAIT]";

  const errPatterns = ["error:", "failed", "exception", "traceback"];
  if (errPatterns.some((p) => lower.includes(p))) return "[ERR]";

  if (preview.endsWith(">") || preview.endsWith("$") || (lower.includes("claude") && preview.includes(">"))) {
    return "[IDLE]";
  }

  return "[WORK]";
}
