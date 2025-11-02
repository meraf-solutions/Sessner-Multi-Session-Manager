# Fix: Premium Tier Session Deletion on Browser Restart

**Date:** 2025-11-02
**Version:** 3.2.1 (Hotfix)
**Severity:** CRITICAL
**Affected Tiers:** Free, Premium
**Status:** ✅ FIXED

---

## Summary

Premium tier users reported that their sessions were being deleted on browser restart, despite being correctly persisted before closing the browser. This was a critical regression that made the extension unusable for Premium users who needed session persistence.

## Root Cause

The Free/Premium cleanup logic in `loadPersistedSessions()` was executing **immediately** without waiting for Edge browser to restore tabs. Since Edge restores tabs asynchronously (100-500ms after extension loads), `chrome.tabs.query()` returned an empty array (0 tabs), causing ALL sessions to be marked as "orphaned" and deleted.

### Evidence from Logs

**Before Browser Close (Working Session):**
```javascript
[openDormantSession] Created tab 1089347807 for session session_1762089377454_iiwmu2kad
[onBeforeSendHeaders] Tab 1089347807 has session session_1762089377454_iiwmu2kad
[session_1762089377454_iiwmu2kad] Injecting 3 cookies for sandbox.merafsolutions.com
[Tab Metadata] Collected metadata for 1 session tabs
✓ Transaction committed to disk: tabToSession/tabMetadata persisted to disk
```

**After Browser Restart (Sessions Deleted!):**
```javascript
[Session Restore] Current tier: premium
[Session Restore] Should auto-restore: false (Not Enterprise tier)
[Session Restore] FREE/PREMIUM TIER: No auto-restore, applying immediate cleanup...
[Session Restore] Found 0 existing tabs in browser  ← BUG! Edge hasn't restored yet
[Session Restore] Session session_1762089377455_7swf4zr2p: Removed 1 stale tabs (1 -> 0)
[Session Restore] Marking empty session for deletion: session_1762089377455_7swf4zr2p
[Session Restore] Deleting 3 orphaned sessions  ← ALL SESSIONS LOST!
```

## The Fix

### Changes Made

**File:** `background.js` (lines 1343-1399)

Added 2-second delay + retry logic (3 attempts) to Free/Premium tier cleanup logic, matching the timing already implemented for Enterprise tier auto-restore:

```javascript
// CRITICAL FIX: Wait for Edge to restore tabs before cleanup
// Edge assigns NEW tab IDs on restart and restores tabs asynchronously
// Without this delay, chrome.tabs.query() returns 0 tabs → all sessions deleted!
console.log('[Session Restore] Waiting 2 seconds for Edge to restore tabs...');
await new Promise((resolve) => setTimeout(resolve, 2000));

// Retry logic: Try up to 3 times to get restored tabs (same as Enterprise tier)
let tabs = [];
let attempt = 0;
const maxAttempts = 3;

while (attempt < maxAttempts) {
  tabs = await new Promise((resolve) => {
    chrome.tabs.query({}, (result) => {
      if (chrome.runtime.lastError) {
        console.error('[Session Restore] Failed to query tabs:', chrome.runtime.lastError);
        resolve([]);
      } else {
        resolve(result || []);
      }
    });
  });

  console.log(`[Session Restore] Tab query attempt ${attempt + 1}: Found ${tabs.length} tabs`);

  // If we found tabs, break out of retry loop
  if (tabs.length > 0) {
    break;
  }

  // If no tabs found, wait and retry
  if (attempt < maxAttempts - 1) {
    console.log(`[Session Restore] No tabs found, waiting 1 second before retry...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  attempt++;
}
```

### Key Changes:

1. **2-second initial delay** - Gives Edge time to restore tabs before validation
2. **Retry logic (3 attempts)** - Handles slower systems gracefully
3. **1-second retry intervals** - Balances responsiveness with system load
4. **Dormant session preservation** - Sessions with no tabs are preserved (not deleted)
5. **Improved logging** - Clearer messages about dormant vs active sessions

## Expected Behavior After Fix

### For Free/Premium Tiers:

**On Browser Restart:**
1. Extension loads before Edge restores tabs
2. `loadPersistedSessions()` waits 2 seconds
3. Retry logic queries tabs up to 3 times
4. Tab mappings cleared (tabs have new IDs)
5. Sessions with no tabs preserved as "dormant"
6. Users can manually reopen dormant sessions from popup

**Expected Console Output:**
```javascript
[Session Restore] Current tier: premium
[Session Restore] Should auto-restore: false
[Session Restore] FREE/PREMIUM TIER: No auto-restore, preserving sessions as dormant...
[Session Restore] Waiting 2 seconds for Edge to restore tabs...
[Session Restore] Tab query attempt 1: Found 0 tabs
[Session Restore] No tabs found, waiting 1 second before retry...
[Session Restore] Tab query attempt 2: Found 3 tabs  ← Success! Tabs restored
[Session Restore] Found 3 existing tabs in browser
[Session Restore] Tab mappings cleared (tabs have new IDs after restart)
[Session Restore] ✓ FREE/PREMIUM session preservation complete
[Session Restore] Active sessions (with tabs): 0
[Session Restore] Dormant sessions (no tabs): 2  ← Sessions preserved!
[Session Restore] Total sessions in storage: 2
```

### For Enterprise Tier:

No changes to Enterprise tier behavior - auto-restore continues to work as before with URL-based tab matching.

## Testing Plan

### Test 1: Premium Tier Browser Restart

**Prerequisites:**
- Active Premium license
- At least 1 session created with cookies

**Steps:**
1. Activate Premium license
2. Create a new session
3. Navigate to `https://httpbin.org/cookies/set?test=premium`
4. Verify badge appears on tab
5. Note the session ID
6. Close browser completely
7. Reopen browser (with Edge "Restore tabs" enabled)
8. Wait 3-4 seconds
9. Open background console
10. Open popup.html

