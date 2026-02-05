"""Entry point for `python -m zui` and the `zui` console script."""

import os
import sys


def main():
    if not os.isatty(0):
        print("zui requires a terminal. Run it directly in a terminal window.")
        sys.exit(1)

    # If not inside tmux, launch ourselves inside a new tmux session
    if "TMUX" not in os.environ:
        import subprocess

        # Kill stale manager session if it exists
        subprocess.run(
            ["tmux", "kill-session", "-t", "zui-manager"],
            capture_output=True,
        )
        os.execvp(
            "tmux",
            [
                "tmux",
                "new-session",
                "-s",
                "zui-manager",
                "-n",
                "zui",
                sys.executable,
                "-m",
                "zui",
            ],
        )

    # Inside tmux - run the TUI
    import curses

    from zui.app import App

    try:
        curses.wrapper(App().run)
    except KeyboardInterrupt:
        pass
    except curses.error as exc:
        print(f"Terminal error: {exc}")
        print("Try making your terminal window larger.")
        sys.exit(1)


if __name__ == "__main__":
    main()
