# Testing Guide - Multi-Session Manager Extension

## Pre-Testing Setup

### 1. Reload Extension
After the bug fixes, you need to reload the extension:
1. Go to `edge://extensions/` (or `chrome://extensions/`)
2. Find "Multi-Session Manager"
3. Click the **Reload** button (circular arrow icon)
4. Check for any errors in the "Errors" section

### 2. Open Background Console
Keep the background console open during testing:
1. On the extension card, click **"Inspect views: background page"**
2. This opens Developer Tools for the background script
3. Go to the **Console** tab
4. Keep this window open to monitor logs

### 3. Open Extension Popup
1. Click the extension icon in the toolbar
2. Right-click inside the popup → **"Inspect"**
3. Go to the **Console** tab
4. Keep this open alongside the background console

---

## Expected Console Output

### When Extension Loads (Background Console):
```
Multi-Session Manager background script loaded
Loaded 0 persisted sessions
Loaded persisted cookie store
Restored 0 tab-to-session mappings
```

### When Creating New Session (Background Console):
```
Created new session session_1234567890_abc123 with tab 45
Sessions persisted to storage (immediate)
```

### When Navigating to Website (Background Console):
```
[session_1234567890_abc123] Stored cookie sessionId for example.com
[session_1234567890_abc123] Stored cookie token for .example.com
Sessions persisted to storage (debounced)
```

### Content Script Initialization (Page Console):
```
[Storage Isolation] Initialized for session: session_1234567890_abc123
[Cookie Isolation] Initialized for session: session_1234567890_abc123
```

---

## Test Cases

### Test 1: Create New Session ✅
**Steps:**
1. Click extension icon
2. Click "+ New Session" button
3. New blank tab should open

**Expected Results:**
- ✅ New tab opens with "about:blank"
- ✅ Tab becomes active (focused)
- ✅ Badge appears on extension icon (colored dot)
- ✅ Background console shows: `Created new session session_...`
- ✅ Background console shows: `Sessions persisted to storage (immediate)`

**If Errors Occur:**
- Check if "Message handler error" appears
- Verify `chrome.tabs.create` is using callback, not async/await

---

### Test 2: Session Appears in Popup ✅
**Steps:**
1. Keep the new session tab open
2. Click extension icon again
3. Look at the popup

**Expected Results:**
- ✅ One session card appears in the popup
- ✅ Session has a colored dot indicator
- ✅ Session ID is displayed
- ✅ Tab title shows "about:blank" or similar
- ✅ Domain shows blank or "about"
- ✅ "Go" button is visible

**If Errors Occur:**
- Check popup console for "Failed to create session"
- Verify `getActiveSessions` is using callback style

---