**Expected Results:**
- ✅ Console shows: "Tab query attempt 1: Found 0 tabs"
- ✅ Console shows: "Tab query attempt 2: Found X tabs" (where X > 0)
- ✅ Console shows: "Dormant sessions (no tabs): 1" or higher
- ✅ Popup shows dormant sessions (grayed out)
- ✅ Can manually reopen dormant session (shows cookies preserved)
- ✅ NO sessions deleted

### Test 2: Free Tier Browser Restart

**Prerequisites:**
- No active license (Free tier)
- At least 1 session created

**Steps:**
1. Same as Test 1, but with Free tier
2. Verify 7-day retention period applies

**Expected Results:**
- Same as Test 1
- Sessions preserved as dormant
- 7-day cleanup runs later (separate from startup)

### Test 3: Enterprise Tier Auto-Restore

**Prerequisites:**
- Active Enterprise license
- Auto-restore enabled

**Steps:**
1. Same as Test 1, but with Enterprise tier and auto-restore enabled

**Expected Results:**
- Auto-restore completes successfully
- Tab mappings restored via URL-based matching
- Badges reappear automatically
- NO regression from fix

## Regression Risk Assessment

**Risk Level:** LOW

**Why:**
1. Fix only affects Free/Premium tiers (Enterprise already had this logic)
2. No changes to core session management or cookie isolation
3. No changes to Enterprise auto-restore logic
4. Only adds delay + retry logic (defensive programming)

**Potential Issues:**
- Slower extension startup (2-4 seconds) on browser restart for Free/Premium
- Mitigation: This is acceptable for session preservation

## Version Bump

**From:** v3.2.0 → **To:** v3.2.1

**Changelog Entry:**
```markdown
## v3.2.1 (2025-11-02) - CRITICAL HOTFIX

### Bug Fixes
- **CRITICAL:** Fixed Premium tier sessions being deleted on browser restart
  - Root cause: Free/Premium cleanup logic executed before Edge restored tabs
  - Fix: Added 2-second delay + retry logic (3 attempts) to wait for tab restoration
  - Impact: Sessions now preserved as "dormant" (can be manually reopened)
  - Affected tiers: Free, Premium
  - No impact to Enterprise auto-restore functionality
```

## Documentation Updates

### Files Updated:
1. **CLAUDE.md** (lines 884-993)
   - Updated "Browser Restart Persistence" section
   - Added "Critical Fix v2" documentation
   - Added before/after log examples
   - Added dormant session behavior explanation

2. **background.js** (lines 1343-1481)
   - Added 2-second delay + retry logic
   - Improved logging for dormant session tracking
   - Added comments explaining the fix

3. **docs/fixes/2025-11-02_premium_session_deletion_bug.md** (this file)
   - Complete fix documentation

## Deployment Checklist

- [x] Code changes implemented
- [x] CLAUDE.md updated
- [x] Fix documentation created
- [ ] Manual testing completed (Test 1, 2, 3)
- [ ] Version bumped to 3.2.1
- [ ] manifest.json version updated
- [ ] Changelog updated
- [ ] Git commit created
- [ ] Extension packaged for distribution

## Related Issues

- **Original Issue:** v3.0.0 (2025-10-25) - Enterprise auto-restore race condition fix
  - Fix: Added URL-based tab matching with 2-second delay for Enterprise tier
  - Documentation: `docs/features_implementation/02_session_persistence.md`

- **This Issue:** v3.2.1 (2025-11-02) - Free/Premium session deletion on restart
  - Fix: Extended same delay + retry logic to Free/Premium tiers
  - Documentation: This file

## Conclusion

This fix resolves a critical bug that made the extension unusable for Premium users. The 2-second delay + retry logic ensures Edge has time to restore tabs before session validation runs, preventing premature session deletion. Sessions are now properly preserved as "dormant" for Free/Premium tiers, matching the expected behavior documented in `docs/features_implementation/05_auto_restore_tier_restrictions.md`.
