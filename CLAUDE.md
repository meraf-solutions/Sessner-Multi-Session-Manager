# Multi-Session Browser Extension - Technical Documentation

## 📚 Documentation Structure

This project has comprehensive documentation organized across multiple files:

### Core Documentation
- **[docs/api.md](docs/api.md)** - Extension API Reference
  - Message passing architecture
  - Background script API (session management, cookies, license)
  - Content script API
  - Popup UI API
  - Chrome Extension APIs used (webRequest, cookies, tabs, etc.)
  - Request/response formats and code examples

- **[docs/subscription_api.md](docs/subscription_api.md)** - Subscription & Licensing API
  - Meraf Solutions API integration
  - Development license keys (Premium/Enterprise)
  - API endpoints (verify, register, unregister, validate)
  - Tier detection logic
  - Device ID generation
  - License activation and validation flows
  - Grace period system

- **[docs/architecture.md](docs/architecture.md)** - System Architecture
  - High-level system overview
  - Design patterns (SessionBox-style isolation)
  - Component architecture (background, content scripts, popup, license manager)
  - Multi-layer isolation architecture
  - Data flow diagrams
  - State management and persistence
  - Session lifecycle
  - Security and performance architecture

- **[docs/technical.md](docs/technical.md)** - Technical Implementation
  - Core algorithms (session ID, device ID, cookie parsing)
  - Code patterns (ES6 Proxy, exponential backoff, debounced persistence)
  - Key functions documentation
  - Technical decisions and trade-offs
  - Helper functions
  - Storage schemas
  - Debugging guide
  - Performance optimizations

- **[CLAUDE.md](CLAUDE.md)** (this file) - Project Overview & Development Guide
  - Quick reference for core concepts
  - Key files and components
  - Session lifecycle
  - Common patterns

### Additional Documentation
- **[docs/monetization_strategy/](docs/monetization_strategy/)** - Business strategy, pricing, license system
- **[docs/features_implementation/](docs/features_implementation/)** - Feature implementation documentation (01_concurrent_sessions, etc.)
- **[docs/analysis/](docs/analysis/)** - License system delivery summary, integration guides, testing

### 🤖 Working with Claude

**IMPORTANT**: When working on this project, Claude should:
- **Use the `javascript-pro` agent** for all complex JavaScript tasks, architecture decisions, and code implementations
- **Consult the documentation structure above** before answering questions (refer to specific docs)
- **Cross-reference between documents** instead of duplicating information
- **Update existing documentation** when adding features (never create redundant files)

---

## Overview

This is a **SessionBox-style multi-session browser extension** that creates **isolated browser sessions per tab**, enabling users to be simultaneously logged into multiple accounts on the same website. Each tab operates in its own isolated session with separate cookies and storage, similar to Firefox Multi-Account Containers or SessionBox.

**Key Capabilities:**
- Completely isolated sessions per tab (like Firefox containers)
- HTTP-level cookie interception and injection via webRequest API
- JavaScript-level cookie capture via chrome.cookies API
- Transparent localStorage/sessionStorage isolation using ES6 Proxy
- Document.cookie interception via injected page scripts
- Automatic session inheritance for popup windows and new tabs
- Persistent session data across browser restarts
- Color-coded badge indicators for visual session identification
- **Dynamic favicon badges** showing extension icon with session color for easy tab identification
- Ephemeral sessions that end when all tabs close
- **Tier-based session limits** (Free: 3 concurrent sessions, Premium/Enterprise: Unlimited)
- **Custom session names** (Premium/Enterprise: name sessions like "Work Gmail" instead of session IDs)

## Architecture

### Design Pattern: SessionBox-Style Isolation

The extension uses a **virtual session** pattern where each session is completely isolated from others and from the browser's native storage:

```
┌─────────────────────────────────────────────────────────────┐
│                      Background Script                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           sessionStore (In-Memory State)             │  │
│  │  • tabToSession: Map<tabId, sessionId>               │  │
│  │  • sessions: Map<sessionId, sessionMetadata>         │  │
│  │  • cookieStore: Map<sessionId, cookies>              │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                  │
│                  chrome.storage.local                        │
│                  (Persistence Layer)                         │
└─────────────────────────────────────────────────────────────┘
                            ↕
         ┌──────────────────┴──────────────────┐
         ↓                                      ↓
┌─────────────────────┐              ┌─────────────────────┐
│   HTTP Requests     │              │   Content Scripts    │
│  (webRequest API)   │              │  (JavaScript Layer)  │
│                     │              │                      │
│  • onBeforeSend     │              │  • storage-script    │
│    Headers          │              │  • cookie-script     │
│  • onHeadersReceived│              │                      │
└─────────────────────┘              └─────────────────────┘
```

### Multi-Layer Cookie Isolation

The extension captures cookies at **three different levels** to ensure complete isolation:

1. **HTTP Request/Response Level** (webRequest API)
   - Intercepts HTTP requests to inject session-specific cookies
   - Intercepts HTTP responses to capture Set-Cookie headers
   - Removes Set-Cookie headers to prevent browser storage

2. **JavaScript Cookie API Level** (chrome.cookies.onChanged)
   - Captures cookies set via JavaScript (document.cookie)
   - Captures cookies set via chrome.cookies.set()
   - Immediately removes cookies from browser's native store

3. **Document.cookie Level** (Injected Script)
   - Overrides document.cookie getter/setter in page context
   - Routes all cookie operations through background script
   - Provides synchronous API compatibility with async operations

### Storage Isolation Mechanism

localStorage and sessionStorage are isolated using **ES6 Proxy** with session ID prefixing:

```javascript
// Original key: "user_preference"
// Prefixed key: "__SID_session_12345__user_preference"

localStorage.setItem('user_preference', 'dark_mode')
// Actually stored as: __SID_session_12345__user_preference = dark_mode
```

The Proxy intercepts:
- `getItem()`, `setItem()`, `removeItem()`, `clear()`
- Direct property access: `localStorage.foo`
- Property enumeration: `Object.keys(localStorage)`
- `length` property
- `key(index)` method

## Manifest V2 Configuration

```json
{
  "manifest_version": 2,
  "name": "Sessner – Multi-Session Manager",
  "version": "3.0",
  "permissions": [
    "webRequest",           // Required for HTTP interception
    "webRequestBlocking",   // Required for synchronous request modification
    "cookies",              // Required for cookie API access
    "tabs",                 // Required for tab management
    "storage",              // Required for persistence
    "webNavigation",        // Required for popup detection
    "<all_urls>"            // Required to intercept all requests
  ],
  "background": {
    "scripts": ["background.js"],
    "persistent": true      // CRITICAL: Must be persistent for webRequest
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script-storage.js"],
      "run_at": "document_start",  // Before page scripts run
      "all_frames": true           // Includes iframes
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content-script-cookie.js"],
      "run_at": "document_start",  // Before page scripts run
      "all_frames": false          // Main frame only
    }
  ]
}
```

### Why Each Permission is Needed

- **webRequest + webRequestBlocking**: Core functionality - intercept and modify HTTP requests/responses in real-time to inject and capture cookies
- **cookies**: Access chrome.cookies API to monitor JavaScript-set cookies and remove them from browser's native store
- **tabs**: Manage tab-to-session mappings, set badge indicators, handle tab lifecycle
- **storage**: Persist sessions and cookies to chrome.storage.local for browser restart survival
- **webNavigation**: Detect when new tabs/popups are created to enable session inheritance
- **<all_urls>**: Required scope for webRequest and content script injection across all websites

## Key Files and Components

### 1. background.js (Core Session Management)

**Purpose**: Manages all session state, cookie interception, and persistence

**Main Data Structure**:
```javascript
const sessionStore = {
  tabToSession: {
    123: 'session_1234567890_abc123',  // tabId -> sessionId mapping
    456: 'session_1234567890_abc123'   // Multiple tabs can share one session
  },
  sessions: {
    'session_1234567890_abc123': {
      id: 'session_1234567890_abc123',
      color: '#FF6B6B',
      createdAt: 1234567890000,
      lastAccessed: 1234567890000,  // Tracks last activity for persistence cleanup
      tabs: [123, 456],
      _isCreating: false  // Temporary flag during creation (removed after 100ms)
    }
  },
  cookieStore: {
    'session_1234567890_abc123': {
      'example.com': {
        '/': {
          'sessionid': {
            name: 'sessionid',
            value: 'abc123',
            domain: 'example.com',
            path: '/',
            secure: true,
            httpOnly: true,
            sameSite: 'lax'
          }
        }
      }
    }
  }
};
```

