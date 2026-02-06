# Release Audit — ZUI v0.1.0

**Date:** 2026-02-06
**Auditor:** Automated (Claude)
**Scope:** Full codebase review for open-source readiness

---

## 1. Sensitive Data

### Hardcoded Credentials / API Keys / Tokens
- **No credentials, API keys, tokens, or secrets found anywhere in the codebase or git history.**

### Personal Paths / Usernames
- `tests/test_worktrees.py` uses `/home/user/myapp` in test assertions — this is a generic placeholder, not a real user path. **Acceptable.**
- No references to real usernames, personal home directories, or machine-specific paths in source code.

### Private IPs / Internal Hostnames
- **None found.**

### Private Repos / Internal Systems
- **None found.** All GitHub URLs reference the public `thornhill6305/zui` repository.

### Git History
- 10 clean commits, no deleted sensitive files (`.env`, `.key`, `.pem`, etc.) in history.
- `.claude/settings.local.json` is **not tracked in git** (verified via `git ls-files`).

| Item | Status |
|------|--------|
| No hardcoded credentials | :white_check_mark: PASS |
| No personal paths in source | :white_check_mark: PASS |
| No private IPs/hostnames | :white_check_mark: PASS |
| No private repo references | :white_check_mark: PASS |
| Clean git history | :white_check_mark: PASS |

---

## 2. Documentation

| Item | Status | Notes |
|------|--------|-------|
| README.md | :white_check_mark: PASS | Complete: features, prerequisites, installation, usage, keybindings, configuration, architecture, license |
| LICENSE | :white_check_mark: PASS | MIT, proper copyright line |
| CONTRIBUTING.md | :white_check_mark: PASS | Dev setup, testing, style guide, PR process, bug reporting |
| DECISIONS.md | :white_check_mark: PASS | 9 documented architecture decisions — excellent for contributors |
| examples/config.toml | :white_check_mark: PASS | Annotated example config |
| Code comments | :white_check_mark: PASS | Module docstrings on all files, key functions documented |

---

## 3. Code Quality

### Debug / Test Code
- `print()` statements in `__main__.py` are user-facing error messages (terminal requirement, terminal error), **not debug output**. Acceptable.
- **No `breakpoint()`, `pdb`, `debugger`, or debug-only code found.**

### TODOs / FIXMEs
- **None found** in any `.py` file. Clean.

### Imports
- **No unused imports found.** All imports are utilized.
- One deferred import (`import time` inside `_toggle_lazygit`) at `app.py:286` — `time` is already imported at module level on line 7, so this inner import is redundant but harmless.

### Style Consistency
- Consistent use of `from __future__ import annotations` across all modules.
- Type hints throughout.
- Consistent naming conventions (snake_case functions, PascalCase classes).
- All 39 tests pass. All files compile cleanly.

| Item | Status | Notes |
|------|--------|-------|
| No debug code | :white_check_mark: PASS | |
| No TODO/FIXME | :white_check_mark: PASS | |
| Clean imports | :white_check_mark: PASS | One harmless redundant `import time` in app.py:286 |
| Consistent style | :white_check_mark: PASS | |
| Tests pass (39/39) | :white_check_mark: PASS | 0.007s runtime |
| Compile check | :white_check_mark: PASS | All 9 source files |

---

## 4. Project Structure

### .gitignore
- Covers: `__pycache__/`, `*.py[cod]`, `*.egg-info/`, `dist/`, `build/`, `.venv/`, `.mypy_cache/`, `.pytest_cache/`

### Tracked Files That Shouldn't Be
- `zui_agent_manager.egg-info/` directory (5 files) is **present in the working tree** but **not tracked in git**. The `.gitignore` pattern `*.egg-info/` correctly excludes it. **No issue.**
- `.claude/settings.local.json` is present locally but **not tracked in git**. **No issue.**

### Package Metadata (pyproject.toml)
- Name: `zui-agent-manager`
- Version: `0.1.0` (matches `__init__.py`)
- Correct build backend: `setuptools.build_meta`
- Entry point: `zui = "zui.__main__:main"`
- Python requirement: `>=3.10`
- Proper classifiers, keywords, URLs
- No `License ::` classifier conflict with PEP 639 `license = "MIT"`

