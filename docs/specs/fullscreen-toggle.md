# Fullscreen Toggle

## Summary

Allow users to hide the ZUI sidebar (session list) so the active Claude session pane takes the full terminal width.

## Keybinding

- **`f`** — Toggle fullscreen (from ZUI pane)
- **`Alt+f`** — Toggle fullscreen (remote control from session pane)

`f` is mnemonic for "fullscreen" and is currently unbound.

## Behavior

Uses tmux's built-in pane zoom (`resize-pane -Z`) rather than kill/recreate:

- **Zoom in**: Zooms the right (session) pane to fill the window. The ZUI pane stays alive but hidden.
- **Zoom out**: Unzooms, restoring the original two-pane layout.
- **No session pane**: If only 1 pane exists (no session open yet), shows a status message and does nothing.

## Why zoom instead of kill/recreate

Killing the left pane would kill the ZUI Ink process. Tmux zoom achieves the same visual result — right pane fills the screen — while keeping ZUI alive to receive Alt-key remote commands from the session pane.

## Edge cases

| Scenario | Behavior |
|---|---|
| No right pane open | Status: "Open a session first" |
| Already zoomed, press `f` or `Alt+f` | Unzooms (toggle) |
| Zoomed + `Alt+Tab` | Tmux auto-unzooms when selecting another pane |
| Zoomed + `Alt+n/y/k` etc. | Works normally — ZUI pane is alive, just hidden |

## Changes

- `packages/tui/src/ui/layout.ts` — add `isWindowZoomed()` and `toggleZoom()`
- `packages/tui/src/ui/keybindings.ts` — add `M-f` to ALT_KEYS
- `packages/tui/src/app.tsx` — add `f` / `Alt+f` handler
- `packages/tui/src/ui/Footer.tsx` — add `f:Full` label
- `packages/tui/src/ui/HelpDialog.tsx` — add help entries