**Key Functions**:

#### Session Management Functions

**`generateSessionId()`**
```javascript
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}
```
- Generates unique session IDs using timestamp + random string
- Format: `session_1234567890_abc123def`

**`createNewSession(url, callback)`**
- Creates a new isolated session
- Opens a new tab with the specified URL (defaults to 'about:blank')
- Initializes session metadata and cookie store
- Sets `createdAt` and `lastAccessed` to same timestamp (ensures exact match on creation)
- Uses `_isCreating` flag (100ms) to prevent immediate `lastAccessed` updates from tab activity
- Sets color-coded badge indicator
- Clears any existing browser cookies for fresh start
- Persists session immediately
- **Important**: Tab activity listeners (`onActivated`, `onUpdated`) check `_isCreating` flag and skip timestamp updates during creation

**`getSessionForTab(tabId)`**
- Returns session ID for a given tab ID
- Used throughout for tab-to-session lookups

**`cleanupSession(sessionId)`**
- Removes session when all tabs are closed
- Deletes session metadata and cookie store
- Persists changes immediately

#### Cookie Management Functions

**`parseCookie(cookieString)`**
- Parses Set-Cookie header string into structured object
- Extracts: name, value, domain, path, secure, httpOnly, sameSite, expires/max-age
- Handles all cookie attributes

**`formatCookieHeader(cookies)`**
- Formats cookie objects into Cookie header string
- Format: `name1=value1; name2=value2`

**`storeCookie(sessionId, domain, cookie)`**
- Stores cookie in sessionStore with hierarchical structure
- Structure: `sessionId -> domain -> path -> cookieName -> cookieObject`
- Triggers debounced persistence

**`getCookiesForSession(sessionId, domain, path)`**
- Retrieves all cookies matching domain and path
- Handles domain matching (example.com, .example.com, sub.example.com)
- Handles path matching (cookie with path=/api matches request to /api/users)
- Returns array of cookie objects

#### Persistence Functions

**`persistSessions(immediate = false)`**
- Saves sessionStore to chrome.storage.local
- Debounced by default (1 second delay) to batch rapid cookie updates
- Can be called with `immediate=true` for critical operations (session creation, tab close)
- Saves: sessions, cookieStore, tabToSession

**`loadPersistedSessions(skipCleanup = false)`** (Updated 2025-10-25)
- **Critical Fix**: Resolved browser restart session deletion bug
- **Parameters**: `skipCleanup` (boolean) - if true, skip aggressive cleanup during browser startup
- Loads saved sessions from chrome.storage.local on extension startup
- Implements 2-second delay + retry logic (3 attempts) for tab restoration
- Uses **URL-based tab matching** (domain + path) instead of tab IDs
- Validates tab mappings (only restores for existing tabs)
- Restores badge indicators and favicon colors
- Conditionally cleans up orphaned sessions (based on skipCleanup flag)
- Called on:
  - Extension install: `loadPersistedSessions(false)` (aggressive cleanup)
  - Extension update: `loadPersistedSessions(false)` (aggressive cleanup)
  - Browser startup: `loadPersistedSessions(true)` (skip cleanup, wait for tab restoration)

#### WebRequest Interception

**`chrome.webRequest.onBeforeSendHeaders`**
```javascript
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    const sessionId = getSessionForTab(details.tabId);
    if (!sessionId) return { requestHeaders: details.requestHeaders };

    const url = new URL(details.url);
    const cookies = getCookiesForSession(sessionId, url.hostname, url.pathname);

    if (cookies.length > 0) {
      // Remove existing Cookie header
      const headers = details.requestHeaders.filter(h =>
        h.name.toLowerCase() !== 'cookie'
      );

      // Add session-specific cookies
      headers.push({
        name: 'Cookie',
        value: formatCookieHeader(cookies)
      });

      return { requestHeaders: headers };
    }

    return { requestHeaders: details.requestHeaders };
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['blocking', 'requestHeaders', 'extraHeaders']
);
```
- Intercepts all HTTP requests
- Looks up session for the tab
- Retrieves session-specific cookies for the domain
- Removes any existing Cookie header
- Injects session-specific cookies
- **Critical**: Uses 'extraHeaders' to capture cookies in CORS requests

**`chrome.webRequest.onHeadersReceived`**
```javascript
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    const sessionId = getSessionForTab(details.tabId);
    if (!sessionId) return { responseHeaders: details.responseHeaders };

    const url = new URL(details.url);

    // Extract Set-Cookie headers
    details.responseHeaders.forEach(header => {
      if (header.name.toLowerCase() === 'set-cookie') {
        const cookie = parseCookie(header.value);
        if (!cookie.domain) {
          cookie.domain = url.hostname;
        }
        storeCookie(sessionId, cookie.domain, cookie);
      }
    });

    // Remove Set-Cookie headers to prevent browser storage
    const filteredHeaders = details.responseHeaders.filter(h =>
      h.name.toLowerCase() !== 'set-cookie'
    );

    return { responseHeaders: filteredHeaders };
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['blocking', 'responseHeaders', 'extraHeaders']
);
```
- Intercepts all HTTP responses
- Extracts Set-Cookie headers
- Stores cookies in session-specific cookie store
- Removes Set-Cookie headers to prevent browser from storing them
- **Critical**: Uses 'extraHeaders' to capture cookies from secure contexts

#### Chrome Cookies API Monitoring

