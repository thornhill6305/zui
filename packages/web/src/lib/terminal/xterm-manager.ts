import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { WebSocketClient } from './websocket-client';
import { activeSession, connectionState } from '$lib/stores/terminal';

export class XtermManager {
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private wsClient: WebSocketClient | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private container: HTMLElement | null = null;

  open(container: HTMLElement, session: string): void {
    this.dispose();
    this.container = container;

    this.terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: '#0f172a',
        foreground: '#f1f5f9',
        cursor: '#38bdf8',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#1e293b',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f1f5f9',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    });

    this.fitAddon = new FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(new WebLinksAddon());

    this.terminal.open(container);
    this.fitAddon.fit();

    // Connect WebSocket
    this.wsClient = new WebSocketClient(
      session,
      (data) => this.terminal?.write(data),
      () => {
        this.terminal?.write('\r\n\x1b[90m[session disconnected]\x1b[0m\r\n');
      },
    );
    this.wsClient.connect();
    activeSession.set(session);

    // Terminal input → WebSocket
    this.terminal.onData((data) => {
      this.wsClient?.send(data);
    });

    // Terminal binary input (for paste etc.)
    this.terminal.onBinary((data) => {
      this.wsClient?.send(data);
    });

    // Send initial size
    this.wsClient.sendResize(this.terminal.cols, this.terminal.rows);

    // Resize handling
    this.terminal.onResize(({ cols, rows }) => {
      this.wsClient?.sendResize(cols, rows);
    });

    this.resizeObserver = new ResizeObserver(() => {
      this.fit();
    });
    this.resizeObserver.observe(container);
  }

  fit(): void {
    if (this.fitAddon && this.container) {
      try {
        this.fitAddon.fit();
      } catch {
        // container might be hidden/zero-size
      }
    }
  }

  focus(): void {
    this.terminal?.focus();
  }

  dispose(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.wsClient?.disconnect();
    this.wsClient = null;
    this.terminal?.dispose();
    this.terminal = null;
    this.fitAddon = null;
    this.container = null;
    activeSession.set(null);
    connectionState.set('disconnected');
  }
}
