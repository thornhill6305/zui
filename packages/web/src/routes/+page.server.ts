import { getSessions, loadConfig, discoverProjects } from '@zui/core';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const config = loadConfig();
  const sessions = getSessions(config, { exclude: ['zui-manager'], skipOwnSession: true });
  const projects = discoverProjects(config);

  return {
    sessions,
    projects,
  };
};