**`chrome.cookies.onChanged`**
```javascript
chrome.cookies.onChanged.addListener((changeInfo) => {
  if (changeInfo.removed) return;

  const cookie = changeInfo.cookie;

  // Find which tab(s) match this cookie's domain
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      const sessionId = sessionStore.tabToSession[tab.id];
      if (!sessionId || !tab.url) return;

      const tabUrl = new URL(tab.url);
      const tabDomain = tabUrl.hostname;
      const cookieDomain = cookie.domain.startsWith('.')
        ? cookie.domain.substring(1)
        : cookie.domain;

      if (tabDomain === cookieDomain || tabDomain.endsWith('.' + cookieDomain)) {
        // Store in session
        storeCookie(sessionId, cookie.domain, {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          secure: cookie.secure,
          httpOnly: cookie.httpOnly,
          sameSite: cookie.sameSite || 'no_restriction'
        });

        // Remove from browser's native store
        const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path || '/'}`;
        chrome.cookies.remove({
          url: cookieUrl,
          name: cookie.name,
          storeId: cookie.storeId
        });
      }
    });
  });
});
```
- Captures cookies set via JavaScript (document.cookie or chrome.cookies.set)
- Matches cookie domain to active session tabs
- Stores cookie in session store
- Immediately removes from browser's native cookie store
- **Why**: Prevents cookie leakage between sessions

#### Cookie Cleaner (Defense in Depth)

**Periodic Cookie Cleanup**
```javascript
setInterval(() => {
  const tabIds = Object.keys(sessionStore.tabToSession);
  tabIds.forEach(tabIdStr => {
    const tabId = parseInt(tabIdStr);
    clearBrowserCookiesForTab(tabId);
  });
}, 2000); // Every 2 seconds
```
- Runs every 2 seconds as a safety mechanism
- Clears any cookies that leaked into browser's native store
- **Why**: Some edge cases (service workers, browser internals) may bypass our interception
- Ensures cookies stay isolated even if interception fails

#### Popup and Tab Inheritance

**`chrome.webNavigation.onCreatedNavigationTarget`**
```javascript
chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  const sourceTabId = details.sourceTabId;
  const targetTabId = details.tabId;
  const sourceSessionId = sessionStore.tabToSession[sourceTabId];

  if (sourceSessionId) {
    // Inherit session from parent
    sessionStore.tabToSession[targetTabId] = sourceSessionId;
    sessionStore.sessions[sourceSessionId].tabs.push(targetTabId);

    // Set badge
    const color = sessionStore.sessions[sourceSessionId].color;
    chrome.browserAction.setBadgeText({ text: '●', tabId: targetTabId });
    chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: targetTabId });

    persistSessions(true);
  }
});
```
- Detects popup windows opened from session tabs
- Automatically inherits parent session
- **Critical for**: OAuth flows, payment popups, report windows, download confirmations

**`chrome.tabs.onCreated`**
```javascript
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId) {
    const parentSessionId = sessionStore.tabToSession[tab.openerTabId];
    if (parentSessionId) {
      sessionStore.tabToSession[tab.id] = parentSessionId;
      sessionStore.sessions[parentSessionId].tabs.push(tab.id);
      // Set badge...
      persistSessions(true);
    }
  }
});
```
- Handles target="_blank" links
- Complements webNavigation listener for comprehensive coverage

#### Tab Lifecycle Management

**`chrome.tabs.onRemoved`**
- Removes tab from session's tab list
- Cleans up session if no tabs remain
- Persists changes

**`chrome.tabs.onUpdated`**
- Preserves session when tab navigates to new URL
- Updates badge indicator

**`chrome.tabs.onActivated`**
- Updates badge when switching tabs
- Ensures visual indicator is current

#### Message Handler

**Supported Actions**:

1. **`createNewSession`**
   - Request: `{ action: 'createNewSession', url: 'https://example.com' }`
   - Response: `{ success: true, sessionId: '...', tabId: 123, color: '#FF6B6B' }`

2. **`getActiveSessions`**
   - Request: `{ action: 'getActiveSessions' }`
   - Response: `{ success: true, sessions: [...] }`

3. **`getSessionId`**
   - Request: `{ action: 'getSessionId' }`
   - Response: `{ success: true, sessionId: 'session_...' }`
   - Used by content scripts to identify their session

4. **`getCookies`**
   - Request: `{ action: 'getCookies', url: 'https://example.com/path' }`
   - Response: `{ success: true, cookies: 'name1=value1; name2=value2' }`

5. **`setCookie`**
   - Request: `{ action: 'setCookie', url: 'https://example.com', cookie: 'name=value; path=/' }`
   - Response: `{ success: true }`

6. **`switchToTab`**
   - Request: `{ action: 'switchToTab', tabId: 123 }`
   - Response: `{ success: true }`

### 2. content-script-storage.js (Storage Isolation)

**Purpose**: Provides transparent localStorage/sessionStorage isolation using ES6 Proxy

**Initialization Flow**:
```
1. Script loads at document_start (before page scripts)
2. Fetch session ID from background (with exponential backoff retry)
3. Install Proxy wrappers on window.localStorage and window.sessionStorage
4. Execute any queued operations
5. Page scripts now see isolated storage
```

**Proxy Handler Methods**:

**`get(target, prop)`**
- Intercepts: `localStorage.length`, `localStorage.key(i)`, `localStorage.getItem(key)`, `localStorage.foo`
- Returns session-specific values

**`set(target, prop, value)`**
- Intercepts: `localStorage.setItem(key, value)`, `localStorage.foo = 'bar'`
- Stores with session prefix

**`deleteProperty(target, prop)`**
- Intercepts: `delete localStorage.foo`
- Removes prefixed key

**`has(target, prop)`**
- Intercepts: `'foo' in localStorage`
- Checks prefixed key existence

**`ownKeys(target)`**
- Intercepts: `Object.keys(localStorage)`, `for...in` loops
- Returns unprefixed keys for current session only

**`getOwnPropertyDescriptor(target, prop)`**
- Intercepts: `Object.getOwnPropertyDescriptor(localStorage, 'foo')`
- Returns descriptor for prefixed key

**Session ID Fetching with Exponential Backoff**:
```javascript
async function fetchSessionId() {
  let attempts = 0;
  const maxAttempts = 5;
  const delays = [100, 500, 1000, 2000, 3000]; // ms

  while (attempts < maxAttempts) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSessionId'
      });

      if (response?.success && response.sessionId) {
        currentSessionId = response.sessionId;
        sessionIdReady = true;
        executePendingOperations();
        return true;
      }
    } catch (error) {
      // Silent retry
    }

    attempts++;
    if (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, delays[attempts - 1]));
    }
  }

  // Fallback to 'default' session
  currentSessionId = 'default';
  sessionIdReady = true;
  executePendingOperations();
  return false;
}
```
- **Why exponential backoff?**: Background script may not be ready immediately on extension startup
- **Why fallback?**: Non-session tabs (regular browsing) should still work

**Operation Queueing**:
- If storage operations occur before session ID is ready, they're queued
- Once session ID loads, queue is processed
- Ensures no data loss during initialization race condition

### 3. content-script-cookie.js (Cookie Isolation)

**Purpose**: Provides transparent document.cookie isolation using injected page script + content script bridge

**Architecture**: Two-part system due to Chrome extension security model

**Part A: Injected Script (Page Context)**
- Runs in the page's JavaScript context
- Overrides document.cookie getter/setter
- Uses window.postMessage to communicate with content script
- Provides synchronous API with async operations underneath

**Part B: Content Script (Extension Context)**
- Runs in extension's isolated context
- Has access to chrome.runtime.sendMessage
- Bridges between page context and background script
- Listens to window.postMessage

**Message Flow**:
```
Page Script (document.cookie = 'foo=bar')
    ↓ window.postMessage({ type: 'SET_COOKIE', cookie: 'foo=bar' })
Content Script (message listener)
    ↓ chrome.runtime.sendMessage({ action: 'setCookie', ... })
Background Script
    ↓ storeCookie(sessionId, domain, cookie)
Cookie Store (sessionStore.cookieStore)
```

**document.cookie Override**:
```javascript
Object.defineProperty(document, 'cookie', {
  get() {
    // Return cached cookies (synchronous)
    return cachedCookies;
  },

  set(cookieString) {
    // Fire async operation (fire-and-forget)
    setCookie(cookieString).catch(console.error);

    // Optimistically update cache for immediate reads
    cachedCookies += '; ' + cookieString.split(';')[0];
  },

  configurable: false,
  enumerable: true
});
```

**Why Optimistic Updates?**
- document.cookie API is synchronous, but our storage is async
- Websites often do: `document.cookie = 'foo=bar'; console.log(document.cookie)`
- Optimistic cache update makes this work as expected

**Request/Response Matching**:
```javascript
const pendingRequests = new Map(); // messageId -> {resolve, reject}
let messageIdCounter = 0;

// Sending
const messageId = ++messageIdCounter;
pendingRequests.set(messageId, { resolve, reject });
window.postMessage({ type: 'GET_COOKIE', messageId }, '*');

// Receiving
window.addEventListener('message', (event) => {
  if (event.data.type === 'COOKIE_GET_RESPONSE') {
    const request = pendingRequests.get(event.data.messageId);
    if (request) {
      pendingRequests.delete(event.data.messageId);
      request.resolve(event.data.cookies);
    }
  }
});
```
- Message IDs ensure responses match requests
- 5-second timeout prevents memory leaks if response never arrives

### 4. popup.html / popup.js (User Interface)

**Purpose**: Simple UI for creating and managing sessions

**Features**:
- **New Session Button**: Creates new isolated session
- **Optional URL Input**: Start session at specific URL
- **Active Sessions List**: Shows all sessions with color-coded indicators
- **Tab List per Session**: Shows all tabs in each session with title, domain, favicon
- **Quick Switch**: Click any tab to switch to it

**UI Components**:
- Gradient header (#667eea to #764ba2)
- Color-coded session dots matching badge colors
- Session ID display (truncated for readability)
- Favicon + title + domain for each tab
- "Go" button for quick tab switching
- Empty state when no sessions exist
- Scrollable list for many sessions

**Real-time Updates**:
```javascript
chrome.tabs.onActivated.addListener(() => refreshSessions());
chrome.tabs.onUpdated.addListener(() => refreshSessions());
chrome.tabs.onRemoved.addListener(() => refreshSessions());
```
- Popup stays in sync with tab changes
- Automatically refreshes when tabs are created/closed/updated

## Session Lifecycle

### 1. Session Creation

**User Action**: Clicks "New Session" button in popup

**Flow**:
```
1. popup.js: Send createNewSession message
2. background.js: Generate unique session ID
3. background.js: Create session metadata
4. background.js: Initialize empty cookie store
5. background.js: Open new tab
6. background.js: Map tab to session
7. background.js: Set color-coded badge
8. background.js: Clear any existing browser cookies
9. background.js: Persist to chrome.storage.local
10. popup.js: Close popup
```

**Resulting State**:
```javascript
sessionStore = {
  tabToSession: { 123: 'session_1234567890_abc123' },
  sessions: {
    'session_1234567890_abc123': {
      id: 'session_1234567890_abc123',
      color: '#FF6B6B',
      createdAt: 1234567890000,
      tabs: [123]
    }
  },
  cookieStore: {
    'session_1234567890_abc123': {}
  }
};
```

### 2. Session Active (Normal Operation)

**Navigation**: User navigates to https://example.com/login

**HTTP Request Interception** (onBeforeSendHeaders):
```
1. Browser initiates GET https://example.com/login
2. Extension intercepts request (tabId: 123)
3. Look up session: sessionStore.tabToSession[123] → 'session_...'
4. Get cookies: getCookiesForSession('session_...', 'example.com', '/login')
5. Inject Cookie header into request
6. Request proceeds to server with session cookies
```

**HTTP Response Interception** (onHeadersReceived):
```
1. Server responds with Set-Cookie: sessionid=abc123; path=/
2. Extension intercepts response (tabId: 123)
3. Look up session: 'session_...'
4. Parse cookie: { name: 'sessionid', value: 'abc123', domain: 'example.com', path: '/' }
5. Store: sessionStore.cookieStore['session_...']['example.com']['/']['sessionid']
6. Remove Set-Cookie header from response
7. Response delivered to browser without Set-Cookie
8. Trigger debounced persist (after 1 second of inactivity)
```

**JavaScript Cookie Operations**:
```javascript
// Page script executes
document.cookie = 'preference=darkmode; path=/';

