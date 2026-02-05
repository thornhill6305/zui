"""Color theme and display mode for ZUI."""

from __future__ import annotations

import curses
import os

# Set ZUI_ASCII=0 for emoji mode
USE_ASCII = os.environ.get("ZUI_ASCII", "1") != "0"

# Color pair IDs
PAIR_HEADER = 1
PAIR_FOOTER = 2
PAIR_SELECTED = 3
PAIR_STATUS_WORK = 4
PAIR_STATUS_WAIT = 5
PAIR_STATUS_ERR = 6
PAIR_STATUS_IDLE = 7
PAIR_DIM = 8


def init_colors() -> None:
    """Initialize curses color pairs. Call after curses.initscr()."""
    curses.use_default_colors()
    try:
        curses.init_pair(PAIR_HEADER, curses.COLOR_BLACK, curses.COLOR_CYAN)
        curses.init_pair(PAIR_FOOTER, curses.COLOR_BLACK, curses.COLOR_CYAN)
        curses.init_pair(PAIR_SELECTED, curses.COLOR_BLACK, curses.COLOR_WHITE)
        curses.init_pair(PAIR_STATUS_WORK, curses.COLOR_CYAN, -1)
        curses.init_pair(PAIR_STATUS_WAIT, curses.COLOR_YELLOW, -1)
        curses.init_pair(PAIR_STATUS_ERR, curses.COLOR_RED, -1)
        curses.init_pair(PAIR_STATUS_IDLE, curses.COLOR_GREEN, -1)
        curses.init_pair(PAIR_DIM, curses.COLOR_WHITE, -1)
    except curses.error:
        pass  # Terminal doesn't support colors — that's fine


def status_attr(status: str) -> int:
    """Return curses attribute for a session status string."""
    if "WAIT" in status:
        return curses.color_pair(PAIR_STATUS_WAIT) | curses.A_BOLD
    if "ERR" in status:
        return curses.color_pair(PAIR_STATUS_ERR) | curses.A_BOLD
    if "IDLE" in status:
        return curses.color_pair(PAIR_STATUS_IDLE)
    # WORK
    return curses.color_pair(PAIR_STATUS_WORK)
