// src/web-server.ts
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "./types.js";
import { execFileSync } from "node:child_process";
import { runCommandOk } from "./shell.js";

const WEB_SESSION = "zui-web";

function tmuxBase(socket: string): string[] {
  return socket ? ["tmux", "-S", socket] : ["tmux"];
}

function resolveServerPath(): string {
  const coreDir = typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
  // core/src -> core -> packages -> packages/web
  return join(coreDir, "..", "..", "web", "server.js");
}

export function isWebServerRunning(config: Config): boolean {
  const base = tmuxBase(config.socket);
  return runCommandOk(base[0]!, [...base.slice(1), "has-session", "-t", WEB_SESSION]);
}

export function startWebServer(config: Config): [boolean, string] {
  if (isWebServerRunning(config)) {
    return [false, "Web server already running"];
  }

  const serverPath = resolveServerPath();
  const cmd = `HOST=${config.webHost} PORT=${config.webPort} node ${serverPath}`;
  const base = tmuxBase(config.socket);
  const ok = runCommandOk(base[0]!, [
    ...base.slice(1), "new-session", "-d", "-s", WEB_SESSION, cmd,
  ]);

  if (!ok) return [false, "Failed to create tmux session"];

  // tmux new-session exits 0 even if the command inside crashes.
  // Wait briefly then verify the session is still alive.
  try { execFileSync("sleep", ["1"]); } catch {}
  if (!isWebServerRunning(config)) {
    return [false, `Failed to start — port ${config.webPort} may be in use`];
  }

  return [true, `Web server started on http://${config.webHost}:${config.webPort}`];
}

export function stopWebServer(config: Config): boolean {
  const base = tmuxBase(config.socket);
  return runCommandOk(base[0]!, [...base.slice(1), "kill-session", "-t", WEB_SESSION]);
}

export function getWebServerUrl(config: Config): string {
  return `http://${config.webHost}:${config.webPort}`;
}

export const WEB_SERVER_SESSION = WEB_SESSION;
