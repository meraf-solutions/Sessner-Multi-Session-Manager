# Architecture Diagrams

## Visual representations of session isolation approaches

---

## 1. Firefox Containers (Native Implementation)

```
┌─────────────────────────────────────────────────────────────┐
│                     Firefox Browser Core                     │
│                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Container 1│  │ Container 2│  │ Container 3│           │
│  │ (Work)     │  │ (Personal) │  │ (Shopping) │           │
│  │            │  │            │  │            │           │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │           │
│  │ │Cookies │ │  │ │Cookies │ │  │ │Cookies │ │           │
│  │ │Store 1 │ │  │ │Store 2 │ │  │ │Store 3 │ │           │
│  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │           │
│  │            │  │            │  │            │           │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │           │
│  │ │Storage │ │  │ │Storage │ │  │ │Storage │ │           │
│  │ │Context │ │  │ │Context │ │  │ │Context │ │           │
│  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │           │
│  │            │  │            │  │            │           │
│  │ ┌────────┐ │  │ ┌────────┐ │  │ ┌────────┐ │           │
│  │ │  Cache │ │  │ │  Cache │ │  │ │  Cache │ │           │
│  │ │Partition│  │ │Partition│  │ │Partition│  │           │
│  │ └────────┘ │  │ └────────┘ │  │ └────────┘ │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                              │
│  Native Browser API: contextualIdentities                   │
│  • cookieStoreId: "firefox-container-1"                     │
│  • Full isolation by browser engine                         │
│  • No performance overhead                                  │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Browser-level enforcement
- Separate cookie stores with unique IDs
- Complete storage isolation
- Cache partitioning per container
- Zero performance impact

---

## 2. Chrome Profiles (Separate Browser Instances)

```
┌─────────────────────────────────────────────────────────────┐
│                      Operating System                        │
│                                                              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐   │
│  │Chrome Profile│   │Chrome Profile│   │Chrome Profile│   │
│  │   Instance 1 │   │   Instance 2 │   │   Instance 3 │   │
│  │  (Window 1)  │   │  (Window 2)  │   │  (Window 3)  │   │
│  │              │   │              │   │              │   │
│  │ ┌──────────┐ │   │ ┌──────────┐ │   │ ┌──────────┐ │   │
│  │ │Entire    │ │   │ │Entire    │ │   │ │Entire    │ │   │
│  │ │Browser   │ │   │ │Browser   │ │   │ │Browser   │ │   │
│  │ │Data      │ │   │ │Data      │ │   │ │Data      │ │   │
│  │ │          │ │   │ │          │ │   │ │          │ │   │
│  │ │• Cookies │ │   │ │• Cookies │ │   │ │• Cookies │ │   │
│  │ │• Storage │ │   │ │• Storage │ │   │ │• Storage │ │   │
│  │ │• Cache   │ │   │ │• Cache   │ │   │ │• Cache   │ │   │
│  │ │• History │ │   │ │• History │ │   │ │• History │ │   │
│  │ │• Ext.    │ │   │ │• Ext.    │ │   │ │• Ext.    │ │   │
│  │ │• Settings│ │   │ │• Settings│ │   │ │• Settings│ │   │
│  │ └──────────┘ │   │ └──────────┘ │   │ └──────────┘ │   │
│  │              │   │              │   │              │   │
│  │  ~400MB RAM  │   │  ~400MB RAM  │   │  ~400MB RAM  │   │
│  └──────────────┘   └──────────────┘   └──────────────┘   │
│                                                              │
│  Total Memory: 1.2GB+ for 3 profiles                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Complete isolation (separate processes)
- Heavy resource usage
- Separate windows (not per-tab)
- Cannot create programmatically
- Best isolation quality in Chrome ecosystem

---

