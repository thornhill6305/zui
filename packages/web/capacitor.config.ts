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
  plugins: {
    Keyboard: {
      // Resize is handled natively by ZUIBridgeViewController's
      // keyboardLayoutGuide constraint — don't let Capacitor also resize.
      resize: 'none',
    },
  },
};

export default config;
