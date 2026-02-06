"""UI widgets: header, footer, session list, dialogs, empty state."""

from __future__ import annotations

import curses
from typing import Dict, List, Optional, Tuple

from zui.sessions import Session
from zui.ui.theme import PAIR_FOOTER, PAIR_HEADER, PAIR_SELECTED, status_attr


# ── Safe drawing ─────────────────────────────────────────────────────


def safe_addstr(win, y: int, x: int, text: str, attr: int = 0) -> None:
    """Write text to a curses window, silently handling boundary errors."""
    try:
        height, width = win.getmaxyx()
        if y < 0 or y >= height or x < 0 or x >= width:
            return
        max_len = width - x - 1
        if max_len <= 0:
            return
        win.addstr(y, x, text[:max_len], attr)
    except curses.error:
        pass


# ── Header ───────────────────────────────────────────────────────────


def draw_header(win, width: int) -> None:
    """Draw title bar."""
    title = "  zui - Agent Manager  "
    attr = curses.color_pair(PAIR_HEADER) | curses.A_BOLD
    safe_addstr(win, 0, 0, " " * (width - 1), attr)
    safe_addstr(win, 0, max(0, (width - len(title)) // 2), title, attr)

    # Column headers
    win.attron(curses.A_BOLD)
    if width >= 70:
        safe_addstr(win, 2, 2, "Session")
        safe_addstr(win, 2, 33, "Status")
        safe_addstr(win, 2, 44, "Running")
        safe_addstr(win, 2, 56, "Preview")
    else:
        safe_addstr(win, 2, 2, "Session")
        safe_addstr(win, 2, 22, "Status")
        safe_addstr(win, 2, 33, "Time")
    win.attroff(curses.A_BOLD)
    safe_addstr(win, 3, 2, "\u2500" * min(width - 4, 80))


# ── Session row ──────────────────────────────────────────────────────


def draw_session_row(
    win, row: int, session: Session, selected: bool, width: int
) -> None:
    """Draw a single session row."""
    if selected:
        attr = curses.color_pair(PAIR_SELECTED) | curses.A_BOLD
        safe_addstr(win, row, 0, " " * (width - 1), attr)
    else:
        attr = 0

    marker = "> " if selected else "  "

    if width >= 70:
        name = session.name[:28]
        safe_addstr(win, row, 0, marker, attr)
        safe_addstr(win, row, 2, name.ljust(30), attr)
        safe_addstr(win, row, 33, session.status.ljust(8), attr | status_attr(session.status))
        safe_addstr(win, row, 44, session.running.ljust(10), attr)
        preview_w = width - 57
        if preview_w > 5:
            preview = session.preview[:preview_w - 3]
            if len(session.preview) > preview_w - 3:
                preview += "..."
            safe_addstr(win, row, 56, preview, attr)
    else:
        name = session.name[:18]
        safe_addstr(win, row, 0, marker, attr)
        safe_addstr(win, row, 2, name.ljust(19), attr)
        safe_addstr(win, row, 22, session.status[:8].ljust(9), attr | status_attr(session.status))
        safe_addstr(win, row, 33, session.running, attr)


# ── Footer ───────────────────────────────────────────────────────────


def draw_footer(win, height: int, width: int) -> None:
    """Draw bottom help bar."""
    if width >= 100:
        footer = " Enter:View | g:Git | Tab:Focus | n:New | y:YOLO | w:Worktree | s:Settings | x:Kill | q:Quit "
    elif width >= 55:
        footer = " Ent g:Git Tab n y w s:Set x q "
    else:
        footer = " Ent g Tab n y w s x q "
    attr = curses.color_pair(PAIR_FOOTER)
    safe_addstr(win, height - 1, 0, " " * (width - 1), attr)
    safe_addstr(win, height - 1, max(0, (width - len(footer)) // 2), footer, attr)


# ── Empty state ──────────────────────────────────────────────────────


def draw_empty_state(win, height: int, width: int) -> None:
    """Draw message when no sessions exist."""
    msg1 = "No Claude sessions running"
    msg2 = "Press 'n' to start a new session"
    mid = height // 2
    safe_addstr(win, mid - 1, max(0, (width - len(msg1)) // 2), msg1, curses.A_BOLD)
    safe_addstr(win, mid + 1, max(0, (width - len(msg2)) // 2), msg2)


# ── Status message ───────────────────────────────────────────────────


def draw_status_message(win, height: int, width: int, message: str) -> None:
    """Draw a temporary status message above the footer."""
    if not message:
        return
    msg = message[: width - 4]
    attr = curses.A_BOLD
    if message.startswith("Error"):
        attr |= curses.A_REVERSE
    safe_addstr(win, height - 2, 2, msg, attr)


# ── Dialogs ──────────────────────────────────────────────────────────


def confirm_dialog(win, message: str) -> bool:
    """Show a yes/no confirmation dialog. Returns True for yes."""
    height, width = win.getmaxyx()
    dialog_w = min(len(message) + 14, width - 4)
    dialog_h = 3
    sy = (height - dialog_h) // 2
    sx = (width - dialog_w) // 2

    win.attron(curses.A_REVERSE)
    for y in range(dialog_h):
        safe_addstr(win, sy + y, sx, " " * dialog_w)
    safe_addstr(win, sy + 1, sx + 2, message + " (y/n)")
    win.attroff(curses.A_REVERSE)
    win.refresh()

    while True:
        key = win.getch()
        if key in (ord("y"), ord("Y")):
            return True
        if key in (ord("n"), ord("N"), 27):
            return False


def input_dialog(
    win, title: str, prompt: str, default: str = ""
) -> Optional[str]:
    """Show a single-line text input dialog. Returns None on cancel."""
    curses.curs_set(1)
    height, width = win.getmaxyx()

    dialog_w = min(70, width - 4)
    dialog_h = 5
    sy = (height - dialog_h) // 2
    sx = (width - dialog_w) // 2

    # Background
    win.attron(curses.A_REVERSE)
    for y in range(dialog_h):
        safe_addstr(win, sy + y, sx, " " * dialog_w)
    win.attroff(curses.A_REVERSE)

    # Title & prompt
    safe_addstr(win, sy, sx + 2, f" {title} ", curses.A_BOLD | curses.A_REVERSE)
    safe_addstr(win, sy + 2, sx + 2, prompt, curses.A_REVERSE)

    input_start = sx + 2 + len(prompt) + 1
    input_width = dialog_w - len(prompt) - 5

    text = default
    cursor_pos = len(text)

    while True:
        display = text[-input_width:] if len(text) > input_width else text
        safe_addstr(win, sy + 2, input_start, display.ljust(input_width), curses.A_REVERSE)

        cx = input_start + min(cursor_pos, input_width)
        try:
            win.move(sy + 2, cx)
        except curses.error:
            pass
        win.refresh()

        key = win.getch()

        if key == 27:  # Escape
            curses.curs_set(0)
            return None
        elif key in (ord("\n"), curses.KEY_ENTER):
            curses.curs_set(0)
            return text
        elif key in (curses.KEY_BACKSPACE, 127, 8):
            if cursor_pos > 0:
                text = text[: cursor_pos - 1] + text[cursor_pos:]
                cursor_pos -= 1
        elif key == curses.KEY_LEFT:
            cursor_pos = max(0, cursor_pos - 1)
        elif key == curses.KEY_RIGHT:
            cursor_pos = min(len(text), cursor_pos + 1)
        elif 32 <= key <= 126:
            text = text[:cursor_pos] + chr(key) + text[cursor_pos:]
            cursor_pos += 1


def settings_dialog(win, config) -> bool:
    """Show a settings dialog. Returns True if saved, False if cancelled."""
    settings = [
        {
            "label": "Right panel width:",
            "key": "layout_right_width",
            "value": config.layout_right_width,
            "min": 50,
            "max": 90,
            "suffix": "%",
        },
        {
            "label": "Lazygit height:",
            "key": "layout_lazygit_height",
            "value": config.layout_lazygit_height,
            "min": 20,
            "max": 60,
            "suffix": "%",
        },
        {
            "label": "Refresh interval:",
            "key": "refresh_interval",
            "value": config.refresh_interval,
            "min": 1,
            "max": 10,
            "suffix": "s",
        },
    ]
    selected = 0

    while True:
        height, width = win.getmaxyx()
        dialog_w = min(38, width - 4)
        dialog_h = len(settings) + 6
        sy = max(0, (height - dialog_h) // 2)
        sx = max(0, (width - dialog_w) // 2)

        # Background
        attr_bg = curses.A_REVERSE
        for y in range(dialog_h):
            safe_addstr(win, sy + y, sx, " " * dialog_w, attr_bg)

        # Title
        safe_addstr(win, sy, sx + 2, " Settings ", curses.A_BOLD | attr_bg)

        # Setting rows
        label_w = max(len(s["label"]) for s in settings)
        for i, s in enumerate(settings):
            row = sy + 2 + i
            marker = "> " if i == selected else "  "
            label = s["label"].ljust(label_w)
            val_str = f"[{s['value']}]{s['suffix']}"
            attr_row = curses.A_BOLD if i == selected else attr_bg
            safe_addstr(win, row, sx + 2, f"{marker}{label}  {val_str}", attr_row)

        # Help
        safe_addstr(win, sy + dialog_h - 2, sx + 2, "\u2191/\u2193: Select | \u2190/\u2192: Adjust", attr_bg)
        safe_addstr(win, sy + dialog_h - 1, sx + 2, "Enter: Save | Esc: Cancel", attr_bg)
        win.refresh()

        key = win.getch()
        if key == 27:
            return False
        elif key == curses.KEY_UP:
            selected = max(0, selected - 1)
        elif key == curses.KEY_DOWN:
            selected = min(len(settings) - 1, selected + 1)
        elif key == curses.KEY_RIGHT:
            s = settings[selected]
            s["value"] = min(s["max"], s["value"] + 1)
        elif key == curses.KEY_LEFT:
            s = settings[selected]
            s["value"] = max(s["min"], s["value"] - 1)
        elif key in (ord("\n"), curses.KEY_ENTER):
            for s in settings:
                setattr(config, s["key"], s["value"])
            return True


def project_picker(
    win, projects: list, title: str = "Select Project"
) -> Optional[int]:
    """Show a project selection dialog. Returns index or None."""
    if not projects:
        return None

    selected = 0

    while True:
        height, width = win.getmaxyx()
        dialog_h = min(len(projects) + 6, height - 2)
        dialog_w = min(65, width - 4)
        sy = max(0, (height - dialog_h) // 2)
        sx = max(0, (width - dialog_w) // 2)

        # Background
        for y in range(dialog_h):
            safe_addstr(win, sy + y, sx, " " * dialog_w, curses.A_REVERSE)

        safe_addstr(win, sy, sx + 2, f" {title} ", curses.A_BOLD | curses.A_REVERSE)
        safe_addstr(win, sy + 1, sx + 2, "Pick a project:", curses.A_REVERSE)

        visible = dialog_h - 5
        for i, proj in enumerate(projects[:visible]):
            row = sy + 3 + i
            marker = "> " if i == selected else "  "
            name = proj.display_name[:dialog_w - 8]
            attr = curses.A_BOLD if i == selected else curses.A_REVERSE
            safe_addstr(win, row, sx + 2, f"{marker}{name}", attr)

        safe_addstr(
            win,
            sy + dialog_h - 1,
            sx + 2,
            " Up/Down:Pick | Enter:Select | Esc:Cancel ",
            curses.A_REVERSE,
        )
        win.refresh()

        key = win.getch()
        if key == 27:
            return None
        elif key == curses.KEY_UP:
            selected = max(0, selected - 1)
        elif key == curses.KEY_DOWN:
            selected = min(len(projects) - 1, selected + 1)
        elif key in (ord("\n"), curses.KEY_ENTER):
            return selected
