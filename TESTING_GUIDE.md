# Testing Guide - Race Condition Fix

**Quick reference for testing the singleton guard fix**

---

## Quick Test (30 seconds)

### Open Test Page
1. Open: `d:\Sessner – Multi-Session Manager\test-singleton-guard.html`
2. Click "Run Test"
3. Check status: Should show "✓ PASS: Only one initialization executed"

**Expected Log:**
```
[Call 1] initialize() called
[Call 1] Starting initialization (execution 1)...
[Call 2] initialize() called
[Call 2] Already initializing, returning existing promise (prevents race condition) ✓
✓ Test PASSED: Singleton guard prevented duplicate execution
```

---

## Full Browser Test (2 minutes)

### Setup
1. Load extension in Edge:
   ```
   Edge → Extensions → Load unpacked
   Select: d:\Sessner – Multi-Session Manager
   ```

2. Create test sessions:
   ```
   - Click extension icon
   - Create 2 new sessions
   - Navigate each to different sites (e.g., google.com, bing.com)
   ```

### Test Browser Restart
1. **Open DevTools:**
   ```
   Edge → Extensions → Sessner → background.html → Inspect
   Keep console open
   ```

2. **Close Edge completely** (not just the window - full exit)

3. **Reopen Edge and check console:**
   - Look for: `[INIT] Already initializing, returning existing promise`
   - Should see only ONE: `[INIT] Starting extension initialization...`
   - Should NOT see duplicate execution

4. **Check sessions:**
   - Click extension icon
   - Sessions should still exist (not deleted)
   - Tabs may show as "dormant" (0 tabs) - this is correct

### Success Criteria

✓ Only ONE initialization log
✓ "returning existing promise" appears
✓ Sessions are preserved
✓ No duplicate "[Session Restore] Deleting orphaned sessions"

### Failure Indicators

✗ TWO "Starting extension initialization..." logs
✗ Multiple "Deleting orphaned sessions" logs
✗ Sessions disappeared after restart

---

## Log Analysis

### Correct Logs (With Fix)

```
[Background Script] Multi-Session Manager background script loaded
[INIT] Starting extension initialization...
[INIT] Phase 0: Initializing storage persistence manager...
[STORAGE] ✓ Storage persistence manager ready
[INIT] Phase 1: Initializing license manager...
[LICENSE] ✓ License manager ready
[Browser Startup] Browser restarted, initializing...
[INIT] Already initializing, returning existing promise (prevents race condition)  ← KEY!
[Extension Event] Reason: browser_update
[INIT] Already initializing, returning existing promise (prevents race condition)  ← KEY!
[INIT] Phase 3: Loading persisted sessions...
[Session Restore] Waiting 2 seconds for Edge to restore tabs...
[Session Restore] Tab query attempt 2: Found 3 tabs
[Session Restore] Dormant sessions (no tabs): 2
[INIT] ✓ Initialization complete
```

**Key Indicators:**
- Only ONE "Starting extension initialization..."
- Multiple "returning existing promise" (good!)
- Dormant sessions preserved

### Incorrect Logs (Without Fix - Bug)

```
[INIT] Starting extension initialization...  ← First execution
[INIT] Starting extension initialization...  ← DUPLICATE (BUG!)
[Session Restore] Waiting 2 seconds...
[Session Restore] Waiting 2 seconds...  ← Both executing
[Session Restore] Tab query: Found 0 tabs
[Session Restore] Deleting 2 orphaned sessions  ← WRONG!
[Session Restore] Deleting 2 orphaned sessions  ← DUPLICATE!
```

**Bug Indicators:**
- TWO "Starting extension initialization..."
- Duplicate "Deleting orphaned sessions"
- All sessions deleted

---

## Troubleshooting

### Issue: Test page shows FAIL

**Cause:** JavaScript error or old cached version

**Fix:**
1. Hard refresh: Ctrl+Shift+R
2. Check browser console for errors
3. Try different browser

### Issue: Extension console shows duplicate initialization

**Cause:** Fix not applied or code reverted

**Fix:**
1. Check `background.js` line 140-142 for singleton guard
2. Reload extension: Extensions → Reload
3. Close and reopen DevTools

### Issue: Sessions still getting deleted

**Cause:** Different bug (not the race condition)

**Check:**
1. Is `loadPersistedSessions()` being called only once?
2. Check tab restoration timing (should wait 2 seconds)
3. Check URL-based matching logic

---

## Deployment Checklist

Before deploying to production:

- [ ] Test page shows PASS
- [ ] Browser restart test successful (3 times minimum)
- [ ] Sessions preserved on restart
- [ ] Console shows singleton guard messages
- [ ] No duplicate initialization logs
- [ ] Performance is normal (no slowdown)

---

## Related Files

**Implementation:**
- `background.js` lines 74-76, 138-277 (singleton guard)
- `background.js` lines 5402-5404 (onInstalled listener)
- `background.js` lines 5489-5495 (onStartup listener)

**Testing:**
- `test-singleton-guard.html` (test page)
- `RACE_CONDITION_FIX.md` (detailed documentation)

**Documentation:**
- `docs/technical.md` (needs update)
- `docs/architecture.md` (needs update)
- `CLAUDE.md` (needs update)

---

**Last Updated:** 2025-11-02
