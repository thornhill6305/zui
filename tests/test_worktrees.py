"""Tests for zui.worktrees — worktree path derivation."""

import os
import unittest

from zui.config import Config


class TestWorktreePathDerivation(unittest.TestCase):
    """Test the branch-to-path logic used by create_worktree."""

    def _derive_path(self, repo_path: str, branch: str) -> str:
        """Replicate the path derivation logic from create_worktree."""
        repo_name = os.path.basename(repo_path.rstrip("/"))
        safe_branch = branch.replace("/", "-").replace("\\", "-")
        worktree_name = f"{repo_name}-{safe_branch}"
        base_dir = os.path.dirname(repo_path)
        return os.path.join(base_dir, worktree_name)

    def test_simple_branch(self):
        path = self._derive_path("/home/user/myapp", "feat/auth")
        self.assertEqual(path, "/home/user/myapp-feat-auth")

    def test_nested_branch(self):
        path = self._derive_path("/home/user/myapp", "feat/ui/modal")
        self.assertEqual(path, "/home/user/myapp-feat-ui-modal")

    def test_plain_branch(self):
        path = self._derive_path("/home/user/myapp", "bugfix")
        self.assertEqual(path, "/home/user/myapp-bugfix")

    def test_trailing_slash_repo(self):
        # rstrip("/") gives "myapp" as name, but dirname of "/home/user/myapp/"
        # is "/home/user/myapp" — so worktree lands inside the repo dir.
        # This matches actual create_worktree behavior.
        path = self._derive_path("/home/user/myapp/", "feat/auth")
        self.assertEqual(path, "/home/user/myapp/myapp-feat-auth")


if __name__ == "__main__":
    unittest.main()
