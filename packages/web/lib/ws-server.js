// WebSocket server + tmux bridge — plain JS so both server.js and Vite plugin can import it.
import { WebSocketServer } from 'ws';
import { spawn } from 'node:child_process';

/**
 * Attach a WebSocket server to an HTTP server that bridges browser ↔ tmux sessions.
 * @param {import('http').Server} httpServer
 * @param {{ tmuxSocket?: string }} [options]
 */
export function setupWebSocket(httpServer, options = {}) {
  const socket = options.tmuxSocket || '';
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, sock, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/terminal') return; // let other handlers (Vite HMR) pass through

    wss.handleUpgrade(req, sock, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const session = url.searchParams.get('session');

    if (!session || !/^[a-zA-Z0-9_.-]+$/.test(session)) {
      ws.close(1008, 'Invalid session parameter');
      return;
    }

    const args = socket
      ? ['-S', socket, 'attach', '-t', session]
      : ['attach', '-t', session];

    const proc = spawn('tmux', args, {
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    if (!proc.pid) {
      ws.close(1011, 'Failed to attach to tmux session');
      return;
    }

    proc.stdout.on('data', (chunk) => {
      if (ws.readyState === 1) ws.send(chunk);
    });

    proc.stderr.on('data', (chunk) => {
      if (ws.readyState === 1) ws.send(chunk);
    });

    proc.on('exit', () => {
      if (ws.readyState === 1) ws.close(1000, 'tmux session ended');
    });

    ws.on('message', (data) => {
      const str = data.toString();
      // Check for JSON control messages (resize)
      if (str.startsWith('{')) {
        try {
          const msg = JSON.parse(str);
          if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) {
            const resizeArgs = socket
              ? ['-S', socket, 'resize-pane', '-t', session, '-x', String(msg.cols), '-y', String(msg.rows)]
              : ['resize-pane', '-t', session, '-x', String(msg.cols), '-y', String(msg.rows)];
            spawn('tmux', resizeArgs);
            return;
          }
        } catch {
          // Not JSON, treat as terminal input
        }
      }
      if (proc.stdin.writable) {
        proc.stdin.write(data);
      }
    });

    ws.on('close', () => {
      if (proc.exitCode === null) proc.kill('SIGTERM');
    });
  });

  return wss;
}
