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
      if (match) {
        const socketPath = match[1];
        // Issue #1: Validate socket path
        if (!/^[a-zA-Z0-9_.\/-]+$/.test(socketPath)) {
          console.warn('Invalid tmux socket path in config, using default');
          return '';
        }
        return socketPath;
      }
    } catch {
      // ignore
    }
  }
  return '';
}

// Issue #10: Validate port
let port = parseInt(process.env.PORT || '3030', 10);
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}, using default 3030`);
  port = 3030;
}
const host = process.env.HOST || '0.0.0.0';

const server = createServer(handler);

setupWebSocket(server, { tmuxSocket: getTmuxSocket() });

server.listen(port, host, () => {
  console.log(`ZUI web server listening on http://${host}:${port}`);
});

// Issue #11: Graceful shutdown
function shutdown(signal) {
  console.log(`${signal} received, closing server gracefully...`);
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
