# Multi-Session Manager - Quick Start Guide

## What is Multi-Session Manager?

Multi-Session Manager is a Chrome extension that allows you to run multiple isolated browsing sessions in different tabs. Each session has its own cookies and local storage, enabling you to:

- Log into the same website with different accounts simultaneously
- Test websites with different user states
- Separate work and personal browsing
- Prevent cross-session tracking

Think of it as "private browsing windows" but for individual tabs, with persistent storage.

---

## Installation

### From Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store](https://chrome.google.com/webstore) (link TBD)
2. Click "Add to Chrome"
3. Click "Add extension" in the confirmation dialog
4. The extension icon will appear in your toolbar

### From Source (Developer Mode)

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the extension directory (`my-multisession-extension`)
6. The extension icon will appear in your toolbar

---

## Basic Usage

### Creating Your First Session

1. Click the extension icon in your toolbar
2. The popup shows your current tab's session (default: "Default Session")
3. Click "New Session" button
4. A new session is created (e.g., "Session 2")
5. Your current tab switches to the new session
6. The page reloads with isolated storage

### Switching Between Sessions

1. Click the extension icon
2. In the "Switch Session" dropdown, select a different session
3. Click "Switch" button
4. The current tab switches to that session and reloads

### Example: Multiple Gmail Accounts

**Scenario:** You want to check two Gmail accounts simultaneously.

1. **Open Tab 1**, create "Work Email" session
   - Navigate to gmail.com
   - Log in with work@example.com

2. **Open Tab 2** (Ctrl+T), switch to "Default Session"
   - Navigate to gmail.com
   - Log in with personal@example.com

3. **Switch between tabs freely** - each maintains its own login!

### Example: Web Development Testing

**Scenario:** Testing how your website behaves for logged-in vs. logged-out users.

1. **Tab 1:** "Logged In User" session
   - Open your website
   - Log in as test user

2. **Tab 2:** "Logged Out User" session
   - Open your website
   - Browse as anonymous user

3. **Tab 3:** "Admin User" session
   - Open your website
   - Log in as admin

Compare behaviors side-by-side without logging in/out repeatedly.

---

## Use Cases

### 1. Multiple Accounts

**Problem:** Most websites only allow one logged-in account per browser.

**Solution:** Create a session per account.

```
Session 1: Twitter @personal_handle
Session 2: Twitter @work_handle
Session 3: Twitter @side_project_handle
```

### 2. E-commerce Testing

**Problem:** Testing shopping carts with different items.

**Solution:** Use separate sessions for different test scenarios.

```
Session 1: Guest user checkout flow
Session 2: Registered user with items in cart
Session 3: Registered user with empty cart
Session 4: User with promo code applied
```

### 3. Social Media Management

**Problem:** Managing multiple client accounts.

**Solution:** One session per client.

```
Session 1: Client A - Facebook
Session 2: Client B - Facebook
Session 3: Client C - Facebook
```

### 4. Privacy & Tracking Prevention

**Problem:** Websites track you across sessions.

**Solution:** Use different sessions for different types of browsing.

```
Session 1: Banking & Finance
Session 2: Shopping
Session 3: Social Media
Session 4: Work Research
```

### 5. Web Scraping & Automation

**Problem:** Need to test automation scripts with different user states.

**Solution:** Use sessions to maintain different states.

```
Session 1: New user onboarding flow
Session 2: Returning user flow
Session 3: Premium subscriber flow
```

---

## Features

### Complete Cookie Isolation

**What it does:**
- Intercepts all HTTP cookies (Set-Cookie headers)
- Intercepts all JavaScript cookie access (document.cookie)
- Stores cookies per-session in extension storage
- Injects session-specific cookies into HTTP requests

**What you see:**
- Log into Facebook in Session 1
- Log into Facebook with different account in Session 2
- Both stay logged in simultaneously

### Complete Storage Isolation

