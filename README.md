# ZUI — The Agent Manager CLI

A terminal UI for managing [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agents running in tmux sessions.

```
┌─────────────────────── zui - Agent Manager ───────────────────────┐
│                                                                    │
│  Session                Status    Running   Preview                │
│  ──────────────────────────────────────────────────────────────    │
│> myapp-feat-auth        [WORK]    12m 34s   Implementing login...  │
│  myapp-fix-api          [WAIT]    3m 12s    Allow tool use? (y/n)  │
│  myapp-main             [IDLE]    1h 5m     >                      │
│                                                                    │
│ Ent:View g:Git Tab:Pane n:New y:YOLO w:Tree s:Set h:Help k:Kill  │
└────────────────────────────────────────────────────────────────────┘
```


## Features

- **Split-pane TUI** — session list on the left, live session on the right
- **Zero config** — auto-discovers git repos in your home directory
- **Worktree management** — create git worktrees and launch agents in them
- **Session status** — detects working, waiting-for-input, error, and idle states
- **YOLO mode** — launch Claude with `--dangerously-skip-permissions`
- **Lazygit integration** — toggle a lazygit pane for the selected session
- **Responsive layout** — columns adapt to terminal width, handles resize

## Prerequisites

| Dependency | Install |
|---|---|
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) or your package manager |
| **tmux** | `sudo apt install tmux` (Debian/Ubuntu) · `brew install tmux` (macOS) · [tmux wiki](https://github.com/tmux/tmux/wiki/Installing) |
| **git** | `sudo apt install git` (Debian/Ubuntu) · `brew install git` (macOS) · [git-scm.com](https://git-scm.com/downloads) |
| **Claude Code** | `npm install -g @anthropic-ai/claude-code` · [docs](https://docs.anthropic.com/en/docs/claude-code) |

## Installation

```bash
# Clone, build, and link globally
git clone https://github.com/thornhill6305/zui.git
cd zui
npm install
npm run build
npm link
```

## Usage

```bash
# Launch ZUI (auto-wraps in tmux if needed)
zui
```

### Keybindings

| Key     | Action                                    |
|---------|-------------------------------------------|
| `n`     | New Claude session (pick a project)       |
| `y`     | New YOLO session (skip permissions)       |
| `w`     | Create a new git worktree                 |
| `Enter` | View selected session in right pane       |
| `Tab`   | Switch focus to session pane              |
| `g`     | Toggle lazygit pane                       |
| `k`     | Kill selected session                     |
| `x`     | Clean up a worktree                       |
| `s`     | Settings                                  |
| `h`     | Help                                      |
| `r`     | Force refresh session list                |
| `q`     | Quit                                      |

### How It Works

1. ZUI launches inside a tmux session (`zui-manager`)
2. It discovers git repos in your cwd and home directory
3. Claude sessions run on the default tmux server
4. When you press Enter on a session, it splits the pane to show the live session
5. Tab switches focus between ZUI and the session pane

## Configuration (Optional)

ZUI works with zero config. For explicit control, create `~/.config/zui/config.toml`:

```toml
# Custom tmux socket path (empty = default tmux server)
socket = ""

# Explicit project roots
[[projects]]
path = "~/myproject"

[[projects]]
path = "~/other-repo"

# Claude CLI arguments
[claude]
default_args = []
yolo_args = ["--dangerously-skip-permissions"]

# Post-create hooks (run after worktree creation)
[hooks]
post_worktree_create = "npm install"
```

See [examples/config.toml](examples/config.toml) for a full example.

## Architecture

```
src/
├── index.tsx          # Entry point, tmux auto-wrapping
├── app.tsx            # Main App component, keybindings
├── config.ts          # Config loading (TOML)
├── discovery.ts       # Git repo/worktree scanning
├── sessions.ts        # Tmux session management
├── worktrees.ts       # Git worktree operations
├── shell.ts           # Shell command wrapper
├── types.ts           # Shared types
└── ui/
    ├── Header.tsx     # Title bar
    ├── Footer.tsx     # Keybinding hints
    ├── SessionList.tsx # Responsive session table
    ├── layout.ts      # Split-pane management
    └── theme.ts       # Status colors
```

## License

MIT
