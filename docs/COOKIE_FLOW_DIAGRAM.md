# Cookie Flow Diagram

## Before Fix: HTTP Headers Only

```
┌─────────────────────────────────────────────────────────────┐
│ Website Server                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Response with
                            │ Set-Cookie header
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Extension: onHeadersReceived                                │
│  ✅ Captures HTTP Set-Cookie headers                        │
│  ✅ Stores in session cookieStore                           │
│  ✅ Removes from response                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Response without
                            │ Set-Cookie header
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser/Website                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ JavaScript executes:
                            │ document.cookie = "name=value"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser Cookie Store                                        │
│  ❌ Cookie stored in native browser store                   │
│  ❌ NOT captured by extension                               │
│  ❌ Shared across all tabs                                  │
└─────────────────────────────────────────────────────────────┘

RESULT: Cookie isolation FAILS ❌
```

## After Fix: Dual Capture System

```
┌─────────────────────────────────────────────────────────────┐
│ Website Server                                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Response with
                            │ Set-Cookie header
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Extension: onHeadersReceived (PATH 1)                       │
│  ✅ Captures HTTP Set-Cookie headers                        │
│  ✅ Stores in session cookieStore                           │
│  ✅ Removes from response                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Response without
                            │ Set-Cookie header
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser/Website                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ JavaScript executes:
                            │ document.cookie = "name=value"
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Browser Cookie Store (Temporary)                            │
│  ⚠️ Cookie briefly stored                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ chrome.cookies.onChanged
                            │ event fires
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Extension: chrome.cookies.onChanged (PATH 2) 🆕             │
│  ✅ Detects cookie change                                   │
│  ✅ Copies to session cookieStore                           │
│  ✅ Removes from browser native store                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ Session Cookie Store (Isolated)                             │
│  ✅ Cookies stored per-session                              │
│  ✅ Not in browser native store                             │
│  ✅ Fully isolated between sessions                         │
└─────────────────────────────────────────────────────────────┘

RESULT: Cookie isolation WORKS ✅
```

## Complete Cookie Lifecycle

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. COOKIE SETTING (Website → Extension)                         │
└──────────────────────────────────────────────────────────────────┘
                          ┌─────────────┐
                          │   Website   │
                          └──────┬──────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
          ┌──────────────────┐      ┌──────────────────┐
          │ HTTP Set-Cookie  │      │ JavaScript       │
          │ header           │      │ document.cookie  │
          └────────┬─────────┘      └────────┬─────────┘
                   │                         │
                   ▼                         ▼
          ┌──────────────────┐      ┌──────────────────┐
          │ onHeadersReceived│      │ cookies.onChanged│
          │ listener         │      │ listener 🆕      │
          └────────┬─────────┘      └────────┬─────────┘
                   │                         │
                   └────────────┬────────────┘
                                │
                                ▼
                   ┌────────────────────────┐
                   │ Session Cookie Store   │
                   │ (Per-Session Isolated) │
                   └────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 2. COOKIE CLEANUP (Periodic)                                     │
└──────────────────────────────────────────────────────────────────┘
                          ┌─────────────┐
                          │ setInterval │
                          │ (2 seconds) │
                          └──────┬──────┘
                                 │
                                 ▼
                   ┌────────────────────────┐
                   │ clearBrowserCookies    │
                   │ ForTab()               │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ chrome.cookies.getAll  │
                   │ (check native store)   │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ chrome.cookies.remove  │
                   │ (if any found)         │
                   └────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ 3. COOKIE INJECTION (Extension → Website)                        │
└──────────────────────────────────────────────────────────────────┘
                   ┌────────────────────────┐
                   │ Tab makes HTTP request │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ onBeforeSendHeaders    │
                   │ listener               │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ getSessionForTab()     │
                   │ (which session?)       │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ getCookiesForSession() │
                   │ (get cookies from      │
                   │  session store)        │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ formatCookieHeader()   │
                   │ (format as Cookie:)    │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ Inject Cookie header   │
                   │ into request           │
                   └────────┬───────────────┘
                            │
                            ▼
                   ┌────────────────────────┐
                   │ Request sent to server │
                   │ with session cookies   │
                   └────────────────────────┘
```

## Session Isolation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Browser Window                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ Tab 1           │  │ Tab 2           │  │ Tab 3           ││
│  │ Session A 🔴    │  │ Session A 🔴    │  │ Session B 🔵    ││
│  │ example.com     │  │ example.com     │  │ example.com     ││
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘│
│           │                    │                     │         │
└───────────┼────────────────────┼─────────────────────┼─────────┘
            │                    │                     │
            └──────────┬─────────┘                     │
                       │                               │
                       ▼                               ▼
         ┌──────────────────────────┐   ┌──────────────────────────┐
         │ Session A Cookie Store   │   │ Session B Cookie Store   │
         ├──────────────────────────┤   ├──────────────────────────┤
         │ example.com:             │   │ example.com:             │
         │  - SessionID=abc123      │   │  - SessionID=xyz789      │
         │  - UserToken=user1       │   │  - UserToken=user2       │
         │  - AuthCookie=auth1      │   │  - AuthCookie=auth2      │
         └──────────────────────────┘   └──────────────────────────┘

         Tabs 1 & 2 share cookies      Tab 3 has separate cookies
         Both see same login state      Different login state
```

