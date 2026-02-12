import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'dev.zui.app',
  appName: 'ZUI',
  webDir: 'build/client',
  // Point the native webview at the ZUI server.
  // Change this to your server's LAN/public URL.
  server: {
    url: 'http://localhost:3030',
    cleartext: true,
  },
  plugins: {
    Keyboard: {
      // Resize the webview when the keyboard opens (matches our visualViewport logic)
      resize: 'native',
    },
  },
};

export default config;