## 3. Chrome Extension Cookie Swapping Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension Architecture                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Background Script                           │
│  (Service Worker / Persistent Background Page)                   │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │          Session Manager                                │    │
│  │                                                         │    │
│  │  sessions: Map {                                       │    │
│  │    'session-1': {                                      │    │
│  │      cookies: { 'example.com': { 'sid': 'abc123' } }  │    │
│  │      storage: { 'example.com': { 'key': 'value' } }   │    │
│  │      color: '#FF6B6B'                                  │    │
│  │    }                                                    │    │
│  │  }                                                      │    │
│  │                                                         │    │
│  │  tabSessions: Map {                                    │    │
│  │    123: 'session-1',                                   │    │
│  │    456: 'session-2'                                    │    │
│  │  }                                                      │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │      chrome.webRequest Listeners (MV2 only)            │    │
│  │                                                         │    │
│  │  onBeforeSendHeaders ──────────────────┐              │    │
│  │   • Read tab ID                        │              │    │
│  │   • Get session for tab                │              │    │
│  │   • Inject session cookies     [Cookie Swap]          │    │
│  │   • Remove browser cookies             │              │    │
│  │                                        ↓              │    │
│  │                              To Website              │    │
│  │                                        ↑              │    │
│  │  onHeadersReceived ────────────────────┘              │    │
│  │   • Capture Set-Cookie headers  [Cookie Capture]     │    │
│  │   • Store in session storage                          │    │
│  │   • Remove from response                              │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  chrome.storage.local                                           │
│   └─ Persistent session data                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Tabs                             │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │  Tab 123        │  │  Tab 456        │  │  Tab 789        ││
│  │  (Session 1)    │  │  (Session 2)    │  │  (No Session)   ││
│  │                 │  │                 │  │                 ││
│  │  [Color Bar]    │  │  [Color Bar]    │  │                 ││
│  │  ████████       │  │  ████████       │  │                 ││
│  │                 │  │                 │  │                 ││
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐││
│  │ │Content      │ │  │ │Content      │ │  │ │Content      │││
│  │ │Script       │ │  │ │Script       │ │  │ │Script       │││
│  │ │             │ │  │ │             │ │  │ │(Inactive)   │││
│  │ │Injected at  │ │  │ │Injected at  │ │  │ │             │││
│  │ │document_    │ │  │ │document_    │ │  │ │             │││
│  │ │start        │ │  │ │start        │ │  │ │             │││
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘││
│  │                 │  │                 │  │                 ││
│  │ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐││
│  │ │Injected     │ │  │ │Injected     │ │  │ │Native       │││
│  │ │Script in    │ │  │ │Script in    │ │  │ │Browser      │││
│  │ │Page Context │ │  │ │Page Context │ │  │ │Context      │││
│  │ │             │ │  │ │             │ │  │ │             │││
│  │ │document     │ │  │ │document     │ │  │ │document     │││
│  │ │.cookie      │ │  │ │.cookie      │ │  │ │.cookie      │││
│  │ │[Overridden] │ │  │ │[Overridden] │ │  │ │[Native]     │││
│  │ │             │ │  │ │             │ │  │ │             │││
│  │ │localStorage │ │  │ │localStorage │ │  │ │localStorage │││
│  │ │[Proxied]    │ │  │ │[Proxied]    │ │  │ │[Native]     │││
│  │ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘││
│  └─────────────────┘  └─────────────────┘  └─────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              ↕
┌─────────────────────────────────────────────────────────────────┐
│                       Extension Popup UI                         │
│                                                                  │
│   ┌─────────────────────────────────────────────────────┐      │
│   │  Active Sessions                                     │      │
│   │                                                      │      │
│   │  ● Work Session    [Open Tab]   [Delete]           │      │
│   │  ● Personal        [Open Tab]   [Delete]           │      │
│   │  ● Shopping        [Open Tab]   [Delete]           │      │
│   │                                                      │      │
│   │  [+ New Session]                                    │      │
│   └─────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Request Flow: Cookie Swapping in Detail

