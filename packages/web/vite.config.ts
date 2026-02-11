import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import type { ViteDevServer } from 'vite';

// In dev mode, attach the WebSocket tmux bridge to Vite's HTTP server.
function wsPlugin() {
  return {
    name: 'zui-ws-dev',
    configureServer(server: ViteDevServer) {
      // Issue #17: Add error handling for dynamic import
      import('./lib/ws-server.js')
        .then(({ setupWebSocket }) => {
          if (server.httpServer) {
            setupWebSocket(server.httpServer);
          }
        })
        .catch((err) => {
          console.error('Failed to setup WebSocket server:', err);
        });
    },
  };
}

export default defineConfig({
  plugins: [sveltekit(), wsPlugin()],
  server: {
    port: 3030,
    host: '0.0.0.0',
  },
});
