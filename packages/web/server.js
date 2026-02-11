// Production server — SvelteKit handler + WebSocket for terminal streaming.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { handler } from './build/handler.js';
import { setupWebSocket } from './lib/ws-server.js';

// Read tmux socket from config (simplified — no TOML dep, just parse the line)
function getTmuxSocket() {
  const paths = [
    join(homedir(), '.config', 'zui', 'config.toml'),
    join(homedir(), '.zui.toml'),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      const content = readFileSync(p, 'utf-8');
      const match = content.match(/^socket\s*=\s*"([^"]*)"/m);
      if (match) return match[1];
    } catch {
      // ignore
    }
  }
  return '';
}

const port = parseInt(process.env.PORT || '3030', 10);
const host = process.env.HOST || '0.0.0.0';

const server = createServer(handler);

setupWebSocket(server, { tmuxSocket: getTmuxSocket() });

server.listen(port, host, () => {
  console.log(`ZUI web server listening on http://${host}:${port}`);
});
