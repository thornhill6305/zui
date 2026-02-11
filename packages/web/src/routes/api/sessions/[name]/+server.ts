import { json } from '@sveltejs/kit';
import { killSession, sessionExists, loadConfig } from '@zui/core';
import type { RequestHandler } from './$types';

const SAFE_NAME = /^[a-zA-Z0-9_.-]+$/;

export const DELETE: RequestHandler = async ({ params }) => {
  const { name } = params;

  if (!name || !SAFE_NAME.test(name)) {
    return json({ ok: false, error: 'Invalid session name' }, { status: 400 });
  }

  const config = loadConfig();

  if (!sessionExists(name, config)) {
    return json({ ok: false, error: 'Session not found' }, { status: 404 });
  }

  const ok = killSession(name, config);
  return json({ ok }, { status: ok ? 200 : 500 });
};
