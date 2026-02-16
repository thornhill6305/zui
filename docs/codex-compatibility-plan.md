# Codex CLI Compatibility Plan

> Making ZUI agent-agnostic: supporting Claude Code, OpenAI Codex CLI, and future agents.

## 1. Architecture Design: Agent Provider Pattern

Introduce an `AgentProvider` interface that abstracts everything agent-specific:

```typescript
// packages/core/src/agents.ts

interface AgentProvider {
  /** Unique key used in config and session metadata */
  id: string;                          // "claude" | "codex"
  displayName: string;                 // "Claude Code" | "Codex CLI"
  
  /** Build the shell command string for tmux */
  buildCommand(args: string[]): string;
  
  /** Detect session status from the last line of tmux output */
  detectStatus(preview: string): SessionStatus;
  
  /** Default args and yolo-mode args */
  defaultArgs: string[];
  yoloArgs: string[];
}
```

Two built-in providers ship in `packages/core/src/agents/`:

```
packages/core/src/agents/
├── index.ts          # registry: getProvider(id), allProviders()
├── types.ts          # AgentProvider interface
├── claude.ts         # Claude Code provider
└── codex.ts          # Codex CLI provider
```

The registry is a simple `Map<string, AgentProvider>`. No dynamic plugin loading needed yet — just import both and register them. Extensibility comes from adding a new file + registering it.

## 2. Config Changes

### Current TOML structure
```toml
[claude]
default_args = ["--verbose"]
yolo_args = ["--dangerously-skip-permissions"]
```

### New structure
```toml
# Global default agent for new sessions
default_agent = "claude"   # "claude" | "codex"

[agents.claude]
default_args = ["--verbose"]
yolo_args = ["--dangerously-skip-permissions"]

[agents.codex]
default_args = []
yolo_args = ["--yolo"]
```

### Migration (backward compat)
If `[claude]` section exists but `[agents]` does not, auto-migrate at parse time:
- Copy `[claude].default_args` → `[agents.claude].default_args`
- Copy `[claude].yolo_args` → `[agents.claude].yolo_args`
- Set `default_agent = "claude"`
- Ignore the old `[claude]` section once `[agents]` is present

No breaking change — old configs work as-is.

### Config type changes

```typescript
// types.ts
interface AgentConfig {
  defaultArgs: string[];
  yoloArgs: string[];
}

interface Config {
  // ... existing fields ...
  defaultAgent: string;                    // NEW: "claude" | "codex"
  agents: Record<string, AgentConfig>;     // NEW: per-agent config
  // REMOVE: defaultArgs, yoloArgs (moved into agents)
}
```

## 3. Session Management

### Session metadata

Sessions need to track which agent they're running. Use a tmux environment variable:

```typescript
// In spawnSession():
// After creating the session, tag it:
tmux set-environment -t <session> ZUI_AGENT "codex"
```

Read it back in `getSessions()`:
```typescript
const agentId = runTmux(["show-environment", "-t", name, "ZUI_AGENT"], socket);
// Falls back to "claude" for existing sessions without the var
```

### Updated Session type

```typescript
interface Session {
  name: string;
  running: string;
  idle: string;
  status: SessionStatus;
  preview: string;
  agent: string;        // NEW: "claude" | "codex"
}
```

### Updated spawnSession signature

```typescript
function spawnSession(
  workdir: string,
  config: Config,
  options: {
    yolo?: boolean;
    agent?: string;      // defaults to config.defaultAgent
  }
): [boolean, string]
```

Implementation:
```typescript
const agentId = options.agent ?? config.defaultAgent;
const provider = getProvider(agentId);
const agentCfg = config.agents[agentId] ?? { defaultArgs: provider.defaultArgs, yoloArgs: provider.yoloArgs };
const args = options.yolo ? agentCfg.yoloArgs : agentCfg.defaultArgs;
const cmd = provider.buildCommand(args);
// ... tmux new-session with cmd ...
// ... tmux set-environment ZUI_AGENT agentId ...
```

## 4. Status Detection per Agent

### Claude Code patterns (existing)
```typescript
// claude.ts
detectStatus(preview: string): SessionStatus {
  const lower = preview.toLowerCase();
  const waitPatterns = ["? ", "allow", "approve", "y/n", "(y)", "press enter", "continue?", "proceed?"];
  if (waitPatterns.some(p => lower.includes(p))) return "[WAIT]";
  const errPatterns = ["error:", "failed", "exception", "traceback"];
  if (errPatterns.some(p => lower.includes(p))) return "[ERR]";
  if (preview.endsWith(">") || preview.endsWith("$") || (lower.includes("claude") && preview.includes(">"))) return "[IDLE]";
  return "[WORK]";
}
```

### Codex CLI patterns (new)

Based on Codex CLI's TUI behavior:
```typescript
// codex.ts
detectStatus(preview: string): SessionStatus {
  const lower = preview.toLowerCase();
  
  // Codex uses --ask-for-approval; shows approval prompts
  const waitPatterns = ["approve?", "allow", "y/n", "press enter", "[allow]", "[deny]", "approve this"];
  if (waitPatterns.some(p => lower.includes(p))) return "[WAIT]";
  
  const errPatterns = ["error:", "failed", "error", "panic"];
  if (errPatterns.some(p => lower.includes(p))) return "[ERR]";
  
  // Codex idle prompt — waiting for user input
  if (preview.includes("❯") || preview.includes(">") || lower.includes("codex>")) return "[IDLE]";
  
  return "[WORK]";
}
```

