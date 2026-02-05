"""Tests for zui.discovery — Project dataclass and helpers."""

import unittest

from zui.discovery import Project, _is_git_dir


class TestProjectDisplayName(unittest.TestCase):

    def test_name_only(self):
        p = Project(name="myapp", path="/tmp/myapp")
        self.assertEqual(p.display_name, "myapp")

    def test_name_with_branch(self):
        p = Project(name="myapp", path="/tmp/myapp", branch="feat/auth")
        self.assertEqual(p.display_name, "myapp (feat/auth)")

    def test_branch_same_as_name(self):
        p = Project(name="main", path="/tmp/main", branch="main")
        self.assertEqual(p.display_name, "main")


class TestIsGitDir(unittest.TestCase):

    def test_non_existent(self):
        self.assertFalse(_is_git_dir("/tmp/definitely-does-not-exist-zui"))


if __name__ == "__main__":
    unittest.main()