```
┌──────────────────────────────────────────────────────────────────┐
│                    HTTP Request Flow                              │
└──────────────────────────────────────────────────────────────────┘

Web Page                Extension               Chrome              Server
   │                        │                      │                  │
   │ 1. User clicks link   │                      │                  │
   │───────────────────────>│                      │                  │
   │                        │                      │                  │
   │                        │ 2. Navigation starts │                  │
   │                        │<─────────────────────│                  │
   │                        │                      │                  │
   │                        │ 3. Get tab session   │                  │
   │                        │    mapping           │                  │
   │                        │                      │                  │
   │                        │                      │ 4. HTTP Request  │
   │                        │                      │    (no cookies)  │
   │                        │                      │─────────────────>│
   │                        │                      │                  │
   │                        │ 5. onBeforeSend      │                  │
   │                        │    Headers event     │                  │
   │                        │<─────────────────────│                  │
   │                        │                      │                  │
   │                        │ 6. Load session      │                  │
   │                        │    cookies from      │                  │
   │                        │    storage           │                  │
   │                        │                      │                  │
   │                        │ 7. Modify request    │                  │
   │                        │    headers:          │                  │
   │                        │    Cookie: sid=abc   │                  │
   │                        │─────────────────────>│                  │
   │                        │                      │                  │
   │                        │                      │ 8. Send request  │
   │                        │                      │    with session  │
   │                        │                      │    cookies       │
   │                        │                      │─────────────────>│
   │                        │                      │                  │
   │                        │                      │ 9. HTTP Response │
   │                        │                      │    Set-Cookie:   │
   │                        │                      │    sid=xyz       │
   │                        │                      │<─────────────────│
   │                        │                      │                  │
   │                        │ 10. onHeadersReceived│                  │
   │                        │     event            │                  │
   │                        │<─────────────────────│                  │
   │                        │                      │                  │
   │                        │ 11. Extract Set-     │                  │
   │                        │     Cookie headers   │                  │
   │                        │     and store in     │                  │
   │                        │     session          │                  │
   │                        │                      │                  │
   │                        │ 12. Remove Set-      │                  │
   │                        │     Cookie from      │                  │
   │                        │     response         │                  │
   │                        │─────────────────────>│                  │
   │                        │                      │                  │
   │ 13. Page loads         │                      │                  │
   │    (no cookies in      │                      │                  │
   │    browser)            │                      │                  │
   │<───────────────────────────────────────────────                  │
   │                        │                      │                  │
   │ 14. Page JS reads      │                      │                  │
   │     document.cookie    │                      │                  │
   │     (returns empty)    │                      │                  │
   │                        │                      │                  │
   │ 15. Content script     │                      │                  │
   │     override returns   │                      │                  │
   │     session cookies    │                      │                  │
   │     from sessionStorage│                      │                  │
   │                        │                      │                  │

KEY:
───>  Normal flow
═══>  Modified by extension
```

---

## 5. document.cookie Override Implementation

```
┌──────────────────────────────────────────────────────────────────┐
│                JavaScript Execution Context                       │
└──────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  Page Context (MAIN world)                                      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Original document.cookie (Native Browser API)           │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │ get() → Returns browser cookie store              │  │ │
│  │  │ set() → Sets cookie in browser                    │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                            ↓                                    │
│                    [INTERCEPTED BY]                             │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Overridden document.cookie (Extension Injected)         │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │ Object.defineProperty(document, 'cookie', {       │  │ │
│  │  │                                                    │  │ │
│  │  │   get: function() {                               │  │ │
│  │  │     // Read from sessionStorage                   │  │ │
│  │  │     const key = '__session_' + SESSION_ID;        │  │ │
│  │  │     return sessionStorage.getItem(key) || '';     │  │ │
│  │  │   },                                               │  │ │
│  │  │                                                    │  │ │
│  │  │   set: function(value) {                          │  │ │
│  │  │     // Parse cookie string                        │  │ │
│  │  │     const [name, val] = value.split('=');        │  │ │
│  │  │                                                    │  │ │
│  │  │     // Get existing cookies                       │  │ │
│  │  │     const key = '__session_' + SESSION_ID;        │  │ │
│  │  │     let cookies = sessionStorage.getItem(key);    │  │ │
│  │  │                                                    │  │ │
│  │  │     // Merge and store                            │  │ │
│  │  │     // ... cookie parsing logic ...               │  │ │
│  │  │     sessionStorage.setItem(key, newValue);        │  │ │
│  │  │                                                    │  │ │
│  │  │     // Notify background                          │  │ │
│  │  │     chrome.runtime.sendMessage({...});            │  │ │
│  │  │   }                                                │  │ │
│  │  │                                                    │  │ │
│  │  │ });                                                │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                            ↓                                    │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  sessionStorage (Per-Tab Browser API)                   │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │ '__session_123_cookies': 'sid=abc; uid=xyz'       │  │ │
│  │  │ '__session_123_storage': '{...}'                  │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Page JavaScript Access:
┌─────────────────────────────────────────────────────────────┐
│ // Website code (unmodified)                                 │
│ console.log(document.cookie);                                │
│ // Returns: "sid=abc; uid=xyz"                              │
│ // (from sessionStorage, not browser cookie store)          │
│                                                              │
│ document.cookie = "new_cookie=value";                        │
│ // Stored in sessionStorage with session prefix             │
│ // NOT stored in browser cookie store                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. localStorage Proxy Implementation

```
┌──────────────────────────────────────────────────────────────────┐
│              localStorage Isolation via Proxy                     │
└──────────────────────────────────────────────────────────────────┘

