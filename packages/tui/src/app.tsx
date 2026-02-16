// src/app.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useApp, useInput, useStdout } from "ink";
import type { Config, Session, Project } from "@zui/core";
import {
  getSessions, spawnSession, killSession, showSessionInPane,
  getSessionWorkdir, sessionExists, discoverProjects,
  createWorktree, removeWorktree, saveConfig,
  isWebServerRunning, startWebServer, stopWebServer, getTailscaleUrl,
  allProviders,
} from "@zui/core";
import { focusRightPane, focusBottomRightPane, closeRightPane, getPaneCount, killBottomRightPane, showLazygitPane, killZuiSession, toggleZoom } from "./ui/layout.js";
import { unregisterAltBindings } from "./ui/keybindings.js";
import { Header } from "./ui/Header.js";
import { Footer } from "./ui/Footer.js";
import { SessionList } from "./ui/SessionList.js";
import { EmptyState } from "./ui/EmptyState.js";
import { StatusMessage } from "./ui/StatusMessage.js";
import { ConfirmDialog } from "./ui/ConfirmDialog.js";
import { InputDialog } from "./ui/InputDialog.js";
import { ProjectPicker } from "./ui/ProjectPicker.js";
import { SettingsDialog } from "./ui/SettingsDialog.js";
import { HelpDialog } from "./ui/HelpDialog.js";
import { AgentPicker } from "./ui/AgentPicker.js";

type Dialog =
  | { type: "none" }
  | { type: "confirm"; message: string; onConfirm: () => void }
  | { type: "input"; title: string; prompt: string; defaultValue: string; onSubmit: (v: string) => void }
  | { type: "picker"; projects: Project[]; title: string; onSelect: (i: number) => void }
  | { type: "agentPicker"; onSelect: (agentId: string) => void }
  | { type: "settings" }
  | { type: "help" };

interface AppProps {
  config: Config;
  initialFocus?: number; // 1-based session index to auto-view on launch
}

