// src/app.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Box, useApp, useInput } from "ink";
import type { Config, Session, Project } from "./types.js";
import { getSessions, spawnSession, killSession, showSessionInPane, getSessionWorkdir, sessionExists } from "./sessions.js";
import { discoverProjects } from "./discovery.js";
import { createWorktree, removeWorktree } from "./worktrees.js";
import { saveConfig } from "./config.js";
import { focusRightPane, getPaneCount, killBottomRightPane, showLazygitPane, killZuiSession } from "./ui/layout.js";
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

type Dialog =
  | { type: "none" }
  | { type: "confirm"; message: string; onConfirm: () => void }
  | { type: "input"; title: string; prompt: string; defaultValue: string; onSubmit: (v: string) => void }
  | { type: "picker"; projects: Project[]; title: string; onSelect: (i: number) => void }
  | { type: "settings" }
  | { type: "help" };

interface AppProps {
  config: Config;
}

export function App({ config: initialConfig }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const [config, setConfig] = useState(initialConfig);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [dialog, setDialog] = useState<Dialog>({ type: "none" });

  const statusTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const setStatus = useCallback((msg: string) => {
    setStatusMessage(msg);
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(""), 3000);
  }, []);

  // Refresh sessions periodically
  useEffect(() => {
    const refresh = () => {
      const s = getSessions(config);
      setSessions(s);
    };
    refresh();
    const interval = setInterval(refresh, config.refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [config]);

  // Initial project discovery
  useEffect(() => {
    setProjects(discoverProjects(config));
  }, [config]);

  // Clamp selection
  useEffect(() => {
    if (sessions.length > 0 && selected >= sessions.length) {
      setSelected(sessions.length - 1);
    }
  }, [sessions, selected]);

  // Key handling (only when no dialog is open)
  useInput((input, key) => {
    if (dialog.type !== "none") return;

    if (input === "q" || key.escape) {
      killZuiSession();
      exit();
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
    if (input === "s") setDialog({ type: "settings" });
    if (input === "h") setDialog({ type: "help" });
    if (key.tab) focusRightPane();
  });

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

  function launchSession(yolo: boolean) {
    const refreshedProjects = discoverProjects(config);
    setProjects(refreshedProjects);

    if (refreshedProjects.length === 0) {
      setDialog({
        type: "input",
        title: yolo ? "New YOLO Session" : "New Claude Session",
        prompt: "Workdir:",
        defaultValue: process.cwd(),
        onSubmit: (workdir) => {
          setDialog({ type: "none" });
          const [ok, result] = spawnSession(workdir, config, yolo);
          if (ok) {
            showSessionInPane(result, config);
            focusRightPane();
            setStatus(`${yolo ? "YOLO" : "Launched"}: ${result}`);
          } else {
            setStatus(result);
          }
          setSessions(getSessions(config));
        },
      });
      return;
    }

    const title = yolo ? "YOLO Launch" : "Launch Claude";
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

        const [ok, result] = spawnSession(proj.path, config, yolo);
        if (ok) {
          showSessionInPane(result, config);
          focusRightPane();
          setStatus(`${yolo ? "YOLO" : "Launched"}: ${result}`);
        } else {
          setStatus(result);
        }
        setSessions(getSessions(config));
      },
    });
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
    <Box flexDirection="column" height="100%">
      <Header />

      {sessions.length === 0 ? (
        <EmptyState />
      ) : (
        <SessionList sessions={sessions} selectedIndex={selected} />
      )}

      <StatusMessage message={statusMessage} />
      <Footer />

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
      {dialog.type === "help" && (
        <HelpDialog onClose={() => setDialog({ type: "none" })} />
      )}
    </Box>
  );
}