Original localStorage Access:
┌──────────────────────────────────────────────────────────────┐
│ localStorage.setItem('user', 'john');                         │
│ localStorage.getItem('user'); // returns 'john'              │
│                                                               │
│ Browser Storage (Shared across all tabs on same domain):     │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ 'user': 'john'                                          │   │
│ │ 'theme': 'dark'                                         │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

Proxied localStorage Access (Session Isolation):
┌──────────────────────────────────────────────────────────────┐
│ // Session 1 (Tab A)                                          │
│ localStorage.setItem('user', 'john');                         │
│                                                               │
│ // Translated to:                                            │
│ // actualStorage.setItem('__session_1__user', 'john');      │
│                                                               │
│ // Session 2 (Tab B)                                          │
│ localStorage.setItem('user', 'jane');                         │
│                                                               │
│ // Translated to:                                            │
│ // actualStorage.setItem('__session_2__user', 'jane');      │
│                                                               │
│ Browser Storage (Prefixed by session):                       │
│ ┌────────────────────────────────────────────────────────┐   │
│ │ '__session_1__user': 'john'                            │   │
│ │ '__session_1__theme': 'dark'                           │   │
│ │ '__session_2__user': 'jane'                            │   │
│ │ '__session_2__theme': 'light'                          │   │
│ │ 'some_other_key': 'shared'  ← Not session-specific    │   │
│ └────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

Proxy Implementation:
┌──────────────────────────────────────────────────────────────┐
│ const prefix = '__session_' + SESSION_ID + '__';              │
│ const originalStorage = window.localStorage;                 │
│                                                               │
│ window.localStorage = new Proxy(originalStorage, {           │
│   get(target, prop) {                                        │
│     if (prop === 'getItem') {                                │
│       return (key) => target.getItem(prefix + key);          │
│     }                                                         │
│     if (prop === 'setItem') {                                │
│       return (key, val) => target.setItem(prefix + key, val);│
│     }                                                         │
│     if (prop === 'removeItem') {                             │
│       return (key) => target.removeItem(prefix + key);       │
│     }                                                         │
│     if (prop === 'clear') {                                  │
│       return () => {                                          │
│         // Only clear session-prefixed items                 │
│         for (let i = target.length - 1; i >= 0; i--) {       │
│           const key = target.key(i);                          │
│           if (key.startsWith(prefix)) {                      │
│             target.removeItem(key);                           │
│           }                                                   │
│         }                                                     │
│       };                                                      │
│     }                                                         │
│     if (prop === 'key') {                                    │
│       return (index) => {                                     │
│         // Return only session keys                          │
│         const sessionKeys = [];                               │
│         for (let i = 0; i < target.length; i++) {            │
│           const key = target.key(i);                          │
│           if (key.startsWith(prefix)) {                      │
│             sessionKeys.push(key.substring(prefix.length));   │
│           }                                                   │
│         }                                                     │
│         return sessionKeys[index];                            │
│       };                                                      │
│     }                                                         │
│     if (prop === 'length') {                                 │
│       let count = 0;                                          │
│       for (let i = 0; i < target.length; i++) {              │
│         if (target.key(i).startsWith(prefix)) count++;       │
│       }                                                       │
│       return count;                                           │
│     }                                                         │
│     return target[prop];                                      │
│   }                                                           │
│ });                                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Session Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│                    Session Lifecycle                              │
└──────────────────────────────────────────────────────────────────┘

