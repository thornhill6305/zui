"""Configuration loading for ZUI.

Supports zero-config mode (auto-detect git repos) and optional
~/.config/zui/config.toml for explicit project roots and hooks.

Uses only stdlib — parses TOML with tomllib (3.11+) or a minimal fallback.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

# Default tmux socket path
DEFAULT_SOCKET = ""  # Empty = use default tmux server (no -S flag)

# Config search paths (first found wins)
CONFIG_PATHS = [
    os.path.expanduser("~/.config/zui/config.toml"),
    os.path.expanduser("~/.zui.toml"),
]


@dataclass
class ProjectConfig:
    path: str
    worktree_pattern: str = ""


@dataclass
class Config:
    socket: str = DEFAULT_SOCKET
    projects: List[ProjectConfig] = field(default_factory=list)
    default_args: List[str] = field(default_factory=list)
    yolo_args: List[str] = field(default_factory=lambda: ["--dangerously-skip-permissions"])
    hook_post_worktree_create: str = ""
    refresh_interval: int = 2
    # Layout settings (percentages)
    layout_right_width: int = 70  # Right panel width (session/lazygit), left gets the rest
    layout_lazygit_height: int = 40  # Lazygit panel height when shown
    confirm_cleanup: bool = True  # Show confirmation before worktree cleanup

    @staticmethod
    def load() -> "Config":
        """Load config from file or return defaults (zero-config)."""
        for path in CONFIG_PATHS:
            if os.path.isfile(path):
                return _load_toml(path)
        return Config()


def _load_toml(path: str) -> Config:
    """Parse a TOML config file into a Config object."""
    data = _parse_toml(path)
    cfg = Config()

    cfg.socket = data.get("socket", cfg.socket)
    cfg.refresh_interval = int(data.get("refresh_interval", cfg.refresh_interval))
    
    # Layout settings
    layout = data.get("layout", {})
    if isinstance(layout, dict):
        cfg.layout_right_width = int(layout.get("right_width", cfg.layout_right_width))
        cfg.layout_lazygit_height = int(layout.get("lazygit_height", cfg.layout_lazygit_height))

    # Claude section
    claude = data.get("claude", {})
    if isinstance(claude, dict):
        cfg.default_args = claude.get("default_args", cfg.default_args)
        cfg.yolo_args = claude.get("yolo_args", cfg.yolo_args)

    # Cleanup section
    cleanup = data.get("cleanup", {})
    if isinstance(cleanup, dict):
        confirm = cleanup.get("confirm", cfg.confirm_cleanup)
        cfg.confirm_cleanup = confirm if isinstance(confirm, bool) else cfg.confirm_cleanup

    # Hooks section
    hooks = data.get("hooks", {})
    if isinstance(hooks, dict):
        cfg.hook_post_worktree_create = hooks.get("post_worktree_create", "")

    # Projects — list of tables
    projects = data.get("projects", [])
    if isinstance(projects, list):
        for proj in projects:
            if isinstance(proj, dict) and "path" in proj:
                p = os.path.expanduser(proj["path"])
                cfg.projects.append(
                    ProjectConfig(
                        path=p,
                        worktree_pattern=proj.get("worktree_pattern", ""),
                    )
                )

    return cfg


def _parse_toml(path: str) -> Dict:
    """Parse TOML using tomllib (3.11+) or a minimal fallback parser."""
    try:
        import tomllib
    except ModuleNotFoundError:
        try:
            import tomli as tomllib  # type: ignore[no-redef]
        except ModuleNotFoundError:
            return _minimal_toml_parse(path)

    with open(path, "rb") as f:
        return tomllib.load(f)


def _minimal_toml_parse(path: str) -> Dict:
    """Bare-bones TOML parser for Python <3.11 without tomli.

    Handles only the subset ZUI needs: key=value, [sections],
    [[array-of-tables]], strings, lists, integers, booleans.
    """
    data: Dict = {}
    current_section: Optional[str] = None
    current_array_table: Optional[str] = None
    current_dict: Dict = data

    with open(path) as f:
        for raw_line in f:
            line = raw_line.strip()

            # Skip blanks and comments
            if not line or line.startswith("#"):
                continue

            # Array of tables: [[name]]
            if line.startswith("[[") and line.endswith("]]"):
                table_name = line[2:-2].strip()
                current_array_table = table_name
                current_section = None
                data.setdefault(table_name, [])
                new_dict: Dict = {}
                data[table_name].append(new_dict)
                current_dict = new_dict
                continue

            # Table: [name]
            if line.startswith("[") and line.endswith("]"):
                section = line[1:-1].strip()
                current_section = section
                current_array_table = None
                data.setdefault(section, {})
                current_dict = data[section]
                continue

            # Key = value
            if "=" in line:
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip()
                current_dict[key] = _parse_toml_value(val)

    return data


def save_config(cfg: Config) -> None:
    """Write current config to ~/.config/zui/config.toml, preserving unknown keys."""
    path = CONFIG_PATHS[0]  # ~/.config/zui/config.toml

    # Read existing file content to preserve unknown sections
    existing: Dict = {}
    if os.path.isfile(path):
        existing = _parse_toml(path)

    # Update known keys
    existing["socket"] = cfg.socket
    existing["refresh_interval"] = cfg.refresh_interval

    # Layout section
    existing.setdefault("layout", {})
    existing["layout"]["right_width"] = cfg.layout_right_width
    existing["layout"]["lazygit_height"] = cfg.layout_lazygit_height

    # Ensure dir exists
    config_dir = os.path.dirname(path)
    os.makedirs(config_dir, exist_ok=True)

    # Write TOML
    with open(path, "w") as f:
        # Top-level scalars
        for key in ("socket", "refresh_interval"):
            if key in existing:
                f.write(f"{key} = {_format_toml_value(existing[key])}\n")

        # Sections (dict values)
        for key, val in existing.items():
            if isinstance(val, dict):
                f.write(f"\n[{key}]\n")
                for k, v in val.items():
                    f.write(f"{k} = {_format_toml_value(v)}\n")
            elif isinstance(val, list) and val and isinstance(val[0], dict):
                for item in val:
                    f.write(f"\n[[{key}]]\n")
                    for k, v in item.items():
                        f.write(f"{k} = {_format_toml_value(v)}\n")


def _format_toml_value(val) -> str:
    """Format a Python value as a TOML literal."""
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, int):
        return str(val)
    if isinstance(val, str):
        return f'"{val}"'
    if isinstance(val, list):
        items = ", ".join(_format_toml_value(v) for v in val)
        return f"[{items}]"
    return str(val)


def _parse_toml_value(val: str):
    """Parse a single TOML value."""
    # Boolean
    if val == "true":
        return True
    if val == "false":
        return False

    # Integer
    try:
        return int(val)
    except ValueError:
        pass

    # String (quoted)
    if (val.startswith('"') and val.endswith('"')) or (
        val.startswith("'") and val.endswith("'")
    ):
        return val[1:-1]

    # Array (simple, single-line)
    if val.startswith("[") and val.endswith("]"):
        inner = val[1:-1].strip()
        if not inner:
            return []
        items = []
        for item in inner.split(","):
            items.append(_parse_toml_value(item.strip()))
        return items

    # Bare string fallback
    return val
