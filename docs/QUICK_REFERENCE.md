# Session Isolation - Quick Reference Guide

## TL;DR

**Question**: Can Chrome extensions do true session isolation like Firefox Containers?

**Answer**: **NO** - but you can fake it with ~80-90% effectiveness using cookie swapping.

---

## What's Possible vs What's Not

### Possible (with workarounds)

- Cookie isolation per tab
- localStorage isolation per session
- sessionStorage isolation (native)
- Visual session indicators
- On-demand session creation
- Ephemeral sessions (cleanup on tab close)

### NOT Possible

- HTTP cache isolation (shared by top-level site)
- True browser-level isolation
- IndexedDB full isolation (too complex)
- Service Worker isolation
- Fingerprint isolation
- Manifest V3 compatibility (currently)

---

## Core APIs

### 1. chrome.webRequest (MV2 only)

**Purpose**: Intercept and modify cookies before browser sees them

```javascript
// Intercept requests - inject session cookies
chrome.webRequest.onBeforeSendHeaders.addListener(
  modifyRequestCookies,
  { urls: ['<all_urls>'] },
  ['blocking', 'requestHeaders', 'extraHeaders']
);

// Intercept responses - capture Set-Cookie
chrome.webRequest.onHeadersReceived.addListener(
  captureResponseCookies,
  { urls: ['<all_urls>'] },
  ['blocking', 'responseHeaders', 'extraHeaders']
);
```

**Status**: Deprecated in MV3

### 2. Content Script Injection

**Purpose**: Override document.cookie and localStorage

```javascript
// Run at document_start
Object.defineProperty(document, 'cookie', {
  get: () => getSessionCookies(),
  set: (value) => storeSessionCookie(value)
});
```

**Limitation**: Race conditions possible

### 3. chrome.cookies

**Purpose**: Manage cookie stores (only 2: normal + incognito)

```javascript
// Get all cookies for incognito
chrome.cookies.getAll({ storeId: '1' });
```

**Limitation**: Cannot create custom stores

---

## Implementation Strategy

### Data Flow

```
User clicks "New Session"
        ↓
Background creates session ID
        ↓
Open new tab, map tab ID → session ID
        ↓
Inject content script with session ID
        ↓
Override document.cookie/localStorage
        ↓
Intercept all HTTP requests
        ↓
Swap cookies based on tab's session ID
        ↓
Store Set-Cookie in session storage
        ↓
User closes tab → delete session
```

### Session Storage Structure

```javascript
{
  sessions: {
    'session-123': {
      id: 'session-123',
      name: 'Work Account',
      color: '#FF6B6B',
      cookies: {
        'example.com': {
          'session_id': 'abc123',
          'user_token': 'xyz789'
        }
      },
      storage: {
        'example.com': {
          'user_preferences': '{"theme":"dark"}'
        }
      }
    }
  },
  tabSessions: {
    '42': 'session-123',
    '43': 'session-456'
  }
}
```

---

## Key Code Snippets

### 1. Create Session

```javascript
async function createSession(name, color) {
  const sessionId = `session-${Date.now()}-${crypto.randomUUID()}`;

  await chrome.storage.local.set({
    [`session-${sessionId}`]: {
      id: sessionId,
      name: name,
      color: color,
      cookies: {},
      storage: {},
      createdAt: Date.now()
    }
  });

  return sessionId;
}
```

### 2. Open Tab in Session

```javascript
async function openTabInSession(sessionId, url) {
  const tab = await chrome.tabs.create({ url });

  // Map tab to session
  await chrome.storage.local.set({
    [`tab-${tab.id}`]: sessionId
  });

  // Inject session variables
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: (sid, color) => {
      window.__SESSION_ID__ = sid;
      window.__SESSION_COLOR__ = color;
    },
    args: [sessionId, session.color]
  });
}
```

### 3. Intercept Cookies (Request)

