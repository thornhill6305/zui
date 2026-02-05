"""Tests for zui.config — Config loading and TOML parsing."""

import os
import tempfile
import unittest

from zui.config import Config, _load_toml, _minimal_toml_parse, _parse_toml_value


class TestConfigDefaults(unittest.TestCase):
    """Config() with no file should return sensible defaults."""

    def test_default_socket(self):
        cfg = Config()
        self.assertEqual(cfg.socket, "/tmp/zui-claude.sock")

    def test_default_projects_empty(self):
        cfg = Config()
        self.assertEqual(cfg.projects, [])

    def test_default_yolo_args(self):
        cfg = Config()
        self.assertEqual(cfg.yolo_args, ["--dangerously-skip-permissions"])

    def test_default_refresh_interval(self):
        cfg = Config()
        self.assertEqual(cfg.refresh_interval, 2)


class TestTomlValueParser(unittest.TestCase):
    """Test the minimal TOML value parser."""

    def test_boolean_true(self):
        self.assertIs(_parse_toml_value("true"), True)

    def test_boolean_false(self):
        self.assertIs(_parse_toml_value("false"), False)

    def test_integer(self):
        self.assertEqual(_parse_toml_value("42"), 42)

    def test_double_quoted_string(self):
        self.assertEqual(_parse_toml_value('"hello"'), "hello")

    def test_single_quoted_string(self):
        self.assertEqual(_parse_toml_value("'world'"), "world")

    def test_empty_array(self):
        self.assertEqual(_parse_toml_value("[]"), [])

    def test_string_array(self):
        self.assertEqual(
            _parse_toml_value('["--flag", "--other"]'),
            ["--flag", "--other"],
        )

    def test_bare_string(self):
        self.assertEqual(_parse_toml_value("bare"), "bare")


class TestMinimalTomlParse(unittest.TestCase):
    """Test the full minimal TOML parser on realistic config files."""

    def _write_and_parse(self, content: str) -> dict:
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".toml", delete=False
        ) as f:
            f.write(content)
            f.flush()
            try:
                return _minimal_toml_parse(f.name)
            finally:
                os.unlink(f.name)

    def test_simple_key_value(self):
        data = self._write_and_parse('socket = "/tmp/test.sock"\n')
        self.assertEqual(data["socket"], "/tmp/test.sock")

    def test_section(self):
        data = self._write_and_parse(
            "[claude]\n"
            'default_args = ["--verbose"]\n'
        )
        self.assertEqual(data["claude"]["default_args"], ["--verbose"])

    def test_array_of_tables(self):
        data = self._write_and_parse(
            '[[projects]]\npath = "~/foo"\n\n'
            '[[projects]]\npath = "~/bar"\n'
        )
        self.assertEqual(len(data["projects"]), 2)
        self.assertEqual(data["projects"][0]["path"], "~/foo")
        self.assertEqual(data["projects"][1]["path"], "~/bar")

    def test_comments_ignored(self):
        data = self._write_and_parse(
            "# This is a comment\n"
            'socket = "/tmp/test.sock"\n'
            "# Another comment\n"
        )
        self.assertEqual(data["socket"], "/tmp/test.sock")

    def test_blank_lines_ignored(self):
        data = self._write_and_parse(
            "\n\nrefresh_interval = 5\n\n"
        )
        self.assertEqual(data["refresh_interval"], 5)


class TestLoadToml(unittest.TestCase):
    """Test _load_toml produces a proper Config object."""

    def test_full_config(self):
        content = (
            'socket = "/tmp/custom.sock"\n'
            "refresh_interval = 5\n"
            "\n"
            "[[projects]]\n"
            'path = "/tmp/myrepo"\n'
            "\n"
            "[claude]\n"
            'yolo_args = ["--dangerously-skip-permissions", "--verbose"]\n'
            "\n"
            "[hooks]\n"
            'post_worktree_create = "npm install"\n'
        )
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".toml", delete=False
        ) as f:
            f.write(content)
            f.flush()
            try:
                cfg = _load_toml(f.name)
            finally:
                os.unlink(f.name)

        self.assertEqual(cfg.socket, "/tmp/custom.sock")
        self.assertEqual(cfg.refresh_interval, 5)
        self.assertEqual(len(cfg.projects), 1)
        self.assertEqual(cfg.projects[0].path, "/tmp/myrepo")
        self.assertEqual(
            cfg.yolo_args,
            ["--dangerously-skip-permissions", "--verbose"],
        )
        self.assertEqual(cfg.hook_post_worktree_create, "npm install")


if __name__ == "__main__":
    unittest.main()