**What it does:**
- Intercepts localStorage and sessionStorage access
- Prefixes storage keys with session ID
- Transparent to websites (they don't know keys are prefixed)

**What you see:**
- App settings saved in Session 1 don't affect Session 2
- Shopping cart items in Session 1 separate from Session 2
- User preferences isolated per session

### Session Persistence

**What it does:**
- Sessions persist across browser restarts
- Cookies and storage saved automatically
- Tab-to-session mappings remembered

**What you see:**
- Close browser, reopen tabs
- Each tab remembers its session
- Cookies and storage restored automatically

### Session Management

**What it does:**
- Create unlimited sessions
- Rename sessions for easy identification
- Delete sessions (clears all associated data)
- View current tab's session

**What you see:**
- Organized list of sessions in popup
- Easy switching between sessions
- Clear indication of current session

---

## Troubleshooting

### Issue: Session not isolating cookies

**Symptoms:**
- Logging into account A in Session 1
- Session 2 also shows logged into account A

**Solutions:**
1. Check that the tab has reloaded after switching sessions
2. Clear browser cookies manually: Settings → Privacy → Clear browsing data → Cookies
3. Verify extension has required permissions: `chrome://extensions/` → Multi-Session Manager → Details → Permissions

### Issue: Storage not isolated

**Symptoms:**
- localStorage changes in Session 1 visible in Session 2

**Solutions:**
1. Ensure page has reloaded after switching sessions
2. Check console for errors: F12 → Console → Look for `[Storage Isolation]` messages
3. Verify content script is injected: F12 → Sources → Content scripts

### Issue: Session lost after browser restart

**Symptoms:**
- Create session, close browser, reopen
- Session is gone or data is lost

**Solutions:**
1. Check extension storage: F12 on extension popup → Application → Storage → Extension
2. Ensure sufficient storage quota: Check console for quota warnings
3. Verify chrome.storage permissions in extension manifest

### Issue: Website detects extension

**Symptoms:**
- Website shows error: "Please disable extensions"
- Website behaves differently with extension enabled

**Solutions:**
1. This is a limitation - some websites detect extensions
2. Try disabling extension for that specific site
3. Report issue to extension developers for potential workaround

### Issue: Extension icon not showing

**Solutions:**
1. Click puzzle icon in toolbar → Pin Multi-Session Manager
2. Restart Chrome
3. Reinstall extension

---

## Frequently Asked Questions

### Q: Does this extension sync sessions across devices?

**A:** Not currently. Sessions are stored locally per Chrome installation. This is a planned feature for a future release.

### Q: How many sessions can I create?

**A:** Theoretically unlimited, but chrome.storage.local has a ~5MB quota. Each session uses roughly 10-50KB depending on cookies/storage, so you can create approximately 100-500 sessions before hitting limits.

### Q: Does this work with Incognito mode?

**A:** No. The extension does not have access to Incognito windows by default. You can enable it in `chrome://extensions/` but session isolation already provides similar privacy benefits.

### Q: Can I export/import sessions?

**A:** Not currently. This feature is planned for a future release.

### Q: Does this protect against fingerprinting?

**A:** No. This extension only isolates cookies and storage. Browser fingerprinting (canvas, WebGL, fonts, etc.) is not affected. For fingerprinting protection, use extensions specifically designed for that purpose.

### Q: Will this work with Single Sign-On (SSO)?

**A:** Partially. OAuth tokens stored in cookies/localStorage will be isolated. However, some SSO implementations use other mechanisms (e.g., window.postMessage across domains) that may not be fully isolated.

### Q: Can I use this with other privacy extensions?

**A:** Yes, but test compatibility. Extensions that also modify cookies or storage may conflict. Recommended to disable other cookie-modifying extensions.

### Q: Does this extension collect any data?

**A:** No. All data is stored locally in your browser. The extension does not send any data to external servers.

### Q: What happens when I delete a session?

**A:**
1. Session is removed from extension storage
2. All cookies associated with that session are deleted
3. Storage keys (localStorage/sessionStorage) remain in browser storage but will be inaccessible
4. Tabs using that session are reassigned to "Default Session"

### Q: Can I use this for automation (Puppeteer, Selenium)?

**A:** Yes, but requires additional setup to load the extension in your automation framework. This is an advanced use case - see IMPLEMENTATION.md for details.

---

## Limitations

### 1. IndexedDB Not Isolated

**Current Status:** IndexedDB is not isolated between sessions.

**Impact:** Websites using IndexedDB for storage may share data across sessions.

**Workaround:** Manually clear IndexedDB: F12 → Application → IndexedDB → Delete

**Planned:** Full IndexedDB isolation in future release.

### 2. Service Workers Not Isolated

**Current Status:** Service Workers are not isolated between sessions.

**Impact:** Push notifications, background sync, and cached responses may be shared across sessions.

**Workaround:** Unregister service workers manually: F12 → Application → Service Workers → Unregister

**Planned:** Service Worker isolation in future release.

### 3. WebSockets Not Isolated

**Current Status:** WebSocket connections don't carry session information.

**Impact:** Real-time features (chat, live updates) may not respect session isolation.

**Workaround:** None currently. Avoid using sessions for WebSocket-heavy apps.

**Planned:** WebSocket proxying in future release (requires server-side support).

### 4. HTTP Authentication

**Current Status:** HTTP Basic/Digest authentication headers not isolated.

**Impact:** Websites using HTTP auth may share credentials across sessions.

**Workaround:** Use websites that use cookie-based authentication instead.

**Planned:** HTTP auth header isolation in future release.

### 5. Client Certificates

**Current Status:** Client certificate selection not isolated.

**Impact:** Websites requiring client certificates will use the same certificate for all sessions.

**Workaround:** None currently.

**Planned:** Not planned (OS-level limitation).

### 6. DNS Cache

**Current Status:** DNS cache is shared across sessions.

**Impact:** Minimal. DNS lookups may reveal browsing history across sessions.

**Workaround:** None.

**Planned:** Not planned (browser limitation).

---

## Tips & Best Practices

### 1. Name Your Sessions

**Why:** Makes switching sessions easier.

**How:**
1. Click extension icon
2. In session dropdown, select session
3. Click "Rename" button (if available)
4. Enter descriptive name: "Work Gmail", "Personal Twitter", etc.

### 2. Use Default Session Wisely

**Why:** Default session is always available and never deleted.

**Recommendation:** Use default session for general browsing, create specific sessions for accounts.

### 3. Close Unused Sessions

**Why:** Reduces clutter and frees storage.

**How:**
1. Ensure no tabs are using the session
2. Click extension icon
3. Click "Delete" button next to session

### 4. Check Current Session

**Why:** Prevents accidentally performing actions in wrong session.

**How:** Click extension icon before logging in or making purchases.

### 5. Reload After Switching

**Why:** Ensures session switch takes effect.

**How:** Extension auto-reloads, but if something seems wrong, manually reload (Ctrl+R).

### 6. Use for Testing

**Why:** Quickly test different user scenarios.

**How:** Create sessions like:
- "Guest User"
- "Logged In User"
- "Admin User"
- "Premium Subscriber"

### 7. Organize by Purpose

**Good:**
- "Banking"
- "Shopping"
- "Social Media"

**Bad:**
- "Session 1"
- "Session 2"
- "Session 3"

### 8. Monitor Storage Usage

**Why:** Avoid hitting storage quota.

**How:**
1. Open extension popup
2. Check storage indicator (if available)
3. Delete old sessions periodically

---

## Keyboard Shortcuts (Future Feature)

Currently not available, but planned for future release:

- `Alt+Shift+N` - Create new session
- `Alt+Shift+S` - Open session switcher
- `Alt+Shift+1-9` - Quick switch to session 1-9

---

## Getting Help

### Check Console Logs

1. Open DevTools: F12
2. Go to Console tab
3. Look for messages tagged with:
   - `[Storage Isolation]`
   - `[Cookie Isolation]`
   - `[Cookie Isolation - Page]`
   - `[Background]`

These logs show what the extension is doing.

### Inspect Extension Background Page

1. Navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Find "Multi-Session Manager"
4. Click "Inspect views: background page"
5. Check console for errors

### Report Issues

If you encounter bugs:

1. **Collect information:**
   - Chrome version: `chrome://version/`
   - Extension version: `chrome://extensions/`
   - Steps to reproduce
   - Console logs (if any errors)

2. **Submit issue on GitHub** (link TBD)

---

## Privacy & Security

### What Data is Stored?

**Locally in your browser:**
- Session names and IDs
- Cookies per session
- Tab-to-session mappings

**Not stored anywhere:**
- Browsing history
- Passwords (handled by Chrome's password manager)
- Actual website content

### Data Access

- Extension has access to all website data (required for cookie/storage isolation)
- Extension does NOT transmit any data externally
- All data stays in your browser

### Permissions Explained

**Storage:** Store session data locally

**Tabs:** Detect tab changes and reload tabs

**webRequest:** Intercept HTTP requests to inject session cookies

**<all_urls>:** Access all websites to inject content scripts

---

## Uninstallation

### Complete Removal

1. Navigate to `chrome://extensions/`
2. Find "Multi-Session Manager"
3. Click "Remove"
4. Confirm removal

### What Gets Deleted

- Extension code
- Extension storage (all sessions)
- Tab-to-session mappings

### What Remains

- localStorage/sessionStorage keys with `__SID_` prefix
- These are harmless and will be ignored by websites
- Optional: Clear browsing data to remove them

### Manual Cleanup (Optional)

To remove all traces:

1. Navigate to any website
2. Open DevTools: F12
3. Go to Console
4. Run:
```javascript
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('__SID_')) {
    localStorage.removeItem(key);
  }
});
```

---

## Changelog

### Version 1.0.0 (Current)

**Features:**
- Complete cookie isolation (HTTP + JavaScript)
- Complete localStorage/sessionStorage isolation
- Session creation, switching, and deletion
- Persistent sessions across browser restarts
- Popup UI for session management

**Known Issues:**
- IndexedDB not isolated
- Service Workers not isolated
- WebSockets not isolated

**Planned for 1.1.0:**
- Session renaming in UI
- Session export/import
- Keyboard shortcuts
- Storage quota indicator

---

## Support

For questions, feature requests, or bug reports:

- **GitHub Issues:** [repository link]
- **Email:** [support email]
- **Documentation:** See IMPLEMENTATION.md for technical details

---

## License

[License information]

---

## Acknowledgments

Built with:
- Chrome Extension Manifest V3
- ES6 Proxy API
- Chrome Storage API
- Chrome WebRequest API

Inspired by Firefox's Multi-Account Containers.

---

**Happy multi-session browsing!**
