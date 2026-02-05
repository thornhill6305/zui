"""Tests for zui.sessions — pure helpers (no tmux required)."""

import unittest

from zui.sessions import _detect_status, _format_duration


class TestFormatDuration(unittest.TestCase):

    def test_seconds(self):
        self.assertEqual(_format_duration(45), "45s")

    def test_minutes(self):
        self.assertEqual(_format_duration(125), "2m 5s")

    def test_hours(self):
        self.assertEqual(_format_duration(3661), "1h 1m")

    def test_zero(self):
        self.assertEqual(_format_duration(0), "0s")

    def test_exactly_one_hour(self):
        self.assertEqual(_format_duration(3600), "1h 0m")


class TestDetectStatus(unittest.TestCase):

    def test_waiting_y_n(self):
        self.assertEqual(_detect_status("Allow tool use? (y/n)"), "[WAIT]")

    def test_waiting_approve(self):
        self.assertEqual(_detect_status("Do you approve this?"), "[WAIT]")

    def test_error(self):
        self.assertEqual(_detect_status("Error: file not found"), "[ERR]")

    def test_error_traceback(self):
        self.assertEqual(_detect_status("Traceback (most recent call)"), "[ERR]")

    def test_idle_prompt(self):
        self.assertEqual(_detect_status("claude>"), "[IDLE]")

    def test_idle_dollar(self):
        self.assertEqual(_detect_status("user@host:~$"), "[IDLE]")

    def test_working(self):
        self.assertEqual(_detect_status("Implementing login flow..."), "[WORK]")

    def test_non_ascii_mode(self):
        self.assertEqual(
            _detect_status("Error: crash", use_ascii=False), "error"
        )
        self.assertEqual(
            _detect_status("working on it", use_ascii=False), "working"
        )


if __name__ == "__main__":
    unittest.main()
