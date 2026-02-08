"""Git worktree creation and management.

Generalized worktree creation — no hardcoded paths or project names.
Worktree paths are auto-derived from branch names.
Optional post-create hooks for project setup.
"""

from __future__ import annotations

import os
import subprocess
from typing import Optional

from zui.config import Config


def create_worktree(
    repo_path: str,
    branch: str,
    config: Config,
    base_dir: Optional[str] = None,
) -> tuple[bool, str]:
    """Create a new git worktree.

    Args:
        repo_path: Path to the main git repository.
        branch: Branch name to create (e.g. "feat/my-feature").
        config: ZUI configuration.
        base_dir: Directory to place the worktree in. Defaults to
                  sibling of repo_path.

    Returns:
        (success, worktree_path_or_error)
    """
    repo_name = os.path.basename(repo_path.rstrip("/"))

    # Auto-generate worktree path from branch name
    # feat/my-feature -> reponame-feat-my-feature
    safe_branch = branch.replace("/", "-").replace("\\", "-")
    worktree_name = f"{repo_name}-{safe_branch}"

    if base_dir is None:
        base_dir = os.path.dirname(repo_path)

    worktree_path = os.path.join(base_dir, worktree_name)

    if os.path.exists(worktree_path):
        return False, f"Path already exists: {worktree_path}"

    # Create the worktree with a new branch
    result = subprocess.run(
        [
            "git",
            "-C",
            repo_path,
            "worktree",
            "add",
            worktree_path,
            "-b",
            branch,
        ],
        capture_output=True,
        text=True,
    )

    if result.returncode != 0:
        # Maybe the branch already exists, try without -b
        result = subprocess.run(
            [
                "git",
                "-C",
                repo_path,
                "worktree",
                "add",
                worktree_path,
                branch,
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            return False, f"git worktree add failed: {result.stderr.strip()}"

    # Run post-create hook if configured
    if config.hook_post_worktree_create:
        _run_hook(config.hook_post_worktree_create, worktree_path)

    return True, worktree_path


def remove_worktree(
    parent_repo: str,
    worktree_path: str,
    branch: str,
    force: bool = False,
) -> tuple[bool, str]:
    """Remove a git worktree and delete its branch.

    Args:
        parent_repo: Path to the main git repository.
        worktree_path: Path to the worktree directory.
        branch: Branch name to delete.
        force: If True, use --force for both worktree remove and branch delete.

    Returns:
        (success, message)
    """
    # Step 1: git worktree remove
    args = ["git", "-C", parent_repo, "worktree", "remove", worktree_path]
    if force:
        args.append("--force")
    result = subprocess.run(args, capture_output=True, text=True)
    if result.returncode != 0:
        return False, f"git worktree remove failed: {result.stderr.strip()}"

    # Step 2: delete the branch
    flag = "-D" if force else "-d"
    result = subprocess.run(
        ["git", "-C", parent_repo, "branch", flag, branch],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        # Worktree removed but branch delete failed — partial success
        return True, f"Worktree removed but branch not deleted: {result.stderr.strip()}"

    return True, f"Removed worktree and branch {branch}"


def _run_hook(command: str, cwd: str) -> None:
    """Run a post-create hook command in the worktree directory."""
    try:
        subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except OSError:
        pass  # Hook failure is non-fatal
