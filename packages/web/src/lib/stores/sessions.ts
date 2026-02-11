import { writable, derived } from 'svelte/store';
import type { Session, Project } from '@zui/core';

export const sessions = writable<Session[]>([]);
export const projects = writable<Project[]>([]);

export const sessionsByStatus = derived(sessions, ($sessions) => ({
  working: $sessions.filter((s) => s.status === '[WORK]'),
  waiting: $sessions.filter((s) => s.status === '[WAIT]'),
  error: $sessions.filter((s) => s.status === '[ERR]'),
  idle: $sessions.filter((s) => s.status === '[IDLE]'),
}));

let refreshTimer: ReturnType<typeof setInterval> | null = null;

export async function fetchSessions(): Promise<void> {
  try {
    const res = await fetch('/api/sessions');
    if (res.ok) sessions.set(await res.json());
  } catch {
    // network error — keep stale data
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

export async function createSession(projectPath: string, yolo: boolean): Promise<string | null> {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project: projectPath, yolo }),
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
