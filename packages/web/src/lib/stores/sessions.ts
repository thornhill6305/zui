import { writable, derived } from 'svelte/store';
import type { Session, Project } from '@zui/core';

export const sessions = writable<Session[]>([]);
export const projects = writable<Project[]>([]);

// Issue #15: Add loading and error states
export const sessionsLoading = writable(false);
export const sessionsError = writable<string | null>(null);

export const sessionsByStatus = derived(sessions, ($sessions) => ({
  working: $sessions.filter((s) => s.status === '[WORK]'),
  waiting: $sessions.filter((s) => s.status === '[WAIT]'),
  error: $sessions.filter((s) => s.status === '[ERR]'),
  idle: $sessions.filter((s) => s.status === '[IDLE]'),
}));

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function fetchSessions(): Promise<void> {
  sessionsLoading.set(true);
  sessionsError.set(null);

  try {
    const res = await fetch('/api/sessions');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sessions.set(await res.json());
  } catch (err) {
    sessionsError.set(err instanceof Error ? err.message : 'Network error');
  } finally {
    sessionsLoading.set(false);
  }
}

export async function fetchProjects(): Promise<void> {
  try {
    const res = await fetch('/api/projects');
    if (res.ok) projects.set(await res.json());
  } catch {
    // network error
  }
}

export async function createSession(projectPath: string, yolo: boolean, agent?: string): Promise<string | null> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: projectPath, yolo, agent }),
  });
  const data = await res.json();
  if (data.ok) {
    await fetchSessions();
    return data.session;
  }
  return null;
}

export async function deleteSession(name: string): Promise<boolean> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(name)}`, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) await fetchSessions();
  return data.ok;
}

export function startAutoRefresh(intervalMs: number = 2000): void {
  stopAutoRefresh();
  fetchSessions();
  refreshTimer = setInterval(fetchSessions, intervalMs);
}

export function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export async function createWorktreeAndSession(
  repo: string,
  branch: string,
  yolo: boolean,
): Promise<string | null> {
  const wtRes = await fetch('/api/worktrees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo, branch }),
  });
  const wtData = await wtRes.json();
  if (!wtData.ok) throw new Error(wtData.error ?? 'Worktree creation failed');

  const sessionName = await createSession(wtData.path, yolo);
  await fetchProjects();
  return sessionName;
}

export async function fetchBrowseSuggestions(path: string): Promise<string[]> {
  try {
    const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function removeWorktree(
  parentRepo: string,
  worktreePath: string,
  branch: string,
): Promise<boolean> {
  const res = await fetch('/api/worktrees', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentRepo, worktreePath, branch }),
  });
  const data = await res.json();
  if (data.ok) {
    await fetchProjects();
    await fetchSessions();
  }
  return data.ok;
}
