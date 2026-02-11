import { json } from '@sveltejs/kit';
import { discoverProjects, loadConfig } from '@zui/core';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const config = loadConfig();
  const projects = discoverProjects(config);
  return json(projects);
};
