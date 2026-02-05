# Contributing to ZUI

Thanks for wanting to contribute! ZUI is a small project and every contribution helps.

## Development Setup

```bash
git clone https://github.com/thornhill6305/zui.git
cd zui
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

You'll also need **tmux** and **git** installed.

## Running Tests

```bash
python -m unittest discover tests
```

## Code Style

- **Stdlib only** — no external dependencies. This is a core design decision.
- Type hints are encouraged.
- Follow the patterns you see in existing code.
- Keep it simple — ZUI is intentionally minimal.

## Submitting Changes

1. Fork the repo and create a branch (`feat/my-thing` or `fix/the-bug`)
2. Make your changes
3. Run the tests
4. Open a PR with a short description of what and why

## Reporting Bugs

Please include:
- OS and terminal emulator
- Python version (`python --version`)
- tmux version (`tmux -V`)
- What happened vs. what you expected
- Steps to reproduce

## Questions?

Open an issue — happy to help.
