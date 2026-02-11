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

  // Issue #1: Validate socket path if provided
  if (socket && !/^[a-zA-Z0-9_.\/-]+$/.test(socket)) {
    throw new Error('Invalid tmux socket path');
  }

  // Issue #3: Add maxPayload to prevent DoS via large messages
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024, // 1MB limit
  });

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

    // Issue #4: Wrap spawn in try-catch
    let proc;
    try {
      proc = spawn('tmux', args, {
        env: { ...process.env, TERM: 'xterm-256color' },
      });
    } catch (err) {
      console.error('Failed to spawn tmux process:', err);
      ws.close(1011, 'Failed to attach to tmux session');
      return;
    }

    if (!proc || !proc.pid) {
      ws.close(1011, 'Failed to attach to tmux session');
      return;
    }

    // Issue #4: Handle process errors
    proc.on('error', (err) => {
      console.error('tmux process error:', err);
      if (ws.readyState === 1) ws.close(1011, 'tmux process error');
    });

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
      if (data.length > 1024 * 1024) {
        ws.close(1009, 'Message too large');
        return;
      }

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

    // Issue #2: Proper cleanup on WebSocket close
    ws.on('close', () => {
      if (proc.exitCode === null) {
        proc.kill('SIGTERM');

        // Force kill after timeout
        const killTimer = setTimeout(() => {
          if (proc.exitCode === null) {
            proc.kill('SIGKILL');
          }
        }, 5000);

        proc.on('exit', () => clearTimeout(killTimer));
      }

      // Cleanup streams
      proc.stdin?.destroy();
      proc.stdout?.destroy();
      proc.stderr?.destroy();
    });
  });

  return wss;
}
