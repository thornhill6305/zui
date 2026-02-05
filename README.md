# ZUI — The Agent Manager CLI

A terminal UI for managing [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agents running in tmux sessions.

```
┌─────────────────────── zui - Agent Manager ───────────────────────┐
│                                                                    │
│  Session                Status    Running   Preview                │
│  ──────────────────────────────────────────────────────────────    │
│> claude-feat-auth       [WORK]    12m 34s   Implementing login...  │
│  claude-fix-api         [WAIT]    3m 12s    Allow tool use? (y/n)  │
│  claude-main            [IDLE]    1h 5m     >                      │
│                                                                    │
│ Enter:View | Tab:Focus | n:New | y:YOLO | w:Worktree | x:Kill    │
└────────────────────────────────────────────────────────────────────┘
```


## Features

- **Split-pane TUI** — session list on the left, live session on the right
- **Zero config** — auto-discovers git repos in your home directory
- **Worktree management** — create git worktrees and launch agents in them
- **Session status** — detects working, waiting-for-input, error, and idle states
- **YOLO mode** — launch Claude with `--dangerously-skip-permissions`
- **No dependencies** — Python stdlib only (curses), runs anywhere Python + tmux exist

## Requirements

- Python 3.10+
- tmux
- git
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

## Installation

```bash
# From source
pip install -e .

# Or with pipx
pipx install .
```

## Usage

```bash
# Launch ZUI (auto-wraps in tmux if needed)
zui

# Or run as a module
python -m zui
```

### Keybindings

| Key     | Action                                    |
|---------|-------------------------------------------|
| `n`     | New Claude session (pick a project)       |
| `y`     | New YOLO session (skip permissions)       |
| `w`     | Create a new git worktree                 |
| `Enter` | View selected session in right pane       |
| `Tab`   | Switch focus to session pane              |
| `x`     | Kill selected session                     |
| `r`     | Force refresh session list                |
| `q`     | Quit                                      |

### How It Works

1. ZUI launches inside a tmux session (`zui-manager`)
2. It discovers git repos in your cwd and home directory
3. Claude sessions run in a separate tmux server (socket: `/tmp/zui-claude.sock`)
4. When you press Enter on a session, it splits the pane to show the live session
5. Tab switches focus between ZUI and the session pane

## Configuration (Optional)

ZUI works with zero config. For explicit control, create `~/.config/zui/config.toml`:

```toml
# Custom tmux socket path
socket = "/tmp/zui-claude.sock"

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
zui/
├── __main__.py      # Entry point
├── app.py           # Main TUI loop
├── config.py        # Config loading (TOML)
├── discovery.py     # Git repo/worktree scanning
├── sessions.py      # Tmux session management
├── worktrees.py     # Git worktree operations
└── ui/
    ├── layout.py    # Split-pane management
    ├── widgets.py   # Header, footer, dialogs
    └── theme.py     # Colors and display modes
```

## License

MIT