User Action                Background Script              Browser
    │                            │                           │
    │ 1. Click "New Session"    │                           │
    │────────────────────────────>│                           │
    │                            │                           │
    │                            │ 2. Generate session ID    │
    │                            │    session-1649123456-abc │
    │                            │                           │
    │                            │ 3. Create session object  │
    │                            │    { id, name, color,    │
    │                            │      cookies: {},         │
    │                            │      storage: {} }        │
    │                            │                           │
    │                            │ 4. Store in chrome.storage│
    │                            │                           │
    │                            │ 5. Open new tab           │
    │                            │───────────────────────────>│
    │                            │                           │
    │                            │                           │ 6. Tab created
    │                            │                           │    tabId: 123
    │                            │<───────────────────────────│
    │                            │                           │
    │                            │ 7. Map tab to session     │
    │                            │    tabSessions[123] =     │
    │                            │    'session-1649...'      │
    │                            │                           │
    │                            │ 8. Inject session script  │
    │                            │───────────────────────────>│
    │                            │                           │
    │                            │                           │ 9. Content script
    │                            │                           │    injects overrides
    │                            │                           │    - document.cookie
    │                            │                           │    - localStorage
    │                            │                           │
    │ 10. User browses           │                           │
    │────────────────────────────────────────────────────────>│
    │                            │                           │
    │                            │                           │ 11. HTTP requests
    │                            │ 12. onBeforeSend events   │     intercepted
    │                            │<───────────────────────────│
    │                            │                           │
    │                            │ 13. Cookie swapping       │
    │                            │───────────────────────────>│
    │                            │                           │
    │                            │                           │ (Session active)
    │                            │                           │ ...user browses...
    │                            │                           │
    │ 14. Close tab             │                           │
    │────────────────────────────────────────────────────────>│
    │                            │                           │
    │                            │                           │ 15. Tab closed
    │                            │ 16. chrome.tabs.onRemoved │     event
    │                            │<───────────────────────────│
    │                            │                           │
    │                            │ 17. Get session for tab   │
    │                            │     sessionId = tabSessions│
    │                            │     .get(123)             │
    │                            │                           │
    │                            │ 18. If ephemeral:         │
    │                            │     Delete session data   │
    │                            │     - Remove from map     │
    │                            │     - Clear cookies       │
    │                            │     - Clear storage       │
    │                            │     - Update chrome.storage│
    │                            │                           │
    │ 19. Session cleaned up    │                           │
    │<────────────────────────────                           │
    │                            │                           │

Persistent Sessions (non-ephemeral):
    │                            │                           │
    │ Close tab                 │                           │
    │────────────────────────────────────────────────────────>│
    │                            │                           │
    │                            │ Session data KEPT         │
    │                            │ Can reopen later          │
    │                            │                           │
    │ Click session in popup    │                           │
    │────────────────────────────>│                           │
    │                            │                           │
    │                            │ Open new tab with         │
    │                            │ existing session          │
    │                            │───────────────────────────>│
    │                            │                           │
    │                            │ Cookies/storage restored  │
```

---

## 8. What Gets Isolated vs What Doesn't

```
┌──────────────────────────────────────────────────────────────────┐
│                      Isolation Capabilities                       │
└──────────────────────────────────────────────────────────────────┘

✅ ISOLATED (Chrome Extension Approach)
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐   │
│  │ Session 1  │      │ Session 2  │      │ Session 3  │   │
│  │            │      │            │      │            │   │
│  │ Cookies    │  ✅  │ Cookies    │  ✅  │ Cookies    │   │
│  │ (90%)      │──────│ (different)│──────│ (different)│   │
│  │            │      │            │      │            │   │
│  │ localStorage│ ✅  │ localStorage│ ✅  │ localStorage│   │
│  │ (95%)      │──────│ (different)│──────│ (different)│   │
│  │            │      │            │      │            │   │
│  │sessionStorage ✅  │sessionStorage ✅  │sessionStorage   │
│  │ (100%)     │──────│ (different)│──────│ (different)│   │
│  │            │      │            │      │            │   │
│  └────────────┘      └────────────┘      └────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

❌ NOT ISOLATED (Shared Across Sessions)
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐   │
│  │ Session 1  │      │ Session 2  │      │ Session 3  │   │
│  │            │      │            │      │            │   │
│  │ HTTP Cache │  ❌  │ HTTP Cache │  ❌  │ HTTP Cache │   │
│  │            │══════│ (SHARED)   │══════│            │   │
│  │            │      │            │      │            │   │
│  │ IndexedDB  │  ❌  │ IndexedDB  │  ❌  │ IndexedDB  │   │
│  │            │══════│ (SHARED)   │══════│            │   │
│  │            │      │            │      │            │   │
│  │Service     │  ❌  │Service     │  ❌  │Service     │   │
│  │Workers     │══════│Workers     │══════│Workers     │   │
│  │            │      │(SHARED)    │      │            │   │
│  │            │      │            │      │            │   │
│  │Browser     │  ❌  │Browser     │  ❌  │Browser     │   │
│  │Fingerprint │══════│Fingerprint │══════│Fingerprint │   │
│  │            │      │(SAME)      │      │            │   │
│  │            │      │            │      │            │   │
│  │TLS Session │  ❌  │TLS Session │  ❌  │TLS Session │   │
│  │Cache       │══════│Cache       │══════│Cache       │   │
│  │            │      │(SHARED)    │      │            │   │
│  │            │      │            │      │            │   │
│  │DNS Cache   │  ❌  │DNS Cache   │  ❌  │DNS Cache   │   │
│  │            │══════│            │══════│            │   │
│  │            │      │(SHARED)    │      │            │   │
│  └────────────┘      └────────────┘      └────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Legend:
  ✅  ────  Isolated (separate per session)
  ❌  ════  Shared (same across all sessions)
