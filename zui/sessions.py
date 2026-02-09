"""Tmux session management for ZUI.

All tmux interactions go through this module. By default, sessions use
the default tmux server. A custom socket can be configured if needed.
"""

from __future__ import annotations

import os
import re
import subprocess
import time
from dataclasses import dataclass
from typing import List, Optional

from zui.config import Config


@dataclass
class Session:
    """A running tmux session managed by ZUI."""

    name: str
    running: str  # human-readable duration
    idle: str
    status: str  # [WORK], [WAIT], [ERR], [IDLE]
    preview: str


def _tmux_base(socket: str) -> List[str]:
    """Build tmux base command, with -S only if socket is set."""
    if socket:
        return ["tmux", "-S", socket]
    return ["tmux"]


def run_tmux(args: List[str], socket: str) -> str:
    """Run a tmux command, using -S only if socket is non-empty."""
    try:
        result = subprocess.run(
            _tmux_base(socket) + args,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return ""


def get_sessions(config: Config, use_ascii: bool = True) -> List[Session]:
    """Get list of active sessions with details."""
    output = run_tmux(
        [
            "list-sessions",
            "-F",
            "#{session_name}|#{session_created}|#{session_activity}",
        ],
        config.socket,
    )
    if not output:
        return []

    sessions: List[Session] = []
    now = time.time()

    for line in output.split("\n"):
        if not line:
            continue
        parts = line.split("|")
        if len(parts) < 3:
            continue

        name = parts[0]
        try:
            created = int(parts[1])
            last_activity = int(parts[2])
        except ValueError:
            continue

        running_secs = int(now - created)
        running_str = _format_duration(running_secs)

        idle_secs = int(now - last_activity)
        idle_str = f"{idle_secs}s ago" if idle_secs < 60 else f"{idle_secs // 60}m ago"

        preview = _get_preview(name, config.socket)
        status = _detect_status(preview, use_ascii)

        sessions.append(
            Session(
                name=name,
                running=running_str,
                idle=idle_str,
                status=status,
                preview=preview[:80] if preview else "(no output)",
            )
        )

    return sessions


def spawn_session(
    workdir: str,
    config: Config,
    yolo: bool = False,
) -> tuple[bool, str]:
    """Spawn a new Claude session in a tmux window.

    Returns (success, session_name_or_error).
    """
    # Derive session name from git branch or directory name
    try:
        result = subprocess.run(
            ["git", "-C", workdir, "branch", "--show-current"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        name = result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        name = ""

    if not name:
        name = os.path.basename(workdir.rstrip("/"))

    name = name.replace("/", "-")
    name = re.sub(r"[^a-zA-Z0-9_-]", "-", name)
    session_name = f"claude-{name}"

    # Check for existing session
    check = subprocess.run(
        _tmux_base(config.socket) + ["has-session", "-t", session_name],
        capture_output=True,
    )
    if check.returncode == 0:
        return False, f"Session {session_name} already exists"

    # Build claude command
    args = config.yolo_args if yolo else config.default_args
    claude_cmd = "claude"
    if args:
        claude_cmd += " " + " ".join(args)

    result = subprocess.run(
        _tmux_base(config.socket) + [
            "new-session",
            "-d",
            "-s",
            session_name,
            "-c",
            workdir,
            claude_cmd,
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        return False, result.stderr.strip() or "Failed to create session"

    return True, session_name


def kill_session(name: str, config: Config) -> bool:
    """Kill a tmux session by name."""
    result = subprocess.run(
        _tmux_base(config.socket) + ["kill-session", "-t", name],
        capture_output=True,
    )
    return result.returncode == 0


def show_session_in_pane(session_name: str, config: Config) -> bool:
    """Show a session in a right split pane.

    Kills existing right pane first if one exists, then splits
    horizontally with 70% width for the session view.
    """
    # Count current panes
    pane_count_out = subprocess.run(
        ["tmux", "display-message", "-p", "#{window_panes}"],
        capture_output=True,
        text=True,
    )
    num_panes = 1
    if pane_count_out.stdout.strip().isdigit():
        num_panes = int(pane_count_out.stdout.strip())

    if num_panes > 1:
        subprocess.run(
            ["tmux", "kill-pane", "-t", "{right}"],
            capture_output=True,
        )

    # Split horizontally, keep focus on zui (left)
    base = f"tmux -S {config.socket}" if config.socket else "tmux"
    cmd = f"{base} attach -t {session_name}"
    result = subprocess.run(
        ["tmux", "split-window", "-d", "-h", "-l", f"{config.layout_right_width}%", cmd],
        capture_output=True,
        text=True,
    )

    time.sleep(0.1)

    # Set pane title with session workdir and branch info
    if result.returncode == 0:
        workdir = get_session_workdir(session_name, config) or "~"
        branch = _get_git_branch(workdir)
        # Shorten path for display
        short_path = workdir.replace(os.path.expanduser("~"), "~")
        title = f"{short_path} ({branch})" if branch else short_path
        subprocess.run(
            ["tmux", "select-pane", "-t", "{right}", "-T", title],
            capture_output=True,
        )

    return result.returncode == 0


def _get_git_branch(path: str) -> Optional[str]:
    """Get the current git branch for a path."""
    if not path or not os.path.isdir(path):
        return None
    result = subprocess.run(
        ["git", "-C", path, "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def get_session_workdir(session_name: str, config: Config) -> Optional[str]:
    """Get the working directory of a tmux session."""
    result = subprocess.run(
        _tmux_base(config.socket) + [
            "display-message", "-t", session_name,
            "-p", "#{pane_current_path}",
        ],
        capture_output=True,
        text=True,
    )
    path = result.stdout.strip()
    return path if path and os.path.isdir(path) else None


def session_exists(name: str, config: Config) -> bool:
    """Check if a session exists."""
    result = subprocess.run(
        _tmux_base(config.socket) + ["has-session", "-t", name],
        capture_output=True,
    )
    return result.returncode == 0


# ── Helpers ──────────────────────────────────────────────────────────


def _format_duration(secs: int) -> str:
    if secs < 60:
        return f"{secs}s"
    if secs < 3600:
        return f"{secs // 60}m {secs % 60}s"
    h = secs // 3600
    m = (secs % 3600) // 60
    return f"{h}h {m}m"


def _get_preview(session: str, socket: str) -> str:
    """Get last non-empty line of output from a session pane."""
    output = run_tmux(
        ["capture-pane", "-p", "-t", session, "-S", "-5"], socket
    )
    if not output:
        return ""
    lines = [l.strip() for l in output.split("\n") if l.strip()]
    return lines[-1] if lines else ""


def _detect_status(preview: str, use_ascii: bool = True) -> str:
    """Detect session status from last output line."""
    lower = preview.lower()

    # Waiting for input
    if any(
        p in lower
        for p in [
            "? ",
            "allow",
            "approve",
            "y/n",
            "(y)",
            "press enter",
            "continue?",
            "proceed?",
        ]
    ):
        return "[WAIT]" if use_ascii else "waiting"

    # Errors
    if any(
        p in lower for p in ["error:", "failed", "exception", "traceback"]
    ):
        return "[ERR]" if use_ascii else "error"

    # Prompt (idle)
    if (
        preview.endswith(">")
        or preview.endswith("$")
        or ("claude" in lower and ">" in preview)
    ):
        return "[IDLE]" if use_ascii else "idle"

    # Default: working
    return "[WORK]" if use_ascii else "working"
