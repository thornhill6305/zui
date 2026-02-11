# ZUI Web App — Implementation Plan

## Phase 1: Extract @zui/core

Convert to npm workspaces monorepo. Move shared (non-UI) modules to `packages/core/`.

**Files to create:**
- `packages/core/package.json` — `@zui/core`, ESM, exports `./src/index.ts`
- `packages/core/tsconfig.json` — strict TS, ESNext
- `packages/core/src/index.ts` — barrel re-export of all modules
- `packages/core/src/config.ts` — moved from `src/config.ts`
- `packages/core/src/discovery.ts` — moved from `src/discovery.ts`
- `packages/core/src/sessions.ts` — moved from `src/sessions.ts`
- `packages/core/src/worktrees.ts` — moved from `src/worktrees.ts`
- `packages/core/src/shell.ts` — moved from `src/shell.ts`
- `packages/core/src/types.ts` — moved from `src/types.ts`
- `packages/core/src/cli.ts` — moved from `src/cli.ts`

**Files to create (TUI):**
- `packages/tui/package.json` — `@zui/tui`, depends on `@zui/core`
- `packages/tui/tsconfig.json`
- `packages/tui/tsup.config.ts` — bundles @zui/core via noExternal
- Move `src/app.tsx` → `packages/tui/src/app.tsx`
- Move `src/index.tsx` → `packages/tui/src/index.tsx`
- Move `src/ui/*` → `packages/tui/src/ui/*`
- Move `src/__tests__/*` → `packages/tui/src/__tests__/*` (with updated imports)

**Root changes:**
- `package.json` — add `"workspaces": ["packages/*"]`, remove TUI-specific deps/scripts
- Update `"bin"` to point to `packages/tui/dist/index.js`

**Import updates (TUI files):**
- `../types.js` → `@zui/core`
- `../config.js` → `@zui/core`
- `../sessions.js` → `@zui/core`
- `../discovery.js` → `@zui/core`
- `../worktrees.js` → `@zui/core`
- `../shell.js` → `@zui/core`
- `./types.js` → `@zui/core`
- `./config.js` → `@zui/core`
- etc.

**Verification:** `npm run build` and `npm test` from root.

## Phase 2: SvelteKit Web App Scaffold

**Create `packages/web/`:**
- `package.json` — SvelteKit + adapter-node + xterm.js + ws
- `svelte.config.js` — adapter-node
- `vite.config.ts`
- `tsconfig.json`
- `src/app.html` — HTML shell
- `src/app.css` — Global styles (CSS variables, dark theme)
- `src/routes/+layout.svelte` — Root layout
- `src/routes/+page.svelte` — Main page (sidebar + terminal)
- `src/routes/+page.server.ts` — SSR data (session list)

## Phase 3: Backend API + WebSocket

**REST API routes:**
- `src/routes/api/sessions/+server.ts` — GET (list), POST (create)
- `src/routes/api/sessions/[name]/+server.ts` — DELETE (kill)
- `src/routes/api/projects/+server.ts` — GET (list)
- `src/routes/api/worktrees/+server.ts` — POST (create), DELETE (remove)

**WebSocket + tmux bridge:**
- `src/lib/server/tmux-bridge.ts` — Spawns `tmux attach`, pipes stdio
- `src/lib/server/websocket.ts` — WebSocket server, routes to tmux-bridge
- `src/server.ts` — Custom Node.js server (SvelteKit handler + WS)

**Security:**
- `src/hooks.server.ts` — Tailscale IP check middleware

## Phase 4: Frontend Components

**Svelte components:**
- `src/lib/components/Sidebar.svelte` — Session list + actions (desktop)
- `src/lib/components/Terminal.svelte` — xterm.js wrapper
- `src/lib/components/StatusBar.svelte` — Session status + connection info
- `src/lib/components/SessionCard.svelte` — Individual session item
- `src/lib/components/ProjectPicker.svelte` — Dialog for new session
- `src/lib/components/MobileDrawer.svelte` — Slide-out drawer

**Stores:**
- `src/lib/stores/sessions.ts` — Writable store for session list
- `src/lib/stores/terminal.ts` — Terminal connection state
- `src/lib/stores/ui.ts` — UI state (drawer open, selected session)

**Terminal integration:**
- `src/lib/terminal/websocket-client.ts` — WS client with reconnection
- `src/lib/terminal/xterm-manager.ts` — xterm.js lifecycle manager

## Phase 5: tmux Bridge (wired into Phase 3)

Already covered in Phase 3. The tmux-bridge.ts spawns `tmux attach -t SESSION` and pipes:
- tmux stdout → WebSocket → xterm.js
- xterm.js input → WebSocket → tmux stdin
- Resize events: client sends JSON `{type:"resize",cols,rows}`, server runs `tmux resize-pane`

## Phase 6: Mobile UX

- MobileDrawer.svelte — swipe-from-left drawer
- Touch-friendly session cards (min 44x44 touch targets)
- Virtual keyboard detection via `visualViewport` API
- Responsive breakpoints: <768px mobile, 768-1024 tablet, >1024 desktop
- CSS media queries in app.css

## Phase 7: CLI Integration

- Add `zui serve` subcommand to `packages/tui/src/index.tsx`
- Starts the web server from packages/web build output
- `--port` flag (default 3030)
- `--host` flag (default 0.0.0.0)
- Prints URL on startup

---

## Execution Strategy

Phase 1 first (sequential — careful refactoring).
Phases 2-4 in parallel via subagents (new files, no deps on each other).
Phases 5-7 sequential (integration work).
