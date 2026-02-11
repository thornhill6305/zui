# ZUI TypeScript Migration Design

## Motivation

1. **Distribution** — `npm i -g zui-agent-manager` / `npx zui-agent-manager` is more universal than pip/pipx for the target audience (developers who already have Node)
2. **Maintainability** — TypeScript is the primary language of the maintainer
3. **Ecosystem** — Ink (React for terminals) provides richer TUI primitives than raw curses

## Scope

Full rewrite from Python (curses) to TypeScript (Ink/React). Drop-in replacement from the user's perspective — same config files, same keybindings, same tmux session naming, same behavior.

## Project Structure

```
zui/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.tsx          # entry point, renders <App />
│   ├── app.tsx            # root component, keybinding dispatch, dialog state
│   ├── config.ts          # TOML loader (~/.config/zui/config.toml or ~/.zui.toml)
│   ├── discovery.ts       # find git repos + worktrees in cwd and ~
│   ├── sessions.ts        # tmux session CRUD (spawn, kill, list, preview)
│   ├── worktrees.ts       # git worktree create/remove
│   ├── hooks/
│   │   ├── useSessions.ts # polls getSessions() on interval, returns sessions[]
│   │   └── useProjects.ts # runs discovery, returns projects[]
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   ├── SessionList.tsx
│   │   ├── SessionRow.tsx
│   │   ├── EmptyState.tsx
│   │   ├── StatusMessage.tsx
│   │   ├── ProjectPicker.tsx
│   │   ├── InputDialog.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── SettingsDialog.tsx
│   │   └── HelpScreen.tsx
│   └── types.ts           # Session, Project, Config interfaces
└── tests/
```

## Dependencies

### Runtime
- `ink` — React renderer for terminals
- `react` — component model and hooks
- `ink-text-input` — text input for dialogs
- `@iarna/toml` — TOML config parsing

### Dev
- `typescript`
- `@types/react`
- `tsx` — for development runs

## Architecture

### State & Data Flow

```
App (root)
├── state: sessions[], projects[], selected, statusMessage, activeDialog
├── useSessions(config) → polls tmux, returns Session[]
├── useProjects(config) → runs repo discovery, returns Project[]
│
├── activeDialog = null → main view
│   ├── <Header />
│   ├── <SessionList /> or <EmptyState />
│   ├── <StatusMessage />
│   └── <Footer />
│
├── activeDialog = 'projectPicker' → <ProjectPicker />
├── activeDialog = 'confirm'       → <ConfirmDialog />
├── activeDialog = 'input'         → <InputDialog />
├── activeDialog = 'settings'      → <SettingsDialog />
└── activeDialog = 'help'          → <HelpScreen />
```

### Keybindings

Handled via Ink's `useInput()` hook in App. Same bindings as Python version:

| Key | Action |
|-----|--------|
| `n` | New Claude session (project picker) |
| `y` | New YOLO session |
| `k` | Kill selected session |
| `x` | Cleanup worktree |
| `w` | Create new worktree |
| `g` | Toggle lazygit pane |
| `s` | Settings dialog |
| `h` | Help screen |
| `r` | Force refresh |
| `Tab` | Focus right tmux pane |
| `Enter` | View session in right pane |
| `Up/Down` | Navigate session list |
| `q/Esc` | Quit |

### Tmux & Subprocess Layer

Direct port from Python. Shell commands stay identical — only the calling API changes:

```ts
import { execSync } from 'node:child_process';

function runTmux(args: string[], socket: string): string {
  const base = socket ? ['tmux', '-S', socket] : ['tmux'];
  try {
    return execSync([...base, ...args].join(' '), {
      timeout: 5000,
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}
```

| Python | TypeScript |
|--------|-----------|
| `subprocess.run([...], capture_output=True)` | `execSync(cmd, { encoding: 'utf-8' })` |
| `subprocess.run([...]).returncode` | `try/catch` (execSync throws on non-zero) |
| `os.path.isdir(path)` | `fs.statSync(path).isDirectory()` |
| `os.path.expanduser('~')` | `os.homedir()` |
| `os.path.basename(p)` | `path.basename(p)` |
| `dataclass` | TypeScript `interface` |

### Config

Same file locations, same TOML format, same defaults. Zero migration needed for existing users.

```
~/.config/zui/config.toml   (primary)
~/.zui.toml                 (fallback)
```

Default config values stay identical:
- `socket = ""` (use default tmux server)
- `refresh_interval = 2`
- `layout_right_width = 70`
- `layout_lazygit_height = 40`
- `confirm_cleanup = true`
- `default_args = []`
- `yolo_args = ["--dangerously-skip-permissions"]`

### Types

```ts
interface Session {
  name: string;
  running: string;    // human-readable duration
  idle: string;
  status: string;     // [WORK], [WAIT], [ERR], [IDLE]
  preview: string;
}

interface Project {
  name: string;
  path: string;
  branch: string;
  displayName: string;
  isWorktree: boolean;
  parentRepo: string;
}

interface Config {
  socket: string;
  refreshInterval: number;
  layoutRightWidth: number;
  layoutLazygitHeight: number;
  confirmCleanup: boolean;
  defaultArgs: string[];
  yoloArgs: string[];
  scanPaths: string[];
}
```

## Distribution

```json
{
  "name": "zui-agent-manager",
  "bin": { "zui": "./dist/index.js" },
  "type": "module",
  "engines": { "node": ">=18" }
}
```

Install methods:
- `npm i -g zui-agent-manager` — global install
- `npx zui-agent-manager` — run without install
- `git clone` + `npm link` — development

Build: `tsc` compiles `src/` to `dist/`. The published package ships compiled JS only — no tsx runtime dependency needed.

## Migration Plan (Implementation Order)

1. **Scaffold** — package.json, tsconfig, types.ts, index.tsx with minimal Ink render
2. **Config** — port config.ts (TOML loading, defaults, save)
3. **Sessions** — port sessions.ts (tmux commands, session listing, spawn/kill)
4. **Discovery** — port discovery.ts (git repo + worktree scanning)
5. **Worktrees** — port worktrees.ts (create/remove)
6. **Hooks** — useSessions (polling), useProjects (discovery)
7. **Components** — Header, Footer, SessionRow, SessionList, EmptyState, StatusMessage
8. **Dialogs** — ProjectPicker, ConfirmDialog, InputDialog, SettingsDialog, HelpScreen
9. **App** — wire everything together with useInput() keybindings
10. **Test** — verify feature parity with Python version
11. **Cleanup** — remove Python source, update README, publish to npm

## What Stays the Same (User Perspective)

- Config file location and format
- All keybindings
- Session naming scheme (`claude-{branch}`)
- Tmux socket behavior
- Worktree paths
- Lazygit integration
- All dialog workflows
