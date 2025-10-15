# Quick Start Guide - Cookie Capture Fix

## What Was Fixed

Your extension was not capturing cookies because it only monitored HTTP headers, but many websites set cookies via JavaScript. We've now added a dual capture system that catches cookies from BOTH sources.

## Quick Test (5 Minutes)

### Step 1: Reload Extension
1. Go to `chrome://extensions/`
2. Find "Multi-Session Manager"
3. Click the **Reload** button (circular arrow icon)

### Step 2: Open Console
1. On the same page, click **"Inspect background page"** (under the extension)
2. A DevTools window will open - this shows all console logs

### Step 3: Create First Session
1. Click the extension icon in Chrome toolbar
2. Click **"New Session"** button
3. Navigate to your test website (e.g., portal.seibinsurance.com)
4. Log in with first account

### Step 4: Watch Console
You should immediately see messages like:
```
[chrome.cookies.onChanged] Cookie changed: SessionID for domain: portal.seibinsurance.com
[session_xxx] Captured cookie SessionID via chrome.cookies API
[session_xxx] Removed browser cookie: SessionID
```

**If you see these messages, THE FIX IS WORKING!** ✅

### Step 5: Test Isolation
1. Click extension icon again
2. Click **"New Session"** (creates second session)
3. Navigate to the SAME website
4. **You should NOT be logged in** (cookies are isolated)
5. Log in with a DIFFERENT account

### Step 6: Verify Both Work
1. Switch between the two tabs
2. Each should show a different account logged in
3. Console should show cookie injection messages:
   ```
   [session_xxx] Found 3 cookies for portal.seibinsurance.com
   [session_xxx] Injecting 3 cookies for portal.seibinsurance.com
   ```

## What Changed

### New Features Added:

1. **Chrome Cookies API Monitoring** (background.js lines 543-634)
   - Captures cookies set via JavaScript (`document.cookie`)
   - Works for cookies set after page load
   - Automatically removes from browser's native store

2. **Periodic Cookie Cleanup** (background.js lines 689-704)
   - Runs every 2 seconds
   - Removes any cookies that leak into browser store
   - Maintains strict isolation

3. **Initial Cookie Clearing** (background.js lines 333-364)
   - Clears existing cookies when creating new session
   - Ensures clean slate for each session

4. **Enhanced Logging** (background.js lines 530-571)
   - Shows exactly what's happening with cookies
   - Helps diagnose issues quickly

## Console Messages Explained

### Good Messages (Everything Working)
```
✅ [chrome.cookies.onChanged] Cookie changed: SessionID
   → Cookie was detected when website set it

✅ [session_xxx] Captured cookie SessionID via chrome.cookies API
   → Cookie was saved to session store

✅ [session_xxx] Removed browser cookie: SessionID
   → Cookie was removed from browser (isolation maintained)

✅ [session_xxx] Found 3 cookies for example.com
   → Session has cookies ready to inject

✅ [session_xxx] Injecting 3 cookies for example.com
   → Cookies being sent to server with request
```

### Warning Messages (Need Attention)
```
⚠️ [onHeadersReceived] No Set-Cookie headers found
   → Website setting cookies via JavaScript (normal, our fix handles this)

⚠️ [onBeforeSendHeaders] No session for tab 123
   → Tab not assigned to session (create session first)

⚠️ [chrome.cookies.onChanged] No tabs found for domain
   → Cookie set but no session tabs match domain
```

### Error Messages (Something Wrong)
```
❌ Failed to persist sessions
   → Storage error, check chrome.storage permissions

❌ Failed to remove browser cookie
   → Isolation may be compromised, check cookies permission
```

## Troubleshooting

### Problem: Still not seeing cookie capture messages

**Solution 1:** Check manifest permissions
```json
"permissions": [
  "cookies",  ← Must be present
  "webRequest",
  "webRequestBlocking",
  ...
]
```

**Solution 2:** Clear ALL browser cookies first
1. DevTools → Application → Cookies
2. Delete all cookies for your test website
3. Close all tabs for that website
4. Try again with new session

**Solution 3:** Test with simple website
Try a simple cookie test site to verify the extension works:
- http://www.allaboutcookies.org/verify-cookies
- https://cookie-script.com/cookie-consent-checker

### Problem: Second session sees first session's cookies

**Solution 1:** Wait for cleanup cycle
- Periodic cleanup runs every 2 seconds
- Wait 2-3 seconds after logging in
- Then create second session

**Solution 2:** Manually clear browser cookies
1. DevTools → Application → Cookies
2. Delete all cookies
3. Create new sessions

**Solution 3:** Check for errors in console
- Look for "Failed to remove browser cookie" errors
- These indicate permission issues

### Problem: Cookies not persisting across page navigation

**Solution:** Check console for storage errors
- Look for "Failed to persist sessions" messages
- May indicate storage quota exceeded
- Try clearing old sessions

## Performance Notes

- **Periodic cleanup:** Runs every 2 seconds (minimal CPU usage)
- **Storage writes:** Debounced to 1 per second (prevents excessive writes)
- **Memory usage:** Only stores cookies for active sessions
- **No impact** on non-session tabs

## File Changes Summary

Only ONE file was modified:
- **d:\Downloads\_TEMP\my-multisession-extension\background.js**
  - Added ~160 lines of new code
  - No breaking changes
  - Fully backward compatible

## Next Steps

1. **Test the extension** with your actual website
2. **Monitor the console** for cookie capture messages
3. **Verify isolation** by creating multiple sessions
4. **Report results** - what works, what doesn't

## Support

If you're still having issues:

1. **Check console logs** - Copy entire console output
2. **Check Network tab** - Look for Set-Cookie headers
3. **Test with different website** - Rule out site-specific issues
4. **Check Chrome version** - Extension requires Chrome 80+

## Success Criteria Checklist

- [ ] Extension reloaded without errors
- [ ] Console shows cookie capture messages when logging in
- [ ] Second session does NOT inherit first session's cookies
- [ ] Each session maintains its own login state
- [ ] Console shows periodic cleanup messages every 2 seconds
- [ ] No errors in background page console
- [ ] Sessions persist after closing/reopening browser

If ALL checkboxes are checked, **THE FIX IS WORKING PERFECTLY!** 🎉

## What To Expect

### Before the fix:
- Cookies not captured
- Sessions share same login state
- Second session sees first session's cookies
- Console shows no cookie storage messages

### After the fix:
- Cookies captured from ALL sources (HTTP + JavaScript)
- Sessions completely isolated
- Each session has own login state
- Console shows detailed cookie flow
- Periodic cleanup prevents leakage

## Timeline

- **Immediate:** Cookie capture works
- **2 seconds:** First cleanup cycle runs
- **Every 2 seconds:** Cleanup maintains isolation
- **On navigation:** Cookies injected automatically
- **On browser restart:** Sessions persist (loaded from storage)

---

**Need Help?** Check the console logs first - they tell you exactly what's happening!
