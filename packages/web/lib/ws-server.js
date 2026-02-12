// WebSocket server + tmux bridge — plain JS so both server.js and Vite plugin can import it.
import { WebSocketServer } from 'ws';
import { spawn as ptySpawn } from 'node-pty';

/**
 * Attach a WebSocket server to an HTTP server that bridges browser ↔ tmux sessions.
 * Uses node-pty to give tmux a real PTY (required for `tmux attach`).
 * @param {import('http').Server} httpServer
 * @param {{ tmuxSocket?: string }} [options]
 */
export function setupWebSocket(httpServer, options = {}) {
  const socket = options.tmuxSocket || '';

  if (socket && !/^[a-zA-Z0-9_.\/-]+$/.test(socket)) {
    throw new Error('Invalid tmux socket path');
  }

  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024,
  });

  httpServer.on('upgrade', (req, sock, head) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/terminal') return;

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

    let pty;
    try {
      pty = ptySpawn('tmux', args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        env: { ...process.env, TERM: 'xterm-256color' },
      });
    } catch (err) {
      console.error('Failed to spawn tmux pty:', err);
      ws.close(1011, 'Failed to attach to tmux session');
      return;
    }

    pty.onData((data) => {
      if (ws.readyState === 1) ws.send(Buffer.from(data));
    });

    pty.onExit(() => {
      if (ws.readyState === 1) ws.close(1000, 'tmux session ended');
    });

    ws.on('message', (data) => {
      if (data.length > 1024 * 1024) {
        ws.close(1009, 'Message too large');
        return;
      }

      const str = data.toString();
      if (str.startsWith('{')) {
        try {
          const msg = JSON.parse(str);
          if (msg.type === 'resize' && msg.cols > 0 && msg.rows > 0) {
            pty.resize(msg.cols, msg.rows);
            return;
          }
        } catch {
          // Not JSON, treat as terminal input
        }
      }
      pty.write(str);
    });

    ws.on('close', () => {
      pty.kill();
    });
  });

  return wss;
}
