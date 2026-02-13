import type { CapacitorConfig } from '@capacitor/cli';
import { readFileSync } from 'node:fs';

// Load .env if present (no dotenv dependency needed)
try {
  const envFile = readFileSync(new URL('.env', import.meta.url), 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(.+)\s*$/);
    if (match && !process.env[match[1]!]) {
      process.env[match[1]!] = match[2]!;
    }
  }
} catch {}

const serverUrl = process.env.ZUI_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'dev.zui.app',
  appName: 'ZUI',
  webDir: 'build/client',
  // Point the native webview at the ZUI server.
  // Set ZUI_SERVER_URL in .env (e.g. https://your-machine.tail1234.ts.net:3030)
  ...(serverUrl && {
    server: {
      url: serverUrl,
      cleartext: serverUrl.startsWith('http://'),
    },
  }),
  // Keyboard handling is done natively by ZUIBridgeViewController —
  // no Capacitor Keyboard plugin needed.
};

export default config;
