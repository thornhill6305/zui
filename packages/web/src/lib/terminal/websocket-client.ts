import { connectionState } from '$lib/stores/terminal';

export type TerminalDataCallback = (data: Uint8Array) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private session: string;
  private onData: TerminalDataCallback;
  private onDisconnect: (() => void) | null;
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(session: string, onData: TerminalDataCallback, onDisconnect?: () => void) {
    this.session = session;
    this.onData = onData;
    this.onDisconnect = onDisconnect ?? null;
  }

  connect(): void {
    this.intentionalClose = false;
    connectionState.set('connecting');

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/terminal?session=${encodeURIComponent(this.session)}`;

    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      connectionState.set('connected');
      this.reconnectDelay = 1000;
    };

    this.ws.onmessage = (event) => {
      this.onData(new Uint8Array(event.data as ArrayBuffer));
    };

    this.ws.onclose = (event) => {
      this.ws = null;
      if (this.intentionalClose || event.code === 1000) {
        connectionState.set('disconnected');
        this.onDisconnect?.();
        return;
      }
      connectionState.set('reconnecting');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  send(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  sendResize(cols: number, rows: number): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    connectionState.set('disconnected');
  }

  private scheduleReconnect(): void {
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, this.maxReconnectDelay);
  }
}
