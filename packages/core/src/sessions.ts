// src/sessions.ts
import { existsSync } from "node:fs";
import type { Config, Session } from "./types.js";
import { runCommand, runCommandOk } from "./shell.js";
import { getProvider } from "./agents/index.js";

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

function getSessionAgent(name: string, socket: string): string {
  const output = runTmux(["show-environment", "-t", name, "ZUI_AGENT"], socket);
  // Output format: "ZUI_AGENT=codex" or error/empty
  if (output && output.startsWith("ZUI_AGENT=")) {
    return output.slice("ZUI_AGENT=".length).trim();
  }
  return "claude"; // fallback for pre-existing sessions
}

const INTERNAL_SESSIONS = new Set(["zui-web"]);

export function getSessions(config: Config, options?: { exclude?: string[]; skipOwnSession?: boolean }): Session[] {
  const output = runTmux(
    ["list-sessions", "-F", "#{session_name}|#{session_created}|#{session_activity}"],
    config.socket,
  );
  if (!output) return [];

  const sessions: Session[] = [];
  const now = Date.now() / 1000;
  const ownSession = options?.skipOwnSession ? null : getOwnSessionName(config.socket);
  const excludeSet = new Set(options?.exclude ?? []);

  for (const line of output.split("\n")) {
    if (!line) continue;
    const parts = line.split("|");
    if (parts.length < 3) continue;

    const name = parts[0]!;
    if (name === ownSession) continue;
    if (excludeSet.has(name)) continue;
    if (INTERNAL_SESSIONS.has(name)) continue;

    const created = parseInt(parts[1]!, 10);
    const lastActivity = parseInt(parts[2]!, 10);
    if (isNaN(created) || isNaN(lastActivity)) continue;

    const runningSecs = Math.floor(now - created);
    const runningStr = formatDuration(runningSecs);

    const idleSecs = Math.floor(now - lastActivity);
    const idleStr = idleSecs < 60 ? `${idleSecs}s ago` : `${Math.floor(idleSecs / 60)}m ago`;

    const agent = getSessionAgent(name, config.socket);
    const paneLines = capturePaneLines(name, config.socket);
    const preview = extractPreview(paneLines);
    const status = detectStatusFromPane(paneLines);

    sessions.push({
      name,
      running: runningStr,
      idle: idleStr,
      status,
      preview: preview ? preview.slice(0, 80) : "(no output)",
      agent,
    });
  }

  return sessions;
}

export function spawnSession(
  workdir: string,
  config: Config,
  yolo: boolean = false,
  options?: { agent?: string },
): [boolean, string] {
  const agentId = options?.agent ?? config.defaultAgent;

  let provider;
  try {
    provider = getProvider(agentId);
  } catch {
    return [false, `Unknown agent: ${agentId}`];
  }

  const agentCfg = config.agents[agentId] ?? { defaultArgs: provider.defaultArgs, yoloArgs: provider.yoloArgs };
  const args = yolo ? agentCfg.yoloArgs : agentCfg.defaultArgs;

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
    let suffix = 2;
    while (runCommandOk(base[0]!, [...base.slice(1), "has-session", "-t", `${sessionName}-${suffix}`])) {
      suffix++;
    }
    sessionName = `${sessionName}-${suffix}`;
  }

  const cmd = provider.buildCommand(args);

  const ok = runCommandOk(base[0]!, [
    ...base.slice(1),
    "new-session", "-d", "-s", sessionName, "-c", workdir, cmd,
  ]);

  if (!ok) return [false, "Failed to create session"];

  // Tag session with agent ID
  runTmux(["set-environment", "-t", sessionName, "ZUI_AGENT", agentId], config.socket);

  return [true, sessionName];
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

function capturePaneLines(session: string, socket: string): string[] {
  const output = runTmux(
    ["capture-pane", "-p", "-t", session, "-S", "-50"],
    socket,
  );
  if (!output) return [];
  return output.split("\n").filter((l) => l.trim());
}

function extractPreview(lines: string[]): string {
  if (lines.length === 0) return "";

  // Find Claude's last text message: "● text" but not "● ToolName(...)"
  for (let i = lines.length - 1; i >= 0; i--) {
    const text = lines[i]!.trim();
    const match = text.match(/^●\s+(.+)/);
    if (match && !/^\w+\(/.test(match[1]!)) {
      return match[1]!.trim().slice(0, 80);
    }
  }

  // Fallback: last non-empty line
  return lines.at(-1)?.trim() ?? "";
}

function detectStatusFromPane(lines: string[]): Session["status"] {
  // Active actions end with … (ellipsis). Completed ones use ✻ without ellipsis.
  // e.g. "✽ Imagining…" = working, "✻ Imagined" = done
  const tail = lines.slice(-10);
  for (let i = tail.length - 1; i >= 0; i--) {
    const text = tail[i]!.trim();
    // Active spinner line: any symbol + word + ellipsis
    if (/^[^\w\s]\s+\S+…/.test(text)) return "[WORK]";
    // Completed action line: ✻ = done, check next
    if (/^✻\s/.test(text)) return "[IDLE]";
  }
  return "[IDLE]";
}
