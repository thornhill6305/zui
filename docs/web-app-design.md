# ZUI Web App — Technical Design Document

**Version:** 1.0  
**Date:** 2026-02-10  
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Requirements](#requirements)
4. [Tech Stack Recommendation](#tech-stack-recommendation)
5. [Architecture Overview](#architecture-overview)
6. [Component Design](#component-design)
7. [tmux Integration Strategy](#tmux-integration-strategy)
8. [Real-Time Communication](#real-time-communication)
9. [Mobile UX Considerations](#mobile-ux-considerations)
10. [Security Design](#security-design)
11. [Migration Strategy](#migration-strategy)
12. [MVP Scope](#mvp-scope)
13. [Future Features](#future-features)
14. [Implementation Roadmap](#implementation-roadmap)

---

## Executive Summary

This document outlines the design for a web-based version of ZUI that preserves all the functionality of the current terminal TUI while adding cross-device accessibility. The web app will be served over Tailscale, accessible from phones and laptops via browser, with a responsive interface that adapts to both desktop and mobile contexts.

**Core Value Props:**
- **Access Anywhere:** Manage Claude Code sessions from phone/laptop without SSH
- **Better Mobile UX:** Touch-friendly interface vs. terminal over SSH
- **Shared Foundation:** Reuse core logic (discovery, worktree mgmt, status detection)
- **Zero Auth Complexity:** Tailscale provides secure access (no login needed)

---

## Current Architecture Analysis

### What ZUI Does Today

The current TUI is a Node.js app built with Ink that:

1. **Discovery**: Scans filesystem for git repos and worktrees
2. **Session Management**: Creates/kills/monitors tmux sessions running Claude Code
3. **Status Detection**: Parses tmux output to detect `[WORK]`, `[WAIT]`, `[ERR]`, `[IDLE]`
4. **Live View**: Shows active session in split pane using tmux attach
5. **Worktree Ops**: Creates git worktrees and cleans them up
6. **Lazygit Integration**: Toggles a lazygit pane for git ops

### Current Tech Stack

| Component | Technology |
|-----------|-----------|
| **UI Framework** | Ink (React for terminal) |
| **Runtime** | Node.js 20+ |
| **Session Backend** | tmux (default server) |
| **Config** | TOML via `smol-toml` |
| **Git Ops** | Direct `git` CLI calls via `execFileSync` |

### Reusable Components

These modules have **no UI dependencies** and can be shared between TUI and web:

- `src/config.ts` — TOML config loading
- `src/discovery.ts` — Git repo/worktree scanning
- `src/sessions.ts` — tmux session management
- `src/worktrees.ts` — Git worktree operations
- `src/shell.ts` — Shell command wrapper
- `src/types.ts` — Shared TypeScript types

**Migration Opportunity:** Extract these into a `@zui/core` package that both TUI and web app import.

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Sidebar lists sessions (name, status, runtime, preview) | P0 |
| F2 | Sidebar supports create/kill/clean/switch actions | P0 |
| F3 | Main panel shows live terminal with Claude Code session | P0 |
| F4 | Support slash command autocomplete (e.g., `/test`, `/commit`) | P1 |
| F5 | Status bar shows session state (working/idle/error/waiting) | P0 |
| F6 | Visualize tool use (file edits, shell commands, web searches) | P1 |
| F7 | Works on desktop browsers (1920x1080+) | P0 |
| F8 | Works on mobile browsers (375x667+, touch-friendly) | P0 |
| F9 | `zui serve` starts web server on Tailscale | P0 |
| F10 | Lazygit integration (toggle git pane) | P2 |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| N1 | Sub-100ms input latency (typing → terminal) | P0 |
| N2 | Reconnect on network interruption | P0 |
| N3 | Only accessible via Tailscale (no public internet) | P0 |
| N4 | Works behind restrictive NAT (mobile carriers) | P0 |
| N5 | Runs on same hardware as TUI (no new server deps) | P0 |
| N6 | Minimal RAM footprint (<100MB idle) | P1 |

---

## Tech Stack Recommendation

### Frontend Framework: **SvelteKit**

**Why Svelte:**
- **Small Bundle Size:** ~15KB compressed (React ~40KB, Vue ~32KB)
- **No Virtual DOM:** Direct DOM updates = better mobile performance
- **Built-in Stores:** Perfect for session state management
- **SSR + SPA:** Pre-render sidebar, hydrate terminal on client
- **Server Routes:** Built-in `/api` endpoints (no Express needed)
- **TypeScript Native:** First-class TS support

**Alternatives Considered:**
- **React + Next.js:** Too heavy for this use case (runtime cost, bundle size)
- **Astro:** Great for static content, but terminal needs reactive state
- **htmx:** Not a good fit for real-time terminal streaming

### Terminal Emulator: **xterm.js**

**Why xterm.js:**
- **Industry Standard:** Used by VS Code, Hyper, Theia, AWS Cloud9
- **Full VT100/xterm Emulation:** Handles Claude's ANSI codes
- **Addon Ecosystem:** `xterm-addon-fit`, `xterm-addon-web-links`, `xterm-addon-webgl`
- **Mobile Support:** Touch events, virtual keyboard handling
- **WebGL Renderer:** Hardware-accelerated for smooth scrolling

**Alternatives Considered:**
- **terminal.js:** Unmaintained (last commit 2017)
- **blessed-contrib:** Terminal-only (not for browser)
- **custom canvas renderer:** Reinventing the wheel, high risk

### Real-Time Communication: **WebSocket**

**Why WebSocket:**
- **Bidirectional:** Keyboard input + terminal output in one connection
- **Low Latency:** No HTTP request/response overhead
- **Native Browser Support:** No library dependencies
- **tmux-friendly:** Easy to wrap `tmux attach` stdio

**Alternatives Considered:**
- **Server-Sent Events (SSE):** One-way only (output streaming), need separate POST for input
- **WebRTC Data Channel:** Overkill for this use case, NAT traversal complexity
- **Long Polling:** High latency, not suitable for interactive terminal

### Backend: **Node.js + `ws` Library**

**Why:**
- **Reuse Existing Code:** Current ZUI logic is Node.js
- **Low Overhead:** `ws` is minimal and fast (no framework bloat)
- **Process Integration:** Easy to spawn `tmux attach` as child process
- **SvelteKit Integration:** Can run as custom server or adapter

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                       │
│                                                               │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │   Sidebar (UI)  │  │   Main Panel (xterm.js)          │  │
│  │                 │  │                                   │  │
│  │ - Session List  │  │  ┌─────────────────────────────┐ │  │
│  │ - Status Icons  │  │  │   Terminal Emulator         │ │  │
│  │ - Action Btns   │  │  │                             │ │  │
│  │ - Project Picker│  │  │   > claude                  │ │  │
│  └─────────────────┘  │  │   Working on task...        │ │  │
│                       │  │                             │ │  │
│                       │  └─────────────────────────────┘ │  │
│                       │                                   │  │
│                       │  [Status Bar: WORKING | 2m 34s]  │  │
│                       └──────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │               WebSocket Connection                     │  │
│  │   ws://your-machine.tailnet.ts.net:3030/terminal    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Tailscale Tunnel
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Server (your-machine)                        │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │            SvelteKit Server                            │  │
│  │   - Serves static assets (HTML/CSS/JS)                │  │
│  │   - API routes (/api/sessions, /api/projects)         │  │
│  │   - WebSocket upgrade handler                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         ZUI Core (Shared Business Logic)              │  │
│  │   - discovery.ts → scan repos/worktrees               │  │
│  │   - sessions.ts → tmux list/create/kill               │  │
│  │   - worktrees.ts → git worktree ops                   │  │
│  │   - config.ts → TOML config                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         WebSocket Server (ws library)                  │  │
│  │   - Spawns `tmux attach -t SESSION_NAME`              │  │
│  │   - Pipes tmux stdout → WebSocket                      │  │
│  │   - Pipes WebSocket input → tmux stdin                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                            │                                 │
│                            ▼                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              tmux (default server)                     │  │
│  │   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐    │  │
│  │   │ session-1   │ │ session-2   │ │ session-3   │    │  │
│  │   │   (Claude)  │ │   (Claude)  │ │  (lazygit)  │    │  │
│  │   └─────────────┘ └─────────────┘ └─────────────┘    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

**1. Page Load:**
```
Browser → HTTPS GET / → SvelteKit → HTML + JS bundle
Browser → REST GET /api/sessions → ZUI Core → Session list JSON
```

**2. View Session (Terminal Attach):**
```
Browser → WebSocket /terminal?session=foo → WS Server
WS Server → spawn `tmux attach -t foo` → tmux
tmux stdout → WS Server → Browser (xterm.js renders)
Browser (keyboard) → WS Server → tmux stdin
```

**3. Create Session:**
```
Browser → REST POST /api/sessions { project, yolo } → ZUI Core
ZUI Core → spawnSession() → tmux new-session -d -s NAME
Response → Browser updates session list
```

---

## Component Design

### Project Structure

```
zui/
├── packages/
│   ├── core/                    # Shared business logic
│   │   ├── src/
│   │   │   ├── config.ts
│   │   │   ├── discovery.ts
│   │   │   ├── sessions.ts
│   │   │   ├── worktrees.ts
│   │   │   ├── shell.ts
│   │   │   └── types.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── tui/                     # Current terminal UI
│   │   ├── src/
│   │   │   ├── app.tsx
│   │   │   ├── ui/
│   │   │   └── index.tsx
│   │   └── package.json
│   │
│   └── web/                     # New web UI (THIS PROJECT)
│       ├── src/
│       │   ├── routes/
│       │   │   ├── +page.svelte         # Main UI
│       │   │   ├── +page.ts             # SSR data loading
│       │   │   └── api/
│       │   │       ├── sessions/
│       │   │       │   ├── +server.ts   # GET/POST/DELETE
│       │   │       ├── projects/
│       │   │       │   └── +server.ts   # GET
│       │   │       └── worktrees/
│       │   │           └── +server.ts   # POST/DELETE
│       │   ├── lib/
│       │   │   ├── components/
│       │   │   │   ├── Sidebar.svelte
│       │   │   │   ├── Terminal.svelte
│       │   │   │   ├── StatusBar.svelte
│       │   │   │   ├── SessionList.svelte
│       │   │   │   ├── ProjectPicker.svelte
│       │   │   │   ├── MobileDrawer.svelte
│       │   │   │   └── ToolVisualizer.svelte
│       │   │   ├── stores/
│       │   │   │   ├── sessions.ts      # Session state store
│       │   │   │   ├── terminal.ts      # Terminal state store
│       │   │   │   └── ui.ts            # UI state (drawer open, etc)
│       │   │   ├── terminal/
│       │   │   │   ├── xterm-manager.ts # xterm.js wrapper
│       │   │   │   └── websocket.ts     # WS client
│       │   │   └── utils/
│       │   │       ├── status-detect.ts
│       │   │       └── formatters.ts
│       │   ├── server/
│       │   │   ├── websocket.ts         # WS server logic
│       │   │   └── tmux-bridge.ts       # tmux attach wrapper
│       │   ├── app.html
│       │   └── app.css
│       ├── static/
│       │   └── favicon.png
│       ├── package.json
│       ├── svelte.config.js
│       ├── vite.config.ts
│       └── tsconfig.json
│
└── package.json                 # Workspace root
```

### Frontend Components

#### 1. **Sidebar.svelte** (Desktop) / **MobileDrawer.svelte** (Mobile)

**Props:**
```typescript
interface SidebarProps {
  sessions: Session[];
  projects: Project[];
  selectedSession: string | null;
  onSelectSession: (name: string) => void;
  onCreateSession: (project: Project, yolo: boolean) => void;
  onKillSession: (name: string) => void;
  onCleanWorktree: (project: Project) => void;
  onRefresh: () => void;
}
```

**Features:**
- Session list with status indicators (color-coded icons)
- Sorting options (name, runtime, status)
- Filter by status (`[WORK]`, `[WAIT]`, `[IDLE]`, `[ERR]`)
- Quick action buttons (new session, refresh)
- Collapsible on desktop (hamburger toggle)
- Bottom sheet drawer on mobile

#### 2. **Terminal.svelte**

**Props:**
```typescript
interface TerminalProps {
  sessionName: string | null;
  websocketUrl: string;
  theme: 'dark' | 'light';
}
```

**Features:**
- xterm.js integration with WebGL renderer
- Auto-fit to container size
- Font size controls (+/- buttons, pinch zoom on mobile)
- Clipboard integration (copy/paste)
- Virtual keyboard support on mobile
- Reconnection logic on WS disconnect

**State Management:**
```svelte
<script lang="ts">
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebLinksAddon } from 'xterm-addon-web-links';
  import { onMount, onDestroy } from 'svelte';

  export let sessionName: string | null;
  export let websocketUrl: string;

  let terminalDiv: HTMLDivElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let ws: WebSocket | null = null;

  onMount(() => {
    terminal = new Terminal({ /* config */ });
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(terminalDiv);
    fitAddon.fit();

    if (sessionName) {
      connectWebSocket(sessionName);
    }
  });

  function connectWebSocket(session: string) {
    ws = new WebSocket(`${websocketUrl}?session=${session}`);
    ws.binaryType = 'arraybuffer';

    ws.onmessage = (event) => {
      const data = new Uint8Array(event.data);
      terminal.write(data);
    };

    terminal.onData((data) => {
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    ws.onclose = () => {
      terminal.write('\r\n\x1b[31m[Connection Lost - Reconnecting...]\x1b[0m\r\n');
      setTimeout(() => connectWebSocket(session), 1000);
    };
  }

  onDestroy(() => {
    ws?.close();
    terminal?.dispose();
  });
</script>

<div bind:this={terminalDiv} class="terminal-container"></div>
```

#### 3. **StatusBar.svelte**

**Props:**
```typescript
interface StatusBarProps {
  sessionName: string;
  status: Session['status'];
  runtime: string;
  toolsUsed?: { name: string; count: number }[];
}
```

**Features:**
- Live status indicator (pulsing dot when `[WORK]`)
- Runtime counter
- Tool use summary (e.g., "3 file edits, 2 shell cmds")
- Connection status icon (WS connected/disconnected)

#### 4. **SessionList.svelte**

**Mobile-optimized table:**
```svelte
<!-- Desktop: Full table -->
<table class="hidden md:table">
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
      <th>Runtime</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#each sessions as session}
      <tr class:selected={session.name === selectedSession}>
        <td>{session.name}</td>
        <td><StatusBadge status={session.status} /></td>
        <td>{session.running}</td>
        <td>
          <button on:click={() => onKill(session.name)}>Kill</button>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<!-- Mobile: Card list -->
<div class="md:hidden space-y-2">
  {#each sessions as session}
    <div class="card" class:selected={session.name === selectedSession}>
      <div class="card-header">
        <h3>{session.name}</h3>
        <StatusBadge status={session.status} />
      </div>
      <div class="card-body">
        <span>Runtime: {session.running}</span>
        <button on:click={() => onKill(session.name)}>Kill</button>
      </div>
    </div>
  {/each}
</div>
```

#### 5. **ProjectPicker.svelte**

**Dialog component:**
- Search/filter projects by name
- Show branch name for worktrees
- Visual indicator for worktrees vs repos
- "YOLO mode" checkbox

---

## tmux Integration Strategy

### Approach: tmux Attach via Child Process

The web server spawns a persistent `tmux attach` process per WebSocket connection and pipes stdio bidirectionally.

### Implementation: `tmux-bridge.ts`

```typescript
import { spawn, ChildProcess } from 'node:child_process';
import type { Config } from '@zui/core';

export class TmuxBridge {
  private process: ChildProcess | null = null;
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  attach(sessionName: string, onData: (data: Buffer) => void, onExit: () => void): boolean {
    const args = this.config.socket
      ? ['-S', this.config.socket, 'attach', '-t', sessionName]
      : ['attach', '-t', sessionName];

    this.process = spawn('tmux', args, {
      env: { ...process.env, TERM: 'xterm-256color' },
    });

    this.process.stdout?.on('data', (chunk) => onData(chunk));
    this.process.stderr?.on('data', (chunk) => onData(chunk));

    this.process.on('exit', (code) => {
      console.log(`tmux attach exited with code ${code}`);
      onExit();
    });

    return this.process.pid !== undefined;
  }

  write(data: string | Buffer): void {
    if (this.process?.stdin?.writable) {
      this.process.stdin.write(data);
    }
  }

  resize(cols: number, rows: number): void {
    // Send SIGWINCH to child process (tmux will detect resize)
    if (this.process?.pid) {
      process.kill(this.process.pid, 'SIGWINCH');
      // Also use tmux command for explicit resize
      const args = this.config.socket
        ? ['-S', this.config.socket, 'resize-window', '-t', 'SESSION_NAME', '-x', cols.toString(), '-y', rows.toString()]
        : ['resize-window', '-t', 'SESSION_NAME', '-x', cols.toString(), '-y', rows.toString()];
      // Note: Would need to track session name to execute this
    }
  }

  detach(): void {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
    }
  }
}
```

### WebSocket Server: `server/websocket.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import { TmuxBridge } from './tmux-bridge.js';
import { loadConfig } from '@zui/core';
import type { Server } from 'http';

export function setupWebSocketServer(httpServer: Server) {
  const config = loadConfig();
  const wss = new WebSocketServer({ server: httpServer, path: '/terminal' });

  wss.on('connection', (ws: WebSocket, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const sessionName = url.searchParams.get('session');

    if (!sessionName) {
      ws.close(1008, 'Missing session parameter');
      return;
    }

    console.log(`WebSocket connected: session=${sessionName}`);

    const bridge = new TmuxBridge(config);
    const attached = bridge.attach(
      sessionName,
      (data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      },
      () => {
        ws.close(1000, 'tmux session ended');
      }
    );

    if (!attached) {
      ws.close(1011, 'Failed to attach to tmux session');
      return;
    }

    ws.on('message', (data) => {
      bridge.write(data as Buffer);
    });

    ws.on('close', () => {
      console.log(`WebSocket closed: session=${sessionName}`);
      bridge.detach();
    });
  });

  return wss;
}
```

### Handling Resize Events

**Client-side (Terminal.svelte):**
```typescript
terminal.onResize(({ cols, rows }) => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resize', cols, rows }));
  }
});
```

**Server-side (websocket.ts):**
```typescript
ws.on('message', (data) => {
  const str = data.toString();
  if (str.startsWith('{')) {
    try {
      const msg = JSON.parse(str);
      if (msg.type === 'resize') {
        // Resize the tmux window
        const args = config.socket
          ? ['-S', config.socket, 'resize-pane', '-t', sessionName, '-x', msg.cols, '-y', msg.rows]
          : ['resize-pane', '-t', sessionName, '-x', msg.cols, '-y', msg.rows];
        spawn('tmux', args);
        return;
      }
    } catch {}
  }
  bridge.write(data as Buffer);
});
```

---

## Real-Time Communication

### REST API Endpoints

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/sessions` | List all sessions | — | `Session[]` |
| POST | `/api/sessions` | Create session | `{ project: string, yolo: boolean }` | `{ ok: boolean, session: string }` |
| DELETE | `/api/sessions/:name` | Kill session | — | `{ ok: boolean }` |
| GET | `/api/projects` | List projects | — | `Project[]` |
| POST | `/api/worktrees` | Create worktree | `{ repo: string, branch: string }` | `{ ok: boolean, path: string }` |
| DELETE | `/api/worktrees/:name` | Clean worktree | — | `{ ok: boolean }` |

### WebSocket Protocol

**URL:** `ws://hostname:port/terminal?session=<session-name>`

**Client → Server:**
- **Text Data:** Keyboard input (UTF-8 string)
- **Binary Data:** Paste buffer (raw bytes)
- **JSON Control Messages:**
  ```json
  { "type": "resize", "cols": 120, "rows": 40 }
  ```

**Server → Client:**
- **Binary Data:** tmux stdout (ANSI escape sequences)
- **Text Data (JSON):** Control messages (future: tool use events)
  ```json
  { "type": "tool", "tool": "edit", "file": "foo.ts" }
  ```

### Reconnection Strategy

**Client-side Exponential Backoff:**
```typescript
let reconnectDelay = 1000; // Start at 1 second
const maxDelay = 30000; // Cap at 30 seconds

function reconnect() {
  setTimeout(() => {
    console.log(`Reconnecting in ${reconnectDelay}ms...`);
    connectWebSocket(sessionName);
    reconnectDelay = Math.min(reconnectDelay * 1.5, maxDelay);
  }, reconnectDelay);
}

ws.onclose = (event) => {
  if (event.code !== 1000) { // Not a clean close
    terminal.write('\r\n\x1b[31m[Connection Lost - Reconnecting...]\x1b[0m\r\n');
    reconnect();
  }
};

ws.onopen = () => {
  reconnectDelay = 1000; // Reset on successful connection
};
```

---

## Mobile UX Considerations

### Responsive Layout Strategy

**Breakpoints:**
- **Mobile:** `< 768px` — Single panel, drawer sidebar
- **Tablet:** `768px - 1024px` — Side-by-side, collapsible sidebar
- **Desktop:** `> 1024px` — Full split view

**Mobile Layout:**
```
┌─────────────────────────────────┐
│  [☰]  ZUI     [+] [↻]  Sessions │ ← Top bar
├─────────────────────────────────┤
│                                 │
│   Terminal (full screen)        │
│                                 │
│   > claude                      │
│   Working on task...            │
│                                 │
│                                 │
│                                 │
│                                 │
│                                 │
├─────────────────────────────────┤
│ [WORKING] 2m 34s | 3 tools used │ ← Status bar
└─────────────────────────────────┘

// Drawer (swipe from left or tap ☰)
┌──────────────────┐
│  Sessions        │
│                  │
│  ● sess-1 [WORK] │
│    sess-2 [IDLE] │
│    sess-3 [WAIT] │
│                  │
│  [+ New Session] │
└──────────────────┘
```

### Touch-Friendly Controls

**Minimum Target Size:** 44x44px (Apple HIG recommendation)

**Session List Items:**
```svelte
<button
  class="session-item touch-target"
  on:click={() => selectSession(session.name)}
>
  <div class="session-icon">
    <StatusIcon status={session.status} />
  </div>
  <div class="session-info">
    <h3>{session.name}</h3>
    <span class="runtime">{session.running}</span>
  </div>
  <button
    class="session-kill"
    on:click|stopPropagation={() => killSession(session.name)}
  >
    ✕
  </button>
</button>

<style>
  .session-item {
    min-height: 60px;
    padding: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .touch-target {
    /* Ensure accessible touch targets */
    min-width: 44px;
    min-height: 44px;
  }

  .session-kill {
    width: 44px;
    height: 44px;
    flex-shrink: 0;
  }
</style>
```

### Virtual Keyboard Handling

**Challenge:** iOS Safari hides toolbar when virtual keyboard appears.

**Solution:**
```svelte
<script>
  import { onMount } from 'svelte';
  let viewportHeight = window.innerHeight;

  onMount(() => {
    // Detect virtual keyboard
    window.visualViewport?.addEventListener('resize', () => {
      const currentHeight = window.visualViewport.height;
      const keyboardHeight = viewportHeight - currentHeight;
      
      if (keyboardHeight > 100) {
        // Keyboard is open - shrink terminal
        terminalDiv.style.height = `${currentHeight - 60}px`; // 60px for status bar
      } else {
        terminalDiv.style.height = '100%';
      }
    });
  });
</script>
```

### Font Size Controls

**Mobile:** Pinch-to-zoom support
```typescript
terminal.onData((data) => {
  // Detect Ctrl+Plus/Minus
  if (data === '\x1b[1;5A') { // Ctrl+Up
    increaseFontSize();
  } else if (data === '\x1b[1;5B') { // Ctrl+Down
    decreaseFontSize();
  }
});

function increaseFontSize() {
  const currentSize = terminal.options.fontSize || 14;
  terminal.setOption('fontSize', Math.min(currentSize + 2, 24));
  fitAddon.fit();
}
```

### Touch Gestures

- **Swipe from Left:** Open drawer (sessions list)
- **Swipe from Right:** Close drawer
- **Two-Finger Swipe Up:** Show keyboard shortcuts
- **Long Press on Session:** Show context menu (kill, clean, lazygit)

---

## Security Design

### Threat Model

**Assumptions:**
1. Tailscale provides transport encryption (WireGuard)
2. Only trusted devices on tailnet (no public internet exposure)
3. Server runs on user's local machine (not a shared host)

**Threats:**
- **T1:** Unauthorized access from compromised tailnet device
- **T2:** Command injection via session/project names
- **T3:** Directory traversal via worktree paths
- **T4:** XSS via terminal output (malicious ANSI sequences)

### Mitigation Strategies

#### 1. Tailscale-Only Access

**Bind to Tailscale Interface:**
```typescript
// svelte.config.js
export default {
  kit: {
    adapter: adapter({
      host: '100.64.0.1', // Tailscale IP (replace with actual)
      port: 3030,
    }),
  },
};
```

**Alternative: tailscale serve:**
```bash
# Start web app on localhost
node build/index.js --host 127.0.0.1 --port 3030

# Expose via Tailscale (HTTPS)
tailscale serve --bg --https=3030 http://localhost:3030
```

**Verify tailnet access:**
```typescript
// src/hooks.server.ts
export async function handle({ event, resolve }) {
  const clientIp = event.getClientAddress();
  
  // Check if IP is in Tailscale range (100.64.0.0/10)
  if (!isTailscaleIP(clientIp)) {
    return new Response('Forbidden', { status: 403 });
  }
  
  return resolve(event);
}

function isTailscaleIP(ip: string): boolean {
  const octets = ip.split('.').map(Number);
  if (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127) {
    return true;
  }
  return false;
}
```

#### 2. Input Validation

**Session Names:**
```typescript
const SAFE_SESSION_NAME = /^[a-zA-Z0-9_-]+$/;

export function validateSessionName(name: string): boolean {
  return SAFE_SESSION_NAME.test(name) && name.length <= 64;
}
```

**Paths:**
```typescript
import { resolve, relative } from 'node:path';
import { homedir } from 'node:os';

export function validateProjectPath(path: string): boolean {
  const absPath = resolve(path);
  const homeDir = homedir();
  const relPath = relative(homeDir, absPath);
  
  // Must be within home directory, no traversal
  return !relPath.startsWith('..') && !relPath.startsWith('/');
}
```

#### 3. XSS Protection

**Terminal Output Sanitization:**

xterm.js handles most ANSI sequences safely, but we should filter dangerous ones:

```typescript
const DANGEROUS_SEQUENCES = [
  /\x1b\]8;;/, // Hyperlink OSC (can be abused)
  /\x1b\]0;/,  // Window title (information disclosure)
];

function filterOutput(data: Buffer): Buffer {
  let str = data.toString('utf-8');
  for (const pattern of DANGEROUS_SEQUENCES) {
    str = str.replace(pattern, '');
  }
  return Buffer.from(str, 'utf-8');
}
```

**Note:** For MVP, rely on xterm.js's built-in sanitization. Add filtering if needed.

#### 4. Rate Limiting

**Prevent WebSocket Spam:**
```typescript
const RATE_LIMIT = 100; // messages per second
const rateLimitMap = new Map<string, { count: number; reset: number }>();

ws.on('message', (data) => {
  const clientId = getClientId(ws); // IP or session ID
  const now = Date.now();
  const limit = rateLimitMap.get(clientId);
  
  if (limit && now < limit.reset) {
    limit.count++;
    if (limit.count > RATE_LIMIT) {
      ws.close(1008, 'Rate limit exceeded');
      return;
    }
  } else {
    rateLimitMap.set(clientId, { count: 1, reset: now + 1000 });
  }
  
  // Process message...
});
```

### No Authentication Needed

**Why:**
- Tailscale already authenticates devices
- Single-user system (not multi-tenant)
- Admin access to tmux already implies full system access

**If Multi-User Support Needed (Future):**
- Add HTTP Basic Auth with bcrypt-hashed passwords
- Use Tailscale identity headers (`Tailscale-User` from `tailscale serve`)

---

## Migration Strategy

### Phase 1: Extract Core (Week 1)

**Goal:** Create `@zui/core` package with shared logic.

**Steps:**
1. Create `packages/core/` directory
2. Move non-UI files:
   - `src/config.ts` → `packages/core/src/config.ts`
   - `src/discovery.ts` → `packages/core/src/discovery.ts`
   - `src/sessions.ts` → `packages/core/src/sessions.ts`
   - `src/worktrees.ts` → `packages/core/src/worktrees.ts`
   - `src/shell.ts` → `packages/core/src/shell.ts`
   - `src/types.ts` → `packages/core/src/types.ts`
3. Update TUI imports: `import { getSessions } from '@zui/core'`
4. Test TUI still works (no regressions)

**Verification:**
```bash
cd packages/tui
npm run build
npm test
zui  # Should work as before
```

### Phase 2: Web MVP (Week 2-3)

**Goal:** Basic web UI with session list and terminal.

**Scope:**
- Session list (read-only, no actions)
- Terminal view (attach to existing session)
- WebSocket streaming
- Basic responsive layout

**Steps:**
1. Scaffold SvelteKit app: `npm create svelte@latest packages/web`
2. Install deps: `xterm`, `xterm-addon-fit`, `ws`
3. Implement:
   - `GET /api/sessions` (REST)
   - `Terminal.svelte` (xterm.js + WS)
   - `SessionList.svelte` (display only)
4. Test on desktop browser
5. Test on mobile (Safari iOS, Chrome Android)

**Success Criteria:**
- Can view all sessions
- Can attach to session and see live output
- Typing works with <100ms latency
- Reconnects after network interruption

### Phase 3: Full Feature Parity (Week 4-5)

**Goal:** Match TUI feature set.

**Scope:**
- Create session (with project picker)
- Kill session
- Create worktree
- Clean worktree
- Status detection
- Lazygit integration

**Steps:**
1. Implement REST endpoints (POST/DELETE)
2. Add UI components (buttons, dialogs)
3. Wire up actions
4. Test all workflows

### Phase 4: Polish (Week 6)

**Goal:** Production-ready.

**Scope:**
- Mobile UX refinements
- Error handling
- Loading states
- Keyboard shortcuts
- Settings page (refresh interval, layout, theme)
- `zui serve` CLI command

---

## MVP Scope

### Must-Have (P0)

- [x] Session list with status indicators
- [x] Terminal view (xterm.js + WebSocket)
- [x] Create session (with project picker)
- [x] Kill session
- [x] View session (attach)
- [x] Responsive layout (desktop + mobile)
- [x] Tailscale-only access
- [x] Reconnection logic
- [x] `zui serve` command

### Nice-to-Have (P1)

- [ ] Slash command autocomplete
- [ ] Tool use visualization
- [ ] Session search/filter
- [ ] Worktree operations (create/clean)
- [ ] Lazygit integration
- [ ] Settings page
- [ ] Dark/light theme toggle

### Future (P2)

- [ ] Multi-session split view (tabs or grid)
- [ ] Session logs/history (persist tmux output)
- [ ] Notifications (session finished, error occurred)
- [ ] Clipboard synchronization
- [ ] File upload/download to session
- [ ] Audio notifications (session waiting for input)
- [ ] Collaborative viewing (multiple clients, one session)

---

## Future Features

### Tool Use Visualization

**Goal:** Show what Claude is doing in real-time.

**Implementation:**
1. Parse tmux output for tool use patterns:
   ```
   Searching the web for "Svelte animations"...
   Editing file: src/routes/+page.svelte
   Running command: npm test
   ```
2. Extract tool name and context
3. Send as JSON over WebSocket:
   ```json
   { "type": "tool", "tool": "edit", "file": "src/routes/+page.svelte", "timestamp": 1707593400 }
   ```
4. Display in sidebar as activity feed:
   ```
   Recent Activity:
   ● 10:23 - Edited +page.svelte
   ● 10:22 - Ran npm test
   ● 10:20 - Searched web: "Svelte animations"
   ```

### Slash Command Autocomplete

**Goal:** Show available slash commands as you type `/`.

**Implementation:**
1. Detect `/` character in terminal input
2. Show floating menu with commands:
   - `/test` - Run tests
   - `/commit` - Commit changes
   - `/thinking` - Toggle reasoning
3. Filter as user types
4. Insert selected command on Enter/Tab

**Challenge:** Requires intercepting terminal input before sending to tmux.

**Solution:**
```typescript
terminal.onData((data) => {
  if (data === '/') {
    showAutocomplete();
  } else if (autocompleteVisible) {
    if (data === '\t' || data === '\r') {
      insertAutocompletedCommand();
    } else {
      filterAutocomplete(data);
    }
  } else {
    ws.send(data); // Normal input
  }
});
```

### Session Persistence

**Goal:** Restore terminal history after browser refresh.

**Implementation:**
1. Enable tmux history capture:
   ```bash
   tmux set-option -g history-limit 50000
   ```
2. On WebSocket connect, dump history:
   ```typescript
   const history = execSync(`tmux capture-pane -p -t ${sessionName} -S -50000`);
   ws.send(history);
   ```
3. xterm.js renders historical output immediately

### Multi-Session View

**Goal:** View multiple sessions side-by-side (like tmux windows).

**UI:**
```
┌──────────────────────────────────────────────────┐
│  Sessions:  [session-1] [session-2] [session-3]  │
├──────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐             │
│  │ session-1    │  │ session-2    │             │
│  │              │  │              │             │
│  │ > claude     │  │ > claude     │             │
│  │              │  │              │             │
│  └──────────────┘  └──────────────┘             │
└──────────────────────────────────────────────────┘
```

**Implementation:**
- Tab bar at top (session names)
- Grid layout (CSS Grid or flexbox)
- Each panel has its own xterm.js instance + WebSocket
- Max 4 sessions visible at once (performance)

---

## Implementation Roadmap

### Week 1: Core Extraction
- [ ] Create `packages/core/` structure
- [ ] Move shared modules
- [ ] Update TUI imports
- [ ] Test TUI regression suite

### Week 2: Web Scaffold
- [ ] Initialize SvelteKit project
- [ ] Setup TypeScript + xterm.js
- [ ] Implement WebSocket server
- [ ] Basic terminal component

### Week 3: MVP Features
- [ ] REST API endpoints
- [ ] Session list UI
- [ ] Project picker dialog
- [ ] Create/kill session actions
- [ ] Responsive layout

### Week 4: Mobile Polish
- [ ] Drawer navigation
- [ ] Touch gestures
- [ ] Virtual keyboard handling
- [ ] Font size controls

### Week 5: Feature Parity
- [ ] Worktree operations
- [ ] Status detection
- [ ] Lazygit integration
- [ ] Settings page

### Week 6: Production Ready
- [ ] Error handling
- [ ] Loading states
- [ ] `zui serve` command
- [ ] Documentation
- [ ] Deploy over Tailscale

---

## Open Questions

1. **Should we support multiple concurrent users?**
   - Current design: Single-user (no auth)
   - Multi-user would require: session isolation, permissions, user accounts

2. **How to handle tmux session limits?**
   - tmux can have 1000+ sessions, but WebSocket connections are limited by OS (ulimit)
   - Solution: Limit active WS connections (e.g., 10 concurrent terminals)

3. **Should lazygit run in a separate terminal or inline?**
   - Option A: Open in new terminal panel (like TUI)
   - Option B: Embed in iframe (requires lazygit web mode - doesn't exist)
   - **Recommendation:** Option A (spawn lazygit session, show in separate terminal)

4. **Do we need offline mode?**
   - Service worker + IndexedDB for session list caching
   - Read-only mode when server unreachable
   - **Recommendation:** Not for MVP (adds complexity)

5. **Should we support desktop app (Electron)?**
   - Pro: Better native integration (notifications, tray icon)
   - Con: More maintenance, larger binary
   - **Recommendation:** Web-first, Electron wrapper later if demand exists

---

## Conclusion

This design provides a clear path from the current terminal TUI to a web-based interface that works across devices. By extracting shared business logic into `@zui/core`, we ensure both interfaces remain in sync and benefit from bug fixes.

The MVP scope is achievable in 4-6 weeks and delivers immediate value: managing Claude Code sessions from a phone without SSH. Future enhancements (tool visualization, multi-session views, notifications) can be added incrementally.

**Next Steps:**
1. Review this design doc with stakeholders
2. Validate tech stack choices (SvelteKit + xterm.js + WebSocket)
3. Create implementation tickets (GitHub issues)
4. Start Week 1: Core extraction

**Questions or Feedback?** Open an issue on [github.com/thornhill6305/zui](https://github.com/thornhill6305/zui).