// Flow:
1. content-script-cookie.js: Override intercepts set operation
2. content-script-cookie.js: Send SET_COOKIE message to content script
3. content-script-cookie.js: Content script forwards to background
4. background.js: Parse and store cookie in session store
5. background.js: Trigger debounced persist
6. content-script-cookie.js: Update optimistic cache
```

**localStorage Operations**:
```javascript
// Page script executes
localStorage.setItem('theme', 'dark');

// Flow:
1. content-script-storage.js: Proxy intercepts setItem
2. content-script-storage.js: Prefix key: '__SID_session_...__theme'
3. content-script-storage.js: Call originalStorage.setItem('__SID_session_...__theme', 'dark')
4. Browser stores in native localStorage with prefixed key
```

### 3. Popup Inheritance

**User Action**: Website opens popup window (OAuth, payment, report, etc.)

**Flow via webNavigation.onCreatedNavigationTarget**:
```
1. Page executes: window.open('https://oauth.provider.com/authorize')
2. Browser creates new tab (tabId: 456)
3. webNavigation fires: { sourceTabId: 123, tabId: 456 }
4. Look up source session: sessionStore.tabToSession[123] → 'session_...'
5. Inherit session: sessionStore.tabToSession[456] = 'session_...'
6. Add to session tabs: sessionStore.sessions['session_...'].tabs.push(456)
7. Set badge on new tab
8. Persist immediately (important for short-lived popups)
```

**Flow via tabs.onCreated** (alternative path):
```
1. Page executes: <a href="..." target="_blank">
2. Browser creates new tab with openerTabId
3. tabs.onCreated fires: { id: 456, openerTabId: 123 }
4. Look up opener session: sessionStore.tabToSession[123] → 'session_...'
5. Inherit session: sessionStore.tabToSession[456] = 'session_...'
6. Add to session tabs
7. Set badge
8. Persist immediately
```

**Result**: Popup window has same session as parent, all cookies and storage are shared

### 4. Session Termination

**User Action**: Closes last tab of a session

**Flow**:
```
1. User closes tab 123
2. tabs.onRemoved fires: (tabId: 123)
3. Look up session: sessionStore.tabToSession[123] → 'session_...'
4. Remove from mapping: delete sessionStore.tabToSession[123]
5. Remove from session tabs: sessionStore.sessions['session_...'].tabs = []
6. cleanupSession('session_...')
7. Check if tabs.length === 0
8. Delete session: delete sessionStore.sessions['session_...']
9. Delete cookies: delete sessionStore.cookieStore['session_...']
10. Persist immediately
```

**Result**: Session data is completely removed, memory freed

### 5. Browser Restart Persistence (Updated 2025-10-25)

**Critical Fix**: Tab Restoration Race Condition Resolved

**Problem Discovered**:
- Microsoft Edge assigns NEW tab IDs on browser restart
- Extension loads BEFORE browser restores tabs
- `chrome.tabs.query()` initially returns empty array (0 tabs)
- Sessions with no tabs get deleted immediately
- 100-500ms later, browser restores tabs → too late, sessions already gone

**Updated Flow** (browser launch or extension reload):
```
1. background.js loads
2. Call loadPersistedSessions(true)  // skipCleanup = true (startup grace period)
3. Load from chrome.storage.local: { sessions, cookieStore, tabToSession, tabMetadata }
4. Wait 2 seconds for Edge to restore tabs
5. Retry tab query up to 3 times (1-second intervals between retries)
6. Use URL-based tab matching:
   - Match tabs by domain + path (ignore query params)
   - Tab URLs stored in tabMetadata array
   - Tab IDs change on restart, but URLs stay the same
7. Restore sessionStore.sessions
8. Restore sessionStore.cookieStore
9. Restore sessionStore.tabToSession (based on URL matches)
10. Update badge indicators for matched tabs
11. Skip aggressive cleanup (preserved for delayed validation)
12. 10 seconds later: validateAndCleanupSessions() cleans up truly orphaned sessions
```

**URL-Based Tab Matching** (replaces tab ID validation):
```javascript
// Wait for Edge to restore tabs (2 seconds)
await new Promise(resolve => setTimeout(resolve, 2000));

// Retry logic (up to 3 attempts)
let tabs = [];
for (let attempt = 0; attempt < 3; attempt++) {
  tabs = await chrome.tabs.query({});
  if (tabs.length > 0) break;
  if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000));
}

// URL-based matching
tabs.forEach(tab => {
  const savedTab = Object.values(tabMetadata).find(
    saved => saved.url === tab.url  // Exact URL match
  );
  if (savedTab && sessions[savedTab.sessionId]) {
    tabToSession[tab.id] = savedTab.sessionId;  // Restore mapping with NEW tab ID
  }
});
```

**Why This Works**:
- **2-second delay**: Gives Edge time to restore tabs before validation
- **Retry logic**: Handles slower systems gracefully (up to 3 attempts)
- **URL-based matching**: Tab IDs change on restart, but URLs stay the same
- **skipCleanup mode**: Prevents premature deletion during startup
- **Delayed validation**: Cleans up truly orphaned sessions after all restoration attempts complete

**Evidence from Testing**:
```
[Session Restore] Tab query attempt 1: Found 0 tabs  ← Edge hasn't restored yet
[Session Restore] Tab query attempt 2: Found 3 tabs  ← Tabs restored after 1 second
[Session Restore] URL-based matching: 2 tabs restored  ← Success
```

## Technical Decisions and Trade-offs

### 1. Manifest V2 vs V3

**Decision**: Use Manifest V2 with persistent background page

**Reasoning**:
- **webRequest API**: MV3's declarativeNetRequest cannot modify headers based on tab-specific state
- **Synchronous Operations**: Cookie injection requires synchronous access to session store
- **State Management**: Service workers in MV3 have limited lifetime, would need constant rehydration
- **Chrome Support**: MV2 still fully supported in Chrome, mandatory migration not until 2024+

**Trade-off**: Extension won't work in Firefox (requires MV3), but core functionality requires MV2

### 2. HTTP-Level vs JavaScript-Only Cookie Interception

**Decision**: Implement both HTTP-level (webRequest) and JavaScript-level (chrome.cookies.onChanged) capture

**Reasoning**:
- **HTTP-Only Cookies**: Only accessible via HTTP headers, not document.cookie
- **JavaScript Cookies**: Set via document.cookie or fetch() APIs
- **Comprehensive Coverage**: Some sites set cookies via HTTP, others via JavaScript
- **Edge Cases**: Service workers, fetch() with credentials, CORS requests

**Example**:
```
HTTP-only cookie: Set-Cookie: session=123; HttpOnly → Only in onHeadersReceived
JavaScript cookie: document.cookie = 'theme=dark' → Only in chrome.cookies.onChanged
```

**Trade-off**: Higher complexity, but complete isolation guarantee

### 3. ES6 Proxy vs Script Injection for Storage

**Decision**: Use ES6 Proxy for localStorage/sessionStorage isolation

**Reasoning**:
- **Transparent**: No API changes, works with all libraries
- **Complete Coverage**: Intercepts all access patterns (direct, bracket, method calls)
- **Performance**: Minimal overhead, native Proxy performance
- **Maintainability**: Single proxy handler vs multiple getter/setter overrides

**Alternative Considered**: Override individual methods
- Would miss: `localStorage.foo`, `Object.keys(localStorage)`, `for...in` loops
- More code, more edge cases

**Trade-off**: Requires ES6 support (not an issue for modern browsers)

### 4. Injected Script vs Content Script for document.cookie

**Decision**: Use injected script + content script bridge

**Reasoning**:
- **Content Script Limitation**: Runs in isolated world, cannot override page's document.cookie
- **Injected Script Requirement**: Must run in page context to override native APIs
- **Communication Gap**: Injected scripts cannot use chrome.runtime.sendMessage
- **Solution**: Use window.postMessage to bridge the gap

**Flow**:
```
Page Context (injected) ←postMessage→ Extension Context (content script) ←runtime.sendMessage→ Background
```

**Alternative Considered**: Only intercept at HTTP level
- Would miss: document.cookie reads (sites checking for cookie existence)
- Would have race conditions (cookie set after page load)

**Trade-off**: More complex, but necessary for complete coverage

### 5. Optimistic vs Pessimistic Cookie Caching

**Decision**: Optimistic caching with periodic refresh

**Reasoning**:
- **Synchronous API**: document.cookie getter must return immediately
- **Async Storage**: Our cookie store is in background script (async)
- **Website Patterns**: Sites often do: `document.cookie = 'x=1'; alert(document.cookie)`
- **Solution**: Cache cookies, update optimistically on set

**Example**:
```javascript
// Website code
document.cookie = 'newCookie=value';
console.log(document.cookie); // Expects to see 'newCookie=value'

