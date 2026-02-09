# ZUI — Architecture Decisions

## D1: Stdlib Only (No External Dependencies)

curses is part of the Python standard library on POSIX systems. By avoiding
external dependencies (textual, rich, blessed), ZUI installs instantly with
`pip install` and has zero supply-chain risk. The trade-off is more manual
drawing code, but the UI is simple enough that this is fine.

## D2: Default Tmux Server

ZUI sessions now use the default tmux server (no custom socket). This
simplifies the setup and allows all Claude sessions to be visible with
standard `tmux ls` commands. Session naming (`claude-*`) keeps them
organized and distinguishable from user sessions.

## D3: Zero-Config Auto-Discovery

When no config file exists, ZUI scans:
1. Current working directory (if it's a git repo)
2. Home directory (one level deep) for directories containing `.git`
3. Each found repo's `git worktree list` for linked worktrees

This means `cd ~/myproject && zui` just works.

## D4: Worktree Paths Derived from Branch Names

Instead of slot numbers (onstudio-f1, onstudio-f2), worktree paths are
auto-generated: `reponame-branch-name`. For example, branch `feat/auth`
in repo `myapp` creates `~/myapp-feat-auth`. This is more descriptive
and doesn't require tracking slot numbers.

## D5: Post-Create Hooks Instead of Hardcoded Setup

The prototype had hardcoded `pnpm install` and `.env` copying. ZUI replaces
this with a configurable `post_worktree_create` hook in config.toml. The
hook runs in the new worktree's directory, so users can do whatever setup
their project needs.

## D6: Auto-Wrap in Tmux

If ZUI is launched outside tmux, it automatically creates a `zui-manager`
tmux session and re-execs itself inside it. This is required because the
split-pane feature (Enter to view a session) relies on tmux pane splitting.

## D7: Session Name Convention

Sessions are named `claude-{branch-or-dirname}` with slashes replaced by
hyphens. This makes session names predictable and human-readable in both
ZUI and raw `tmux` commands.

## D8: Minimal TOML Parser Fallback

Python 3.11 added `tomllib`. For 3.10 support, we include a minimal TOML
parser that handles only the subset ZUI needs (key=value, [sections],
[[array-of-tables]], strings, lists, integers, booleans). This avoids
requiring `tomli` as a dependency.

## D9: ASCII-First UI

Default is ASCII-safe output (`[WORK]`, `[WAIT]`, etc.) because many
terminal/font configurations don't render emoji well in curses. Users can
set `ZUI_ASCII=0` for emoji mode.
