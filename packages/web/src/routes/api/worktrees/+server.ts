import { json } from '@sveltejs/kit';
import { createWorktree, removeWorktree, loadConfig, discoverProjects } from '@zui/core';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { repo, branch } = body as { repo?: string; branch?: string };

  if (!repo || !branch || typeof repo !== 'string' || typeof branch !== 'string') {
    return json({ ok: false, error: 'Missing repo or branch' }, { status: 400 });
  }

  // Issue #8: Tighten branch name validation — disallow path traversal
  const parts = branch.split('/');
  if (parts.length > 3 || parts.some(p => p === '' || p === '.' || p === '..') || !/^[a-zA-Z0-9_./-]+$/.test(branch)) {
    return json({ ok: false, error: 'Invalid branch name' }, { status: 400 });
  }

  const config = loadConfig();

  // Validate repo is a known project
  const projects = discoverProjects(config);
  const match = projects.find((p) => p.path === repo && !p.isWorktree);
  if (!match) {
    return json({ ok: false, error: 'Unknown repository' }, { status: 400 });
  }

  const [ok, result] = createWorktree(repo, branch, config);
  if (!ok) {
    return json({ ok: false, error: result }, { status: 409 });
  }

  return json({ ok: true, path: result });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { parentRepo, worktreePath, branch } = body as {
    parentRepo?: string;
    worktreePath?: string;
    branch?: string;
  };

  if (!parentRepo || !worktreePath || !branch) {
    return json({ ok: false, error: 'Missing parentRepo, worktreePath, or branch' }, { status: 400 });
  }

  const [ok, result] = removeWorktree(parentRepo, worktreePath, branch);
  return json({ ok, message: result }, { status: ok ? 200 : 500 });
};
