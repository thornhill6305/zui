import { json } from '@sveltejs/kit';
import { getSessions, spawnSession, loadConfig, discoverProjects } from '@zui/core';
import { existsSync, statSync } from 'node:fs';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const config = loadConfig();
  const sessions = getSessions(config, { exclude: ['zui-manager'], skipOwnSession: true });
  return json(sessions);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { project, yolo, agent } = body as { project?: string; yolo?: boolean; agent?: string };

  if (!project || typeof project !== 'string') {
    return json({ ok: false, error: 'Missing project path' }, { status: 400 });
  }

  const config = loadConfig();

  // Accept discovered projects or any existing directory
  const projects = discoverProjects(config);
  const match = projects.find((p) => p.path === project);
  if (!match) {
    if (!existsSync(project) || !statSync(project).isDirectory()) {
      return json({ ok: false, error: 'Path is not a valid directory' }, { status: 400 });
    }
  }

  const [ok, result] = spawnSession(project, config, yolo ?? false, {
    agent: typeof agent === 'string' ? agent : undefined,
  });
  if (!ok) {
    return json({ ok: false, error: result }, { status: 409 });
  }

  return json({ ok: true, session: result });
};
