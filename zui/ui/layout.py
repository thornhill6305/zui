"""Split-pane layout management.

Handles the left panel (session list) running inside curses and the
right panel (live session) managed via tmux split-pane.
"""

from __future__ import annotations

import subprocess


def focus_right_pane() -> None:
    """Switch tmux focus to the right pane (session view)."""
    subprocess.run(
        ["tmux", "select-pane", "-R"],
        capture_output=True,
    )


def kill_right_pane() -> None:
    """Kill the right pane if it exists."""
    pane_count = subprocess.run(
        ["tmux", "display-message", "-p", "#{window_panes}"],
        capture_output=True,
        text=True,
    )
    num = int(pane_count.stdout.strip()) if pane_count.stdout.strip().isdigit() else 1
    if num > 1:
        subprocess.run(
            ["tmux", "kill-pane", "-t", "{right}"],
            capture_output=True,
        )


def kill_zui_session() -> None:
    """Kill the zui-manager tmux session on quit."""
    subprocess.run(
        ["tmux", "kill-session", "-t", "zui-manager"],
        capture_output=True,
    )