## Cookie Storage Hierarchy

```
sessionStore
│
├── tabToSession
│   ├── [tabId 1] → "session_xxx"
│   ├── [tabId 2] → "session_xxx"
│   └── [tabId 3] → "session_yyy"
│
├── sessions
│   ├── "session_xxx"
│   │   ├── id: "session_xxx"
│   │   ├── color: "#FF6B6B"
│   │   ├── createdAt: 1234567890
│   │   └── tabs: [1, 2]
│   │
│   └── "session_yyy"
│       ├── id: "session_yyy"
│       ├── color: "#4ECDC4"
│       ├── createdAt: 1234567891
│       └── tabs: [3]
│
└── cookieStore
    ├── "session_xxx"
    │   └── "example.com"
    │       └── "/"
    │           ├── SessionID: { name, value, domain, ... }
    │           ├── UserToken: { name, value, domain, ... }
    │           └── AuthCookie: { name, value, domain, ... }
    │
    └── "session_yyy"
        └── "example.com"
            └── "/"
                ├── SessionID: { name, value, domain, ... }
                ├── UserToken: { name, value, domain, ... }
                └── AuthCookie: { name, value, domain, ... }
```

## Timeline: Cookie Lifecycle

```
Time    Event                           What Happens
────────────────────────────────────────────────────────────────
0ms     User creates session            → sessionId assigned to tab
        │                               → cookieStore[sessionId] = {}
        │
100ms   Initial cookie clearing         → Clear any existing cookies
        │                               → Ensures clean slate
        │
500ms   User navigates to website       → Request intercepted
        │                               → onBeforeSendHeaders fires
        │                               → No cookies to inject (yet)
        │
1000ms  Server responds                 → Response intercepted
        │                               → onHeadersReceived fires
        │                               → Set-Cookie headers captured
        │                               → Stored in session cookieStore
        │
1100ms  JavaScript executes             → document.cookie = "..."
        │                               → Browser stores temporarily
        │
1150ms  chrome.cookies.onChanged        → Extension detects change 🆕
        │                               → Copies to session store
        │                               → Removes from browser store
        │
2000ms  First cleanup cycle             → Check browser cookie store
        │                               → Remove any leaked cookies
        │
4000ms  Second cleanup cycle            → Check again
        │                               → Maintain isolation
        │
6000ms  Third cleanup cycle             → Check again
        │                               → Continuous monitoring
        │
...     Every 2 seconds                 → Cleanup continues
```

## Multi-Session Scenario

```
┌──────────────────────────────────────────────────────────────────┐
│ Session A (Red 🔴)                                               │
├──────────────────────────────────────────────────────────────────┤
│ Tab 1: example.com/dashboard                                     │
│ Tab 2: example.com/profile                                       │
│                                                                  │
│ Cookie Store:                                                    │
│   example.com → SessionID=abc123, User=alice                     │
│                                                                  │
│ Request Flow:                                                    │
│   Tab 1 → example.com/api → Cookie: SessionID=abc123; User=alice│
│   Tab 2 → example.com/api → Cookie: SessionID=abc123; User=alice│
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Session B (Blue 🔵)                                              │
├──────────────────────────────────────────────────────────────────┤
│ Tab 3: example.com/dashboard                                     │
│                                                                  │
│ Cookie Store:                                                    │
│   example.com → SessionID=xyz789, User=bob                       │
│                                                                  │
│ Request Flow:                                                    │
│   Tab 3 → example.com/api → Cookie: SessionID=xyz789; User=bob  │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ Browser Native Cookie Store                                      │
├──────────────────────────────────────────────────────────────────┤
│   example.com → (EMPTY - all cookies removed)                    │
│                                                                  │
│   Cleanup runs every 2 seconds to ensure this stays empty       │
└──────────────────────────────────────────────────────────────────┘
```

## Key Points

1. **Dual Capture**: Cookies captured from both HTTP headers AND JavaScript
2. **Immediate Removal**: Cookies removed from browser store after capture
3. **Periodic Cleanup**: Continuous monitoring prevents leakage
4. **Isolated Storage**: Each session has separate cookie store
5. **Automatic Injection**: Cookies automatically injected per request

## Visual Legend

- ✅ Working correctly
- ❌ Problem/failure
- ⚠️ Temporary state
- 🆕 New feature added
- 🔴 Session A (red)
- 🔵 Session B (blue)
