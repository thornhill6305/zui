import { json } from '@sveltejs/kit';
import { getSessions, spawnSession, loadConfig, discoverProjects } from '@zui/core';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const config = loadConfig();
  const sessions = getSessions(config, { exclude: ['zui-manager'], skipOwnSession: true });
  return json(sessions);
};

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { project, yolo } = body as { project?: string; yolo?: boolean };

  if (!project || typeof project !== 'string') {
    return json({ ok: false, error: 'Missing project path' }, { status: 400 });
  }

  const config = loadConfig();

  // Validate that the project path exists in discovered projects
  const projects = discoverProjects(config);
  const match = projects.find((p) => p.path === project);
  if (!match) {
    return json({ ok: false, error: 'Unknown project' }, { status: 400 });
  }

  const [ok, result] = spawnSession(project, config, yolo ?? false);
  if (!ok) {
    return json({ ok: false, error: result }, { status: 409 });
  }

  return json({ ok: true, session: result });
};