**Note:** These patterns will need tuning once we can test against a real Codex session. The detection is intentionally conservative — `[WORK]` is the safe default.

### In getSessions(), dispatch to the right detector:

```typescript
const provider = getProvider(session.agent);
const status = provider.detectStatus(preview);
```

## 5. UI Changes

### TUI (packages/tui)

**Session list:** Show agent type badge next to each session:
```
  myproject-main    [WORK]  ◆ Claude    2m ago
  backend-fix       [IDLE]  ◇ Codex     5s ago
```

Single-character or short badge. Color-coded: Claude = purple/blue, Codex = green.

**Spawn flow:** When pressing `n` (new session), after selecting the project/worktree:
1. Show agent picker: `[c] Claude  [x] Codex` (skip if only one agent configured)
2. Then show yolo toggle as before
3. Spawn with selected agent

Minimal change — one extra keypress in the spawn flow.

**Keybinding:** `a` to toggle default agent (or show in status bar).

### Web UI (packages/web)

- Session cards show agent icon/label
- Spawn dialog gets agent dropdown
- Filter sessions by agent type

## 6. Codex CLI Provider Details

```typescript
// packages/core/src/agents/codex.ts
export const codexProvider: AgentProvider = {
  id: "codex",
  displayName: "Codex CLI",
  
  buildCommand(args: string[]): string {
    return args.length ? `codex ${args.join(" ")}` : "codex";
  },
  
  defaultArgs: [],
  yoloArgs: ["--yolo"],   // --dangerously-bypass-approvals-and-sandbox
  
  detectStatus(preview) { /* see §4 */ }
};
```

Key Codex flags for reference:
| Flag | Purpose |
|------|---------|
| `--model, -m` | Override model (e.g. `gpt-5-codex`) |
| `--sandbox, -s` | `read-only` / `workspace-write` / `danger-full-access` |
| `--ask-for-approval, -a` | `untrusted` / `on-failure` / `on-request` / `never` |
| `--yolo` | Alias for no approvals + no sandbox |
| `--full-auto` | `--ask-for-approval on-request` + `--sandbox workspace-write` |
| `--cd, -C` | Working directory |
| `--profile, -p` | Config profile from `~/.codex/config.toml` |

## 7. File-by-File Change List

### New files
| File | Purpose |
|------|---------|
| `packages/core/src/agents/types.ts` | `AgentProvider` interface, `SessionStatus` type |
| `packages/core/src/agents/claude.ts` | Claude Code provider implementation |
| `packages/core/src/agents/codex.ts` | Codex CLI provider implementation |
| `packages/core/src/agents/index.ts` | Provider registry (`getProvider`, `allProviders`) |
| `packages/core/src/__tests__/agents.test.ts` | Tests for both providers' `detectStatus` and `buildCommand` |

### Modified files

| File | Changes |
|------|---------|
| **`packages/core/src/types.ts`** | Add `AgentConfig` interface. Add `defaultAgent` and `agents: Record<string, AgentConfig>` to `Config`. Remove `defaultArgs`/`yoloArgs` from `Config`. Add `agent: string` to `Session`. |
| **`packages/core/src/config.ts`** | Parse `[agents.*]` sections + `default_agent`. Add migration logic for old `[claude]` section. Update `defaultConfig()` to include `agents` map and `defaultAgent: "claude"`. Update `saveConfig()` to write new structure. |
| **`packages/core/src/sessions.ts`** | Import provider registry. `spawnSession()`: accept agent option, use provider's `buildCommand()`, set `ZUI_AGENT` env var on tmux session. `getSessions()`: read `ZUI_AGENT` from each session, use provider's `detectStatus()`. Remove inline `detectStatus()` function (moved to providers). |
| **`packages/core/src/index.ts`** | Re-export agents module. |
| **`packages/tui/src/app.ts`** (or equivalent) | Show agent badge in session list. Add agent picker to spawn flow. |
| **`packages/web/`** | Session cards show agent type. Spawn form gets agent selector. |
| **`packages/core/src/__tests__/sessions.test.ts`** | Update tests for new `spawnSession` signature and agent-aware status detection. |
| **`packages/core/src/__tests__/config.test.ts`** | Add tests for new config format + migration from old format. |

## 8. Implementation Order

1. **Create `agents/` module** with types, claude provider, codex provider, registry — no breaking changes yet
2. **Update `Config` type + `config.ts`** — add new fields alongside old ones, migration logic
3. **Update `sessions.ts`** — use provider pattern, tag sessions with `ZUI_AGENT`
4. **Update TUI** — agent badge in list, agent picker in spawn
5. **Update Web UI** — agent display + selection
6. **Tests** — update existing, add new for both providers
7. **Remove deprecated fields** — clean up old `defaultArgs`/`yoloArgs` from Config (major version bump)

Steps 1-3 can be one PR. Steps 4-5 can be parallel. Step 7 is a follow-up.

## 9. Future Extensibility

Adding a new agent (e.g., Aider, Continue, Goose) requires:
1. Create `packages/core/src/agents/<name>.ts` implementing `AgentProvider`
2. Register in `agents/index.ts`
3. Add `[agents.<name>]` config section support
4. Done — TUI/Web auto-discover from registry

No plugin system needed until there are 5+ agents or third-party providers.
