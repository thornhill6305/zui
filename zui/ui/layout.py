"""Split-pane layout management.

Handles the left panel (session list) running inside curses and the
right panel (live session) managed via tmux split-pane.
"""

from __future__ import annotations

import shlex
import subprocess
import time


def focus_right_pane() -> None:
    """Switch tmux focus to the right pane (session view)."""
    subprocess.run(
        ["tmux", "select-pane", "-R"],
        capture_output=True,
    )


def get_pane_count() -> int:
    """Get the number of panes in the current tmux window."""
    result = subprocess.run(
        ["tmux", "display-message", "-p", "#{window_panes}"],
        capture_output=True,
        text=True,
    )
    return int(result.stdout.strip()) if result.stdout.strip().isdigit() else 1


def kill_right_pane() -> None:
    """Kill the right pane if it exists."""
    if get_pane_count() > 1:
        subprocess.run(
            ["tmux", "kill-pane", "-t", "{right}"],
            capture_output=True,
        )


def show_lazygit_pane(workdir: str, right_width: int = 70, lazygit_height: int = 40) -> bool:
    """Show lazygit in a bottom-right pane for the given workdir."""
    num_panes = get_pane_count()

    if num_panes < 2:
        # No session pane yet — open lazygit in the right pane
        result = subprocess.run(
            ["tmux", "split-window", "-d", "-h", "-l", f"{right_width}%",
             f"cd {shlex.quote(workdir)} && lazygit"],
            capture_output=True, text=True,
        )
        time.sleep(0.1)
        return result.returncode == 0

    if num_panes == 2:
        # Session pane exists on right — split it vertically for lazygit below
        result = subprocess.run(
            ["tmux", "split-window", "-d", "-t", "{right}", "-v", "-l", f"{lazygit_height}%",
             f"cd {shlex.quote(workdir)} && lazygit"],
            capture_output=True, text=True,
        )
        time.sleep(0.1)
        return result.returncode == 0

    # 3+ panes — kill bottom-right and recreate
    subprocess.run(
        ["tmux", "kill-pane", "-t", "{bottom-right}"],
        capture_output=True,
    )
    result = subprocess.run(
        ["tmux", "split-window", "-d", "-t", "{right}", "-v", "-l", f"{lazygit_height}%",
         f"cd {shlex.quote(workdir)} && lazygit"],
        capture_output=True, text=True,
    )
    time.sleep(0.1)
    return result.returncode == 0


def kill_bottom_right_pane() -> None:
    """Kill the bottom-right pane (lazygit)."""
    subprocess.run(
        ["tmux", "kill-pane", "-t", "{bottom-right}"],
        capture_output=True,
    )


def kill_zui_session() -> None:
    """Kill the zui-manager tmux session on quit."""
    subprocess.run(
        ["tmux", "kill-session", "-t", "zui-manager"],
        capture_output=True,
    )
