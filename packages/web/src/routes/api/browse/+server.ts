import { json } from '@sveltejs/kit';
import { readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import { homedir } from 'node:os';
import type { RequestHandler } from './$types';

function expandHome(p: string): string {
  if (p.startsWith('~/')) return join(homedir(), p.slice(2));
  if (p === '~') return homedir();
  return p;
}

export const GET: RequestHandler = async ({ url }) => {
  const input = url.searchParams.get('path') ?? '~/';
  const expanded = expandHome(input);
  const resolved = resolve(expanded);

  try {
    let parentDir: string;
    let prefix: string;

    if (input.endsWith('/')) {
      parentDir = resolved;
      prefix = '';
    } else {
      parentDir = dirname(resolved);
      prefix = basename(resolved);
    }

    if (!existsSync(parentDir)) return json([]);

    const entries = readdirSync(parentDir, { withFileTypes: true });
    const showDots = prefix.startsWith('.');

    const suggestions = entries
      .filter((e) => {
        if (!e.isDirectory()) return false;
        if (!showDots && e.name.startsWith('.')) return false;
        if (prefix && !e.name.toLowerCase().startsWith(prefix.toLowerCase())) return false;
        return true;
      })
      .map((e) => join(parentDir, e.name))
      .sort()
      .slice(0, 20);

    return json(suggestions);
  } catch {
    return json([]);
  }
};
