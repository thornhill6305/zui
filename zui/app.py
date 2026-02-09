"""Main TUI application loop for ZUI."""

from __future__ import annotations

import curses
import os
import time
from typing import List, Optional

from zui.config import Config, save_config
from zui.discovery import Project, discover_projects
from zui.sessions import (
    Session,
    get_session_workdir,
    get_sessions,
    kill_session,
    session_exists,
    show_session_in_pane,
    spawn_session,
)
from zui.ui.layout import (
    focus_right_pane,
    get_pane_count,
    kill_bottom_right_pane,
    kill_zui_session,
    show_lazygit_pane,
)
from zui.ui.theme import init_colors
from zui.ui.widgets import (
    confirm_dialog,
    draw_empty_state,
    draw_footer,
    draw_header,
    draw_session_row,
    draw_status_message,
    help_dialog,
    input_dialog,
    project_picker,
    settings_dialog,
)
from zui.worktrees import create_worktree


class App:
    """The ZUI application."""

    def __init__(self) -> None:
        self.config = Config.load()
        self.sessions: List[Session] = []
        self.projects: List[Project] = []
        self.selected = 0
        self.last_refresh = 0.0
        self.status_message = ""
        self.status_time = 0.0

    def run(self, stdscr) -> None:
        """Main curses loop."""
        curses.curs_set(0)
        curses.set_escdelay(25)
        init_colors()
        stdscr.timeout(self.config.refresh_interval * 1000)

        # Initial discovery
        self.projects = discover_projects(self.config)

        while True:
            try:
                self._tick(stdscr)
            except KeyboardInterrupt:
                break

    def _tick(self, stdscr) -> None:
        now = time.time()

        # Clear status after 3s
        if self.status_message and now - self.status_time > 3:
            self.status_message = ""

        # Refresh sessions periodically
        if now - self.last_refresh >= self.config.refresh_interval:
            self.sessions = get_sessions(self.config)
            self.last_refresh = now
            if self.sessions and self.selected >= len(self.sessions):
                self.selected = len(self.sessions) - 1

        # Draw
        stdscr.erase()
        height, width = stdscr.getmaxyx()

        draw_header(stdscr, width)

        if not self.sessions:
            draw_empty_state(stdscr, height, width)
        else:
            for i, session in enumerate(self.sessions):
                row = 4 + i
                if row >= height - 3:
                    break
                draw_session_row(stdscr, row, session, i == self.selected, width)

        draw_status_message(stdscr, height, width, self.status_message)
        draw_footer(stdscr, height, width)
        stdscr.refresh()

        # Input
        key = stdscr.getch()
        self._handle_key(stdscr, key)

    def _handle_key(self, stdscr, key: int) -> None:
        if key == ord("q") or key == 27:
            kill_zui_session()
            raise KeyboardInterrupt

        elif key == ord("r"):
            self._refresh(stdscr)

        elif key == curses.KEY_RESIZE:
            self._handle_resize(stdscr)

        elif key == curses.KEY_UP and self.sessions:
            self.selected = max(0, self.selected - 1)

        elif key == curses.KEY_DOWN and self.sessions:
            self.selected = min(len(self.sessions) - 1, self.selected + 1)

        elif key == ord("\n") and self.sessions:
            self._view_session(stdscr)

        elif key == ord("n"):
            self._launch_session(stdscr, yolo=False)

        elif key == ord("y"):
            self._launch_session(stdscr, yolo=True)

        elif key == ord("k") and self.sessions:
            self._kill_session(stdscr)

        elif key == ord("x"):
            self._cleanup_worktree(stdscr)

        elif key == ord("g") and self.sessions:
            self._toggle_lazygit(stdscr)

        elif key == ord("w"):
            self._create_worktree(stdscr)

        elif key == ord("s"):
            self._open_settings(stdscr)

        elif key == ord("h"):
            self._open_help(stdscr)

        elif key == ord("\t"):
            focus_right_pane()

    def _render(self, stdscr) -> None:
        """Force a screen redraw (for showing loading states)."""
        stdscr.erase()
        height, width = stdscr.getmaxyx()
        draw_header(stdscr, width)
        if not self.sessions:
            draw_empty_state(stdscr, height, width)
        else:
            for i, session in enumerate(self.sessions):
                row = 4 + i
                if row >= height - 3:
                    break
                draw_session_row(stdscr, row, session, i == self.selected, width)
        draw_status_message(stdscr, height, width, self.status_message)
        draw_footer(stdscr, height, width)
        stdscr.refresh()

    # ── Actions ──────────────────────────────────────────────────────

    def _view_session(self, stdscr) -> None:
        name = self.sessions[self.selected].name
        try:
            if show_session_in_pane(name, self.config):
                focus_right_pane()
                self._set_status(f"Showing: {name}")
            else:
                self._set_status("Error: Failed to open pane")
        except Exception as exc:
            self._set_status(f"Error: {exc}")

    def _launch_session(self, stdscr, yolo: bool) -> None:
        stdscr.timeout(-1)

        # Refresh projects for the picker
        self.projects = discover_projects(self.config)

        if not self.projects:
            # No projects found, ask for a directory
            title = "New YOLO Session" if yolo else "New Claude Session"
            workdir = input_dialog(stdscr, title, "Workdir:", os.getcwd())
            stdscr.timeout(self.config.refresh_interval * 1000)
            if workdir is None:
                self._set_status("Cancelled")
                return
            workdir = os.path.expanduser(workdir)
            if not os.path.isdir(workdir):
                self._set_status(f"Error: {workdir} is not a directory")
                return
            ok, result = spawn_session(workdir, self.config, yolo=yolo)
        else:
            title = "YOLO Launch" if yolo else "Launch Claude"
            idx = project_picker(stdscr, self.projects, title)
            stdscr.timeout(self.config.refresh_interval * 1000)
            if idx is None:
                self._set_status("Cancelled")
                return

            proj = self.projects[idx]

            # If session already exists for this project, just show it
            session_candidate = f"claude-{proj.name}"
            if session_exists(session_candidate, self.config):
                show_session_in_pane(session_candidate, self.config)
                focus_right_pane()
                self._set_status(f"Showing: {session_candidate}")
                self._refresh(stdscr)
                return

            ok, result = spawn_session(proj.path, self.config, yolo=yolo)

        if ok:
            show_session_in_pane(result, self.config)
            focus_right_pane()
            label = "YOLO" if yolo else "Launched"
            self._set_status(f"{label}: {result}")
        else:
            self._set_status(result)

        self._refresh(stdscr)

    def _kill_session(self, stdscr) -> None:
        name = self.sessions[self.selected].name
        stdscr.timeout(-1)
        if confirm_dialog(stdscr, f"Kill {name}?"):
            if kill_session(name, self.config):
                self._set_status(f"Killed: {name}")
            else:
                self._set_status(f"Error: Failed to kill {name}")
            self._refresh(stdscr)
            if self.selected >= len(self.sessions) and self.sessions:
                self.selected = len(self.sessions) - 1
        else:
            self._set_status("Cancelled")
        self._set_status_time()
        stdscr.timeout(self.config.refresh_interval * 1000)

    def _cleanup_worktree(self, stdscr) -> None:
        """Show picker of worktrees, then clean selected one (remove worktree + delete branch + kill matching session)."""
        self.projects = discover_projects(self.config)
        worktrees = [p for p in self.projects if p.is_worktree]

        if not worktrees:
            self._set_status("No worktrees to clean")
            self._set_status_time()
            return

        stdscr.timeout(-1)

        idx = project_picker(stdscr, worktrees, title="Clean Worktree")
        if idx is None:
            self._set_status("Cancelled")
            self._set_status_time()
            stdscr.timeout(self.config.refresh_interval * 1000)
            return

        proj = worktrees[idx]

        if self.config.confirm_cleanup:
            msg = f"Clean {proj.display_name}? (remove worktree + delete branch)"
            if not confirm_dialog(stdscr, msg):
                self._set_status("Cancelled")
                self._set_status_time()
                stdscr.timeout(self.config.refresh_interval * 1000)
                return

        self._set_status(f"Cleaning {proj.display_name}...")
        self._render(stdscr)

        # Kill any matching tmux session
        basename = os.path.basename(proj.path)
        for sess in self.sessions:
            if basename in sess.name or sess.name.endswith(basename):
                kill_session(sess.name, self.config)
                break

        # Remove worktree + branch
        from zui.worktrees import remove_worktree

        ok, msg = remove_worktree(proj.parent_repo, proj.path, proj.branch)

        if ok:
            self._set_status(f"Cleaned: {proj.display_name}")
        else:
            self._set_status(f"Error: {msg}")

        self._refresh(stdscr)
        if self.sessions and self.selected >= len(self.sessions):
            self.selected = len(self.sessions) - 1
        self._set_status_time()
        stdscr.timeout(self.config.refresh_interval * 1000)

    def _create_worktree(self, stdscr) -> None:
        stdscr.timeout(-1)

        # Pick parent repo
        self.projects = discover_projects(self.config)
        # Filter to non-worktree repos only
        repos = [p for p in self.projects if not p.is_worktree]
        if not repos:
            stdscr.timeout(self.config.refresh_interval * 1000)
            self._set_status("No git repos found")
            return

        if len(repos) == 1:
            repo = repos[0]
        else:
            idx = project_picker(stdscr, repos, "New Worktree - Pick Repo")
            if idx is None:
                stdscr.timeout(self.config.refresh_interval * 1000)
                self._set_status("Cancelled")
                return
            repo = repos[idx]

        # Get branch name
        branch = input_dialog(stdscr, "New Worktree", "Branch:", "feat/")
        stdscr.timeout(self.config.refresh_interval * 1000)

        if branch is None or not branch.strip():
            self._set_status("Cancelled")
            return

        branch = branch.strip()
        ok, result = create_worktree(repo.path, branch, self.config)

        if ok:
            self._set_status(f"Created: {os.path.basename(result)} ({branch})")
            # Refresh to discover the new worktree
            self.projects = discover_projects(self.config)
        else:
            self._set_status(f"Error: {result}")

    def _toggle_lazygit(self, stdscr) -> None:
        num_panes = get_pane_count()

        if num_panes >= 3:
            # Lazygit is showing — kill it (toggle off)
            kill_bottom_right_pane()
            self._set_status("Git: hidden")
        else:
            name = self.sessions[self.selected].name
            workdir = get_session_workdir(name, self.config)
            if workdir:
                if num_panes < 2:
                    # No session shown yet — full 3-pane layout
                    if show_session_in_pane(name, self.config):
                        time.sleep(0.2)
                        show_lazygit_pane(workdir, self.config.layout_right_width, self.config.layout_lazygit_height)
                        self._set_status(f"View + Git: {name}")
                    else:
                        self._set_status("Error: Failed to open panes")
                else:
                    # Session already shown — add lazygit below
                    if show_lazygit_pane(workdir, self.config.layout_right_width, self.config.layout_lazygit_height):
                        self._set_status(f"Git: {os.path.basename(workdir)}")
                    else:
                        self._set_status("Error: Failed to open lazygit")
            else:
                self._set_status("Error: Can't find session workdir")

    def _open_settings(self, stdscr) -> None:
        stdscr.timeout(-1)
        if settings_dialog(stdscr, self.config):
            try:
                save_config(self.config)
                stdscr.timeout(self.config.refresh_interval * 1000)
                self._set_status("Settings saved")
            except Exception as exc:
                stdscr.timeout(self.config.refresh_interval * 1000)
                self._set_status(f"Error saving: {exc}")
        else:
            stdscr.timeout(self.config.refresh_interval * 1000)
            self._set_status("Settings cancelled")

    def _open_help(self, stdscr) -> None:
        stdscr.timeout(-1)
        help_dialog(stdscr)
        stdscr.timeout(self.config.refresh_interval * 1000)

    # ── Helpers ──────────────────────────────────────────────────────

    def _refresh(self, stdscr) -> None:
        self.sessions = get_sessions(self.config)
        self.last_refresh = time.time()

    def _set_status(self, msg: str) -> None:
        self.status_message = msg
        self.status_time = time.time()

    def _set_status_time(self) -> None:
        self.status_time = time.time()

    def _handle_resize(self, stdscr) -> None:
        curses.endwin()
        stdscr.refresh()