### Test 3: Navigate to Website in Session Tab ✅
**Steps:**
1. In the session tab, navigate to a website (e.g., https://example.com)
2. Wait for page to load
3. Check both consoles

**Expected Results:**
- ✅ Page loads normally
- ✅ Background console shows cookie storage messages
- ✅ Page console shows storage/cookie isolation initialization
- ✅ No errors in either console

**If Errors Occur:**
- Check for "Failed to get session ID" errors
- Check for "Cannot read properties of undefined (reading 'cookies')" errors

---

### Test 4: Cookie Isolation ✅
**Steps:**
1. Go to a website that sets cookies (e.g., https://google.com)
2. Log in if possible
3. Create a second session (click "+ New Session")
4. In the new session tab, go to the same website
5. Check if you're logged out (separate session)

**Expected Results:**
- ✅ First session: Logged in
- ✅ Second session: Not logged in (or different account)
- ✅ Cookies are isolated between sessions
- ✅ Background console shows different cookie stores for each session

**If Issues Occur:**
- Check if cookies are being intercepted in `onBeforeSendHeaders`
- Verify cookies are being stored in `onHeadersReceived`
- Check if session IDs are different for each tab

---

### Test 5: LocalStorage Isolation ✅
**Steps:**
1. In session 1, open page console (F12)
2. Run: `localStorage.setItem('test', 'session1')`
3. Run: `console.log(localStorage.test)` → Should show "session1"
4. Switch to session 2 tab
5. Open console and run: `console.log(localStorage.test)` → Should show `undefined`
6. Set different value: `localStorage.setItem('test', 'session2')`
7. Switch back to session 1, check again

**Expected Results:**
- ✅ Session 1 has `test: 'session1'`
- ✅ Session 2 has `test: 'session2'`
- ✅ Values are isolated and don't interfere
- ✅ Page console shows: `[Storage Isolation] Initialized for session: session_...`

**To Verify Prefix:**
1. Open Application tab in DevTools
2. Go to Local Storage → your domain
3. You should see keys like: `__SID_session_123__test`

---

### Test 6: Session Storage Isolation ✅
**Steps:**
Same as Test 5, but use `sessionStorage` instead of `localStorage`

**Expected Results:**
- ✅ sessionStorage is also isolated
- ✅ Keys are prefixed with session ID
- ✅ Closing tab clears sessionStorage

---

### Test 7: Persistent Storage (Survive Browser Restart) ✅
**Steps:**
1. Create 2-3 sessions
2. Navigate to different websites in each
3. Log in to websites if possible
4. Check popup shows all sessions
5. **Close the browser completely** (not just tabs)
6. Reopen browser
7. Click extension icon

**Expected Results:**
- ✅ Sessions are NOT shown (tabs don't exist anymore)
- ✅ Background console shows: `Loaded X persisted sessions`
- ✅ Cookie data is preserved in storage
- ✅ If you manually create sessions and go to same sites, cookies should be available

**Note:** Sessions are ephemeral (tied to tabs), but the cookie data persists. To use persisted cookies, you would need to implement a "restore session" feature.

---

### Test 8: Tab Close Cleanup ✅
**Steps:**
1. Create a session
2. Note the session ID in popup
3. Close the session's tab
4. Click extension icon

**Expected Results:**
- ✅ Session disappears from popup
- ✅ Background console shows: `Tab X closed, removing from session...`
- ✅ Background console shows: `Cleaning up session session_...`
- ✅ Background console shows: `Sessions persisted to storage (immediate)`

---

### Test 9: Multiple Tabs in Same Session ✅
**Steps:**
1. Create session 1
2. In session 1 tab, navigate to google.com
3. Open a new tab manually (Ctrl+T)
4. In the new tab, navigate to google.com
5. Check which session the new tab belongs to

**Expected Results:**
- ✅ New manual tab does NOT belong to session 1
- ✅ New manual tab has no badge
- ✅ Both tabs show in popup but only session 1 tab is marked
- ✅ Cookies are NOT shared between session 1 tab and manual tab

**Note:** Only tabs created via the extension's "New Session" button are part of sessions. Manual tabs are treated as "no session" (default browser behavior).

---

### Test 10: Switch Between Tabs ✅
**Steps:**
1. Create 3 sessions with different websites
2. Click extension icon
3. Click "Go" button on different sessions

**Expected Results:**
- ✅ Clicking "Go" switches to that tab
- ✅ Tab becomes active (focused)
- ✅ Badge updates to show correct color

---

### Test 11: Badge Colors ✅
**Steps:**
1. Create multiple sessions
2. Check extension badge on each tab

**Expected Results:**
- ✅ Each session has a different colored badge
- ✅ Badge shows "●" (solid dot)
- ✅ Tabs without sessions have no badge
- ✅ Colors are consistent (same session = same color)

---

### Test 12: Error Handling ✅
**Steps:**
1. Create session
2. Navigate to `chrome://extensions/` or `about:blank`
3. Check for errors

**Expected Results:**
- ✅ No JavaScript errors in console
- ✅ Content scripts handle special URLs gracefully
- ✅ No "Cannot read properties of undefined" errors

---

## Common Errors and Solutions

### Error 1: "Failed to create session: [object Object]"
**Cause:** `chrome.tabs.create` not using callback
**Solution:** Already fixed in background.js (line 305-330)
**Verify:** Check if `createNewSession` function uses callback style

### Error 2: "tabs.query signature error"
**Cause:** Manifest V2 requires callbacks, not Promises
**Solution:** Already fixed in background.js (line 338-343)
**Verify:** All `chrome.tabs.query` calls use callback style

### Error 3: "Cannot read properties of undefined (reading 'id')"
**Cause:** Tab object is undefined (async/await issue)
**Solution:** Already fixed - using callback provides tab object
**Verify:** Check line 308-313 in background.js

### Error 4: "[Cookie Isolation] Failed to get session ID"
**Cause:** Tab doesn't have session assigned yet
**Solution:** Already fixed - proper error handling in message handlers
**Verify:** Check lines 532-543 in background.js

### Error 5: "Cannot read properties of undefined (reading 'cookies')"
**Cause:** Session object doesn't exist
**Solution:** Already fixed - null checks before accessing session
**Verify:** Check lines 556-560 in background.js

### Error 6: "[Storage Isolation] Using fallback session ID: default"
**Cause:** Content script loaded before session was assigned
**Solution:** This is a warning, not an error - content script will retry
**Note:** Content scripts inject before tab is fully ready, fallback handles this

---

## Performance Testing

### Test: Many Sessions
1. Create 10+ sessions
2. Navigate to different websites
3. Check popup responsiveness
4. Check memory usage in Task Manager

**Expected:**
- ✅ Popup loads quickly (< 1 second)
- ✅ Memory usage reasonable (< 200MB for extension)
- ✅ No performance degradation

### Test: Many Cookies
1. Navigate to websites that set many cookies (e.g., Facebook, Google)
2. Check background console for storage messages
3. Open chrome.storage.local to see persisted data

**Expected:**
- ✅ Cookies persist after 1 second (debounced)
- ✅ No excessive console spam
- ✅ Storage size reasonable

---

## Debugging Tips

### View Persisted Data:
1. Open background console
2. Run: `chrome.storage.local.get(null, (data) => console.log(data))`
3. Inspect the sessions, cookieStore, and tabToSession objects

### Clear All Data:
```javascript
chrome.storage.local.clear(() => console.log('Storage cleared'));
```

### Manually Create Session for Testing:
```javascript
chrome.runtime.sendMessage({ action: 'createNewSession' }, (response) => {
  console.log('Session created:', response);
});
```

### Get Active Sessions:
```javascript
chrome.runtime.sendMessage({ action: 'getActiveSessions' }, (response) => {
  console.log('Active sessions:', response);
});
```

---

## Success Criteria

All tests should pass with:
- ✅ No JavaScript errors in any console
- ✅ Sessions create successfully
- ✅ Cookies isolated between sessions
- ✅ Storage isolated between sessions
- ✅ Sessions persist across browser restarts
- ✅ Tabs close and cleanup properly
- ✅ UI responsive and functional

---

## Known Limitations

1. **Manual Tabs Not in Sessions**: Only extension-created tabs have sessions
2. **No Session Naming**: Sessions identified by auto-generated IDs
3. **No Session Restoration**: Closing all tabs deletes session (by design)
4. **IndexedDB Not Isolated**: Only cookies, localStorage, and sessionStorage
5. **Service Workers Shared**: Service workers are not session-specific
6. **Manifest V2 Required**: Will need migration to V3 eventually

---

## Next Steps After Testing

If all tests pass:
1. ✅ Extension is working correctly
2. ✅ Ready for daily use
3. 📝 Consider feature additions (session naming, restoration, etc.)

If tests fail:
1. 🔍 Check specific error messages
2. 📋 Review console logs from both background and content scripts
3. 🐛 Debug using Chrome DevTools
4. 💬 Report specific error messages for further assistance

---

## Support

For issues:
1. Check console logs (background + content script)
2. Verify Manifest V2 is being used
3. Ensure all API calls use callbacks, not async/await
4. Check chrome.runtime.lastError handling

Good luck with testing! 🚀