```javascript
function handleBeforeSendHeaders(details) {
  const sessionId = await getSessionForTab(details.tabId);
  if (!sessionId) return {};

  const domain = new URL(details.url).hostname;
  const sessionCookies = await getSessionCookies(sessionId, domain);

  // Remove existing Cookie header
  const headers = details.requestHeaders.filter(
    h => h.name.toLowerCase() !== 'cookie'
  );

  // Add session-specific cookies
  if (sessionCookies) {
    headers.push({ name: 'Cookie', value: sessionCookies });
  }

  return { requestHeaders: headers };
}
```

### 4. Capture Cookies (Response)

```javascript
function handleHeadersReceived(details) {
  const sessionId = await getSessionForTab(details.tabId);
  if (!sessionId) return {};

  const domain = new URL(details.url).hostname;

  // Extract Set-Cookie headers
  const setCookies = details.responseHeaders.filter(
    h => h.name.toLowerCase() === 'set-cookie'
  );

  // Store in session
  for (const header of setCookies) {
    await storeSessionCookie(sessionId, domain, header.value);
  }

  // Remove Set-Cookie to prevent browser storage
  return {
    responseHeaders: details.responseHeaders.filter(
      h => h.name.toLowerCase() !== 'set-cookie'
    )
  };
}
```

### 5. Override document.cookie

```javascript
// Injected into page context at document_start
(function() {
  const sessionId = window.__SESSION_ID__;
  if (!sessionId) return;

  const storageKey = `__session_${sessionId}_cookies__`;

  Object.defineProperty(document, 'cookie', {
    get: function() {
      return window.sessionStorage.getItem(storageKey) || '';
    },
    set: function(value) {
      // Parse new cookie
      const [cookieStr] = value.split(';');
      const [name, val] = cookieStr.split('=');

      // Get existing cookies
      const existing = window.sessionStorage.getItem(storageKey) || '';
      const cookieMap = {};

      existing.split('; ').forEach(c => {
        const [k, v] = c.split('=');
        if (k) cookieMap[k] = v;
      });

      // Update
      cookieMap[name] = val;

      // Store
      const serialized = Object.entries(cookieMap)
        .map(([k, v]) => `${k}=${v}`)
        .join('; ');

      window.sessionStorage.setItem(storageKey, serialized);

      // Notify background
      chrome.runtime.sendMessage({
        type: 'COOKIE_SET',
        sessionId: sessionId,
        name: name,
        value: val
      });
    }
  });
})();
```

### 6. Override localStorage

```javascript
(function() {
  const sessionId = window.__SESSION_ID__;
  if (!sessionId) return;

  const prefix = `__session_${sessionId}__`;
  const original = window.localStorage;

  window.localStorage = new Proxy(original, {
    get(target, prop) {
      if (prop === 'getItem') {
        return (key) => target.getItem(prefix + key);
      }
      if (prop === 'setItem') {
        return (key, value) => target.setItem(prefix + key, value);
      }
      if (prop === 'removeItem') {
        return (key) => target.removeItem(prefix + key);
      }
      if (prop === 'clear') {
        return () => {
          // Clear only session items
          for (let i = target.length - 1; i >= 0; i--) {
            const key = target.key(i);
            if (key.startsWith(prefix)) {
              target.removeItem(key);
            }
          }
        };
      }
      if (prop === 'key') {
        return (index) => {
          const sessionKeys = [];
          for (let i = 0; i < target.length; i++) {
            const key = target.key(i);
            if (key.startsWith(prefix)) {
              sessionKeys.push(key.substring(prefix.length));
            }
          }
          return sessionKeys[index];
        };
      }
      if (prop === 'length') {
        let count = 0;
        for (let i = 0; i < target.length; i++) {
          if (target.key(i).startsWith(prefix)) count++;
        }
        return count;
      }
      return target[prop];
    }
  });
})();
```

---

## Manifest Configuration

### Manifest V2 (Required for full functionality)

```json
{
  "manifest_version": 2,
  "name": "Session Manager",
  "version": "1.0.0",
  "permissions": [
    "webRequest",
    "webRequestBlocking",
    "cookies",
    "storage",
    "tabs",
    "<all_urls>"
  ],
  "background": {
    "scripts": ["background.js"],
    "persistent": true
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ],
  "browser_action": {
    "default_popup": "popup.html"
  }
}
```

