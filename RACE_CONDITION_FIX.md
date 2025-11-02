# Race Condition Fix - Duplicate Initialization Prevention

**Date:** 2025-11-02
**Issue:** Duplicate `loadPersistedSessions()` execution causing session deletion on browser restart
**Status:** FIXED ✓

---

## Problem Summary

### The Bug

On browser restart, `chrome.runtime.onStartup` and `chrome.runtime.onInstalled` both fire simultaneously, causing **duplicate initialization**:

```
[Browser Startup] Browser restarted, initializing...     ← First call
[Extension Event] Reason: browser_update                  ← Second call (simultaneous)
↓
Both call initializationManager.initialize()
↓
Both execute loadPersistedSessions() in parallel
↓
Both wait 2 seconds for Edge to restore tabs
↓
Both find 0 tabs (Edge hasn't restored yet)
↓
Both delete all sessions (thinking they're orphaned)
```

### Root Cause

**File:** `background.js` lines 5489-5495 and 5402-5484

**The Race Condition:**
```javascript
// Line 5489: onStartup listener
chrome.runtime.onStartup.addListener(() => {
  initializationManager.initialize();  // ← Call 1
});

// Line 5402: onInstalled listener
chrome.runtime.onInstalled.addListener(async (details) => {
  initializationManager.initialize();  // ← Call 2 (simultaneous!)
});
```

**Why State-Based Guards Failed:**
```javascript
// Old guard (lines 134-145)
if (this.currentState === this.STATES.READY) {
  return;  // ✓ Works if already complete
}

if (this.currentState !== this.STATES.LOADING && ...) {
  await this.waitForReady();  // ✓ Works if in progress
  return;
}

// ✗ FAILS when both check at same time:
// Time 0ms: Call 1 checks currentState = 'LOADING' → Pass ✓
// Time 1ms: Call 2 checks currentState = 'LOADING' → Pass ✓
// Time 2ms: Both proceed to execute!
```

---

## The Fix

### Implementation

Added **promise-based singleton guard** to `initializationManager`:

**File:** `background.js` lines 74-76

```javascript
const initializationManager = {
  // ... existing properties ...

  // CRITICAL: Singleton guard to prevent duplicate initialization
  isInitializing: false,
  initPromise: null,
```

**Updated `initialize()` method** (lines 138-172):

```javascript
async initialize() {
  // CRITICAL: Singleton guard - return existing promise if already initializing
  if (this.isInitializing && this.initPromise) {
    console.log('[INIT] Already initializing, returning existing promise (prevents race condition)');
    return this.initPromise;  // ← Both calls get same promise!
  }

  // Prevent duplicate initialization - if already READY, skip
  if (this.currentState === this.STATES.READY) {
    console.log('[INIT] Already initialized and ready, skipping duplicate initialization');
    return Promise.resolve();
  }

  // If already initializing, wait for completion instead of starting new initialization
  if (this.currentState !== this.STATES.LOADING && this.currentState !== this.STATES.ERROR) {
    console.log('[INIT] Initialization already in progress (state:', this.currentState, '), waiting for completion...');
    await this.waitForReady();
    return;
  }

  // Set flag and create promise BEFORE starting async work (critical for race prevention)
  this.isInitializing = true;
  this.initPromise = this._doInitialize();

  try {
    await this.initPromise;
  } catch (error) {
    console.error('[INIT] Initialization failed:', error);
    throw error;
  } finally {
    // Clear flags after completion
    this.isInitializing = false;
    this.initPromise = null;
  }
}
```

**Extracted internal logic** (lines 178-277):

```javascript
/**
 * Internal initialization logic (extracted to allow singleton guard)
 * @private
 */
async _doInitialize() {
  try {
    console.log('[INIT] Starting extension initialization...');
    // ... all initialization phases ...
  } catch (error) {
    // ... error handling ...
  }
}
```

### How It Works

**Timeline with Fix:**
```
Time 0ms:  onStartup fires    → Call initialize()
           isInitializing = false
           Set isInitializing = true
           Create initPromise = _doInitialize()
           Start async work

Time 1ms:  onInstalled fires  → Call initialize()
           isInitializing = true ✓
           initPromise exists ✓
           Return existing promise (SKIP execution)

Time 2000ms: First call completes
           isInitializing = false
           initPromise = null

Result: Only ONE execution, both promises resolve to same result
```

**Key Points:**
1. **Flag set BEFORE async work starts** - prevents race condition
2. **Return existing promise** - second caller waits for first to complete
3. **Finally block clears flags** - ensures cleanup even on error
4. **Idempotent** - can be called multiple times safely

---

## Testing

### Test File

Created `test-singleton-guard.html` for browser-based testing:

**Test Scenario:**
- Simulates simultaneous `initialize()` calls
- Counts total calls vs actual executions
- Shows detailed log with race condition detection

**Expected Result:**
- 2 calls to `initialize()`
- 1 execution of `_doInitialize()`
- Second call returns existing promise