export function App({ config: initialConfig, initialFocus }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [termSize, setTermSize] = useState({ rows: stdout.rows, cols: stdout.columns });
  const [config, setConfig] = useState(initialConfig);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [dialog, setDialog] = useState<Dialog>({ type: "none" });
  const [webRunning, setWebRunning] = useState(() => isWebServerRunning(initialConfig));
  const [tailscaleUrl, setTailscaleUrl] = useState("");

  // Track terminal resize
  useEffect(() => {
    const onResize = () => setTermSize({ rows: stdout.rows, cols: stdout.columns });
    stdout.on("resize", onResize);
    return () => { stdout.off("resize", onResize); };
  }, [stdout]);

  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const setStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(""), 3000);
  }, []);

  // Refresh sessions periodically — only update state when data changed
  const sessionsRef = useRef<string>("");
  useEffect(() => {
    const refresh = () => {
      const s = getSessions(config);
      const key = s.map(x => `${x.name}|${x.status}|${x.running}|${x.preview}`).join("\n");
      if (key !== sessionsRef.current) {
        sessionsRef.current = key;
        setSessions(s);
      }
      const webUp = isWebServerRunning(config);
      setWebRunning(webUp);
      if (webUp && !tailscaleUrl) {
        setTailscaleUrl(getTailscaleUrl(config));
      } else if (!webUp) {
        setTailscaleUrl("");
      }
    };
    refresh();
    const interval = setInterval(refresh, config.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [config]);

  // Initial project discovery
  useEffect(() => {
    setProjects(discoverProjects(config));
  }, [config]);

  // Auto-focus session from CLI arg (e.g. `zui 1`)
  const focusHandled = useRef(false);
  useEffect(() => {
    if (!initialFocus || focusHandled.current || sessions.length === 0) return;
    const idx = initialFocus - 1;
    if (idx >= 0 && idx < sessions.length) {
      focusHandled.current = true;
      setSelected(idx);
      const session = sessions[idx]!;
      if (showSessionInPane(session.name, config)) {
        focusRightPane();
        setStatus(`Showing: ${session.name}`);
      }
    }
  }, [sessions, initialFocus]);

  // Clamp selection
  useEffect(() => {
    if (sessions.length > 0 && selected >= sessions.length) {
      setSelected(sessions.length - 1);
    }
  }, [sessions, selected]);

  // Key handling
  useInput((input, key) => {
    // Alt-key remote control (works regardless of dialog state)
    if (key.meta && key.return && sessions.length > 0) {
      viewSession();
      return;
    }
    // Alt+Tab handled by tmux directly (select-pane to ZUI pane)

    if (key.meta && input.length > 0) {
      if (/^[0-9]$/.test(input) && sessions.length > 0) {
        const idx = input === "0" ? 9 : parseInt(input, 10) - 1;
        if (idx < sessions.length) {
          setSelected(idx);
          const session = sessions[idx]!;
          if (showSessionInPane(session.name, config)) {
            focusRightPane();
            setStatus(`Showing: ${session.name}`);
          }
        }
        return;
      }
      if (input === "q") { shutdownZui(); return; }
      if (input === "n") { launchSession(false); return; }
      if (input === "y") { launchSession(true); return; }
      if (input === "k" && sessions.length > 0) { killSessionAction(); return; }
      if (input === "x") { cleanupWorktree(); return; }
      if (input === "g" && sessions.length > 0) { showLazygitFromRemote(); return; }
      if (input === "w") { createWorktreeAction(); return; }
      if (input === "f") { toggleFullscreen(); return; }
      if (input === "v") { toggleWebServer(); return; }
      if (input === "a") { toggleDefaultAgent(); return; }
      if (input === "s") { setDialog({ type: "settings" }); return; }
      if (input === "h") { setDialog({ type: "help" }); return; }
      if (input === "c") {
        if (closeRightPane()) setStatus("Pane closed");
        return;
      }
      return;
    }

    if (dialog.type !== "none") return;

    // 1-9: Jump to session by index
    if (sessions.length > 0 && /^[1-9]$/.test(input)) {
      const idx = parseInt(input, 10) - 1;
      if (idx < sessions.length) {
        setSelected(idx);
        const session = sessions[idx]!;
        if (showSessionInPane(session.name, config)) {
          focusRightPane();
          setStatus(`Showing: ${session.name}`);
        }
      }
      return;
    }

    if (input === "q" || key.escape) {
      shutdownZui();
      return;
    }

    if (input === "r") {
      setSessions(getSessions(config));
      setStatus("Refreshed");
    }

    if (key.upArrow && sessions.length > 0) {
      setSelected((s) => Math.max(0, s - 1));
    }
    if (key.downArrow && sessions.length > 0) {
      setSelected((s) => Math.min(sessions.length - 1, s + 1));
    }

    if (key.return && sessions.length > 0) {
      viewSession();
    }

    if (input === "n") launchSession(false);
    if (input === "y") launchSession(true);
    if (input === "k" && sessions.length > 0) killSessionAction();
    if (input === "x") cleanupWorktree();
    if (input === "g" && sessions.length > 0) toggleLazygit();
    if (input === "w") createWorktreeAction();
    if (input === "a") toggleDefaultAgent();
    if (input === "f") toggleFullscreen();
    if (input === "v") toggleWebServer();
    if (input === "s") setDialog({ type: "settings" });
    if (input === "h") setDialog({ type: "help" });
    if (key.tab) focusRightPane();
  });

  function shutdownZui() {
    unregisterAltBindings();
    killZuiSession();
    exit();
  }

  function viewSession() {
    const session = sessions[selected];
    if (!session) return;
    if (showSessionInPane(session.name, config)) {
      focusRightPane();
      setStatus(`Showing: ${session.name}`);
    } else {
      setStatus("Error: Failed to open pane");
    }
  }

  function showLazygitFromRemote() {
    const numPanes = getPaneCount();
    const session = sessions[selected];
    if (!session) return;
    if (numPanes >= 3) {
      focusBottomRightPane();
      return;
    }
    const workdir = getSessionWorkdir(session.name, config);
    if (!workdir) {
      setStatus("Error: Can't find session workdir");
      return;
    }
    if (numPanes < 2) {
      if (showSessionInPane(session.name, config)) {
        setTimeout(() => {
          showLazygitPane(workdir, config.layoutRightWidth, config.layoutLazygitHeight);
          focusBottomRightPane();
          setStatus(`View + Git: ${session.name}`);
        }, 200);
      }
    } else {
      showLazygitPane(workdir, config.layoutRightWidth, config.layoutLazygitHeight);
      focusBottomRightPane();
      setStatus(`Git: ${workdir.split("/").pop()}`);
    }
  }

  function doSpawn(workdir: string, yolo: boolean, agentId: string) {
    const [ok, result] = spawnSession(workdir, config, yolo, { agent: agentId });
    if (ok) {
      showSessionInPane(result, config);
      focusRightPane();
      setStatus(`${yolo ? "YOLO" : "Launched"}: ${result} (${agentId})`);
    } else {
      setStatus(result);
    }
    setSessions(getSessions(config));
  }

  function pickAgentThenSpawn(workdir: string, yolo: boolean) {
    const providers = allProviders();
    if (providers.length <= 1) {
      doSpawn(workdir, yolo, config.defaultAgent);
      return;
    }
    setDialog({
      type: "agentPicker",
      onSelect: (agentId) => {
        setDialog({ type: "none" });
        doSpawn(workdir, yolo, agentId);
      },
    });
  }

  function launchSession(yolo: boolean) {
    const refreshedProjects = discoverProjects(config);
    setProjects(refreshedProjects);

    if (refreshedProjects.length === 0) {
      setDialog({
        type: "input",
        title: yolo ? "New YOLO Session" : "New Session",
        prompt: "Workdir:",
        defaultValue: process.cwd(),
        onSubmit: (workdir) => {
          setDialog({ type: "none" });
          pickAgentThenSpawn(workdir, yolo);
        },
      });
      return;
    }

    const title = yolo ? "YOLO Launch" : "Launch Session";
    setDialog({
      type: "picker",
      projects: refreshedProjects,
      title,
      onSelect: (idx) => {
        setDialog({ type: "none" });
        const proj = refreshedProjects[idx]!;

        const branch = proj.branch ? proj.branch.replace(/\//g, "-") : "";
        const candidate = branch ? `${proj.name}-${branch}` : proj.name;
        if (sessionExists(candidate, config)) {
          showSessionInPane(candidate, config);
          focusRightPane();
          setStatus(`Showing: ${candidate}`);
          setSessions(getSessions(config));
          return;
        }

        pickAgentThenSpawn(proj.path, yolo);
      },
    });
  }

  function toggleDefaultAgent() {
    const providers = allProviders();
    const currentIdx = providers.findIndex((p) => p.id === config.defaultAgent);
    const nextIdx = (currentIdx + 1) % providers.length;
    const next = providers[nextIdx]!;
    const newConfig = { ...config, defaultAgent: next.id };
    setConfig(newConfig);
    try {
      saveConfig(newConfig);
    } catch {
      // ignore save errors for toggle
    }
    setStatus(`Default agent: ${next.displayName}`);
  }

  function killSessionAction() {
    const session = sessions[selected];
    if (!session) return;
    setDialog({
      type: "confirm",
      message: `Kill ${session.name}?`,
      onConfirm: () => {
        setDialog({ type: "none" });
        if (killSession(session.name, config)) {
          setStatus(`Killed: ${session.name}`);
        } else {
          setStatus(`Error: Failed to kill ${session.name}`);
        }
        setSessions(getSessions(config));
      },
    });
  }

  function cleanupWorktree() {
    const refreshedProjects = discoverProjects(config);
    const worktrees = refreshedProjects.filter((p) => p.isWorktree);

    if (worktrees.length === 0) {
      setStatus("No worktrees to clean");
      return;
    }

    setDialog({
      type: "picker",
      projects: worktrees,
      title: "Clean Worktree",
      onSelect: (idx) => {
        const proj = worktrees[idx]!;

        const doCleanup = () => {
          setDialog({ type: "none" });
          const baseName = proj.path.split("/").pop()!;
          for (const sess of sessions) {
            if (sess.name.includes(baseName) || sess.name.endsWith(baseName)) {
              killSession(sess.name, config);
              break;
            }
          }
          const [ok, msg] = removeWorktree(proj.parentRepo, proj.path, proj.branch);
          setStatus(ok ? `Cleaned: ${proj.name}` : `Error: ${msg}`);
          setSessions(getSessions(config));
        };

        if (config.confirmCleanup) {
          setDialog({
            type: "confirm",
            message: `Clean ${proj.name}? (remove worktree + delete branch)`,
            onConfirm: doCleanup,
          });
        } else {
          doCleanup();
        }
      },
    });
  }

  function toggleLazygit() {
    const numPanes = getPaneCount();
    if (numPanes >= 3) {
      killBottomRightPane();
      setStatus("Git: hidden");
      return;
    }
    const session = sessions[selected];
    if (!session) return;
    const workdir = getSessionWorkdir(session.name, config);
    if (!workdir) {
      setStatus("Error: Can't find session workdir");
      return;
    }
    if (numPanes < 2) {
      if (showSessionInPane(session.name, config)) {
        setTimeout(() => {
          showLazygitPane(workdir, config.layoutRightWidth, config.layoutLazygitHeight);
          setStatus(`View + Git: ${session.name}`);
        }, 200);
      }
    } else {
      showLazygitPane(workdir, config.layoutRightWidth, config.layoutLazygitHeight);
      setStatus(`Git: ${workdir.split("/").pop()}`);
    }
  }

  function createWorktreeAction() {
    const refreshedProjects = discoverProjects(config);
    const repos = refreshedProjects.filter((p) => !p.isWorktree);

    if (repos.length === 0) {
      setStatus("No git repos found");
      return;
    }

    const pickBranch = (repo: Project) => {
      setDialog({
        type: "input",
        title: "New Worktree",
        prompt: "Branch:",
        defaultValue: "feat/",
        onSubmit: (branch) => {
          setDialog({ type: "none" });
          if (!branch.trim()) {
            setStatus("Cancelled");
            return;
          }
          const [ok, result] = createWorktree(repo.path, branch.trim(), config);
          if (ok) {
            setStatus(`Created: ${result.split("/").pop()} (${branch.trim()})`);
            setProjects(discoverProjects(config));
          } else {
            setStatus(`Error: ${result}`);
          }
        },
      });
    };

    if (repos.length === 1) {
      pickBranch(repos[0]!);
    } else {
      setDialog({
        type: "picker",
        projects: repos,
        title: "New Worktree - Pick Repo",
        onSelect: (idx) => pickBranch(repos[idx]!),
      });
    }
  }

  function toggleWebServer() {
    if (webRunning) {
      if (stopWebServer(config)) {
        setWebRunning(false);
        setStatus("Web server stopped");
      } else {
        setStatus("Error: Failed to stop web server");
      }
    } else {
      const [ok, msg] = startWebServer(config);
      if (ok) {
        setWebRunning(true);
        setStatus(`Web :${config.webPort} started`);
      } else {
        setStatus(msg);
      }
    }
  }

  function toggleFullscreen() {
    if (toggleZoom()) {
      setStatus("Fullscreen toggled");
    } else {
      setStatus("Open a session first");
    }
  }

  function handleSettingsSave(updates: Partial<Config>) {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    setDialog({ type: "none" });
    try {
      saveConfig(newConfig);
      setStatus("Settings saved");
    } catch (e) {
      setStatus(`Error saving: ${e}`);
    }
  }

  return (
    <Box flexDirection="column" height={termSize.rows}>
      <Header webRunning={webRunning} webPort={config.webPort} tailscaleUrl={tailscaleUrl} defaultAgent={config.defaultAgent} />

      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <SessionList sessions={sessions} selectedIndex={selected} />
      )}

      <StatusMessage message={statusMessage} />
      <Footer webRunning={webRunning} />

      {dialog.type === "confirm" && (
        <ConfirmDialog
          message={dialog.message}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "input" && (
        <InputDialog
          title={dialog.title}
          prompt={dialog.prompt}
          defaultValue={dialog.defaultValue}
          onSubmit={dialog.onSubmit}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "picker" && (
        <ProjectPicker
          projects={dialog.projects}
          title={dialog.title}
          onSelect={dialog.onSelect}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "settings" && (
        <SettingsDialog
          config={config}
          onSave={handleSettingsSave}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "agentPicker" && (
        <AgentPicker
          onSelect={dialog.onSelect}
          onCancel={() => setDialog({ type: "none" })}
        />
      )}
      {dialog.type === "help" && (
        <HelpDialog onClose={() => setDialog({ type: "none" })} />
      )}
    </Box>
  );
}