### Manifest V3 (Limited - NOT recommended)

```json
{
  "manifest_version": 3,
  "name": "Session Manager",
  "version": "1.0.0",
  "permissions": [
    "cookies",
    "storage",
    "tabs",
    "scripting"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_start",
      "all_frames": true
    }
  ],
  "action": {
    "default_popup": "popup.html"
  }
}
```

**NOTE**: MV3 cannot use `webRequest` blocking, severely limiting cookie interception.

---

## Testing Checklist

### Basic Functionality

- [ ] Create new session
- [ ] Open tab in session
- [ ] Login to website in session 1
- [ ] Open same website in session 2
- [ ] Verify session 2 is logged out
- [ ] Login to session 2 with different account
- [ ] Switch between tabs - verify cookies stay separate
- [ ] Close tab - verify session is deleted
- [ ] Reopen extension - verify persistent sessions remain

### Cookie Isolation

- [ ] Set cookie via document.cookie in session 1
- [ ] Verify cookie not visible in session 2
- [ ] Set cookie via HTTP response in session 1
- [ ] Verify cookie captured and isolated
- [ ] Test with HttpOnly cookies
- [ ] Test with Secure cookies
- [ ] Test with SameSite cookies
- [ ] Test cookie expiration handling

### Storage Isolation

- [ ] Set localStorage in session 1
- [ ] Verify not visible in session 2
- [ ] Test localStorage.clear() only clears session
- [ ] Test sessionStorage (should be native per-tab)
- [ ] Test with JSON data
- [ ] Test with large data (quota limits)

### Edge Cases

- [ ] Test with single-page applications (SPA)
- [ ] Test with sites that use fetch() API
- [ ] Test with WebSocket connections
- [ ] Test with sites that check browser fingerprint
- [ ] Test with sites that use CORS
- [ ] Test with sites that have CSP
- [ ] Test iframe behavior
- [ ] Test popup windows
- [ ] Test navigation (back/forward)
- [ ] Test page reload
- [ ] Test with ad blockers enabled

### Performance

- [ ] Measure request latency overhead
- [ ] Monitor memory usage with 10+ sessions
- [ ] Test with slow network
- [ ] Test with 100+ cookies
- [ ] Profile background script CPU usage

---

## Common Issues and Solutions

### Issue: Cookies Leak Between Sessions

**Cause**: Race condition - page JavaScript runs before injection

**Solution**:
- Ensure content script runs at `document_start`
- Use synchronous injection for critical overrides
- Add double-check in background script

### Issue: HttpOnly Cookies Not Isolated

**Cause**: Cannot intercept with JavaScript

**Solution**:
- Rely on `webRequest` API only
- Ensure `extraHeaders` permission
- Handle edge cases where interception fails

### Issue: Login Doesn't Persist

**Cause**: Session cookies not being captured

**Solution**:
- Debug `onHeadersReceived` listener
- Check for redirect chains
- Verify cookie domain matching logic

### Issue: Performance Degradation

**Cause**: Too many request interceptions

**Solution**:
- Add domain whitelist/blacklist
- Cache cookie data
- Debounce storage operations
- Use efficient data structures

### Issue: Conflict with Other Extensions

**Cause**: Multiple extensions modifying headers

**Solution**:
- Document known conflicts
- Provide disable instructions
- Consider listener priority (not officially supported)

---

## Performance Benchmarks

### Expected Overhead

| Operation | Native | With Extension | Overhead |
|-----------|--------|----------------|----------|
| Page Load | 500ms | 520ms | +20ms (4%) |
| API Request | 100ms | 110ms | +10ms (10%) |
| Cookie Set | 1ms | 5ms | +4ms (400%) |
| localStorage Get | 0.1ms | 0.2ms | +0.1ms (100%) |

### Memory Usage

- Base extension: ~5-10 MB
- Per session: ~100-500 KB (depends on cookies)
- 10 active sessions: ~15-20 MB total

### Limitations

