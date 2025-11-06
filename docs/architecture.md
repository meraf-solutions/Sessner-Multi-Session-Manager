# System Architecture
## Sessner – Multi-Session Manager

**Last Updated:** 2025-11-03
**Extension Version:** 3.2.4
**Architecture Pattern:** SessionBox-Style Isolation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Design Pattern](#design-pattern)
3. [Component Architecture](#component-architecture)
4. [Multi-Layer Isolation Architecture](#multi-layer-isolation-architecture)
5. [Data Flow Diagrams](#data-flow-diagrams)
6. [State Management](#state-management)
7. [Persistence Architecture](#persistence-architecture)
8. [Session Lifecycle](#session-lifecycle)
9. [Integration Points](#integration-points)
10. [Security Architecture](#security-architecture)
11. [Performance Architecture](#performance-architecture)

---

## System Overview

Sessner is a SessionBox-style multi-session browser extension that creates **completely isolated browser sessions per tab**. Each session operates independently with separate cookies, localStorage, sessionStorage, and IndexedDB.

### Key Architectural Principles

1. **Virtual Session Pattern**: Each tab belongs to a virtual session completely isolated from others
2. **Multi-Layer Defense**: Cookie/storage isolation at HTTP, JavaScript, and Page Context levels
3. **100% Local, 100% Private**: Zero cloud dependency, all data stored locally
4. **Persistent Background Page**: Manifest V2 with always-running background script
5. **Transparent Isolation**: Web applications work without modification
6. **Fair Enforcement**: License system never locks out users, graceful degradation

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser Chrome                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │
│  │   Tab 1    │  │   Tab 2    │  │   Tab 3    │                 │
│  │ Session A  │  │ Session A  │  │ Session B  │                 │
│  └────────────┘  └────────────┘  └────────────┘                 │
└──────────────────────────────────────────────────────────────────┘
                            ↕
┌──────────────────────────────────────────────────────────────────┐
│                    Extension Components                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Background Script (Persistent)                 │   │
│  │  • Session Manager                                        │   │
│  │  • Cookie Store (in-memory)                               │   │
│  │  • License Manager                                        │   │
│  │  • WebRequest Interceptor                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↕                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Content Scripts (Per Tab)                      │   │
│  │  • Storage Isolation (ES6 Proxy)                          │   │
│  │  • Cookie Isolation (document.cookie override)            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            ↕                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │            Popup UI                                        │   │
│  │  • Session Management UI                                   │   │
│  │  • License Management UI                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                            ↕
┌──────────────────────────────────────────────────────────────────┐
│                    Persistence Layer                              │
│  • chrome.storage.local (10MB quota)                             │
│  • IndexedDB (session data, cookies, metadata)                   │
│  • Storage Persistence Manager (dual-layer sync)                 │
│  • License data (device ID, tier, features)                      │
└──────────────────────────────────────────────────────────────────┘
                            ↕
┌──────────────────────────────────────────────────────────────────┐
│                    External Services                              │
│  • Meraf Solutions Licensing API (HTTPS only)                    │
│  • Validation every 7 days, 30-day grace period                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Design Pattern

### SessionBox-Style Isolation

Sessner uses a **virtual session** pattern where each session is a logical container that groups tabs and isolates their data:

```
Session A (ID: session_1234567890_abc123)
├── Tabs: [123, 456]
├── Cookies: { example.com: { sessionid: 'xyz' } }
├── Color: #FF6B6B
└── Created: 2025-10-21T12:00:00Z

Session B (ID: session_1234567890_def456)
├── Tabs: [789]
├── Cookies: { example.com: { sessionid: 'abc' } }
├── Color: #4ECDC4
└── Created: 2025-10-21T12:05:00Z
```

### Key Design Decisions

**1. Persistent Background Page (Manifest V2)**
- **Why**: webRequest API requires synchronous access to session state
- **Trade-off**: Can't use Manifest V3 (service workers incompatible)
- **Benefit**: Instant cookie injection, no state rehydration delays

**2. In-Memory Cookie Store**
- **Why**: Fast lookups during HTTP interception (<1ms)
- **Trade-off**: Lost on extension crash (mitigated by debounced persistence)
- **Benefit**: Zero I/O latency for request/response handling

**3. ES6 Proxy for Storage Isolation**
- **Why**: Transparent interception of all storage operations
- **Trade-off**: Requires modern browser (not an issue for Chrome/Edge)
- **Benefit**: Works with any JavaScript code without modification

**4. Multi-Layer Cookie Isolation**
- **Why**: Complete coverage of all cookie-setting mechanisms
- **Trade-off**: Higher complexity, multiple interception points
- **Benefit**: 100% isolation guarantee, no leakage

**5. Local-Only Architecture**
- **Why**: Privacy competitive advantage, GDPR compliance
- **Trade-off**: No cross-device sync (replaced with portable sessions)
- **Benefit**: Zero data breach risk, complete user control

---

## Component Architecture

### Project File Structure

The extension follows an organized directory structure with clear separation of concerns:

```
sessner-extension/
├── manifest.json                 # Extension manifest (V2)
├── html/                         # All HTML files
│   ├── popup.html               # Main popup UI
│   ├── popup-license.html       # License activation UI
│   ├── license-details.html     # License details page
│   └── storage-diagnostics.html # Storage debugging UI
├── js-scripts/                   # All JavaScript files
│   ├── background.js            # Core session management
│   ├── popup.js                 # Popup UI logic
│   ├── popup-license.js         # License activation logic
│   ├── license-details.js       # License details logic
│   ├── license-manager.js       # License validation core
│   ├── license-integration.js   # License system integration
│   ├── license-utils.js         # License utility functions
│   ├── storage-persistence-layer.js # IndexedDB + chrome.storage sync
│   ├── storage-diagnostics.js   # Storage debugging tools
│   ├── crypto-utils.js          # Encryption utilities (AES-256)
│   ├── content-script-storage.js # Storage isolation (Proxy)
│   ├── content-script-cookie.js  # Cookie isolation
│   ├── content-script-favicon.js # Favicon color overlay
│   └── count-tlds.js            # TLD counting utility
├── icons/                        # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── libs/                         # Third-party libraries
│   ├── pako.min.js              # Deflate compression
│   └── jszip.min.js             # ZIP file generation
├── assets/                       # Brand assets
│   ├── Sessner_brand.png
│   ├── Sessner_logo.png
│   ├── Sessner_market_design_1.png
│   ├── Sessner_market_design_2.png
│   └── sources/                 # Source files (excluded from releases)
├── docs/                         # Documentation
│   ├── architecture.md          # This file
│   ├── technical.md             # Technical implementation
│   ├── api.md                   # API reference
│   └── subscription_api.md      # Licensing API reference
└── releases/                     # Release builds (ZIP files)
```

**Key Organizational Principles**:
- **Separation of Concerns**: HTML and JS files organized in dedicated folders
- **Easy Navigation**: Related files grouped together by type
- **Build Process**: `createReleaseZip()` automatically discovers and packages files
- **Exclusions**: `docs/`, `assets/sources/`, and development files excluded from releases

---

### 1. Background Script (js-scripts/background.js)

**Role**: Core session management, cookie interception, license validation

**Responsibilities**:
- Manage session state (sessions, tabs, cookies)
- Intercept HTTP requests/responses (webRequest API)
- Monitor JavaScript cookie operations (chrome.cookies API)
- Handle message passing from popup/content scripts
- Persist data to chrome.storage.local
- Validate licenses periodically
- Enforce feature limits based on tier

**Key Data Structures**:
```javascript
const sessionStore = {
  tabToSession: Map<tabId, sessionId>,
  sessions: Map<sessionId, SessionMetadata>,
  cookieStore: Map<sessionId, Map<domain, Map<path, Map<name, Cookie>>>>
};

const licenseCache = {
  key: string,
  tier: 'free' | 'premium' | 'enterprise',
  status: 'active' | 'expired' | 'blocked',
  deviceId: string,
  lastValidated: ISO8601,
  features: FeatureMap
};
```

**State Persistence**:
- Debounced writes (1 second delay)
- Immediate writes for critical operations (session creation/deletion)
- Periodic validation (every 7 days online)
- Grace period handling (30 days offline)

**Session Data Model (Updated v3.1.0)**:
```javascript
sessionStore.sessions[sessionId] = {
  id: 'session_1234567890_abc123',
  name: null,                    // NEW v3.1.0: Custom session name (Premium/Enterprise)
  color: '#FF6B6B',              // Session color
  customColor: null,             // Custom color (Enterprise only)
  createdAt: 1234567890000,      // Timestamp
  lastAccessed: 1234567890000,   // Last activity timestamp
  tabs: [123, 456]               // Tab IDs in this session
};
```

**New in v3.1.0:**
- `name` field: Custom session name (Premium/Enterprise only)
- Validation: Max 50 chars, no duplicates, emoji support
- Migration: Automatically added to existing sessions on load

---

### 2. Content Scripts

#### js-scripts/content-script-storage.js

**Role**: Transparent localStorage/sessionStorage isolation

**Injection**:
- `run_at`: `document_start` (before page scripts)
- `all_frames`: `true` (includes iframes)
- `matches`: `<all_urls>`

**Isolation Mechanism**:
```javascript
// ES6 Proxy wrapping native storage
window.localStorage = new Proxy(originalLocalStorage, {
  get(target, prop) {
    // Prefix keys with session ID
    if (prop === 'getItem') {
      return (key) => target.getItem(`__SID_${sessionId}__${key}`);
    }
    // ... other traps
  },
  set(target, prop, value) {
    // Prefix keys with session ID
    target.setItem(`__SID_${sessionId}__${prop}`, value);
  }
});
```

**Session ID Fetching**:
- Exponential backoff retry (100ms, 500ms, 1s, 2s, 3s)
- Fallback to 'default' session if background unavailable
- Operation queueing during initialization

---

#### js-scripts/content-script-cookie.js

**Role**: Transparent document.cookie isolation

**Injection**:
- `run_at`: `document_start` (before page scripts)
- `all_frames`: `false` (main frame only, not iframes)
- `matches`: `<all_urls>`

**Two-Part Architecture**:

**Part A: Injected Script (Page Context)**
```javascript
// Runs in page's JavaScript context
Object.defineProperty(document, 'cookie', {
  get() {
    return cachedCookies; // Synchronous return
  },
  set(cookieString) {
    setCookieAsync(cookieString); // Fire-and-forget
    cachedCookies += '; ' + cookieString; // Optimistic update
  }
});
```

**Part B: Content Script (Extension Context)**
```javascript
// Bridges between page and background
window.addEventListener('message', (event) => {
  if (event.data.type === 'SET_COOKIE') {
    chrome.runtime.sendMessage({
      action: 'setCookie',
      cookie: event.data.cookie
    });
  }
});
```

**Why Two Parts?**
- Content scripts run in isolated context (can't override page's document.cookie)
- Injected scripts run in page context (can override) but can't use chrome.runtime
- window.postMessage bridges the gap

---

### 3. Popup UI

**Components**:

**popup.html / popup.js**
- Session list display
- New session creation
- Tab switching
- Session color indicators

**popup-license.html / popup-license.js**
- License activation form
- License status display
- Deactivation functionality
- Tier badge display
- Feature availability list

**Real-Time Updates**:
```javascript
chrome.tabs.onActivated.addListener(() => refreshUI());
chrome.tabs.onUpdated.addListener(() => refreshUI());
chrome.tabs.onRemoved.addListener(() => refreshUI());
```

---

### 4. License Manager (license-manager.js)

**Role**: License validation, tier detection, feature gating

**Configuration**:
- `IS_DEVELOPMENT` constant controls API endpoint and secret keys
  - **CRITICAL**: Must be set to `false` before production deployment
  - See [docs/subscription_api.md - IS_DEVELOPMENT](subscription_api.md#is_development-environment-toggle) for details

**Key Methods**:
- `activateLicense(key)` - Two-step activation (register device → verify license)
- `validateLicense()` - Periodic validation (every 7 days)
- `deactivateLicense()` - Unregister device from license
- `getTier()` - Get current tier (free/premium/enterprise)
- `hasFeature(name)` - Check feature availability

**Error Handling**:
- Consistent error response format with error codes (60-65)
- User-friendly messages converted from technical API errors
- See [docs/subscription_api.md - Error Handling](subscription_api.md#error-handling) for complete error code mappings
- See [docs/technical.md - License System](technical.md#13-license-system-2025-10-21) for implementation details

---

## Multi-Layer Isolation Architecture

### Layer 1: HTTP Request/Response (webRequest API)

**Interception Points**:
1. `onBeforeSendHeaders` - Inject session cookies into requests
2. `onHeadersReceived` - Capture Set-Cookie headers from responses

**Flow**:
```
Browser → HTTP Request → onBeforeSendHeaders
                         ↓
                   Look up session for tab
                         ↓
                   Get session cookies
                         ↓
                   Inject Cookie header
                         ↓
Server ← Modified Request with session cookies

Server → HTTP Response → onHeadersReceived
                         ↓
                   Extract Set-Cookie headers
                         ↓
                   Store in session cookie store
                         ↓
                   Remove Set-Cookie headers
                         ↓
Browser ← Modified Response without Set-Cookie
```

**Why Remove Set-Cookie?**
- Prevents browser from storing cookies in native cookie jar
- Ensures isolation (cookies stored only in session-specific store)

---

### Layer 2: JavaScript Cookie API (chrome.cookies.onChanged)

**Purpose**: Capture cookies set via JavaScript

**Trigger Conditions**:
- `document.cookie = 'name=value'`
- `chrome.cookies.set()`
- `fetch()` with credentials
- Service worker cookie operations

**Flow**:
```
JavaScript sets cookie → chrome.cookies.onChanged fires
                         ↓
                   Find matching session tab
                         ↓
                   Store in session cookie store
                         ↓
                   Remove from browser's native store
```

**Why Immediate Removal?**
- Prevents cookie leakage between sessions
- Defense in depth (backup for Set-Cookie removal)

---

### Layer 3: document.cookie Override (Injected Script)

**Purpose**: Intercept page-level cookie operations

**Override**:
```javascript
Object.defineProperty(document, 'cookie', {
  get() {
    // Return session-specific cookies
    return cachedCookies;
  },
  set(cookieString) {
    // Route to background script
    window.postMessage({ type: 'SET_COOKIE', cookie: cookieString }, '*');

    // Optimistic cache update for immediate reads
    cachedCookies += '; ' + cookieString;
  },
  configurable: false // Prevent override
});
```

**Why Optimistic Update?**
- `document.cookie` is synchronous but our storage is async
- Websites often do: `document.cookie = 'x=1'; console.log(document.cookie)`
- Optimistic update makes this pattern work correctly

---

### Layer 4: Storage Isolation (ES6 Proxy)

**Mechanism**: Prefix all storage keys with session ID

**Original Code**:
```javascript
localStorage.setItem('theme', 'dark');
localStorage.getItem('theme'); // Returns 'dark'
```

**With Proxy**:
```javascript
// Actually stored as:
localStorage.setItem('__SID_session_123__theme', 'dark');
localStorage.getItem('__SID_session_123__theme'); // Returns 'dark'

// Page sees:
localStorage.getItem('theme'); // Returns 'dark' (prefix hidden)
```

**Proxy Traps**:
- `get` - Intercept property access
- `set` - Intercept property assignment
- `deleteProperty` - Intercept `delete` operator
- `has` - Intercept `in` operator
- `ownKeys` - Intercept `Object.keys()` and `for...in`
- `getOwnPropertyDescriptor` - Intercept property descriptors

---

### Defense in Depth: Periodic Cookie Cleaner

**Purpose**: Safety net for edge cases

**Implementation**:
```javascript
setInterval(() => {
  // For each session tab
  sessionTabs.forEach(tabId => {
    // Get all browser cookies for tab's domain
    chrome.cookies.getAll({ ... }, (cookies) => {
      // Remove any leaked cookies
      cookies.forEach(cookie => {
        chrome.cookies.remove({ ... });
      });
    });
  });
}, 2000); // Every 2 seconds
```

**Why Needed?**
- Service workers may bypass webRequest
- Browser internals may set cookies
- Race conditions during page load
- Ensures isolation even if primary mechanisms fail

---

## Data Flow Diagrams

### Session Creation Flow

```
User clicks "New Session" in popup
            ↓
Popup sends message: { action: 'createNewSession', url: 'https://example.com' }
            ↓
Background Script:
  1. Generate session ID: session_1234567890_abc123
  2. Create session metadata: { id, color, createdAt, tabs: [] }
  3. Initialize empty cookie store: {}
  4. Open new tab with URL
  5. Map tab ID to session ID
  6. Set colored badge on tab
  7. Clear any existing browser cookies for domain
  8. Persist to chrome.storage.local
            ↓
Response: { success: true, sessionId, tabId, color }
            ↓
Popup closes
            ↓
Tab loads, content scripts inject
            ↓
Content scripts fetch session ID from background
            ↓
Storage/Cookie isolation active
```

---

### HTTP Cookie Interception Flow

```
Page navigates to https://example.com/api
            ↓
Browser initiates HTTP request
            ↓
onBeforeSendHeaders fires (details.tabId = 123)
            ↓
Background Script:
  1. Look up session: tabToSession[123] → session_abc
  2. Get cookies: cookieStore[session_abc]['example.com']['/api']
  3. Format Cookie header: 'sessionid=xyz; theme=dark'
  4. Inject into request headers
            ↓
Request sent to server with session cookies
            ↓
Server responds with Set-Cookie: newsession=123
            ↓
onHeadersReceived fires
            ↓
Background Script:
  1. Parse Set-Cookie header
  2. Store: cookieStore[session_abc]['example.com']['/']['newsession'] = {...}
  3. Remove Set-Cookie from response headers
  4. Trigger debounced persistence (1 second)
            ↓
Response delivered to browser without Set-Cookie
            ↓
Page receives response with cookies isolated
```

---

### JavaScript Cookie Capture Flow

```
Page executes: document.cookie = 'preference=darkmode'
            ↓
Cookie override intercepts (injected script)
            ↓
window.postMessage: { type: 'SET_COOKIE', cookie: 'preference=darkmode' }
            ↓
Content script receives message
            ↓
chrome.runtime.sendMessage: { action: 'setCookie', cookie: '...' }
            ↓
Background Script:
  1. Parse cookie string
  2. Determine domain from tab URL
  3. Store: cookieStore[sessionId][domain][path][name]
  4. Trigger debounced persistence
            ↓
Optimistic cache update in page context
            ↓
Page can immediately read: document.cookie (returns updated value)
```

**Parallel Path** (JavaScript API):
```
Page executes: document.cookie = 'preference=darkmode'
            ↓
Browser's native cookie store updated
            ↓
chrome.cookies.onChanged fires
            ↓
Background Script:
  1. Match cookie domain to session tabs
  2. Store in session cookie store
  3. Remove from browser's native store
            ↓
Cookie isolated to session
```

---

### License Activation Flow

```
User enters license key in popup
            ↓
Popup sends: { action: 'activateLicense', licenseKey: 'YEKE...' }
            ↓
License Manager (background):
  1. Generate/retrieve device ID
  2. API call: /api/license/register/device/{deviceId}/{secret}/{key}
     - Default API: https://sandbox.merafsolutions.com (development keys)
     - Response: "Device added successfully"
  3. API call: /api/license/verify/{secret}/{key}
     Response: { status: 'active', max_allowed_devices: 1, ... }
  4. Detect tier: maxDevices=1, maxDomains=999 → 'premium'
  5. Cache license data locally: { key, tier, status, features, ... }
  6. Save to chrome.storage.local
            ↓
Response: { success: true, tier: 'premium', message: '...' }
            ↓
Popup shows: "Welcome to Sessner PREMIUM!"
            ↓
Feature gates unlocked immediately
```

---

### Periodic License Validation Flow

```
Background Script (every hour):
  Check if validation needed (7+ days since last validation)
            ↓
If yes:
  API call: /api/license/validate/{secret}/{key}
            ↓
  Response: "1" (valid, JSON-encoded string) or "0" (invalid)
            ↓
  Parse response: JSON.parse(responseText) to handle quoted format
            ↓
  If '1':
    Update lastValidated timestamp
    Continue with current tier
            ↓
  If '0':
    Mark license as expired
    Downgrade to free tier
    Show notification with correct icon path (icons/icon128.png)
    Send redirectToPopup message to license-details.js
            ↓
    license-details.js receives message:
      Redirects to popup.html (if in extension context)
      Falls back to window.open (if in tab context)
            ↓
  If network error:
    Check grace period (30 days)
    If within grace period:
      Trust cached license
      Show reminder notification
    Else:
      Downgrade to free tier
      Show expiry notification
```

### License Validation Redirect Flow

**Message-Based Redirect Pattern**:

```
Invalid License Detected (license-manager.js)
            ↓
chrome.runtime.sendMessage({ action: 'redirectToPopup' })
            ↓
license-details.js receives message
            ↓
Check context:
  Is this license-details.html (extension popup)?
    → window.location.href = 'popup.html'
  Is this a regular browser tab?
    → chrome.windows.getCurrent() then open popup.html
            ↓
User redirected to main session management UI
```

**Why Message-Based Redirect?**
- Extension popups cannot use `window.open()` directly on invalid pages
- chrome.runtime.sendMessage bridges background → popup communication
- Listener in license-details.js handles redirect in the correct context
- Graceful fallback for edge cases (browser tabs, incognito)

---

## State Management

### Session State

**In-Memory State (background.js)**:
```javascript
const sessionStore = {
  // Tab → Session mapping
  tabToSession: {
    123: 'session_1234567890_abc123',
    456: 'session_1234567890_abc123',
    789: 'session_1234567890_def456'
  },

  // Session metadata
  sessions: {
    'session_1234567890_abc123': {
      id: 'session_1234567890_abc123',
      color: '#FF6B6B',
      createdAt: 1737475200000,
      tabs: [123, 456]
    }
  },

  // Cookie store (hierarchical)
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
            sameSite: 'lax',
            expires: null
          }
        }
      }
    }
  }
};
```

**Persistence (chrome.storage.local)**:
```javascript
{
  sessionStore: {
    sessions: { ... },
    cookieStore: { ... },
    tabToSession: { ... }
  }
}
```

---

### License State

**In-Memory Cache (background.js)**:
```javascript
let licenseCache = {
  key: 'YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1',
  tier: 'premium',
  status: 'active',
  type: 'regular',
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  maxAllowedDomains: 999,
  maxAllowedDevices: 1,
  dateActivated: '2025-10-21T12:00:00.000Z',
  lastValidated: '2025-10-21T12:00:00.000Z',
  deviceId: 'SESSNER_a1b2c3d4e5f6_X7Y8Z9W0V1',
  features: {
    maxSessions: Infinity,
    sessionPersistence: Infinity,
    sessionNaming: true,
    exportImport: true,
    // ... all features
  }
};
```

**Persistence (chrome.storage.local)**:
```javascript
{
  sessner_device_id: 'SESSNER_a1b2c3d4e5f6_X7Y8Z9W0V1',
  sessner_license: { ... licenseCache ... }
}
```

---

### State Synchronization

**Debounced Persistence**:
```javascript
let persistTimer = null;

function persistSessions(immediate = false) {
  if (immediate) {
    clearTimeout(persistTimer);
    saveToChromeStorage();
  } else {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      saveToChromeStorage();
    }, 1000); // 1 second debounce
  }
}
```

**When to Persist Immediately**:
- Session creation
- Session deletion
- Tab closed (session cleanup)
- License activation/deactivation
- Popup window inheritance

**When to Debounce**:
- Cookie updates (can be rapid during login)
- Storage operations
- Periodic validation updates

---

## Persistence Architecture

### Dual-Layer Storage System

**Architecture**: Storage Persistence Manager (2025-10-28)

The extension uses a dual-layer persistence system for reliability and performance:

**Layer 1: chrome.storage.local** (Primary)
- Fast, synchronous access
- 10MB quota
- Automatic browser-level persistence
- Session metadata, cookies, tab mappings

**Layer 2: IndexedDB** (Secondary)
- Asynchronous, transactional
- Larger capacity (based on available disk space)
- Advanced querying capabilities
- Complete session state backup

**Synchronization**: Storage Persistence Manager maintains consistency between both layers through:
- Debounced writes (1 second delay for batch operations)
- Immediate writes for critical operations (session creation/deletion)
- Automatic fallback to cached data if one layer fails

### Storage Quota Management

**chrome.storage.local Quota**: 10MB

**IndexedDB Quota**: Dynamic (based on available disk space, typically 50%+ of free space)

**Typical Usage**:
- 10 sessions with metadata: ~10KB (both layers)
- 1000 cookies: ~500KB (both layers)
- License data: ~5KB (chrome.storage.local only)
- **Total per layer**: <1MB (well under quota)

**Quota Monitoring**:
```javascript
chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
  const quotaPercent = (bytesInUse / 10485760) * 100;
  console.log(`Storage usage: ${quotaPercent.toFixed(2)}%`);
});
```

### Storage Reinitialization (2025-10-28)

**Critical Fix**: After clearing all storage or closing the IndexedDB connection, the Storage Persistence Manager must be properly reinitialized to restore functionality.

**Reinitialization Process**:
1. Close existing database connection
2. Reset initialization flags (`isInitialized = false`, `db = null`, `initPromise = null`)
3. Call `initialize(forceReinit = true)` to open fresh connection
4. Recreate object stores if needed
5. Resume health monitoring

**Force Reinitialization**: The `initialize(forceReinit)` parameter ensures complete state reset:
```javascript
await storagePersistenceManager.initialize(true); // Force fresh initialization
```

---

### Data Recovery

**Extension Crash**:
- In-memory state lost
- Restore from chrome.storage.local on restart
- Sessions survive, cookies survive
- Only lose data from last 1 second (debounce window)

**Browser Restart**:
- Tab IDs change (invalid tab mappings)
- Session metadata and cookies persist
- Tab mappings cleared (orphaned sessions)
- User must create new sessions

**Extension Update**:
- Same as browser restart
- Migration logic in chrome.runtime.onInstalled
- Backward compatibility checks

---

## Session Lifecycle

### 1. Creation

```
User Action → Background creates session → Opens new tab → Maps tab to session
→ Sets badge → Clears browser cookies → Persists
```

**State Changes**:
- `sessions[sessionId] = { id, color, createdAt, tabs: [tabId] }`
- `cookieStore[sessionId] = {}`
- `tabToSession[tabId] = sessionId`

---

### 2. Active Operation

```
Tab navigates → Content scripts inject → Fetch session ID → Install isolation
→ HTTP requests intercepted → Cookies injected/captured → Storage isolated
```

**State Changes**:
- Cookies added to `cookieStore[sessionId][domain][path][name]`
- Debounced persistence triggered

---

### 3. Popup Inheritance

```
Page opens popup (window.open or target="_blank") → webNavigation fires
→ Detect source tab → Inherit session → Add to session.tabs → Set badge → Persist
```

**State Changes**:
- `tabToSession[newTabId] = sourceSessionId`
- `sessions[sourceSessionId].tabs.push(newTabId)`

**Critical For**: OAuth flows, payment popups, downloads

---

### 4. Tab Closure & Session Cleanup (Updated v3.2.4)

```
User closes tab → onRemoved fires → Look up session → Remove from mapping
→ Remove from session.tabs → If no tabs remain: cleanupSession() → Tier-based behavior
```

**State Changes**:
- `delete tabToSession[tabId]`
- `sessions[sessionId].tabs = sessions[sessionId].tabs.filter(...)`
- If `tabs.length === 0`: `cleanupSession(sessionId)` determines fate

**Tier-Based Cleanup Behavior (v3.2.4)**:

| Tier | Auto-Restore | Behavior | Session State | URLs & Cookies |
|------|--------------|----------|---------------|----------------|
| Free | N/A | Convert to DORMANT | Preserved | Saved |
| Premium | N/A | Convert to DORMANT | Preserved | Saved |
| Enterprise | Disabled | Convert to DORMANT | Preserved | Saved |
| Enterprise | Enabled | Delete ephemeral | Deleted | Deleted |

**DORMANT Session**:
- Session metadata preserved with `persistedTabs` array containing tab URLs
- All cookies preserved in `cookieStore`
- Can be manually deleted via UI (X icon) or reopened via "Open Session" button
- URLs restored when session reopened

**Critical Fix (v3.2.4)**:
- Previously: Enterprise tier always deleted sessions (data loss bug)
- Now: Enterprise tier checks auto-restore preference before deletion
- Ensures: Enterprise users without auto-restore don't lose session data

---

### 5. Dormant Session Deletion (New v3.2.4)

```
User clicks X icon on dormant session → Confirmation dialog → If confirmed:
deleteDormantSession() → Multi-layer deletion → UI refresh
```

**Tier Availability**: All Tiers (Free, Premium, Enterprise)

**Deletion Scope**:
- **In-memory**: `sessionStore.sessions`, `sessionStore.cookieStore`, `tabMetadataCache`
- **Persistent**: IndexedDB (sessions, cookies, tab mappings, tab metadata)
- **Persistent**: chrome.storage.local (all data structures synced)

**Validation**:
- Session must exist
- Session must be dormant (no active tabs)
- Cannot delete active sessions

**State Changes**:
- `delete sessionStore.sessions[sessionId]`
- `delete sessionStore.cookieStore[sessionId]`
- `tabMetadataCache` entries cleaned up (defense against stale cache)
- Persistent storage updated immediately (no debounce)

**UI Flow**:
1. User clicks X icon on dormant session card
2. Confirmation dialog: "Are you sure you want to delete this session? This will permanently delete all saved cookies and session data."
3. If confirmed: Button disabled (loading state), send `deleteDormantSession` message
4. Background deletes from all storage layers
5. On success: UI refreshed, session card removed
6. On error: Alert shown with error message

**Related Documentation**:
- API: [docs/api.md - deleteDormantSession](api.md#deletedormantsession)
- Technical: [docs/technical.md - deleteDormantSession()](technical.md#deletedormantsessionsessionid)

---

### 5a. Bulk Dormant Session Deletion (New v3.2.5)

```
User clicks "Delete All" button → Confirmation dialog → If confirmed:
deleteAllDormantSessions() → Sequential multi-layer deletion → UI refresh
```

**Tier Availability**: All Tiers (Free, Premium, Enterprise)

**Flow**:
1. User clicks "Delete All" button (beside "Imported Sessions" title)
2. Confirmation dialog shows count: "Are you sure you want to delete ALL dormant sessions? This will permanently delete all saved cookies and session data for X sessions."
3. If confirmed:
   - Button shows "Deleting..." and is disabled
   - Send `deleteAllDormantSessions` message to background
   - Background identifies all dormant sessions
   - For each session: Delete from memory → Delete from cache → Delete from persistent storage
   - Return results with success count and errors
4. On success: UI refreshed automatically
5. On error: Alert shown with error details

**Deletion Strategy**:
- **Sequential Processing**: One session at a time to ensure atomicity
- **Error Resilience**: Continues deleting even if one fails
- **Same Deletion Logic**: Uses identical multi-layer deletion as single session deletion
- **Comprehensive Logging**: Each session deletion logged for debugging

**Deletion Scope (per session)**:
- **In-memory**: `sessionStore.sessions`, `sessionStore.cookieStore`, `tabMetadataCache`
- **Persistent**: IndexedDB (sessions, cookies, tab mappings, tab metadata)
- **Persistent**: chrome.storage.local (all data structures synced)

**State Changes**:
- For each dormant session:
  - `delete sessionStore.sessions[sessionId]`
  - `delete sessionStore.cookieStore[sessionId]`
  - `tabMetadataCache` entries cleaned up
  - Persistent storage updated via storage manager
- Final state: All dormant sessions removed from all storage layers

**Performance**:
- **Time**: ~50-100ms per session
- **Batch Size**: No limit (processes all dormant sessions)
- **Memory**: Minimal impact (deletes from memory first)
- **I/O**: Sequential writes prevent race conditions

**UI Enhancements**:
- Red-themed button (`#ff6b6b`) indicates destructive action
- Hover effects with background color change
- Disabled state during deletion
- Theme-aware styling (light/dark modes)
- Only visible when dormant sessions exist

**Related Documentation**:
- API: [docs/api.md - deleteAllDormantSessions](api.md#deletealldormantsessions)
- Technical: [docs/technical.md - deleteAllDormantSessions()](technical.md#deletealldormantsessions)

---

### 6. Browser Restart Persistence

**Overview**: Sessions and cookies persist across browser restarts via `chrome.storage.local`.

**Key Architecture Points**:
- **State Restoration**: `loadPersistedSessions()` loads saved sessions, cookies, and tab mappings
- **Race Condition Handling**: 2-second delay + retry logic (3 attempts) for Edge tab restoration timing
- **URL-Based Matching**: Tab IDs change on restart, so tabs matched by URL (domain + path)
- **Startup Grace Period**: `skipCleanup=true` mode prevents premature session deletion during tab restoration
- **Delayed Validation**: 10-second delayed cleanup removes truly orphaned sessions

**Tier-Based Behavior (Auto-Restore Feature - 2025-10-28)**:
- **Free/Premium**: Sessions saved, but tab mappings cleared (no auto-restore)
- **Enterprise Only**: Tab mappings automatically restored via URL-based matching
- See: [Session Persistence & Auto-Restore Tier Restrictions](../features_implementation/05_auto_restore_tier_restrictions.md)

**For Complete Implementation Details**:
- **Browser Restart Fix**: [Session Persistence - Phase 4](../features_implementation/02_session_persistence.md#phase-4-browser-startup-session-deletion-fix)
- **Technical Timing**: [Technical Docs - Section 11](technical.md#11-browser-restart-tab-restoration-timing)
- **Architecture Diagrams**: See feature documentation above

---

## Integration Points

### License System Integration

**Feature Gating**:
```javascript
async function createNewSession(url) {
  const tier = await licenseManager.getTier();
  const features = TIER_FEATURES[tier];

  // Check session limit
  const sessionCount = Object.keys(sessionStore.sessions).length;
  if (sessionCount >= features.maxSessions) {
    return {
      success: false,
      error: `You've reached the session limit (${features.maxSessions}). Upgrade to create more sessions.`
    };
  }

  // Create session...
}
```

**Session Persistence Enforcement**:
```javascript
// Daily cleanup of expired sessions
setInterval(() => {
  const tier = await licenseManager.getTier();
  const features = TIER_FEATURES[tier];

  if (features.sessionPersistence === Infinity) return;

  const expiryDate = Date.now() - (features.sessionPersistence * 24 * 60 * 60 * 1000);

  Object.values(sessionStore.sessions).forEach(session => {
    if (session.tabs.length === 0 && session.createdAt < expiryDate) {
      delete sessionStore.sessions[session.id];
      delete sessionStore.cookieStore[session.id];
    }
  });

  persistSessions(true);
}, 24 * 60 * 60 * 1000); // Daily
```

---

### Upgrade Prompts

**When Session Limit Reached**:
```javascript
if (!canCreateSession) {
  showNotification(
    'Session Limit Reached',
    'You\'ve reached the free tier limit (3 sessions). Upgrade to Premium for unlimited sessions!',
    [
      { title: 'Upgrade Now', callback: openPricingPage },
      { title: 'Manage Sessions', callback: openPopup }
    ]
  );
}
```

**When Feature Unavailable**:
```javascript
if (!await hasFeature('encryption')) {
  showUpgradePrompt(
    'Encryption requires Enterprise',
    'Upgrade to Sessner Enterprise to enable AES-256 encryption for your sessions.',
    'View Plans'
  );
}
```

---

## Security Architecture

### Cookie Isolation Guarantee

**Threat Model**: Prevent cross-session cookie leakage

**Defense Layers**:
1. **Primary**: webRequest interception (HTTP level)
2. **Secondary**: chrome.cookies.onChanged capture (JavaScript level)
3. **Tertiary**: Periodic cookie cleaner (defense in depth)

**Attack Scenarios Handled**:

| Attack Vector | Defense | Layer |
|---------------|---------|-------|
| Set-Cookie header | onHeadersReceived removes header | Layer 1 |
| document.cookie | Override intercepts | Layer 3 |
| fetch() with credentials | chrome.cookies.onChanged | Layer 2 |
| Service worker cookies | Periodic cleaner | Layer 3 |
| Browser internal cookies | Periodic cleaner | Layer 3 |

---

### Storage Isolation Guarantee

**Threat Model**: Prevent cross-session storage leakage

**Defense Mechanism**: ES6 Proxy with session prefixing

**Attack Scenarios Handled**:

| Attack Vector | Defense | Method |
|---------------|---------|--------|
| localStorage.getItem('key') | Proxy get trap | Prefix lookup |
| localStorage.foo | Proxy get trap | Direct access |
| Object.keys(localStorage) | Proxy ownKeys trap | Filter by prefix |
| for...in loop | Proxy ownKeys trap | Enumerate session keys only |
| delete localStorage.foo | Proxy deleteProperty | Delete prefixed key |

---

### Privacy Protection

**Data Collection**: ZERO
- No analytics, no telemetry, no external requests
- Only license validation API calls (every 7 days)

**Data Storage**: Local only
- chrome.storage.local (private to extension)
- Never leaves device
- No cloud backup

**Device ID**: Privacy-preserving
- Browser fingerprint + SHA-256 + random salt
- Not reversible to personal data
- No cross-site tracking
- Used only for license validation

---

### XSS Protection

**Not a Goal**: Extension does NOT protect against XSS

**Why**: XSS runs in page context with full access to session data (by design)

**User Responsibility**: Only navigate to trusted sites within sessions

---

## Performance Architecture

### Memory Usage

**Per Session**: ~10-20KB
- Session metadata: ~1KB
- Cookie store (typical): ~5-10KB
- Tab references: ~1KB

**Per Tab**: ~50-100KB
- Content scripts: ~30KB (loaded per tab)
- Storage proxy: ~10KB heap
- Cookie cache: ~10KB

**Typical Usage** (5 sessions, 15 tabs): ~1.5MB total

---

### CPU Usage

**Idle**: Near zero (event-driven, no polling)

**Active Browsing**:
- WebRequest interception: <1ms per request
- Cookie lookup: O(1) hash map, <0.1ms
- Storage proxy: <0.1ms per operation
- Cookie cleaner: <5ms every 2 seconds

**License Validation**:
- API call: 50-200ms (network-dependent)
- Local check: <1ms
- Runs every 7 days only

---

### Storage I/O Optimization

**Debounced Writes**:
- Batches rapid cookie updates
- Reduces write amplification by 10-100x
- 1 second debounce window

**Immediate Writes (Critical Operations)**:
- Session creation/deletion
- Tab closure
- License activation/deactivation
- Prevents data loss on crash

---

## Related Documentation

- **Extension API**: See [docs/api.md](api.md)
- **Subscription API**: See [docs/subscription_api.md](subscription_api.md)
- **Technical Implementation**: See [docs/technical.md](technical.md)
- **Project Overview**: See [CLAUDE.md](../CLAUDE.md)

---

**Status**: Production Ready
**Architecture Pattern**: SessionBox-Style Virtual Sessions
**Isolation Level**: Complete (cookies, storage, IndexedDB)
**Privacy Level**: 100% Local, 100% Private