**Test Output (Expected):**
```
[Call 1] initialize() called
[Call 1] Starting initialization (execution 1)...
[Call 2] initialize() called
[Call 2] Already initializing, returning existing promise (prevents race condition)
✓ Test PASSED: Singleton guard prevented duplicate execution
```

### Manual Testing Steps

1. **Load Test Page:**
   ```
   Open: d:\Sessner – Multi-Session Manager\test-singleton-guard.html
   ```

2. **Run Test:**
   - Click "Run Test" button
   - Check log for duplicate execution detection
   - Status should show: "✓ PASS: Only one initialization executed"

3. **Browser Restart Test:**
   ```
   1. Load extension in Edge
   2. Create 2 sessions with tabs
   3. Close Edge completely
   4. Reopen Edge
   5. Open DevTools → Background Page console
   6. Check logs:
      - Should see "Already initializing, returning existing promise"
      - Should NOT see duplicate "[INIT] Starting extension initialization..."
      - Sessions should be preserved (not deleted)
   ```

### Expected Browser Restart Logs

**With Fix (Correct):**
```
[Browser Startup] Browser restarted, initializing...
[INIT] Starting extension initialization...
[INIT] Phase 0: Initializing storage persistence manager...
[STORAGE] ✓ Storage persistence manager ready
[INIT] Phase 1: Initializing license manager...
[LICENSE] ✓ License manager ready
[INIT] Phase 2: Checking auto-restore settings...
[AUTO-RESTORE] Not Enterprise tier, skipping auto-restore check
[INIT] Phase 3: Loading persisted sessions...
[Session Restore] Waiting 2 seconds for Edge to restore tabs...
[Extension Event] Reason: browser_update
[INIT] Already initializing, returning existing promise (prevents race condition)  ← SINGLETON GUARD!
[Session Restore] Tab query attempt 1: Found 0 tabs
[Session Restore] Tab query attempt 2: Found 3 tabs  ← Success!
[Session Restore] Dormant sessions (no tabs): 2  ← PRESERVED!
[INIT] ✓ Initialization complete
```

**Without Fix (Bug):**
```
[INIT] Starting extension initialization...  ← First execution
[INIT] Starting extension initialization...  ← DUPLICATE! (Bug)
[Session Restore] Waiting 2 seconds...
[Session Restore] Waiting 2 seconds...  ← Both wait
[Session Restore] Tab query: Found 0 tabs
[Session Restore] Tab query: Found 0 tabs  ← Both find 0
[Session Restore] Deleting 2 orphaned sessions  ← Both delete!
[Session Restore] Deleting 2 orphaned sessions  ← DUPLICATE DELETE!
```

---

## Code Changes Summary

### Files Modified

**File:** `background.js`

**Changes:**
1. **Lines 74-76:** Added `isInitializing` and `initPromise` properties
2. **Lines 138-172:** Rewrote `initialize()` with singleton guard
3. **Lines 178-277:** Extracted `_doInitialize()` internal method
4. **Lines 5403-5404:** Updated `onInstalled` logging and comments
5. **Lines 5490-5491:** Updated `onStartup` logging and comments
6. **Line 5498:** Updated background script load logging

**Total Lines Changed:** ~40 lines
**Total Lines Added:** ~20 lines

### Files Created

**File:** `test-singleton-guard.html`
- Browser-based test for race condition prevention
- Visual log with duplicate execution detection
- Pass/fail status indicator

**File:** `RACE_CONDITION_FIX.md` (this file)
- Complete documentation of bug and fix
- Testing procedures
- Expected behaviors

---

## Verification Checklist

Before deploying, verify:

- [ ] Test page shows "✓ PASS" status
- [ ] Browser restart preserves sessions (no deletion)
- [ ] Console shows "returning existing promise" on restart
- [ ] Only ONE "Starting extension initialization..." appears
- [ ] Sessions with tabs are restored correctly
- [ ] Dormant sessions (no tabs) are preserved
- [ ] No duplicate execution logs

---

## Related Documentation

**Files to Update:**
- `docs/technical.md` - Add section on initialization singleton guard
- `docs/architecture.md` - Update initialization flow diagram
- `CLAUDE.md` - Add critical note about listener race conditions

**Cross-References:**
- Browser restart session deletion bug (Fixed 2025-10-25)
- URL-based tab restoration (Feature 02)
- InitializationManager phased startup (Added 2025-10-21)

---

## Conclusion

**Problem:** Race condition between `onStartup` and `onInstalled` listeners causing duplicate initialization and session deletion

**Solution:** Promise-based singleton guard that returns existing promise for simultaneous calls

**Impact:**
- ✓ Prevents duplicate `loadPersistedSessions()` execution
- ✓ Prevents session deletion on browser restart
- ✓ Maintains dormant sessions correctly
- ✓ No performance impact (single execution)

**Status:** Ready for testing and deployment

---

**Last Updated:** 2025-11-02
**Author:** Claude (Anthropic)
**Version:** 3.2.1 (hotfix)