### CI
- GitHub Actions workflow tests Python 3.10-3.13 on Ubuntu. Includes compile check and test run.

| Item | Status | Notes |
|------|--------|-------|
| .gitignore comprehensive | :white_check_mark: PASS | |
| No unnecessary tracked files | :white_check_mark: PASS | |
| pyproject.toml correct | :white_check_mark: PASS | |
| Version consistency | :white_check_mark: PASS | 0.1.0 in both places |
| CI pipeline | :white_check_mark: PASS | Multi-version matrix |

### Missing from .gitignore (non-blocking)

| Item | Status | Notes |
|------|--------|-------|
| `.claude/` directory | :warning: WARNING | Add `.claude/` to .gitignore to prevent accidentally committing Claude Code local settings |

---

## 5. Security

### Shell Injection

| Item | Status | Notes |
|------|--------|-------|
| `shell=True` in worktrees.py:94-96 | :warning: WARNING | `_run_hook()` runs `config.hook_post_worktree_create` with `shell=True`. The command comes from the user's own config file, not external input, so this is **by design** (it's meant to run arbitrary shell commands). However, document this in README/config example so users understand the trust model. |
| Unquoted `{workdir}` in layout.py | :warning: WARNING | `f"cd {workdir} && lazygit"` is passed as a tmux `split-window` argument. If `workdir` contains shell metacharacters (spaces, semicolons, etc.), this could break or execute unintended commands. The `workdir` comes from git repo paths which are typically safe, but quoting with `shlex.quote()` would be more defensive. |

### Hardcoded Paths
- `/tmp/zui-claude.sock` is a sensible default for a tmux socket, configurable via config file. **Acceptable.**
- All other paths use `os.path.expanduser("~")` or `os.getcwd()`. **No hardcoded absolute paths.**

### Safe Defaults
- YOLO mode (`--dangerously-skip-permissions`) requires an explicit `y` keypress — not enabled by default. **Good.**
- Config file is optional — zero-config mode uses only safe operations (git branch listing, tmux session management).

| Item | Status | Notes |
|------|--------|-------|
| No hardcoded paths | :white_check_mark: PASS | Defaults are configurable |
| Safe defaults | :white_check_mark: PASS | YOLO mode requires explicit action |
| Subprocess handling | :white_check_mark: PASS | Proper use of `capture_output=True`, timeouts on git commands |

---

## 6. Help Screen Inconsistency

| Item | Status | Notes |
|------|--------|-------|
| Wrong socket path in help | :warning: WARNING | `widgets.py:382` shows `tmux -S /tmp/claude-worktrees.sock ls` but the actual default socket is `/tmp/zui-claude.sock`. This will confuse users. |

---

## Summary

### Blockers (must fix before release)

**None.** The codebase is clean and ready for open-source release.

### Warnings (should fix but not blocking)

| # | Issue | File | Severity | Recommendation |
|---|-------|------|----------|----------------|
| W1 | Wrong socket path in help screen | `zui/ui/widgets.py:382` | Medium | Change `/tmp/claude-worktrees.sock` to `/tmp/zui-claude.sock` |
| W2 | Unquoted `workdir` in shell commands | `zui/ui/layout.py:48,58,71` | Low | Use `shlex.quote(workdir)` for defensive quoting |
| W3 | Add `.claude/` to .gitignore | `.gitignore` | Low | Prevents accidental commit of local Claude Code settings |
| W4 | Redundant inner `import time` | `zui/app.py:286` | Trivial | Remove — `time` is already imported at module level |

### Pass Summary

- 0 blockers
- 4 warnings (1 medium, 2 low, 1 trivial)
- 22 pass items across all categories
- 39/39 tests passing
- Clean git history with no sensitive data
- Complete documentation suite (README, LICENSE, CONTRIBUTING, DECISIONS, example config)
- CI pipeline covering Python 3.10-3.13

**Verdict: Ready for release** after addressing W1 (incorrect socket path in help — would confuse users on day one).
