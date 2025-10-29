# Extension API Documentation
## Sessner  Multi-Session Manager

**Last Updated:** 2025-10-28
**Extension Version:** 3.0
**Manifest Version:** 2

---

## Table of Contents

1. [Overview](#overview)
2. [Message Passing Architecture](#message-passing-architecture)
3. [Background Script API](#background-script-api)
4. [Content Script API](#content-script-api)
5. [Popup UI API](#popup-ui-api)
6. [Chrome Extension APIs Used](#chrome-extension-apis-used)
7. [Event Listeners](#event-listeners)
8. [Error Handling](#error-handling)
9. [Code Examples](#code-examples)

---

## Overview

Sessner uses Chrome's message passing API for communication between different components:

- **Background Script** (`background.js`): Persistent background page managing session state
- **Content Scripts** (`content-script-storage.js`, `content-script-cookie.js`): Injected into web pages
- **Popup UI** (`popup.js`, `popup-license.js`): User interface for session and license management

### Communication Flow

```
                      chrome.runtime.sendMessage
   +-----------+           ------>              +--------------+
   | Popup UI  |                                |  Background  |
   |           |   <------                      |    Script    |
   +-----------+       Response (callback)      +--------------+
                                                        |
                                           chrome.runtime.sendMessage
                                                        |
                                                        v
                                                 +--------------+
                                                 |   Content    |
                                                 |   Scripts    |
                                                 +--------------+
```
---

## Message Passing Architecture

### Message Format

All messages follow a consistent structure:

```javascript
// Request
{
  action: string,      // Required: Action to perform
  ...params            // Optional: Action-specific parameters
}

// Response
{
  success: boolean,    // Required: Operation status
  ...data              // Optional: Response data
}
```

### Sending Messages

**From Popup/Content Script to Background:**
```javascript
chrome.runtime.sendMessage(
  { action: 'actionName', param1: 'value1' },
  (response) => {
    if (response.success) {
      console.log('Success:', response);
    } else {
      console.error('Error:', response.error);
    }
  }
);
```

**From Background to Content Script:**
```javascript
chrome.tabs.sendMessage(
  tabId,
  { action: 'actionName', param1: 'value1' },
  (response) => {
    // Handle response
  }
);
```

### Error Handling Pattern

```javascript
chrome.runtime.sendMessage(message, (response) => {
  if (chrome.runtime.lastError) {
    console.error('Message error:', chrome.runtime.lastError.message);
    return;
  }

  if (!response || !response.success) {
    console.error('Action failed:', response?.error || 'Unknown error');
    return;
  }

  // Success
  console.log('Action completed:', response);
});
```

---

## Background Script API

### Session Management

#### canCreateSession

**Status:** ✅ Tested & Working (2025-10-21)

Checks if a new session can be created based on current tier limits.

**Request:**
```javascript
{
  action: 'canCreateSession'
}
```

**Response:**
```javascript
{
  success: boolean,
  allowed: boolean,        // true if session creation is allowed
  tier: string,            // 'free', 'premium', or 'enterprise'
  current: number,         // Current active session count
  limit: number,           // Maximum allowed sessions (Infinity for Premium/Enterprise)
  reason?: string          // Error message if not allowed
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'canCreateSession' },
  (response) => {
    if (response.success) {
      if (response.allowed) {
        console.log(`Can create session: ${response.current}/${response.limit}`);
        // Proceed with session creation
      } else {
        console.log(`Session limit reached: ${response.reason}`);
        // Show upgrade prompt
      }
    }
  }
);
```

---

#### getSessionStatus

**Status:** ✅ Tested & Working (2025-10-21)

Retrieves the current session status for UI display (count, limit, tier).

**Request:**
```javascript
{
  action: 'getSessionStatus'
}
```

**Response:**
```javascript
{
  success: boolean,
  canCreateNew: boolean,   // true if new session can be created
  isOverLimit: boolean,    // true if current count exceeds limit (graceful degradation)
  activeCount: number,     // Current active session count (only tabs with sessions)
  limit: number,           // Maximum allowed sessions (Infinity for Premium/Enterprise)
  tier: string             // 'free', 'premium', or 'enterprise'
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'getSessionStatus' },
  (response) => {
    if (response.success) {
      const display = response.limit === Infinity
        ? `${response.activeCount} / ∞ sessions`
        : `${response.activeCount} / ${response.limit} sessions`;

      console.log(`Status: ${display}`);
      console.log(`Can create new: ${response.canCreateNew}`);
    }
  }
);
```

---

#### createNewSession

Creates a new isolated session and opens it in a new tab.

**Request:**
```javascript
{
  action: 'createNewSession',
  url: string  // Optional: URL to open (defaults to 'about:blank')
}
```

**Response:**
```javascript
{
  success: boolean,
  sessionId: string,     // e.g., 'session_1234567890_abc123'
  tabId: number,         // Chrome tab ID
  color: string,         // e.g., '#FF6B6B'
  error?: string         // If success=false
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'createNewSession',
    url: 'https://example.com'
  },
  (response) => {
    if (response.success) {
      console.log(`Session ${response.sessionId} created in tab ${response.tabId}`);
      console.log(`Badge color: ${response.color}`);
    }
  }
);
```

**Error Conditions:**
- Session limit reached (Free tier: 3 sessions)
- Invalid URL format

---

#### getActiveSessions

Retrieves all active sessions with their tabs.

**Request:**
```javascript
{
  action: 'getActiveSessions'
}
```

**Response:**
```javascript
{
  success: boolean,
  sessions: Array<{
    id: string,
    color: string,
    createdAt: number,
    tabs: Array<{
      id: number,
      title: string,
      url: string,
      favIconUrl: string
    }>
  }>
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'getActiveSessions' },
  (response) => {
    if (response.success) {
      response.sessions.forEach(session => {
        console.log(`Session ${session.id}: ${session.tabs.length} tabs`);
        session.tabs.forEach(tab => {
          console.log(`  - ${tab.title} (${tab.url})`);
        });
      });
    }
  }
);
```

---

#### getSessionId

Gets the session ID for the current tab (called by content scripts).

**Request:**
```javascript
{
  action: 'getSessionId'
}
```

**Response:**
```javascript
{
  success: boolean,
  sessionId: string,  // null if tab has no session
  error?: string
}
```

**Example:**
```javascript
// From content script
chrome.runtime.sendMessage(
  { action: 'getSessionId' },
  (response) => {
    if (response.success) {
      const sessionId = response.sessionId || 'default';
      console.log(`Current session: ${sessionId}`);
    }
  }
);
```

---

#### switchToTab

Switches browser focus to a specific tab.

**Request:**
```javascript
{
  action: 'switchToTab',
  tabId: number
}
```

**Response:**
```javascript
{
  success: boolean,
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'switchToTab',
    tabId: 123
  },
  (response) => {
    if (response.success) {
      console.log('Switched to tab successfully');
    }
  }
);
```

---

### Session Naming (Premium/Enterprise) - v3.1.0

Custom session names for easier session identification.

#### `setSessionName`

Set or update a custom name for a session.

**Request:**
```javascript
chrome.runtime.sendMessage({
  action: 'setSessionName',
  sessionId: 'session_1234567890_abc123',
  name: 'Work Gmail'
}, response => {
  console.log(response);
});
```

**Response (Success):**
```javascript
{
  success: true,
  sessionId: 'session_1234567890_abc123',
  name: 'Work Gmail',
  tier: 'premium'
}
```

**Response (Validation Error):**
```javascript
{
  success: false,
  message: 'Session name already exists. Please choose a different name.'
}
```

**Response (Tier Restricted):**
```javascript
{
  success: false,
  message: 'Session naming is a Premium feature',
  requiresUpgrade: true,
  tier: 'premium'
}
```

**Validation Rules:**
- Max 50 characters (emoji-aware)
- No duplicates (case-insensitive)
- No HTML characters: `< > " ' \``
- Whitespace trimmed and collapsed
- Premium or Enterprise tier required

#### `getSessionName`

Retrieve the custom name for a session.

**Request:**
```javascript
chrome.runtime.sendMessage({
  action: 'getSessionName',
  sessionId: 'session_1234567890_abc123'
}, response => {
  console.log(response);
});
```

**Response (With Name):**
```javascript
{
  success: true,
  sessionId: 'session_1234567890_abc123',
  name: 'Work Gmail'
}
```

**Response (No Name):**
```javascript
{
  success: true,
  sessionId: 'session_1234567890_abc123',
  name: null
}
```

#### `clearSessionName`

Clear the custom name for a session (revert to session ID).

**Request:**
```javascript
chrome.runtime.sendMessage({
  action: 'clearSessionName',
  sessionId: 'session_1234567890_abc123'
}, response => {
  console.log(response);
});
```

**Response (Success):**
```javascript
{
  success: true,
  sessionId: 'session_1234567890_abc123'
}
```

**Usage Example:**
```javascript
// Set session name
const response = await sendMessage({
  action: 'setSessionName',
  sessionId: sessionId,
  name: '🎨 Personal Account'
});

if (response.success) {
  console.log('Name set:', response.name);
} else {
  console.error('Error:', response.message);
}
```

---

### Auto-Restore Management

**Status:** ✅ Implemented (2025-10-28) - Enterprise-Only Feature

Auto-restore is an Enterprise-exclusive feature that automatically reconnects session-to-tab mappings after browser restart using URL-based matching.

#### getAutoRestorePreference

Gets the user's auto-restore preference settings.

**Request:**
```javascript
{
  action: 'getAutoRestorePreference'
}
```

**Response:**
```javascript
{
  success: boolean,
  enabled: boolean,              // true if auto-restore enabled
  tier: string,                  // 'free', 'premium', or 'enterprise'
  isEnterpriseOnly: boolean,     // Always true (metadata for UI)
  disabledReason?: string,       // 'tier_downgrade', 'migration_tier_restriction', or undefined
  previousTier?: string,         // Previous tier before downgrade (if applicable)
  newTier?: string,              // New tier after downgrade (if applicable)
  disabledAt?: number,           // Timestamp when disabled (if applicable)
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'getAutoRestorePreference' },
  (response) => {
    if (response.success) {
      console.log(`Auto-restore enabled: ${response.enabled}`);
      console.log(`Current tier: ${response.tier}`);

      if (response.disabledReason === 'tier_downgrade') {
        console.log(`Disabled due to tier change: ${response.previousTier} → ${response.newTier}`);
      }
    }
  }
);
```

---

#### setAutoRestorePreference

Sets the user's auto-restore preference (Enterprise-only).

**Request:**
```javascript
{
  action: 'setAutoRestorePreference',
  enabled: boolean,              // true to enable, false to disable
  dontShowNotice?: boolean       // true to hide future notices (optional)
}
```

**Response:**
```javascript
{
  success: boolean,
  tier: string,                  // Current tier
  allowed: boolean,              // false if not Enterprise tier
  message?: string,              // Error message if not allowed
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'setAutoRestorePreference',
    enabled: true,
    dontShowNotice: false
  },
  (response) => {
    if (response.success) {
      if (response.allowed) {
        console.log('Auto-restore enabled successfully');
      } else {
        console.log(`Not allowed: ${response.message}`);
        // Show upgrade prompt for Enterprise
      }
    }
  }
);
```

**Note:** This action is only allowed for Enterprise tier users. Free/Premium users will receive `allowed: false`.

---

#### getInitializationState

**Status:** ✅ Implemented (2025-10-23)

Gets the current initialization state of the extension (used for loading UI).

**Request:**
```javascript
{
  action: 'getInitializationState'
}
```

**Response:**
```javascript
{
  success: boolean,
  state: string,                 // 'LOADING', 'AUTO_RESTORE_CHECK', 'READY', or 'ERROR'
  isReady: boolean,              // true if state === 'READY'
  currentPhase?: string,         // Human-readable phase description
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'getInitializationState' },
  (response) => {
    if (response.success) {
      console.log(`Initialization state: ${response.state}`);
      console.log(`Is ready: ${response.isReady}`);

      if (response.currentPhase) {
        console.log(`Current phase: ${response.currentPhase}`);
      }
    }
  }
);
```

**Initialization States:**
- `LOADING`: Extension is loading and initializing
- `AUTO_RESTORE_CHECK`: Checking auto-restore preference and tier
- `READY`: Extension fully initialized and ready
- `ERROR`: Initialization failed

**Related Documentation:**
- **Feature Documentation:** [docs/features_implementation/05_auto_restore_tier_restrictions.md](../features_implementation/05_auto_restore_tier_restrictions.md)
- **Session Persistence:** [docs/features_implementation/02_session_persistence.md](../features_implementation/02_session_persistence.md)
- **Technical Details:** [docs/technical.md - Section 11](technical.md#11-browser-restart-tab-restoration-timing)

---

### Cookie Management

#### getCookies

Retrieves session-specific cookies for a URL.

**Request:**
```javascript
{
  action: 'getCookies',
  url: string  // Full URL (e.g., 'https://example.com/path')
}
```

**Response:**
```javascript
{
  success: boolean,
  cookies: string,  // Cookie header format: 'name1=value1; name2=value2'
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'getCookies',
    url: 'https://example.com/api/users'
  },
  (response) => {
    if (response.success) {
      console.log('Cookies:', response.cookies);
      // Output: 'sessionid=abc123; theme=dark'
    }
  }
);
```

---

#### setCookie

Sets a cookie for the current session.

**Request:**
```javascript
{
  action: 'setCookie',
  url: string,     // Domain URL (e.g., 'https://example.com')
  cookie: string   // Cookie string (e.g., 'name=value; path=/')
}
```

**Response:**
```javascript
{
  success: boolean,
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'setCookie',
    url: 'https://example.com',
    cookie: 'sessionid=abc123; path=/; secure'
  },
  (response) => {
    if (response.success) {
      console.log('Cookie set successfully');
    }
  }
);
```

---

### License Management

#### redirectToPopup

**Purpose**: Redirect the extension popup to popup.html (internal message for license validation)

**Request:**
```javascript
{
  action: 'redirectToPopup'
}
```

**Response:**
```javascript
{
  success: boolean
}
```

**Example:**
```javascript
// From background script (license-manager.js):
chrome.runtime.sendMessage(
  { action: 'redirectToPopup' },
  (response) => {
    if (response.success) {
      console.log('Redirect triggered');
    }
  }
);
```

**Listener Implementation (license-details.js):**
```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'redirectToPopup') {
    // Redirect current page to popup.html
    window.location.href = 'popup.html';
    sendResponse({ success: true });
    return true;
  }
});
```

**Context-Aware Behavior**:
- If called from extension popup (license-details.html): Redirects to popup.html
- If called from browser tab: Opens popup.html in new window (fallback)
- Used when license validation fails to bring user back to main UI

---

#### activateLicense

Activates a license key on the current device.

**Request:**
```javascript
{
  action: 'activateLicense',
  licenseKey: string  // e.g., 'YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1'
}
```

**Response:**
```javascript
{
  success: boolean,
  tier: string,        // 'free', 'premium', or 'enterprise'
  message: string,     // Success/error message (user-friendly if error_code present)
  error_code?: number, // API error code (60-65) if validation failed, or null
  error?: string       // Deprecated: Use message instead
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'activateLicense',
    licenseKey: 'YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1'
  },
  (response) => {
    if (response.success) {
      console.log(`Activated ${response.tier} license`);
      console.log(response.message);
    } else {
      console.error('Activation failed:', response.error);
    }
  }
);
```

---

#### deactivateLicense

Deactivates the current license on this device.

**Request:**
```javascript
{
  action: 'deactivateLicense'
}
```

**Response:**
```javascript
{
  success: boolean,
  message: string,
  error_code?: number, // API error code if validation failed
  error?: string       // Deprecated: Use message instead
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'deactivateLicense' },
  (response) => {
    if (response.success) {
      console.log('License deactivated');
    }
  }
);
```

---

#### getTier

Gets the current license tier.

**Request:**
```javascript
{
  action: 'getTier'
}
```

**Response:**
```javascript
{
  success: boolean,
  tier: string,  // 'free', 'premium', or 'enterprise'
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'getTier' },
  (response) => {
    if (response.success) {
      console.log(`Current tier: ${response.tier}`);
    }
  }
);
```

---

#### getFeatures

Gets all features available for the current tier.

**Request:**
```javascript
{
  action: 'getFeatures'
}
```

**Response:**
```javascript
{
  success: boolean,
  features: {
    maxSessions: number,
    sessionPersistence: number,
    coloredBadges: number,
    sessionNaming: boolean,
    exportImport: boolean,
    sessionTemplates: boolean,
    encryption: boolean | string,
    portableSessions: boolean,
    localAPI: boolean,
    multiProfile: boolean,
    analytics: boolean | string,
    support: string
  },
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'getFeatures' },
  (response) => {
    if (response.success) {
      const f = response.features;
      console.log(`Max sessions: ${f.maxSessions}`);
      console.log(`Session naming: ${f.sessionNaming ? 'Yes' : 'No'}`);
      console.log(`Encryption: ${f.encryption || 'None'}`);
    }
  }
);
```

---

#### hasFeature

Checks if a specific feature is available.

**Request:**
```javascript
{
  action: 'hasFeature',
  featureName: string  // e.g., 'encryption', 'exportImport'
}
```

**Response:**
```javascript
{
  success: boolean,
  hasFeature: boolean,
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'hasFeature',
    featureName: 'encryption'
  },
  (response) => {
    if (response.success && response.hasFeature) {
      console.log('Encryption feature is available');
      enableEncryptionUI();
    } else {
      console.log('Encryption not available');
      showUpgradePrompt();
    }
  }
);
```

---

#### getLicenseStatus

Gets the full license status and information.

**Request:**
```javascript
{
  action: 'getLicenseStatus'
}
```

**Response:**
```javascript
{
  success: boolean,
  licenseData: {
    key: string,
    tier: string,
    status: string,
    email: string,
    firstName: string,
    lastName: string,
    maxAllowedDomains: number,
    maxAllowedDevices: number,
    dateActivated: string,
    lastValidated: string,
    deviceId: string,
    features: object
  } | null,
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'getLicenseStatus' },
  (response) => {
    if (response.success && response.licenseData) {
      const license = response.licenseData;
      console.log(`License: ${license.tier.toUpperCase()}`);
      console.log(`Email: ${license.email}`);
      console.log(`Devices: 1/${license.maxAllowedDevices}`);
    } else {
      console.log('No active license');
    }
  }
);
```

---

### Storage Management

#### deleteSessionById

**Status:** ✅ Added 2025-10-28

Deletes a specific session by ID from all storage layers (in-memory, chrome.storage.local, IndexedDB).

**Request:**
```javascript
{
  action: 'deleteSessionById',
  sessionId: string  // Session ID to delete
}
```

**Response:**
```javascript
{
  success: boolean,
  sessionId: string,           // The deleted session ID
  results: {
    local: boolean,            // True if deleted from chrome.storage.local
    indexedDB: boolean         // True if deleted from IndexedDB
  },
  tabsClosed: number,          // Number of tabs closed
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  {
    action: 'deleteSessionById',
    sessionId: 'session_1234567890_abc123'
  },
  (response) => {
    if (response.success) {
      console.log(`Session ${response.sessionId} deleted`);
      console.log(`Chrome storage: ${response.results.local ? 'OK' : 'FAILED'}`);
      console.log(`IndexedDB: ${response.results.indexedDB ? 'OK' : 'FAILED'}`);
      console.log(`Closed ${response.tabsClosed} tabs`);
    }
  }
);
```

**Use Cases:**
- Storage diagnostics "Clear All Storage" operation
- Manual session cleanup
- Testing and debugging

---

#### closeIndexedDB

**Status:** ✅ Added 2025-10-28

Closes the IndexedDB database connection to enable database deletion.

**Request:**
```javascript
{
  action: 'closeIndexedDB'
}
```

**Response:**
```javascript
{
  success: boolean,
  message: string,    // Status message
  error?: string
}
```

**Example:**
```javascript
chrome.runtime.sendMessage(
  { action: 'closeIndexedDB' },
  (response) => {
    if (response.success) {
      console.log('IndexedDB connection closed');
      // Now safe to delete database
    }
  }
);
```

**Important**: Always call this before attempting to delete the IndexedDB database, otherwise deletion will be blocked.

---

#### reinitializeStorage

**Status:** ✅ Added 2025-10-28

Reinitializes the storage persistence manager with a fresh database connection after clearing storage.

**Request:**
```javascript
{
  action: 'reinitializeStorage'
}
```

**Response:**
```javascript
{
  success: boolean,
  message: string,    // Status message
  error?: string
}
```

**Example:**
```javascript
// After clearing storage and deleting IndexedDB
chrome.runtime.sendMessage(
  { action: 'reinitializeStorage' },
  (response) => {
    if (response.success) {
      console.log('Storage persistence manager reinitialized');
      // Can now create new sessions
    }
  }
);
```

**Use Cases:**
- After "Clear All Storage" operation
- After IndexedDB database deletion
- Recovery from storage errors

**Wait Time**: Recommended to wait 2-3 seconds after reinitialization before creating new sessions to ensure stability.

---

## Content Script API

Content scripts receive messages from the background script and can send messages back.

### Storage Isolation Messages

#### getSessionId (sent by content script)

Already documented in Background Script API. Content scripts call this during initialization to get their session ID.

#### Storage Operation Queue

Content scripts queue storage operations if session ID is not yet available:

```javascript
// Internal content script pattern
const pendingOperations = [];
let sessionIdReady = false;
let currentSessionId = null;

// Queue operation if not ready
if (!sessionIdReady) {
  pendingOperations.push(() => {
    localStorage.setItem(key, value);
  });
} else {
  // Execute immediately
  localStorage.setItem(key, value);
}
```

---

### Cookie Isolation Messages

Content scripts use `window.postMessage` for cookie operations (not chrome.runtime.sendMessage) due to page context isolation.

#### Cookie Get (window.postMessage)

**From Page Context:**
```javascript
window.postMessage(
  {
    type: 'GET_COOKIE',
    messageId: 123
  },
  '*'
);
```

**Response (window.postMessage):**
```javascript
{
  type: 'COOKIE_GET_RESPONSE',
  messageId: 123,
  cookies: 'name1=value1; name2=value2'
}
```

#### Cookie Set (window.postMessage)

**From Page Context:**
```javascript
window.postMessage(
  {
    type: 'SET_COOKIE',
    cookie: 'name=value; path=/'
  },
  '*'
);
```

**No response** (fire-and-forget for performance)

---

## Popup UI API

The popup UI uses the same message passing API as documented in Background Script API. Common patterns:

### Refresh Sessions List

```javascript
function refreshSessions() {
  chrome.runtime.sendMessage(
    { action: 'getActiveSessions' },
    (response) => {
      if (response.success) {
        displaySessions(response.sessions);
      }
    }
  );
}
```

### Create Session from URL Input

```javascript
function createSession() {
  const url = document.getElementById('urlInput').value || 'about:blank';

  chrome.runtime.sendMessage(
    {
      action: 'createNewSession',
      url: url
    },
    (response) => {
      if (response.success) {
        window.close(); // Close popup
      } else {
        showError(response.error);
      }
    }
  );
}
```

### Activate License

```javascript
function activateLicense() {
  const licenseKey = document.getElementById('licenseKeyInput').value;

  chrome.runtime.sendMessage(
    {
      action: 'activateLicense',
      licenseKey: licenseKey
    },
    (response) => {
      if (response.success) {
        showSuccess(`Welcome to Sessner ${response.tier.toUpperCase()}!`);
      } else {
        showError(response.error);
      }
    }
  );
}
```

---

## Chrome Extension APIs Used

### chrome.webRequest

Used for HTTP-level cookie interception and injection.

#### onBeforeSendHeaders

**Purpose**: Inject session-specific cookies into HTTP requests

**Listener:**
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

**Permissions Required:**
- `webRequest`
- `webRequestBlocking`
- `<all_urls>`

---

#### onHeadersReceived

**Purpose**: Capture Set-Cookie headers from HTTP responses

**Listener:**
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

**Permissions Required:**
- `webRequest`
- `webRequestBlocking`
- `<all_urls>`

---

### chrome.cookies

Used for JavaScript-level cookie capture.

#### onChanged

**Purpose**: Capture cookies set via JavaScript (document.cookie or chrome.cookies.set)

**Listener:**
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

**Permissions Required:**
- `cookies`
- `<all_urls>`

---

### chrome.tabs

Used for tab management and lifecycle tracking.

#### onCreated

**Purpose**: Detect new tabs and inherit session from opener

**Listener:**
```javascript
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.openerTabId) {
    const parentSessionId = sessionStore.tabToSession[tab.openerTabId];
    if (parentSessionId) {
      sessionStore.tabToSession[tab.id] = parentSessionId;
      sessionStore.sessions[parentSessionId].tabs.push(tab.id);
      setBadge(tab.id, sessionStore.sessions[parentSessionId].color);
      persistSessions(true);
    }
  }
});
```

**Permissions Required:**
- `tabs`

---

#### onRemoved

**Purpose**: Clean up session when tab is closed

**Listener:**
```javascript
chrome.tabs.onRemoved.addListener((tabId) => {
  const sessionId = sessionStore.tabToSession[tabId];
  if (!sessionId) return;

  // Remove from mapping
  delete sessionStore.tabToSession[tabId];

  // Remove from session tabs
  const session = sessionStore.sessions[sessionId];
  if (session) {
    session.tabs = session.tabs.filter(id => id !== tabId);

    // Clean up session if no tabs remain
    if (session.tabs.length === 0) {
      delete sessionStore.sessions[sessionId];
      delete sessionStore.cookieStore[sessionId];
    }
  }

  persistSessions(true);
});
```

---

#### onUpdated

**Purpose**: Update badge when tab navigates

**Listener:**
```javascript
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const sessionId = sessionStore.tabToSession[tabId];
    if (sessionId) {
      const session = sessionStore.sessions[sessionId];
      setBadge(tabId, session.color);
    }
  }
});
```

---

#### onActivated

**Purpose**: Update badge when switching tabs

**Listener:**
```javascript
chrome.tabs.onActivated.addListener((activeInfo) => {
  const sessionId = sessionStore.tabToSession[activeInfo.tabId];
  if (sessionId) {
    const session = sessionStore.sessions[sessionId];
    setBadge(activeInfo.tabId, session.color);
  }
});
```

---

### chrome.webNavigation

Used for popup window detection and session inheritance.

#### onCreatedNavigationTarget

**Purpose**: Detect popup windows and inherit parent session

**Listener:**
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

**Permissions Required:**
- `webNavigation`

**Critical for**: OAuth flows, payment popups, window.open() calls

---

### chrome.storage

Used for persistent storage of session data and license information.

#### storage.local.set

**Purpose**: Save session data and license information

**Usage:**
```javascript
chrome.storage.local.set({
  sessner_device_id: deviceId,
  sessner_license: licenseData,
  sessionStore: {
    sessions: sessionStore.sessions,
    cookieStore: sessionStore.cookieStore,
    tabToSession: sessionStore.tabToSession
  }
}, () => {
  if (chrome.runtime.lastError) {
    console.error('Storage error:', chrome.runtime.lastError);
  } else {
    console.log('Data saved successfully');
  }
});
```

---

#### storage.local.get

**Purpose**: Load persisted session data and license information

**Usage:**
```javascript
chrome.storage.local.get([
  'sessner_device_id',
  'sessner_license',
  'sessionStore'
], (data) => {
  if (chrome.runtime.lastError) {
    console.error('Storage error:', chrome.runtime.lastError);
    return;
  }

  if (data.sessionStore) {
    sessionStore.sessions = data.sessionStore.sessions || {};
    sessionStore.cookieStore = data.sessionStore.cookieStore || {};
    sessionStore.tabToSession = data.sessionStore.tabToSession || {};
  }

  if (data.sessner_license) {
    licenseCache = data.sessner_license;
  }
});
```

**Permissions Required:**
- `storage`

---

### chrome.browserAction

Used for badge indicators on extension icon.

#### setBadgeText

**Purpose**: Set badge text (colored dot indicator)

**Usage:**
```javascript
chrome.browserAction.setBadgeText({
  text: '●',
  tabId: tabId
});
```

---

#### setBadgeBackgroundColor

**Purpose**: Set badge background color

**Usage:**
```javascript
chrome.browserAction.setBadgeBackgroundColor({
  color: '#FF6B6B',
  tabId: tabId
});
```

---

## Event Listeners

### Background Script Event Listeners

| Event | Purpose | Handler Function |
|-------|---------|-----------------|
| `chrome.runtime.onMessage` | Handle messages from popup/content scripts | `handleMessage()` |
| `chrome.runtime.onInstalled` | Extension installed/updated | `loadPersistedSessions(false)` (aggressive cleanup) |
| `chrome.runtime.onStartup` | Browser started | `loadPersistedSessions(true)` (skip cleanup, wait for tab restoration) |
| `chrome.webRequest.onBeforeSendHeaders` | Inject cookies into requests | Cookie injection |
| `chrome.webRequest.onHeadersReceived` | Capture Set-Cookie headers | Cookie capture |
| `chrome.cookies.onChanged` | Capture JavaScript cookies | Cookie capture |
| `chrome.tabs.onCreated` | New tab created | Session inheritance |
| `chrome.tabs.onRemoved` | Tab closed | Session cleanup |
| `chrome.tabs.onUpdated` | Tab navigated | Badge update + URL persistence |
| `chrome.tabs.onActivated` | Tab switched | Badge update |
| `chrome.webNavigation.onCreatedNavigationTarget` | Popup opened | Session inheritance |

**Note on Browser Startup (2025-10-25)**:
- `loadPersistedSessions(true)` skips aggressive cleanup to allow browser time to restore tabs
- 2-second delay + retry logic (3 attempts) ensures tabs are restored before validation
- URL-based matching reconnects sessions to tabs (tab IDs change on restart)
- `validateAndCleanupSessions()` runs 10 seconds later to clean up truly orphaned sessions

### Content Script Event Listeners

| Event | Purpose | Handler Function |
|-------|---------|-----------------|
| `window.addEventListener('message')` | Receive cookie operations from page | Cookie message handler |

---

## Error Handling

### Error Response Format

All license-related actions (`activateLicense`, `validateLicense`, `deactivateLicense`) return consistent error responses:

```javascript
{
  success: false,
  tier: 'free',
  message: 'User-friendly error message',  // Converted from technical API error
  error_code: 60  // Numeric error code from API (or null if not applicable)
}
```

**Error Code Mappings:**

The extension automatically converts technical API errors to user-friendly messages based on error codes.

See [docs/subscription_api.md - Error Handling](subscription_api.md#error-handling) for complete error code mappings (60-65) and user-friendly message translations.

### Common Error Patterns

#### Message Passing Errors

```javascript
chrome.runtime.sendMessage(message, (response) => {
  // Check for runtime errors
  if (chrome.runtime.lastError) {
    console.error('Runtime error:', chrome.runtime.lastError.message);
    // Common causes:
    // - Extension context invalidated (extension updated/reloaded)
    // - Receiving end does not exist (background script crashed)
    return;
  }

  // Check for application errors
  if (!response || !response.success) {
    console.error('Application error:', response?.error || 'Unknown error');
    return;
  }

  // Success
  handleSuccess(response);
});
```

#### Storage Errors

```javascript
chrome.storage.local.set(data, () => {
  if (chrome.runtime.lastError) {
    console.error('Storage error:', chrome.runtime.lastError.message);
    // Common causes:
    // - Quota exceeded (10MB limit)
    // - Invalid data format
    return;
  }

  console.log('Saved successfully');
});
```

#### API Call Errors

```javascript
try {
  const response = await fetch(url, { timeout: 10000 });
  const data = await response.json();

  if (data.result === 'error') {
    throw new Error(data.message);
  }

  return data;
} catch (error) {
  console.error('API error:', error.message);
  // Common causes:
  // - Network timeout
  // - Invalid response format
  // - API server error
  return null;
}
```

---

## Code Examples

### Complete Session Creation Flow

```javascript
// 1. User clicks "New Session" button in popup
document.getElementById('newSessionBtn').addEventListener('click', () => {
  const url = document.getElementById('urlInput').value || 'about:blank';

  // 2. Send message to background script
  chrome.runtime.sendMessage(
    {
      action: 'createNewSession',
      url: url
    },
    (response) => {
      // 3. Handle response
      if (chrome.runtime.lastError) {
        showError('Extension error: ' + chrome.runtime.lastError.message);
        return;
      }

      if (!response || !response.success) {
        showError(response?.error || 'Failed to create session');
        return;
      }

      // 4. Success - close popup
      console.log(`Session ${response.sessionId} created in tab ${response.tabId}`);
      window.close();
    }
  );
});
```

### Content Script Initialization

```javascript
// content-script-storage.js initialization
(async function initializeStorageIsolation() {
  // 1. Fetch session ID from background with retry
  const sessionId = await fetchSessionIdWithRetry();

  if (!sessionId) {
    console.warn('[Storage] Could not fetch session ID, using default');
    currentSessionId = 'default';
  } else {
    currentSessionId = sessionId;
  }

  // 2. Install Proxy wrappers
  window.localStorage = new Proxy(window.localStorage, proxyHandler);
  window.sessionStorage = new Proxy(window.sessionStorage, proxyHandler);

  // 3. Execute queued operations
  executePendingOperations();

  console.log('[Storage] Isolation active for session:', currentSessionId);
})();

async function fetchSessionIdWithRetry() {
  const delays = [100, 500, 1000, 2000, 3000];

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getSessionId'
      });

      if (response?.success && response.sessionId) {
        return response.sessionId;
      }
    } catch (error) {
      // Silent retry
    }

    if (attempt < 4) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }

  return null;
}
```

### License Activation with Error Handling

```javascript
async function activateLicenseWithValidation(licenseKey) {
  // 1. Validate input
  if (!licenseKey || licenseKey.trim().length === 0) {
    return {
      success: false,
      error: 'Please enter a license key'
    };
  }

  // 2. Show loading state
  showLoading('Activating license...');

  // 3. Send activation message
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        action: 'activateLicense',
        licenseKey: licenseKey.trim()
      },
      (response) => {
        // 4. Hide loading state
        hideLoading();

        // 5. Check for errors
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: 'Extension error: ' + chrome.runtime.lastError.message
          });
          return;
        }

        if (!response || !response.success) {
          resolve({
            success: false,
            error: response?.error || 'Activation failed'
          });
          return;
        }

        // 6. Success
        resolve(response);
      }
    );
  });
}

// Usage
const result = await activateLicenseWithValidation(licenseKey);
if (result.success) {
  showSuccess(`Welcome to Sessner ${result.tier.toUpperCase()}!`);
} else {
  showError(result.error);
}
```

---

## Related Documentation

- **Subscription API**: See [docs/subscription_api.md](subscription_api.md)
- **System Architecture**: See [docs/architecture.md](architecture.md)
- **Technical Implementation**: See [docs/technical.md](technical.md)
- **Project Overview**: See [CLAUDE.md](../CLAUDE.md)

---

**Status**: Production Ready
**Extension ID**: (To be assigned by Chrome Web Store)
**Support**: GitHub Issues