```

---

## 9. Performance Impact Comparison

```
┌──────────────────────────────────────────────────────────────────┐
│                  Request Latency Breakdown                        │
└──────────────────────────────────────────────────────────────────┘

Native Browser (No Extension):
│
├─ DNS Lookup:           10ms ████
├─ TCP Connect:          20ms ████████
├─ TLS Handshake:        30ms ████████████
├─ HTTP Request:          5ms ██
├─ Server Processing:    50ms ████████████████████
├─ HTTP Response:        10ms ████
├─ Browser Processing:   15ms ██████
│
└─ Total:               140ms

Chrome Extension (Cookie Swapping):
│
├─ DNS Lookup:           10ms ████
├─ TCP Connect:          20ms ████████
├─ TLS Handshake:        30ms ████████████
├─ ⚠️ Extension Hook:     8ms ███ ← ADDED OVERHEAD
├─ HTTP Request:          5ms ██
├─ Server Processing:    50ms ████████████████████
├─ HTTP Response:        10ms ████
├─ ⚠️ Extension Hook:    12ms █████ ← ADDED OVERHEAD
├─ Browser Processing:   15ms ██████
│
└─ Total:               160ms (+14% slower)

Breakdown of Extension Overhead:
  onBeforeSendHeaders:
    - Get tab ID:                    0.5ms
    - Lookup session:                1ms
    - Read cookies from storage:     3ms
    - Parse/serialize cookies:       2ms
    - Modify headers:                1.5ms
    ───────────────────────────────────────
    Total:                           8ms

  onHeadersReceived:
    - Get tab ID:                    0.5ms
    - Lookup session:                1ms
    - Parse Set-Cookie headers:      3ms
    - Store in chrome.storage:       5ms
    - Modify response headers:       2.5ms
    ───────────────────────────────────────
    Total:                          12ms
```

---

## 10. Memory Usage Comparison

```
┌──────────────────────────────────────────────────────────────────┐
│                    Memory Usage Analysis                          │
└──────────────────────────────────────────────────────────────────┘

Chrome with 3 Profiles (Separate Windows):
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Profile 1│  │ Profile 2│  │ Profile 3│
│          │  │          │  │          │
│ 450 MB   │  │ 450 MB   │  │ 450 MB   │
│          │  │          │  │          │
│ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │
│ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │  │ ▓▓▓▓▓▓▓▓ │
└──────────┘  └──────────┘  └──────────┘
Total: 1,350 MB

Chrome with Extension (3 Sessions):
┌────────────────────────────────────────┐
│ Single Chrome Instance                 │
│                                        │
│ Base:                    400 MB        │
│ Extension overhead:       10 MB        │
│ Session 1 data:            2 MB        │
│ Session 2 data:            2 MB        │
│ Session 3 data:            2 MB        │
│                                        │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │
│ ▓▓▓▓▓▓▓▓                               │
└────────────────────────────────────────┘
Total: 416 MB

Memory Savings: ~930 MB (69% reduction!)

Per-Session Memory Breakdown (Extension):
┌─────────────────────────────────────┐
│ Session Data Structure:             │
│  - Session metadata:       1 KB     │
│  - Cookies (50 avg):      15 KB     │
│  - localStorage data:     50 KB     │
│  - Internal bookkeeping:  10 KB     │
│  - V8 object overhead:    24 KB     │
│                                     │
│ Total per session:      ~100 KB     │
│                                     │
│ 10 sessions:            ~1 MB       │
│ 100 sessions:          ~10 MB       │
└─────────────────────────────────────┘
```

---

This comprehensive set of diagrams illustrates the different approaches to session isolation, their architectures, data flows, and trade-offs. The Chrome extension approach using cookie swapping provides a practical middle ground between true isolation (Firefox Containers, Chrome Profiles) and no isolation.