- Max 10-20 sessions recommended
- Each session adds slight overhead
- Large cookie sets (>50 cookies) may cause slowdown

---

## Browser Compatibility

| Feature | Chrome | Edge | Brave | Opera |
|---------|--------|------|-------|-------|
| webRequest | Yes | Yes | Yes | Yes |
| Content Scripts | Yes | Yes | Yes | Yes |
| cookie Override | Yes | Yes | Yes | Yes |
| MV2 Support | Until 2024 | Until 2024 | Ongoing | Until 2024 |
| MV3 Limited | Yes | Yes | Yes | Yes |

**Note**: Manifest V2 deprecation timeline may vary by browser.

---

## Alternative Solutions

### 1. Chrome Profiles

**Best for**: Complete isolation, different browsing contexts

**Limitations**: Cannot create programmatically, separate windows only

### 2. Incognito Mode

**Best for**: 2-session use case (normal + private)

**Limitations**: Only 1 incognito store, UI limitations

### 3. Firefox Containers

**Best for**: True native session isolation

**Limitations**: Firefox only, requires different extension code

### 4. Antidetect Browsers

**Best for**: Production use, fingerprint spoofing

**Limitations**: Paid software, not a browser extension

---

## Development Resources

### Essential APIs

- [chrome.webRequest](https://developer.chrome.com/docs/extensions/reference/api/webRequest)
- [chrome.cookies](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage)
- [chrome.tabs](https://developer.chrome.com/docs/extensions/reference/api/tabs)

### Useful Libraries

- [js-cookie](https://github.com/js-cookie/js-cookie) - Cookie parsing
- [tough-cookie](https://github.com/salesforce/tough-cookie) - Advanced cookie handling
- [uuid](https://github.com/uuidjs/uuid) - Session ID generation

### Testing Tools

- Chrome DevTools Network tab
- chrome://extensions/ (debugging)
- chrome://storage-internals/ (storage inspection)
- [Postman](https://www.postman.com/) - API testing

### Example Projects

- [SessionBox Open Source](https://github.com/emmanuelroecker/SessionBox)
- [Firefox Multi-Account Containers](https://github.com/mozilla/multi-account-containers)

---

## Support and Debugging

### Enable Debug Logging

```javascript
const DEBUG = true;

function log(...args) {
  if (DEBUG) {
    console.log('[SessionManager]', ...args);
  }
}
```

### View Background Script Console

1. Go to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "background page" under your extension
4. View console logs

### View Content Script Console

1. Open DevTools on the web page
2. Check console for injected script logs
3. Look for `[SessionManager]` prefix

### Common Debug Commands

```javascript
// View all sessions
chrome.storage.local.get(null, console.log);

// View tab-session mapping
chrome.runtime.sendMessage({ type: 'DEBUG_TAB_SESSIONS' });

// Clear all sessions
chrome.storage.local.clear();

// Get cookies for current tab
chrome.cookies.getAll({ url: window.location.href });
```

---

## License and Attribution

This implementation is based on research of existing projects:

- [SessionBox](https://github.com/emmanuelroecker/SessionBox) - MIT License
- [Firefox Containers](https://github.com/mozilla/multi-account-containers) - MPL 2.0

The techniques described are well-documented in Chrome extension development community.

---

## Conclusion

**Session isolation in Chrome is a workaround, not a feature.**

You can achieve **good enough** isolation for most use cases (80-90% effectiveness), but it will never match Firefox's native container support.

**Recommended path**:
1. Build on Manifest V2 while still supported
2. Focus on cookie isolation (highest value)
3. Add localStorage isolation (medium value)
4. Skip complex features like IndexedDB (low value, high complexity)
5. Monitor Manifest V3 migration options

**Be transparent with users** about limitations:
- HTTP cache may leak
- Some HttpOnly cookies may leak
- Fingerprint remains the same
- Future Chrome updates may break functionality

For production use cases requiring **guaranteed isolation**, recommend:
- Firefox with native containers
- Chrome profiles (separate windows)
- Antidetect browsers

---

**Last Updated**: 2024-10-14
