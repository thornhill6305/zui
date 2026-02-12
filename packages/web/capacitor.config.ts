import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.zui.app',
  appName: 'ZUI',
  webDir: 'build/client',
  // Point the native webview at the ZUI server.
  // Change this to your server's LAN/public URL.
  server: {
    url: 'https://YOUR_TAILSCALE_HOST:3030',
    cleartext: false,
  },
  // Keyboard handling is done natively by ZUIBridgeViewController —
  // no Capacitor Keyboard plugin needed.
};

export default config;
