"""Project and worktree discovery.

Zero-config mode:
  1. If cwd is a git repo, use it.
  2. Scan ~ for directories with .git.
  3. Detect worktrees via `git worktree list`.

Config mode:
  Use explicitly listed project paths from config.
"""

from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass, field
from typing import List, Optional

from zui.config import Config


@dataclass
class Project:
    """A discovered git repository or worktree."""

    name: str
    path: str
    branch: str = ""
    is_worktree: bool = False
    parent_repo: str = ""  # path to main repo if this is a worktree

    @property
    def display_name(self) -> str:
        if self.branch and self.branch != self.name:
            return f"{self.name} ({self.branch})"
        return self.name


def discover_projects(config: Config) -> List[Project]:
    """Discover projects based on config or auto-detection."""
    if config.projects:
        return _discover_from_config(config)
    return _discover_auto()


def _discover_from_config(config: Config) -> List[Project]:
    """Discover projects from explicit config paths."""
    projects: List[Project] = []

    for proj_cfg in config.projects:
        path = os.path.expanduser(proj_cfg.path)
        if not os.path.isdir(path):
            continue

        # Add the main repo
        branch = _get_branch(path)
        projects.append(
            Project(
                name=os.path.basename(path),
                path=path,
                branch=branch,
            )
        )

        # Discover worktrees from git
        worktrees = _get_worktrees(path)
        for wt in worktrees:
            if wt.path != path:
                projects.append(wt)

        # Also scan worktree_pattern if specified
        if proj_cfg.worktree_pattern:
            pattern_dir = os.path.dirname(os.path.expanduser(proj_cfg.worktree_pattern))
            prefix = os.path.basename(os.path.expanduser(proj_cfg.worktree_pattern)).replace("*", "")
            if os.path.isdir(pattern_dir):
                for entry in sorted(os.listdir(pattern_dir)):
                    full = os.path.join(pattern_dir, entry)
                    if entry.startswith(prefix) and _is_git_dir(full) and full != path:
                        br = _get_branch(full)
                        # Skip if already found via git worktree list
                        if not any(p.path == full for p in projects):
                            projects.append(
                                Project(
                                    name=entry,
                                    path=full,
                                    branch=br,
                                    is_worktree=True,
                                    parent_repo=path,
                                )
                            )

    return projects


def _discover_auto() -> List[Project]:
    """Auto-discover projects from cwd and home directory."""
    projects: List[Project] = []
    seen_paths: set = set()

    # 1. Check if cwd is a git repo
    cwd = os.getcwd()
    if _is_git_dir(cwd):
        _add_repo_and_worktrees(cwd, projects, seen_paths)

    # 2. Scan home directory for git repos (one level deep)
    home = os.path.expanduser("~")
    try:
        for entry in sorted(os.listdir(home)):
            full = os.path.join(home, entry)
            if full in seen_paths:
                continue
            if os.path.isdir(full) and not entry.startswith("."):
                if _is_git_dir(full):
                    _add_repo_and_worktrees(full, projects, seen_paths)
    except OSError:
        pass

    return projects


def _add_repo_and_worktrees(
    path: str, projects: List[Project], seen_paths: set
) -> None:
    """Add a repo and all its worktrees to the project list."""
    if path in seen_paths:
        return
    seen_paths.add(path)

    branch = _get_branch(path)
    projects.append(
        Project(name=os.path.basename(path), path=path, branch=branch)
    )

    for wt in _get_worktrees(path):
        if wt.path not in seen_paths:
            seen_paths.add(wt.path)
            projects.append(wt)


def _get_worktrees(repo_path: str) -> List[Project]:
    """Get linked worktrees for a git repo."""
    worktrees: List[Project] = []
    try:
        result = subprocess.run(
            ["git", "-C", repo_path, "worktree", "list", "--porcelain"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return worktrees

        current_path: Optional[str] = None
        current_branch: Optional[str] = None

        for line in result.stdout.splitlines():
            if line.startswith("worktree "):
                if current_path and current_path != repo_path:
                    worktrees.append(
                        Project(
                            name=os.path.basename(current_path),
                            path=current_path,
                            branch=current_branch or "",
                            is_worktree=True,
                            parent_repo=repo_path,
                        )
                    )
                current_path = line[len("worktree "):]
                current_branch = None
            elif line.startswith("branch "):
                # refs/heads/feat/foo -> feat/foo
                ref = line[len("branch "):]
                current_branch = ref.removeprefix("refs/heads/")

        # Last entry
        if current_path and current_path != repo_path:
            worktrees.append(
                Project(
                    name=os.path.basename(current_path),
                    path=current_path,
                    branch=current_branch or "",
                    is_worktree=True,
                    parent_repo=repo_path,
                )
            )

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        pass

    return worktrees


def _get_branch(path: str) -> str:
    """Get the current branch of a git repo."""
    try:
        result = subprocess.run(
            ["git", "-C", path, "branch", "--show-current"],
            capture_output=True,
            text=True,
            timeout=3,
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return ""


def _is_git_dir(path: str) -> bool:
    """Check if a directory is a git repository or worktree."""
    git_path = os.path.join(path, ".git")
    # .git can be a directory (normal) or a file (worktree)
    return os.path.exists(git_path)