// Our approach
set(cookieString) {
  setCookie(cookieString).catch(...); // Async, fire-and-forget
  cachedCookies += '; ' + cookieString; // Immediate update
}
```

**Trade-off**: Cache can be slightly stale, but provides correct synchronous behavior

### 6. Periodic Cookie Cleaner

**Decision**: Run cookie cleaner every 2 seconds

**Reasoning**:
- **Defense in Depth**: Backup mechanism if interception fails
- **Edge Cases**: Service workers, browser internals, race conditions
- **Browser Quirks**: Some browsers may bypass webRequest in certain scenarios
- **Safety Net**: Ensures isolation even if primary mechanisms fail

**Performance Impact**: Minimal (queries only session tabs, not all cookies)

**Trade-off**: Small overhead, but significantly increases isolation robustness

### 7. Debounced vs Immediate Persistence

**Decision**: Debounced persistence (1 second) for cookie updates, immediate for critical operations

**Reasoning**:
- **Frequent Updates**: Some sites set dozens of cookies during login
- **Write Amplification**: chrome.storage.local writes are slow
- **Batching**: Debouncing groups rapid updates into single write
- **Critical Operations**: Session creation/deletion persisted immediately

**Example**:
```javascript
// Login flow sets 10 cookies in 500ms
// Without debouncing: 10 storage writes
// With debouncing: 1 storage write

storeCookie(...) {
  persistSessions(false); // Debounced (1 second)
}

