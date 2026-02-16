# SECURITY FIXES REQUIRED - Quick Reference

**Status:** 🔴 CRITICAL ACTION REQUIRED  
**Report:** See `security-audit-2026-02-15.md` for full details

---

## 🔴 CRITICAL - Fix Immediately

### C-1: Command Injection in Worktree Hook
**File:** `packages/core/src/worktrees.ts:59-64`

**Current code:**
```typescript
spawn(command, { shell: true, cwd, stdio: "ignore", detached: true }).unref();
```

**Fix:**
```typescript
function runHook(command: string, cwd: string): void {
  try {
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

---

## 🟠 HIGH - Fix This Week

### H-1: NPM Dependency Vulnerabilities
```bash
cd ~/zui/packages/web
npm audit fix --force
npm test
```

### H-2: WebSocket Session Name Validation
**File:** `packages/web/lib/ws-server.js:34-38`

Add to top of file:
```javascript
const INTERNAL_SESSIONS = new Set(['zui-web']);
```

Change validation:
```javascript
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

### H-3: Add WebSocket Authentication
**File:** `packages/web/lib/ws-server.js` (after line 38)

```javascript
// Check session ownership
const { execSync } = require('child_process');
try {
  const args = socket ? `-S ${socket} ` : '';
  const owner = execSync(`tmux ${args}display-message -t ${session} -p '#{session_user}'`, 
    { encoding: 'utf8', timeout: 1000 }).trim();
  
  if (owner !== process.env.USER) {
    ws.close(1008, 'Unauthorized: session belongs to another user');
    return;
  }
} catch (err) {
  ws.close(1011, 'Failed to verify session ownership');
  return;
}
```

---

## 🟡 MEDIUM - Fix This Month

### M-4: Add PTY Cleanup Timer
**File:** `packages/web/lib/ws-server.js:40-60`

Add timeout tracking:
```javascript
let pty;
let idleTimer;

// After pty.onData:
pty.onData((data) => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.warn(`PTY for ${session} idle for 5min, killing`);
    pty.kill();
  }, 5 * 60 * 1000);
  
  if (ws.readyState === 1) ws.send(Buffer.from(data));
});

// Update ws.on('close'):
ws.on('close', () => {
  clearTimeout(idleTimer);
  pty.kill();
});
```

### M-5: Add Rate Limiting
Create `packages/web/src/lib/rate-limit.ts`:
```typescript
const limits = new Map<string, { count: number; reset: number }>();

export function rateLimit(ip: string, max = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const limit = limits.get(ip);
  
  if (!limit || now > limit.reset) {
    limits.set(ip, { count: 1, reset: now + windowMs });
    return true;
  }
  
  if (limit.count >= max) return false;
  limit.count++;
  return true;
}
```

Update `packages/web/src/hooks.server.ts`:
```typescript
import { rateLimit } from '$lib/rate-limit';

// In handle() after IP check:
if (event.request.method === 'POST' && !rateLimit(clientIp)) {
  return new Response('Too Many Requests', { status: 429 });
}
```

---

## 📊 Stats

| Severity | Count | Fixed |
|----------|-------|-------|
| CRITICAL | 1 | ⬜ |
| HIGH | 3 | ⬜ |
| MEDIUM | 6 | ⬜ |
| LOW | 5 | ⬜ |

**Total Issues:** 15  
**Must Fix (CRITICAL+HIGH):** 4  
**Should Fix (MEDIUM):** 6  
**Nice to Have (LOW):** 5

---

## Testing After Fixes

```bash
# 1. Test worktree hook (should not allow shell injection)
echo '[hooks]
post_worktree_create = "echo safe_command"' > /tmp/test-config.toml

# 2. Test WebSocket session validation
# Should reject: ws://localhost:3030/terminal?session=../../../etc/passwd
# Should reject: ws://localhost:3030/terminal?session=zui-web
# Should accept: ws://localhost:3030/terminal?session=my-project-main

# 3. Test rate limiting
for i in {1..15}; do
  curl -X POST http://localhost:3030/api/sessions \
    -H "Content-Type: application/json" \
    -d '{"project": "/invalid"}' &
done
# Should see 429 after 10 requests

# 4. Verify no new npm vulnerabilities
cd packages/web && npm audit
```

---

## Questions?

Refer to full audit report: `~/zui/docs/security-audit-2026-02-15.md`
