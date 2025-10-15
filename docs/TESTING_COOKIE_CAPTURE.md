# Cookie Capture Testing Guide

## Changes Made

### 1. Chrome Cookies API Monitoring (lines 543-634)
- Added `chrome.cookies.onChanged` listener to capture cookies set via JavaScript
- Captures cookies set by `document.cookie` or `chrome.cookies.set()`
- Automatically removes cookies from browser's native store after capturing
- Stores captured cookies in the session store

### 2. Browser Cookie Clearing (lines 636-687)
- Added `clearBrowserCookiesForTab()` function to remove browser-native cookies
- Ensures cookies only exist in our session store for isolation
- Called periodically to maintain isolation

### 3. Periodic Cookie Cleanup (lines 689-704)
- Runs every 2 seconds to check all session tabs
- Removes any cookies that leaked into browser's native store
- Maintains strict cookie isolation between sessions

### 4. Initial Cookie Clearing (lines 333-364)
- When a new session is created, clears any existing cookies
- Prevents cookie leakage from previous browsing
- Ensures clean state for new sessions

### 5. Enhanced Logging (lines 530-571)
- Added checks for missing responseHeaders
- Logs header count for debugging
- Explicitly logs when no Set-Cookie headers are found

## Testing Procedure

### Phase 1: Reload Extension
1. Open Chrome Extensions page: `chrome://extensions/`
2. Find "Multi-Session Manager"
3. Click "Reload" button
4. Open Console: Right-click extension > "Inspect background page"

### Phase 2: Clear Browser Cookies
1. Open DevTools (F12)
2. Go to Application tab > Cookies
3. Delete all cookies for the test website
4. Close all tabs for the test website

### Phase 3: Create First Session
1. Click extension icon
2. Click "New Session"
3. Navigate to your test website (e.g., https://portal.seibinsurance.com)
4. Log in with first account

### Phase 4: Monitor Console Output
You should see messages like:

```
[chrome.cookies.onChanged] Cookie changed: SessionID for domain: portal.seibinsurance.com
[session_xxx] Captured cookie SessionID via chrome.cookies API
[session_xxx] Removed browser cookie: SessionID (keeping only in session store)
[Cookie Cleaner] Checking 1 session tabs for browser cookies
```

**OR** if cookies are set via HTTP headers:

```
[onHeadersReceived] Response has 15 headers
[onHeadersReceived] Found Set-Cookie header: SessionID=abc123; Path=/; HttpOnly
[session_xxx] Stored cookie SessionID for portal.seibinsurance.com
[session_xxx] Stored 1 cookies from portal.seibinsurance.com
```

### Phase 5: Verify Cookie Isolation
1. Click extension icon
2. Click "New Session" (creates second session)
3. Navigate to SAME website
4. You should NOT be logged in
5. Log in with DIFFERENT account

### Phase 6: Verify Both Sessions Work
1. Switch between session tabs
2. Each should maintain its own login state
3. Console should show:
   ```
   [session_xxx] Found N cookies for domain
   [session_xxx] Injecting N cookies for domain
   ```

## Expected Console Output Examples

### Successful Cookie Capture via Chrome API
```
[chrome.cookies.onChanged] Cookie changed: JSESSIONID for domain: .example.com
[session_1760445206859_abc] Storing cookie JSESSIONID for session session_1760445206859_abc
[session_1760445206859_abc] Captured cookie JSESSIONID via chrome.cookies API
[session_1760445206859_abc] Removed browser cookie: JSESSIONID (keeping only in session store)
```

### Successful Cookie Capture via HTTP Headers
```
[onHeadersReceived] Tab 123 received response from https://example.com/login
[onHeadersReceived] Tab 123 has session session_1760445206859_abc
[onHeadersReceived] Response has 12 headers
[onHeadersReceived] Found Set-Cookie header: SessionToken=xyz789; Path=/; Secure
[session_1760445206859_abc] Stored cookie SessionToken for example.com
[session_1760445206859_abc] Stored 1 cookies from example.com
```

### Cookie Injection on Subsequent Requests
```
[onBeforeSendHeaders] Tab 123 requesting https://example.com/dashboard
[onBeforeSendHeaders] Tab 123 has session session_1760445206859_abc
[session_1760445206859_abc] Found 3 cookies for example.com
[session_1760445206859_abc] Injecting 3 cookies for example.com
```

### Periodic Cookie Cleanup
```
[Cookie Cleaner] Checking 2 session tabs for browser cookies
[session_1760445206859_abc] Clearing 2 browser cookies for example.com
[session_1760445206859_abc] Removed browser cookie: SessionToken
[session_1760445206859_def] Clearing 1 browser cookies for example.com
[session_1760445206859_def] Removed browser cookie: JSESSIONID
```

## Troubleshooting

### If you see NO cookie capture messages:

1. **Check if website uses HTTP-only cookies**
   - These can only be set via HTTP headers
   - Check Network tab for Set-Cookie headers

2. **Check if website uses third-party cookies**
   - These may be blocked by browser settings
   - Try disabling "Block third-party cookies" in Chrome settings

3. **Check manifest permissions**
   - Verify `"cookies"` permission exists in manifest.json
   - Should be on line 9

4. **Check webRequest listener registration**
   - Look for these console messages on extension load:
     ```
     Testing webRequest listeners...
     onBeforeSendHeaders registered: true
     onHeadersReceived registered: true
     ```

### If cookies are captured but not injected:

1. **Check session assignment**
   - Console should show: `[onBeforeSendHeaders] Tab XXX has session session_xxx`
   - If not, tab may not be assigned to session

2. **Check cookie domain matching**
   - Cookie domains must match or be parent domain of request domain
   - Example: `.example.com` cookie works for `www.example.com` request

3. **Check cookie path matching**
   - Cookie path must be prefix of request path
   - Example: `/app/` cookie works for `/app/dashboard` request

### If sessions leak into each other:

1. **Check periodic cleanup is running**
   - Should see `[Cookie Cleaner]` messages every 2 seconds
   - If not, extension may have crashed

2. **Check cookie removal is successful**
   - Should see `[session_xxx] Removed browser cookie: YYY` messages
   - If errors, check Chrome's cookie permissions

3. **Manually clear browser cookies**
   - DevTools > Application > Cookies > Delete all
   - Then test again

## Key Files Modified

- **d:\Downloads\_TEMP\my-multisession-extension\background.js**
  - Lines 333-364: Initial cookie clearing for new sessions
  - Lines 530-571: Enhanced logging in onHeadersReceived
  - Lines 543-634: Chrome cookies API monitoring
  - Lines 636-704: Browser cookie clearing and periodic cleanup

## Next Steps

If cookies are still not being captured:

1. **Enable verbose logging**: Check all console messages
2. **Inspect Network tab**: Look for Set-Cookie headers in response
3. **Test with simple website**: Try a test site that definitely sets cookies
4. **Check browser extensions**: Other extensions may interfere with cookies
5. **Try incognito mode**: Rules out cookie conflicts from regular browsing

## Success Criteria

- Cookies appear in console logs when logging in
- Second session does NOT inherit first session's cookies
- Each session maintains its own login state
- Console shows periodic cookie cleanup messages
- No errors in background page console
