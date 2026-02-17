# ZUI — The Agent Manager

A terminal UI and web UI for managing AI coding agents ([Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Codex CLI](https://github.com/openai/codex)) running in tmux sessions.

<img width="1728" height="1087" alt="image" src="https://github.com/user-attachments/assets/edfcb7fe-b18f-49a4-a385-e2d76bfb1a8f" />

## Features

- **Split-pane TUI** — session list on the left, live agent output on the right
- **Web UI** — SvelteKit + xterm.js browser interface
- **Multi-agent** — supports Claude Code and Codex CLI; toggle between them on the fly
- **Zero config** — auto-discovers git repos in your home directory
- **Session status** — detects working, waiting-for-input, error, and idle states
- **Worktree management** — create git worktrees and launch agents in them
- **YOLO mode** — launch agents with auto-accept permissions enabled
- **Lazygit integration** — toggle a lazygit pane for the selected session
- **Remote control** — Alt-key bindings let you control ZUI from within an agent pane
- **Responsive layout** — columns adapt to terminal width, handles resize
- **Tailscale-aware** — detects your Tailscale URL for remote web access

## Prerequisites

| Dependency | Install |
|---|---|
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) or your package manager |
| **tmux** | `sudo apt install tmux` · `brew install tmux` · [tmux wiki](https://github.com/tmux/tmux/wiki/Installing) |
| **git** | `sudo apt install git` · `brew install git` · [git-scm.com](https://git-scm.com/downloads) |
| **Claude Code** *(optional)* | `npm install -g @anthropic-ai/claude-code` · [docs](https://docs.anthropic.com/en/docs/claude-code) |
| **Codex CLI** *(optional)* | `npm install -g @openai/codex` · [github](https://github.com/openai/codex) |
| **lazygit** *(optional)* | `sudo apt install lazygit` · `brew install lazygit` · [github](https://github.com/jesseduffield/lazygit#installation) |

At least one agent (Claude Code or Codex CLI) must be installed.

## Installation

```bash
npm install -g zui-agent-manager
```

### From Source

```bash
git clone https://github.com/thornhill6305/zui.git
cd zui
npm install
npm run build
npm link
```

## Usage

```bash
zui              # Launch TUI (auto-wraps in tmux if needed)
zui 3            # Launch TUI focused on session #3
zui ls           # List sessions with indices
zui serve        # Start web UI server (foreground)
zui serve start  # Start web UI server in background tmux session
zui serve stop   # Stop background web UI server
zui serve status # Check web UI server status
```

### How It Works

1. ZUI launches inside a tmux session (`zui-manager`)
2. It discovers git repos in your cwd, home directory, and any configured `scan_dirs`
3. Agent sessions run on the default tmux server
4. Pressing `Enter` on a session splits the pane right to show live output
5. `Tab` switches focus between the ZUI list and the session pane
6. From inside a session pane, use Alt-key bindings to control ZUI without switching focus

### Keybindings

#### TUI Navigation

| Key | Action |
|-----|--------|
| `1`–`9` | Jump to and view session by index |
| `↑` / `↓` | Move selection up/down |
| `Enter` | View selected session in right pane |
| `Tab` | Focus right pane (session output) |

#### Session Management

| Key | Action |
|-----|--------|
| `n` | New session (pick project + agent) |
| `y` | New YOLO session (auto-accept permissions) |
| `a` | Toggle default agent (Claude Code ↔ Codex CLI) |
| `k` | Kill selected session |
| `x` | Clean up a worktree |

#### Git & Worktrees

| Key | Action |
|-----|--------|
| `g` | Toggle lazygit pane |
| `w` | Create a new git worktree |

#### Layout & Misc

| Key | Action |
|-----|--------|
| `f` | Toggle fullscreen (zoom session pane) |
| `v` | Toggle web UI server |
| `s` | Settings |
| `r` | Force refresh session list |
| `h` | Help |
| `q` / `Esc` | Quit ZUI |

#### Remote Control (from within a session pane)

These Alt-key bindings work while focused inside an agent pane, so you can
control ZUI without switching back to the list.

| Key | Action |
|-----|--------|
| `Alt+1`–`9` | Jump to session by index |
| `Alt+0` | Jump to session 10 |
| `Alt+Enter` | View selected session |
| `Alt+Tab` | Toggle focus (ZUI ↔ pane) |
| `Alt+n` / `Alt+y` | New / YOLO session |
| `Alt+k` | Kill selected session |
| `Alt+g` | Show lazygit + focus |
| `Alt+w` | Create worktree |
| `Alt+f` | Toggle fullscreen |
| `Alt+c` | Close right pane |
| `Alt+q` | Quit ZUI |

## Web UI

ZUI includes a browser-based UI built with SvelteKit and xterm.js. It provides
the same session list and live terminal access from any browser — useful for
remote machines or as a mobile interface.

```bash
# Start the web server (default: http://127.0.0.1:3030)
zui serve start

# Or toggle it from within the TUI with `v`
```

If Tailscale is running, ZUI detects your Tailscale URL and shows it in the
header so you can access it from other devices on your tailnet.

## Configuration

ZUI works with zero config. For explicit control, create
`~/.config/zui/config.toml` (or `~/.zui.toml`):

```toml
# Tmux socket path (default: "" = default tmux server)
socket = ""

# Session list refresh interval in seconds
refresh_interval = 2

# Default agent to use when launching sessions: "claude" or "codex"
default_agent = "claude"

# Additional directories to scan for git repos (beyond ~)
scan_dirs = ["~/desktop", "~/work"]

# Explicit project roots
[[projects]]
path = "~/myproject"
# Optional: glob pattern for where worktrees live
# worktree_pattern = "~/myproject-*"

# Per-agent CLI arguments
[agents.claude]
default_args = []
yolo_args = ["--dangerously-skip-permissions"]

[agents.codex]
default_args = []
yolo_args = ["--yolo"]

# Hooks — shell commands run on events (cwd = new worktree)
[hooks]
post_worktree_create = "npm install"

# Cleanup confirmation prompt
[cleanup]
confirm = true

# Layout — panel sizes (percentages)
[layout]
right_width = 70      # Right panel width (session view), left gets the rest
lazygit_height = 40   # Lazygit panel height when shown

# Web UI server settings
[web]
port = 3030
host = "127.0.0.1"
```

See [examples/config.toml](examples/config.toml) for a full annotated example.

### In-TUI Settings

Press `s` in the TUI to open the settings dialog, where you can adjust panel
sizes and refresh interval without editing the config file. Changes are saved
to `~/.config/zui/config.toml` automatically.

## Architecture

ZUI is a TypeScript monorepo with three packages:

```
packages/
├── core/          # Shared logic (no UI dependencies)
│   ├── agents/    # Agent providers (Claude Code, Codex CLI)
│   ├── config.ts  # Config loading and saving (TOML)
│   ├── discovery.ts  # Git repo and worktree scanning
│   ├── sessions.ts   # Tmux session management
│   ├── worktrees.ts  # Git worktree operations
│   ├── shell.ts      # Shell command helpers
│   ├── web-server.ts # Web server lifecycle (background tmux session)
│   └── types.ts      # Shared types
│
├── tui/           # Terminal UI (Ink / React)
│   ├── index.tsx  # Entry point, tmux auto-wrapping
│   ├── app.tsx    # Main App component, keybindings
│   └── ui/        # Header, Footer, SessionList, dialogs, layout
│
└── web/           # Browser UI (SvelteKit + xterm.js)
    ├── src/
    │   ├── routes/    # SvelteKit pages and API endpoints
    │   ├── lib/
    │   │   ├── components/  # Sidebar, Terminal, SessionCard, etc.
    │   │   ├── stores/      # Svelte stores (sessions, terminal, ui)
    │   │   └── terminal/    # xterm.js manager + WebSocket client
    ├── server.js      # Node.js server entry point
```

## License

MIT