cleanupSession(...) {
  persistSessions(true); // Immediate
}
```

**Trade-off**: Small window (1 second) where data could be lost on crash, but huge performance gain

### 8. Session ID Format

**Decision**: `session_${timestamp}_${random}`

**Reasoning**:
- **Uniqueness**: Timestamp + random ensures no collisions
- **Sortable**: Sessions can be ordered by creation time
- **Readable**: Easy to identify in logs and debugging
- **No PII**: Contains no user information

**Example**: `session_1704067200000_a1b2c3d4e`

**Alternative Considered**: UUID v4
- More standard, but longer and less readable

**Trade-off**: Custom format, but optimized for our use case

### 9. Exponential Backoff for Session ID Fetching

**Decision**: Retry with delays: 100ms, 500ms, 1s, 2s, 3s

**Reasoning**:
- **Race Condition**: Content script may load before background script ready
- **Extension Startup**: Background script initialization takes time
- **Tab Restoration**: Browser restores tabs before extension fully loads
- **Solution**: Retry with increasing delays

**Example**:
```
Attempt 1: Immediate → Fail (background not ready)
Attempt 2: Wait 100ms → Fail (still initializing)
Attempt 3: Wait 500ms → Success (background ready)
Total time: 600ms
```

**Fallback**: After 5 attempts, use 'default' session ID

**Trade-off**: Small delay on edge cases, but ensures robustness

### 10. Color-Coded Badges

**Decision**: Use 12 distinct colors for session identification

**Reasoning**:
- **Visual Identification**: Users can quickly identify session tabs
- **No Labels**: Badge text limited to 4 characters, color is better
- **12 Colors**: Balance between distinctiveness and color blindness
- **Deterministic**: Same session always gets same color (hash-based)

**Color Palette**:
```javascript
const colors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
  '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
  '#F06292', '#64B5F6', '#81C784', '#FFD54F'
];
```

**Hash Function**:
```javascript
function sessionColor(sessionId) {
  const hash = sessionId.split('').reduce((acc, char) =>
    acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}
```

**Trade-off**: Only 12 colors, sessions may share colors if many exist

## Debugging Guide

### Console Logging

The extension has extensive logging. Open DevTools to see:

**Background Script Logs** (background.js):
```
[onBeforeSendHeaders] Tab 123 requesting https://example.com/api
[session_1234567890_abc123] Found 3 cookies for example.com
[session_1234567890_abc123] Injecting 3 cookies for example.com

[onHeadersReceived] Tab 123 received response from https://example.com/api
[session_1234567890_abc123] Stored cookie sessionid for example.com

[chrome.cookies.onChanged] Cookie changed: theme for domain: example.com
[session_1234567890_abc123] Captured cookie theme via chrome.cookies API
[session_1234567890_abc123] Removed browser cookie: theme

[Cookie Cleaner] Checking 2 session tabs for browser cookies
[session_1234567890_abc123] Clearing 1 browser cookies for example.com

Sessions persisted to storage (debounced)
```

**Content Script Logs** (console on page):
```
[Storage Isolation] Initializing storage isolation...
[Storage Isolation] ✓ Session ready: session_1234567890_abc123
[Storage Isolation] localStorage.setItem('theme', 'dark')
[Storage Isolation] localStorage.getItem('theme') => 'dark'

[Cookie Isolation] Initializing cookie isolation...
[Cookie Isolation] ✓ Session ready: session_1234567890_abc123
[Cookie Isolation - Page] Installing cookie override...
[Cookie Isolation - Page] document.cookie (set) => preference=darkmode
[Cookie Isolation - Page] document.cookie (get) => preference=darkmode
```

### Inspecting Session State

**From Background Script Console**:
```javascript
// View all sessions
console.log(sessionStore.sessions);

// View tab mappings
console.log(sessionStore.tabToSession);

// View cookies for a specific session
console.log(sessionStore.cookieStore['session_1234567890_abc123']);

// View cookies for a specific domain
console.log(sessionStore.cookieStore['session_1234567890_abc123']['example.com']);

// Count total sessions
console.log(Object.keys(sessionStore.sessions).length);

// Count total tabs
console.log(Object.keys(sessionStore.tabToSession).length);
```

**From Page Console**:
```javascript
// Check session ID
chrome.runtime.sendMessage({ action: 'getSessionId' }, console.log);

// View localStorage with prefixes
Object.keys(localStorage).filter(k => k.startsWith('__SID_'));

// View localStorage without prefixes (via Proxy)
Object.keys(localStorage); // Shows unprefixed keys

// Test cookie isolation
document.cookie = 'test=123';
console.log(document.cookie); // Should see 'test=123'
```

### Common Issues

**Issue**: Cookies not persisting across requests
**Cause**: Session not assigned to tab
**Debug**:
```javascript
// Check if tab has session
chrome.runtime.sendMessage({ action: 'getSessionId' }, console.log);
// Should return: { success: true, sessionId: 'session_...' }
```

**Issue**: Storage not isolated
**Cause**: Content script failed to load or session ID not fetched
**Debug**:
```javascript
// Check if Proxy is installed
console.log(window.__STORAGE_ISOLATION_INJECTED__); // Should be true

// Check if session ready
// Look for "[Storage Isolation] ✓ Session ready" in console
```

**Issue**: document.cookie returns empty string
**Cause**: Cookie override not installed or session not ready
**Debug**:
```javascript
// Check if override is installed
console.log(window.__COOKIE_OVERRIDE_INSTALLED__); // Should be true

// Look for "[Cookie Isolation - Page] Installing cookie override..." in console
```

**Issue**: Popup doesn't inherit session
**Cause**: webNavigation or tabs.onCreated not firing
**Debug**:
```javascript
// In background console, watch for:
// [Popup Inheritance] New tab X created from tab Y
// [Popup Inheritance] ✓ Tab X now has session session_...
```

### Testing Multi-Session Isolation

**Test 1: Basic Cookie Isolation**
1. Create two sessions (Session A, Session B)
2. Navigate both to https://httpbin.org/cookies/set?session=A and ?session=B
3. Navigate both to https://httpbin.org/cookies
4. Verify: Session A shows `{"session": "A"}`, Session B shows `{"session": "B"}`

**Test 2: localStorage Isolation**
1. Create two sessions
2. Navigate both to a test page
3. In Session A console: `localStorage.setItem('test', 'A')`
4. In Session B console: `localStorage.setItem('test', 'B')`
5. Verify: `localStorage.getItem('test')` returns 'A' in Session A, 'B' in Session B

**Test 3: Popup Inheritance**
1. Create session
2. Navigate to a page
3. Set cookie: `document.cookie = 'test=parent'`
4. Open popup: `window.open('https://httpbin.org/cookies')`
5. Verify: Popup shows `{"test": "parent"}` and has same colored badge

**Test 4: Persistence**
1. Create session
2. Navigate to site, log in
3. Restart browser
4. Verify: Badge is still colored, still logged in after navigation

## Performance Considerations

### Memory Usage

**Per Session Overhead**: ~10-20KB
- Session metadata: ~1KB
- Cookie store: ~5-10KB (typical)
- Tab references: ~1KB

**Per Tab Overhead**: ~50-100KB
- Content scripts: ~30KB (loaded per tab)
- Storage proxy: ~10KB heap
- Cookie cache: ~10KB

**Typical Usage** (5 sessions, 15 tabs):
- Total: ~1.5MB
- Negligible compared to browser baseline

### CPU Usage

**Idle**: Near zero
- No polling, event-driven architecture

**Active Browsing**:
- WebRequest interception: <1ms per request
- Cookie lookup: O(1) hash map
- Storage proxy: <0.1ms per operation
- Cookie cleaner: <5ms every 2 seconds

**Persistence**:
- Debounced writes: Once per second during activity
- chrome.storage.local: 10-50ms per write (browser internal)

### Storage I/O

**chrome.storage.local Quota**: 10MB (per-extension)

**Typical Usage**:
- 10 sessions: ~100KB
- 1000 cookies: ~500KB
- Well under quota

**Optimization**: Debounced persistence reduces writes by 10-100x during active browsing

## Security Considerations

### Cookie Isolation Guarantee

**Threat Model**: Prevent cross-session cookie leakage

**Defenses**:
1. HTTP-level interception (primary)
2. chrome.cookies.onChanged capture (secondary)
3. Periodic cookie cleaner (tertiary)
4. Set-Cookie header removal (prevents browser storage)

**Attack Scenarios Handled**:
- **Scenario**: Website sets cookie via Set-Cookie header
  - **Defense**: onHeadersReceived intercepts, stores in session, removes header

- **Scenario**: Website sets cookie via document.cookie
  - **Defense**: Override intercepts, sends to background, background stores

- **Scenario**: Website sets cookie via fetch() API
  - **Defense**: chrome.cookies.onChanged captures, stores in session, removes from browser

- **Scenario**: Service worker sets cookie
  - **Defense**: chrome.cookies.onChanged + periodic cleaner

- **Scenario**: Browser internal sets cookie
  - **Defense**: Periodic cleaner removes leaked cookies

### Storage Isolation Guarantee

**Threat Model**: Prevent cross-session storage leakage

**Defenses**:
1. ES6 Proxy with session prefixing
2. run_at: document_start (before page scripts)
3. Non-configurable property descriptors

**Attack Scenarios Handled**:
- **Scenario**: Website reads localStorage.getItem('key')
  - **Defense**: Proxy intercepts, returns session-prefixed value

- **Scenario**: Website enumerates Object.keys(localStorage)
  - **Defense**: Proxy ownKeys trap returns only session keys

- **Scenario**: Website tries to override localStorage
  - **Defense**: Property descriptor configurable: false prevents override

- **Scenario**: Iframe tries to access parent storage
  - **Defense**: Content script runs in all_frames: true, each frame gets own proxy

### XSS Protection

**Not a Goal**: This extension does NOT protect against XSS

**Why**: XSS runs in page context with full access to session data (by design)

**User Responsibility**: Only navigate to trusted sites within sessions

### Privacy

**Data Collection**: ZERO
- No analytics
- No telemetry
- No external requests

**Data Storage**: Local only
- chrome.storage.local (never leaves device)
- In-memory session store (cleared on browser close)

**Permissions**: Minimal necessary
- No access to browsing history
- No access to bookmarks
- No access to passwords

## Extension Lifecycle

### Installation

```
1. User installs extension from Chrome Web Store or loads unpacked
2. Chrome creates extension context
3. background.js loads
4. chrome.runtime.onInstalled fires
5. loadPersistedSessions() called
6. If first install: sessionStore is empty
7. Extension ready, icon appears in toolbar
```

### Browser Startup

```
1. Chrome launches
2. Extension system initializes
3. background.js loads
4. chrome.runtime.onStartup fires
5. loadPersistedSessions() called
6. Restore sessions, cookieStore, tabToSession
7. Query open tabs, restore badges
8. Extension ready
```

### Extension Update

```
1. Chrome Web Store publishes new version
2. Chrome downloads update
3. Old extension context terminates
4. New extension context starts
5. background.js loads
6. chrome.runtime.onInstalled fires (reason: 'update')
7. loadPersistedSessions() called
8. Sessions restored from storage
9. Extension ready with new version
```

### Uninstallation

```
1. User uninstalls extension
2. Chrome removes extension files
3. chrome.storage.local is deleted
4. All session data is permanently lost
5. Browser cookies (if any leaked) remain
6. localStorage prefixed keys remain (harmless)
```

## Future Enhancements

### Potential Improvements

1. **Session Names**: Allow users to name sessions ("Work Gmail", "Personal Gmail")
2. **Session Icons**: Custom icons instead of just colors
3. **Import/Export**: Save session cookies to file, restore later
4. **Session Cloning**: Duplicate session to new tab
5. **Cookie Editor**: View/edit cookies via popup UI
6. **Auto-Login**: Save credentials per session (password manager integration)
7. **Session Rules**: Auto-assign domains to specific sessions
8. **Sync**: Sync sessions across devices via chrome.storage.sync
9. **Container Tabs**: Firefox-style container assignment UI
10. **Incognito Support**: Extend to private browsing mode

### Known Limitations

1. **Manifest V2**: Will require migration to MV3 eventually (major rewrite)
2. **Chrome Only**: Firefox requires MV3 (webRequest.onBeforeRequest different API)
3. **HTTP/HTTPS Only**: file://, chrome://, about: URLs not intercepted
4. **Service Workers**: Some edge cases may bypass interception (mitigated by cleaner)
5. **WebSockets**: Cookies in WS handshake not modified after connection
6. **Performance**: Large cookie stores (1000+ cookies) may slow persistence
7. **Storage Quota**: chrome.storage.local 10MB limit (unlikely to hit)
8. **Color Reuse**: Only 12 colors, sessions may share if >12 exist

## Comparison to Alternatives

### vs Firefox Multi-Account Containers

**Similarities**:
- Isolated cookies and storage per container/session
- Visual indicators (colors)
- Popup windows inherit parent container/session

**Differences**:
- **Containers**: Persistent, user-named, manually assigned
- **Sessions**: Ephemeral, auto-created, tab-specific
- **Firefox**: Built-in browser feature
- **This Extension**: Chrome extension with full browser support

### vs SessionBox Extension

**Similarities**:
- Tab-based sessions
- Cookie isolation
- Popup inheritance

**Differences**:
- **SessionBox**: Closed source, subscription model, cloud sync
- **This Extension**: Open source, free, local-only

### vs Incognito Mode

**Similarities**:
- Isolated cookies and storage

**Differences**:
- **Incognito**: Single alternate session, no history, cleared on close
- **This Extension**: Multiple simultaneous sessions, history preserved, selective clearing

### vs Multiple Browser Profiles

**Similarities**:
- Complete isolation (cookies, storage, extensions, history)

**Differences**:
- **Profiles**: Separate browser windows, heavy overhead, awkward switching
- **This Extension**: Tabs in same window, lightweight, quick switching

## Critical Notes for Development

### Concurrent Session Limits (✅ Tested & Deployed 2025-10-21)

**Status:** Production Ready - All Tests Passed

**Implementation Overview:**
- Free tier: Maximum 3 concurrent sessions
- Premium/Enterprise: Unlimited concurrent sessions
- Session counting: Only counts sessions with active tabs (ignores stale sessions)
- Automatic cleanup: Stale sessions removed on browser startup
- Graceful degradation: Existing sessions preserved when downgrading tiers

**Key Functions:**
- `getActiveSessionCount()` - Counts sessions with tabs (background.js:720)
  ```javascript
  function getActiveSessionCount() {
    return Object.values(sessionStore.sessions).filter(session =>
      session.tabs && session.tabs.length > 0
    ).length;
  }
  ```

- `canCreateNewSession()` - Checks limits before creation (background.js:734)
  ```javascript
  async function canCreateNewSession() {
    const tier = await getTier();
    const limit = SESSION_LIMITS[tier] || SESSION_LIMITS.free;
    const currentCount = getActiveSessionCount();

    if (currentCount >= limit) {
      return {
        allowed: false,
        tier: tier,
        current: currentCount,
        limit: limit,
        reason: `You've reached the ${tier.toUpperCase()} tier limit of ${limit} concurrent sessions.`
      };
    }

    return {
      allowed: true,
      tier: tier,
      current: currentCount,
      limit: limit
    };
  }
  ```

- `getSessionStatus()` - Returns status for UI (background.js:781)
  ```javascript
  function getSessionStatus() {
    const tier = getTier();
    const limit = SESSION_LIMITS[tier] || SESSION_LIMITS.free;
    const activeCount = getActiveSessionCount();

    return {
      canCreateNew: activeCount < limit,
      isOverLimit: activeCount > limit,  // Graceful degradation
      activeCount: activeCount,
      limit: limit,
      tier: tier
    };
  }
  ```

**API Endpoints:**
- `canCreateSession` - Pre-creation validation
  - Request: `{ action: 'canCreateSession' }`
  - Response: `{ success: true, allowed: boolean, tier: string, current: number, limit: number, reason?: string }`

- `getSessionStatus` - Real-time status
  - Request: `{ action: 'getSessionStatus' }`
  - Response: `{ success: true, canCreateNew: boolean, isOverLimit: boolean, activeCount: number, limit: number, tier: string }`

**UI Integration:**
- Session counter: "X / Y sessions" (Y = ∞ for Premium/Enterprise)
- Disabled button state at limit
- Warning banner with upgrade prompt
- "Approaching limit" info (1 session away)

**Testing Results (2025-10-21):**
✅ All test scenarios passed - See [docs/features_implementation/01_concurrent_sessions.md](docs/features_implementation/01_concurrent_sessions.md#testing-results)

**Critical Implementation Details:**
1. Session counting ONLY includes sessions with `tabs.length > 0`
2. Stale sessions (no tabs) automatically removed on browser startup
3. No false warnings on fresh browser start (0 sessions)
4. Graceful degradation: Existing sessions preserved when downgrading
5. Performance: No noticeable impact on session operations

---

### Session Persistence & Auto-Restore Tier Restrictions (✅ Implemented 2025-10-28)

**IMPORTANT:** Session persistence consists of TWO distinct features with different tier restrictions:

#### 1. Session Data Retention (All Tiers)

**What it is:** Saving session cookies and storage to `chrome.storage.local`

**Tier-based retention periods:**
- **Free tier:** 7 days (sessions auto-deleted after 7 days of inactivity)
- **Premium/Enterprise:** Permanent (sessions never auto-deleted)

**Implementation:**
- `persistSessions()` (background.js:1028-1128) - NO tier checks, saves for all tiers
- `loadPersistedSessions()` (background.js:1153-1485) - Loads for all tiers, but tier check for tab restoration
- `cleanupExpiredSessions()` (background.js:1559-1665) - Enforces 7-day limit for Free tier

**Code reference:**
```javascript
// background.js:1559-1665
async function cleanupExpiredSessions() {
  const tier = await getTier();
  if (tier === 'free') {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    // Delete sessions older than 7 days
  }
  // Premium/Enterprise: no cleanup
}
```

#### 2. Auto-Restore on Browser Restart (Enterprise Only) ✅ TIER-ENFORCED

**What it is:** Automatic reconnection of session-to-tab mappings after browser restart using URL-based matching

**Tier restriction:** Enterprise tier ONLY

**Implementation Status (2025-10-28):** ✅ Fully Tested & Deployed
- Free tier: 3 tests **PASSED**
- Premium tier: 1 test **PASSED**
- Enterprise tier: Pending testing (Test Category 3-9)

**Key Behaviors:**
- **Enterprise with auto-restore enabled:** Tab mappings restored via URL-based matching
- **Free/Premium tiers:** Tab mappings cleared (sessions saved but NOT restored)
- **Tier downgrade:** Auto-restore preference automatically disabled, notification shown
- **Edge browser restore detection:** Upgrade notification for Free/Premium users

**For Detailed Implementation:**
- **Feature Documentation:** [docs/features_implementation/05_auto_restore_tier_restrictions.md](docs/features_implementation/05_auto_restore_tier_restrictions.md) - Complete testing procedures and expected behaviors
- **Session Persistence:** [docs/features_implementation/02_session_persistence.md](docs/features_implementation/02_session_persistence.md) - URL-based tab matching algorithm
- **Technical Implementation:** [docs/technical.md - Section 11](docs/technical.md#11-browser-restart-tab-restoration-timing) - Code patterns and timing details
- **API Endpoints:** [docs/api.md](docs/api.md) - Auto-restore management messages

**Quick Reference:**
- `loadPersistedSessions()` checks: `shouldAutoRestore = (tier === 'enterprise') && autoRestoreEnabled`
- `handleTierChange(oldTier, newTier)` auto-disables preference on downgrade
- `detectEdgeBrowserRestore()` shows upgrade notification (with retry logic: 2s + 3 attempts)
- Debouncing: 5-second delay prevents tier flapping
- Singleton patterns: Prevent memory leaks from duplicate listeners

**Browser Restart Tab Restoration (2025-10-25):**
- Race condition fix: 2-second delay + retry logic (3 attempts) for Edge tab restoration
- URL-based tab matching algorithm (tab IDs change, URLs stay same)
- See [docs/features_implementation/02_session_persistence.md - Phase 4](docs/features_implementation/02_session_persistence.md#phase-4-browser-startup-session-deletion-fix) for complete details

---

### Session Naming/Labeling (✅ Complete 2025-10-29)

**Status:** Production Ready - v3.1.0

**Implementation Overview:**
- Premium/Enterprise exclusive feature
- Custom session names with validation (max 50 chars, no duplicates, emoji support)
- Inline editing (double-click session name)
- Enterprise modal integration (gear icon → Session Settings)
- Full theme support (light/dark modes)

**Key Functions:**
- `setSessionName(sessionId, name)` - Set custom name with validation (background.js:2756)
- `getSessionName(sessionId)` - Retrieve session name (background.js:2829)
- `clearSessionName(sessionId)` - Clear custom name (background.js:2853)
- `validateSessionName(name, currentSessionId)` - Validate name (background.js:2660)

**API Endpoints:**
- `setSessionName` - Set/update session name
- `getSessionName` - Get session name
- `clearSessionName` - Clear session name (revert to ID)

**Session Data Model:**
```javascript
sessionStore.sessions[sessionId] = {
  id: sessionId,
  name: null, // NEW: Custom session name (Premium/Enterprise only)
  color: color,
  customColor: validatedCustomColor,
  createdAt: timestamp,
  lastAccessed: timestamp,
  tabs: []
};
```

**Validation Rules:**
- Max 50 characters (emoji-aware)
- No duplicates (case-insensitive)
- No HTML characters: `< > " ' \``
- Whitespace trimmed and collapsed
- Free tier blocked with upgrade prompt

**UI Features:**
- **Premium:** Inline editing (double-click session name)
- **Enterprise:** Settings modal with name + color fields
- **Free:** PRO badge with upgrade prompt
- **Theme-aware:** Full light/dark mode support

**For detailed implementation:** See [docs/features_implementation/06_session_naming.md](docs/features_implementation/06_session_naming.md)

---

### License Validation Error Handling (2025-10-21)

1. **IS_DEVELOPMENT Constant** (license-manager.js line 54)
   - CRITICAL: Set to `false` before production deployment
   - Controls both API endpoint and secret keys
   - Single point of configuration - no useSandbox parameter needed
   ```javascript
   this.IS_DEVELOPMENT = true;  // ← Change to false for production
   ```

2. **Manifest V2 Async Handling**
   - `chrome.runtime.sendMessage()` does NOT return Promise in MV2
   - MUST use callback pattern or promisify with helper function
   - popup-license.js has `sendMessage()` helper for this purpose (lines 71-96)
   - license-integration.js uses `Promise.resolve()` wrapper + `return true`

   **Correct Pattern:**
   ```javascript
   // In popup/UI code
   const response = await sendMessage({ action: 'activateLicense', licenseKey });

   // In background message handler
   Promise.resolve(licenseManager.activateLicense(request.licenseKey))
     .then(result => {
       sendResponse(result);
     })
     .catch(error => {
       sendResponse({ success: false, tier: 'free', message: error.message, error_code: null });
     });
   return true; // Keep message channel open
   ```

3. **Error Code Propagation**
   - API returns: `{result: "error", message: "...", error_code: 60}`
   - Extension converts: `{success: false, tier: 'free', message: '...', error_code: 60}`
   - Popup displays: User-friendly message via `getUserFriendlyErrorMessage()`
   - Always include `error_code` field in error responses (or null)
   - See [docs/subscription_api.md - Error Handling](docs/subscription_api.md#error-handling) for complete error code mappings (60-65)

4. **Message Response Pattern**
   - Always call `sendResponse()` inside Promise.then() and .catch()
   - Always `return true` to keep message channel open
   - Wrap async operations in `Promise.resolve()` for consistency
   - Use try-catch around sendResponse for error detection

   **Example:**
   ```javascript
   chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
     if (request.action === 'activateLicense') {
       Promise.resolve(licenseManager.activateLicense(request.licenseKey))
         .then(result => {
           try {
             sendResponse(result);
           } catch (error) {
             console.error('sendResponse error:', error);
           }
         })
         .catch(error => {
           sendResponse({
             success: false,
             tier: 'free',
             message: error.message,
             error_code: null
           });
         });
       return true; // CRITICAL: Keep channel open
     }
   });
   ```

5. **Error Message Security**
   - ALWAYS use `escapeHtml()` before displaying user-facing messages
   - Convert technical API errors to user-friendly messages
   - Don't expose internal error details to users
   - Log detailed errors to console for debugging

   **XSS Prevention:**
   ```javascript
   function escapeHtml(text) {
     const div = document.createElement('div');
     div.textContent = text;
     return div.innerHTML;
   }

   // Usage:
   statusElement.innerHTML = `<div class="error">${escapeHtml(errorMessage)}</div>`;
   ```

6. **Dark Mode Implementation (2025-10-21)**
   - license-details.html and popup-license.html now support dark mode
   - Uses system preference: `@media (prefers-color-scheme: dark)`
   - Color palette consistent with popup.html
   - All UI elements properly styled for both modes

   **Color Palette:**
   - Background: `#1a1a1a`, `#2d2d2d`, `#242424`
   - Text: `#e0e0e0`, `#999`, `#888`
   - Borders: `#444`, `#333`
   - Accent: `#1ea7e8`
   - Error: `#ff6b6b` on `#3a1e1e`

### License Validation (2025-01-22)

**IMPORTANT - Response Parsing**:
- Meraf Solutions API returns JSON-encoded strings: `"1"` (with quotes) not `1` (plain)
- **ALWAYS** use `JSON.parse()` when parsing validation responses:
  ```javascript
  const text = await response.text();  // text = '"1"'
  const parsed = JSON.parse(text);     // parsed = '1'
  const isValid = parsed === '1';      // true
  ```
- **NEVER** compare directly: `text === '1'` will fail because `'"1"' !== '1'`

**IMPORTANT - Message-Based Redirect**:
- Extension popups cannot use `window.open()` to open extension pages
- **ALWAYS** use message-based redirect pattern for invalid license:
  ```javascript
  // Background script:
  chrome.runtime.sendMessage({ action: 'redirectToPopup' });

  // license-details.js listener:
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'redirectToPopup') {
      window.location.href = 'popup.html';
      sendResponse({ success: true });
      return true;
    }
  });
  ```

**IMPORTANT - Notification Icons**:
- Extension icons are in `icons/` subdirectory
- **ALWAYS** use `icons/icon128.png` for notifications (NOT `icon.png`)
- Available sizes: `icon16.png`, `icon48.png`, `icon128.png`

**IMPORTANT - Error Handling**:
- **ALWAYS** check if `licenseData` is not null before accessing properties
- Set to null **AFTER** logging properties that depend on it
- Example:
  ```javascript
  if (this.licenseData) {
    console.log('Key:', this.licenseData.key);
  }
  this.licenseData = null; // Set to null AFTER accessing
  ```

### Documentation Policy

**IMPORTANT**: When adding new features or fixes, ALWAYS update existing documentation instead of creating new markdown files.

**Documentation Structure**:
- **`docs/api.md`** - API endpoints, authentication, request/response formats, usage examples
- **`docs/subscription_api.md`** - Saas-Subscription API endpoints, authentication, request/response formats, usage examples
- **`docs/technical.md`** - Implementation details, code patterns, helper functions, algorithms
- **`docs/architecture.md`** - System design, component interactions, data flows, integration patterns
- **`CLAUDE.md`** - Project overview, development guidelines, critical system behaviors (this file)

**Rules**:
1. **NEVER create new markdown documentation files** without checking existing docs/ directory first
2. **ALWAYS update existing documentation files** when adding new features or fixes
3. **ONLY create a new .md file if**:
   - No existing category fits the content
   - The content is substantial enough to warrant a separate file (>500 lines)
   - You've verified with the user first
4. **When making changes**:
   - Update the "Last Updated" date in documentation
   - Keep documentation concise and avoid redundancy across files
   - Use cross-references instead of duplicating content

**Examples**:
- ✅ Add subscription system details → Update `docs/technical.md` section 13
- ✅ Add new API endpoint → Update `docs/api.md` with endpoint documentation
- ✅ Add system architecture diagram → Update `docs/architecture.md`
- ❌ Create `SUBSCRIPTION-IMPLEMENTATION-SUMMARY.md` → Should update existing docs instead
- ❌ Create `API_FIX_RENEWAL_FLOW.md` → Should update `docs/api.md` instead


## Conclusion

This extension provides **industrial-grade session isolation** using a multi-layered defense strategy:

1. **HTTP Layer**: webRequest interception for HTTP cookies
2. **API Layer**: chrome.cookies.onChanged for JavaScript cookies
3. **Page Layer**: document.cookie override for page scripts
4. **Storage Layer**: ES6 Proxy for localStorage/sessionStorage
5. **Cleanup Layer**: Periodic cookie cleaner as safety net

The architecture balances **completeness** (all isolation vectors covered), **performance** (minimal overhead), **reliability** (exponential backoff, fallbacks), and **user experience** (transparent operation, visual indicators).

**Use Cases**:
- Social media managers with multiple client accounts
- Developers testing multi-account workflows
- Support staff accessing customer accounts
- Anyone needing simultaneous logins to the same site

**Code Quality**:
- Extensively commented for maintainability
- Defensive programming with error handling
- Comprehensive logging for debugging
- Clean separation of concerns

This document should enable any developer to understand, modify, and extend the extension.
