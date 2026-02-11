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
  // Issue #5: Track disposed state to prevent race conditions
  private disposed = false;
  private touchCleanup: (() => void) | null = null;

  open(container: HTMLElement, session: string): void {
    this.dispose();
    this.disposed = false;
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

    // Connect WebSocket — guard callbacks with disposed check (Issue #5)
    this.wsClient = new WebSocketClient(
      session,
      (data) => {
        if (!this.disposed) this.terminal?.write(data);
      },
      () => {
        if (!this.disposed) {
          this.terminal?.write('\r\n\x1b[90m[session disconnected]\x1b[0m\r\n');
        }
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

    // Resize handling — always send size after fit so tmux PTY matches
    this.terminal.onResize(({ cols, rows }) => {
      this.wsClient?.sendResize(cols, rows);
    });

    // Touch-to-scroll for tmux: xterm.js converts wheel→up/down keys (for tmux
    // scrollback) but does NOT do the same for touch. Synthesize wheel events
    // from touch gestures so mobile scrolling works in tmux sessions.
    this.touchCleanup = this.bindTouchScroll(container);

    this.resizeObserver = new ResizeObserver(() => {
      this.fitAndSync();
    });
    this.resizeObserver.observe(container);

    // Defer initial fit until layout is computed
    requestAnimationFrame(() => {
      this.fitAndSync();
    });
  }

  private fitAndSync(): void {
    if (this.fitAddon && this.container && this.terminal) {
      try {
        this.fitAddon.fit();
        // Always send current size to sync the PTY, even if cols/rows didn't change
        this.wsClient?.sendResize(this.terminal.cols, this.terminal.rows);
      } catch (err) {
        if (this.container.offsetWidth > 0 && this.container.offsetHeight > 0) {
          console.warn('Terminal fit failed:', err);
        }
      }
    }
  }

  private bindTouchScroll(container: HTMLElement): () => void {
    let lastTouchY = 0;

    const onTouchStart = (ev: TouchEvent): void => {
      lastTouchY = ev.touches[0].clientY;
    };

    const onTouchMove = (ev: TouchEvent): void => {
      const currentY = ev.touches[0].clientY;
      const deltaY = lastTouchY - currentY;
      lastTouchY = currentY;

      if (Math.abs(deltaY) < 2) return;

      // Dispatch a synthetic wheel event that xterm.js will convert to
      // up/down keys for tmux scroll (when buffer has no scrollback)
      const wheelEvent = new WheelEvent('wheel', {
        deltaY,
        deltaMode: WheelEvent.DOM_DELTA_PIXEL,
        bubbles: true,
        cancelable: true,
      });
      container.querySelector('.xterm')?.dispatchEvent(wheelEvent);
      ev.preventDefault();
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
    };
  }

  focus(): void {
    this.terminal?.focus();
  }

  dispose(): void {
    this.disposed = true;
    this.touchCleanup?.();
    this.touchCleanup = null;
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
