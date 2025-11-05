# Manifest V3 Migration Plan
## Sessner Multi-Session Manager Extension

**Date:** 2025-11-04
**Version:** 4.0.0 (Manifest V3)
**Status:** Planning Complete, Implementation Ready

---

## Executive Summary

This document outlines the complete migration strategy from Manifest V2 to Manifest V3 for the Sessner Multi-Session Manager extension. The migration preserves ALL existing functionality while adapting to the Manifest V3 architecture, particularly the service worker model.

**Critical Success Factors:**
1. ✅ WebRequest API still supported in MV3 (with `webRequestBlocking`)
2. ✅ Content scripts remain fully compatible
3. ✅ All Chrome storage APIs work identically
4. ⚠️ **Service worker lifecycle management is the primary challenge**

---

## Current Architecture Analysis

### Manifest V2 Components

#### 1. **Background Script (Persistent)**
- **File:** `background.js` (5,980 lines)
- **Type:** Persistent background page
- **Dependencies:**
  - `libs/pako.min.js` (compression)
  - `crypto-utils.js` (encryption)
  - `storage-persistence-layer.js` (multi-layer storage)
  - `license-manager.js` (licensing)
  - `license-integration.js` (licensing integration)

- **Key Features:**
  - Session state management (in-memory `sessionStore`)
  - Cookie interception (webRequest API)
  - Tab lifecycle management
  - License validation with periodic checks
  - Session persistence with debouncing
  - Periodic cleanup tasks (setInterval)

#### 2. **Content Scripts**
- **Files:**
  - `content-script-storage.js` - localStorage/sessionStorage isolation
  - `content-script-cookie.js` - document.cookie isolation
  - `content-script-favicon.js` - favicon badge coloring

- **Compatibility:** ✅ No changes needed for MV3

#### 3. **License Manager**
- **File:** `license-manager.js`
- **Features:**
  - Periodic validation (setInterval every hour)
  - Exponential backoff retries
  - Grace period handling
  - Tier detection

#### 4. **Storage Persistence**
- **File:** `storage-persistence-layer.js`
- **Strategy:**
  - Layer 1: chrome.storage.local (primary)
  - Layer 2: IndexedDB (backup)
  - Layer 3: chrome.storage.sync (critical data)

---

## Manifest V3 Migration Strategy

### Phase 1: Manifest Update ✅

#### Changes Made:
1. **manifest_version:** 2 → 3
2. **background:**
   ```json
   // MV2
   "background": {
     "scripts": [...],
     "persistent": true
   }

   // MV3
   "background": {
     "service_worker": "background_sw.js",
     "type": "module"
   }
   ```

3. **browser_action → action:**
   - Renamed `browser_action` to `action`
   - API calls updated: `chrome.browserAction` → `chrome.action`

4. **host_permissions:**
   - Moved `<all_urls>` from `permissions` to `host_permissions`

5. **web_accessible_resources:**
   - Changed from array to object with `resources` and `matches`

#### New File Structure:
- `manifest_v3.json` - New Manifest V3 configuration
- `background_sw.js` - Service worker entry point (NEW)
- `service_worker_state.js` - State management module (NEW)
- `service_worker_alarms.js` - Alarm handlers module (NEW)

---

### Phase 2: Service Worker Migration

#### 2.1 Service Worker Lifecycle

**Key Differences from Persistent Background:**
- ✅ **Persistent:** Always running, never terminates
- ⚠️ **Service Worker:** Terminates after 30 seconds of inactivity

**Termination Triggers:**
- No active event listeners
- 30 seconds of idle time
- Browser resource constraints
- Extension update

**Activation Triggers:**
- Extension event fires (tabs, webRequest, alarms, messages)
- User interaction (popup, context menu)
- External message

#### 2.2 State Management Strategy

**Problem:** `sessionStore` is in-memory and will be lost when service worker terminates.

**Solution:** Multi-layer state persistence

```javascript
// State storage hierarchy:
// 1. In-memory cache (fast, volatile)
const memoryCache = {
  sessionStore: null,
  lastSync: 0,
  isDirty: false
};

// 2. chrome.storage.session (MV3 API, persists until browser close)
// Use for: tabToSession mappings, active state

// 3. chrome.storage.local (persists across restarts)
// Use for: sessions, cookieStore, license data

// 4. IndexedDB (backup layer)
// Use for: large datasets, recovery
```

**State Restoration Flow:**
```
Service Worker Activates
    ↓
Check memoryCache.sessionStore
    ↓ (if null)
Load from chrome.storage.session (fast)
    ↓ (if empty)
Load from chrome.storage.local
    ↓ (if empty)
Load from IndexedDB (backup)
    ↓
Restore state to memoryCache
```

**State Persistence Flow:**
```
State Change Detected
    ↓
Mark as dirty (isDirty = true)
    ↓
Debounce (1 second)
    ↓
Save to chrome.storage.session (immediate)
    ↓
Save to chrome.storage.local (background)
    ↓
Save to IndexedDB (background)
```

#### 2.3 Critical Functions Requiring Updates

##### Cookie Cleaner (Currently: setInterval)
```javascript
// MV2 (current)
setInterval(() => {
  const tabIds = Object.keys(sessionStore.tabToSession);
  tabIds.forEach(tabId => {
    clearBrowserCookiesForTab(tabId);
  });
}, 2000); // Every 2 seconds

// MV3 (new)
chrome.alarms.create('cookieCleaner', {
  periodInMinutes: 1/30 // Every 2 seconds (minimum)
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cookieCleaner') {
    // Restore state if needed
    await restoreState();
    const tabIds = Object.keys(sessionStore.tabToSession);
    tabIds.forEach(tabId => {
      clearBrowserCookiesForTab(tabId);
    });
  }
});
```

##### License Validation (Currently: setInterval)
```javascript
// MV2 (current)
setInterval(async () => {
  await licenseManager.checkAndValidate();
}, 60 * 60 * 1000); // Every hour

// MV3 (new)
chrome.alarms.create('licenseValidation', {
  periodInMinutes: 60 // Every hour
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'licenseValidation') {
    await licenseManager.checkAndValidate();
  }
});
```

##### Session Cleanup (Currently: setInterval)
```javascript
// MV2 (current)
setInterval(async () => {
  await cleanupExpiredSessions();
}, 24 * 60 * 60 * 1000); // Every 24 hours

// MV3 (new)
chrome.alarms.create('sessionCleanup', {
  periodInMinutes: 1440 // Every 24 hours
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'sessionCleanup') {
    await restoreState();
    await cleanupExpiredSessions();
    await persistState();
  }
});
```

#### 2.4 WebRequest API Compatibility

✅ **Good News:** MV3 still supports `webRequest` with `webRequestBlocking` for extensions.

**No changes needed for:**
- `chrome.webRequest.onBeforeSendHeaders`
- `chrome.webRequest.onHeadersReceived`
- Cookie injection logic
- Set-Cookie header removal

**Requirements:**
- `webRequest` permission
- `host_permissions: ["<all_urls>"]`
- Listener options: `['blocking', 'requestHeaders', 'extraHeaders']`

#### 2.5 Message Passing

✅ **No changes needed** - same API in MV2 and MV3:
- `chrome.runtime.sendMessage()`
- `chrome.runtime.onMessage.addListener()`
- Return `true` for async responses

---

### Phase 3: API Updates

#### 3.1 Browser Action → Action
```javascript
// MV2
chrome.browserAction.setBadgeText({...});
chrome.browserAction.setBadgeBackgroundColor({...});

// MV3
chrome.action.setBadgeText({...});
chrome.action.setBadgeBackgroundColor({...});
```

#### 3.2 Storage API (No Changes)
✅ All storage APIs remain identical:
- `chrome.storage.local`
- `chrome.storage.sync`
- `chrome.storage.session` (NEW in MV3, but optional)

#### 3.3 Alarms API (Existing → Expanded Use)
✅ Already using `chrome.alarms` in MV2, expand usage in MV3:
- Cookie cleaner (2-second interval)
- License validation (hourly)
- Session cleanup (daily)
- Service worker keep-alive (5-minute heartbeat)

---

### Phase 4: Service Worker State Management

#### 4.1 State Restoration Module

**File:** `service_worker_state.js`

```javascript
/**
 * Service Worker State Management Module
 * Handles state restoration and persistence across service worker lifecycles
 */

const STATE_KEYS = {
  SESSION_STORE: 'sessionStore',
  TAB_METADATA: 'tabMetadata',
  LICENSE_DATA: 'licenseData',
  LAST_SYNC: 'lastStateSync'
};

class ServiceWorkerState {
  constructor() {
    this.memoryCache = {
      sessionStore: null,
      tabMetadata: null,
      lastSync: 0,
      isDirty: false
    };

    this.restorationPromise = null;
    this.isRestoring = false;
  }

  /**
   * Restore state from storage layers
   * @returns {Promise<Object>} Restored state
   */
  async restoreState() {
    // Singleton guard - prevent concurrent restoration
    if (this.isRestoring && this.restorationPromise) {
      console.log('[SW State] Already restoring, returning existing promise');
      return this.restorationPromise;
    }

    // If cache is fresh (< 5 seconds old), return immediately
    if (this.memoryCache.sessionStore &&
        (Date.now() - this.memoryCache.lastSync) < 5000) {
      console.log('[SW State] Cache is fresh, returning immediately');
      return this.memoryCache.sessionStore;
    }

    this.isRestoring = true;
    this.restorationPromise = this._doRestore();

    try {
      const state = await this.restorationPromise;
      return state;
    } finally {
      this.isRestoring = false;
      this.restorationPromise = null;
    }
  }

  async _doRestore() {
    console.log('[SW State] Restoring state from storage...');

    // Try Layer 1: chrome.storage.session (fastest, MV3 only)
    try {
      if (chrome.storage.session) {
        const sessionData = await chrome.storage.session.get([
          STATE_KEYS.SESSION_STORE,
          STATE_KEYS.TAB_METADATA
        ]);

        if (sessionData[STATE_KEYS.SESSION_STORE]) {
          console.log('[SW State] ✓ Restored from chrome.storage.session');
          this.memoryCache.sessionStore = sessionData[STATE_KEYS.SESSION_STORE];
          this.memoryCache.tabMetadata = sessionData[STATE_KEYS.TAB_METADATA];
          this.memoryCache.lastSync = Date.now();
          return this.memoryCache.sessionStore;
        }
      }
    } catch (error) {
      console.warn('[SW State] chrome.storage.session not available:', error);
    }

    // Try Layer 2: chrome.storage.local (fallback)
    try {
      const localData = await chrome.storage.local.get([
        'sessions',
        'cookieStore',
        'tabToSession',
        'tabMetadata'
      ]);

      if (localData.sessions) {
        console.log('[SW State] ✓ Restored from chrome.storage.local');

        this.memoryCache.sessionStore = {
          sessions: localData.sessions || {},
          cookieStore: localData.cookieStore || {},
          tabToSession: localData.tabToSession || {},
          domainToSessionActivity: {}
        };

        this.memoryCache.tabMetadata = localData.tabMetadata || {};
        this.memoryCache.lastSync = Date.now();

        // Save to session storage for faster future access
        if (chrome.storage.session) {
          await chrome.storage.session.set({
            [STATE_KEYS.SESSION_STORE]: this.memoryCache.sessionStore,
            [STATE_KEYS.TAB_METADATA]: this.memoryCache.tabMetadata
          });
        }

        return this.memoryCache.sessionStore;
      }
    } catch (error) {
      console.error('[SW State] Error restoring from chrome.storage.local:', error);
    }

    // Try Layer 3: IndexedDB (backup, via storage persistence manager)
    try {
      if (typeof storagePersistenceManager !== 'undefined') {
        const idbData = await storagePersistenceManager.loadData();

        if (idbData.sessions && Object.keys(idbData.sessions).length > 0) {
          console.log('[SW State] ✓ Restored from IndexedDB backup');

          this.memoryCache.sessionStore = {
            sessions: idbData.sessions,
            cookieStore: idbData.cookieStore,
            tabToSession: idbData.tabToSession,
            domainToSessionActivity: {}
          };

          this.memoryCache.tabMetadata = idbData.tabMetadata || {};
          this.memoryCache.lastSync = Date.now();

          // Restore to primary storage layers
          await this.persistState(true);

          return this.memoryCache.sessionStore;
        }
      }
    } catch (error) {
      console.error('[SW State] Error restoring from IndexedDB:', error);
    }

    // No state found - initialize empty state
    console.log('[SW State] No stored state found, initializing empty');

    this.memoryCache.sessionStore = {
      sessions: {},
      cookieStore: {},
      tabToSession: {},
      domainToSessionActivity: {}
    };

    this.memoryCache.tabMetadata = {};
    this.memoryCache.lastSync = Date.now();

    return this.memoryCache.sessionStore;
  }

  /**
   * Persist state to storage layers
   * @param {boolean} immediate - Skip debouncing
   * @returns {Promise<void>}
   */
  async persistState(immediate = false) {
    if (!this.memoryCache.sessionStore) {
      console.warn('[SW State] No state to persist');
      return;
    }

    // Debouncing logic
    if (!immediate) {
      this.memoryCache.isDirty = true;

      // Debounce writes (1 second)
      clearTimeout(this.persistTimeout);
      this.persistTimeout = setTimeout(() => {
        this._doPersist();
      }, 1000);

      return;
    }

    // Immediate persist
    await this._doPersist();
  }

  async _doPersist() {
    console.log('[SW State] Persisting state to storage...');

    const stateData = {
      sessions: this.memoryCache.sessionStore.sessions,
      cookieStore: this.memoryCache.sessionStore.cookieStore,
      tabToSession: this.memoryCache.sessionStore.tabToSession,
      tabMetadata: this.memoryCache.tabMetadata,
      _lastSaved: Date.now()
    };

    // Layer 1: chrome.storage.session (fast, for quick restoration)
    if (chrome.storage.session) {
      try {
        await chrome.storage.session.set({
          [STATE_KEYS.SESSION_STORE]: this.memoryCache.sessionStore,
          [STATE_KEYS.TAB_METADATA]: this.memoryCache.tabMetadata,
          [STATE_KEYS.LAST_SYNC]: Date.now()
        });
        console.log('[SW State] ✓ Saved to chrome.storage.session');
      } catch (error) {
        console.error('[SW State] Error saving to session storage:', error);
      }
    }

    // Layer 2: chrome.storage.local (primary persistence)
    try {
      await chrome.storage.local.set(stateData);
      console.log('[SW State] ✓ Saved to chrome.storage.local');
    } catch (error) {
      console.error('[SW State] Error saving to local storage:', error);
    }

    // Layer 3: IndexedDB (backup, via storage persistence manager)
    if (typeof storagePersistenceManager !== 'undefined') {
      try {
        await storagePersistenceManager.saveData(stateData);
        console.log('[SW State] ✓ Saved to IndexedDB backup');
      } catch (error) {
        console.error('[SW State] Error saving to IndexedDB:', error);
      }
    }

    this.memoryCache.isDirty = false;
    this.memoryCache.lastSync = Date.now();
  }

  /**
   * Mark state as dirty (needs persistence)
   */
  markDirty() {
    this.memoryCache.isDirty = true;
  }

  /**
   * Get current state (returns cached state immediately)
   * @returns {Object|null} Current state or null
   */
  getCurrentState() {
    return this.memoryCache.sessionStore;
  }

  /**
   * Clear all cached state
   */
  clearCache() {
    this.memoryCache.sessionStore = null;
    this.memoryCache.tabMetadata = null;
    this.memoryCache.lastSync = 0;
    this.memoryCache.isDirty = false;
  }
}

// Export singleton instance
const serviceWorkerState = new ServiceWorkerState();
```

#### 4.2 Service Worker Keep-Alive

**Problem:** Service worker terminates after 30 seconds of inactivity.

**Solution:** Periodic alarm to keep worker "warm" and ensure timely operations.

```javascript
/**
 * Service Worker Keep-Alive
 * Prevents premature termination of service worker
 */

// Create keep-alive alarm on service worker start
chrome.alarms.create('keepAlive', {
  periodInMinutes: 1 // Every minute
});

// Handle keep-alive alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    console.log('[SW Keep-Alive] Heartbeat');

    // Persist any dirty state
    if (serviceWorkerState.memoryCache.isDirty) {
      serviceWorkerState.persistState(true);
    }

    // Check for orphaned sessions
    // (sessions in memory but tabs closed)
    // Clean them up proactively
  }
});
```

---

### Phase 5: License Manager Updates

#### 5.1 Replace setInterval with chrome.alarms

**File:** `license-manager-mv3.js`

**Changes:**
1. Remove `this.validationTimer` (setInterval)
2. Use `chrome.alarms` for periodic validation
3. Store alarm state in class instance

```javascript
// MV2 (current)
startValidationTimer() {
  if (this.validationTimer) {
    clearInterval(this.validationTimer);
  }

  this.validationTimer = setInterval(async () => {
    await this.checkAndValidate();
  }, this.CHECK_INTERVAL_MS);
}

// MV3 (new)
startValidationTimer() {
  chrome.alarms.create('licenseValidation', {
    periodInMinutes: 60 // Every hour
  });

  console.log('[LicenseManager] Validation alarm created (checks every hour)');
}

// Handle in service worker alarm listener
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'licenseValidation') {
    console.log('[License] Periodic validation triggered');
    await licenseManager.checkAndValidate();
  }
});
```

#### 5.2 Cleanup Method

```javascript
// MV2 (current)
cleanup() {
  if (this.validationTimer) {
    clearInterval(this.validationTimer);
    this.validationTimer = null;
  }
  console.log('[LicenseManager] Cleanup complete');
}

// MV3 (new)
cleanup() {
  chrome.alarms.clear('licenseValidation', (wasCleared) => {
    if (wasCleared) {
      console.log('[LicenseManager] Validation alarm cleared');
    }
  });
  console.log('[LicenseManager] Cleanup complete');
}
```

---

### Phase 6: Background Script Modularization

#### 6.1 Module Structure

**MV3 Service Worker Files:**
```
background_sw.js (entry point)
├── modules/
│   ├── state_manager.js (state restoration/persistence)
│   ├── session_manager.js (session CRUD operations)
│   ├── cookie_interceptor.js (webRequest handlers)
│   ├── tab_lifecycle.js (tab event handlers)
│   ├── alarm_handlers.js (all alarm handlers)
│   └── message_handlers.js (runtime.onMessage)
├── license-manager-mv3.js (updated license manager)
└── storage-persistence-layer.js (unchanged)
```

#### 6.2 Entry Point: background_sw.js

```javascript
/**
 * Service Worker Entry Point (Manifest V3)
 * Sessner Multi-Session Manager
 */

// Import modules (ES6 modules)
import { serviceWorkerState } from './modules/state_manager.js';
import { initializeSessionManager } from './modules/session_manager.js';
import { registerCookieInterceptors } from './modules/cookie_interceptor.js';
import { registerTabLifecycleHandlers } from './modules/tab_lifecycle.js';
import { registerAlarmHandlers } from './modules/alarm_handlers.js';
import { registerMessageHandlers } from './modules/message_handlers.js';

// Import dependencies (loaded as modules)
import './libs/pako.min.js';
import './crypto-utils.js';
import './storage-persistence-layer.js';
import './license-manager-mv3.js';
import './license-integration.js';

console.log('[Service Worker] Sessner Multi-Session Manager service worker loaded');

/**
 * Service Worker Initialization
 * Runs on service worker activation
 */
async function initializeServiceWorker() {
  console.log('[Service Worker] Initializing...');

  try {
    // Phase 1: Restore state from storage
    console.log('[Service Worker] Phase 1: Restoring state...');
    await serviceWorkerState.restoreState();
    console.log('[Service Worker] ✓ State restored');

    // Phase 2: Initialize license manager
    console.log('[Service Worker] Phase 2: Initializing license manager...');
    if (typeof licenseManager !== 'undefined') {
      await licenseManager.initialize();
      console.log('[Service Worker] ✓ License manager ready');
    }

    // Phase 3: Initialize storage persistence
    console.log('[Service Worker] Phase 3: Initializing storage persistence...');
    if (typeof storagePersistenceManager !== 'undefined') {
      await storagePersistenceManager.initialize();
      console.log('[Service Worker] ✓ Storage persistence ready');
    }

    // Phase 4: Register event handlers
    console.log('[Service Worker] Phase 4: Registering event handlers...');
    registerCookieInterceptors();
    registerTabLifecycleHandlers();
    registerAlarmHandlers();
    registerMessageHandlers();
    console.log('[Service Worker] ✓ Event handlers registered');

    // Phase 5: Initialize session manager
    console.log('[Service Worker] Phase 5: Initializing session manager...');
    await initializeSessionManager();
    console.log('[Service Worker] ✓ Session manager ready');

    console.log('[Service Worker] ✅ Initialization complete');
  } catch (error) {
    console.error('[Service Worker] ❌ Initialization error:', error);
    throw error;
  }
}

// Initialize on service worker start
initializeServiceWorker().catch(error => {
  console.error('[Service Worker] Failed to initialize:', error);
});

// Handle service worker install
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event');
  self.skipWaiting(); // Activate immediately
});

// Handle service worker activate
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event');
  event.waitUntil(
    (async () => {
      await clients.claim(); // Take control immediately
      await initializeServiceWorker();
    })()
  );
});

// CRITICAL: Keep service worker alive by listening to events
self.addEventListener('message', (event) => {
  console.log('[Service Worker] Message received:', event.data);
  // Messages will be handled by message_handlers.js
});
```

---

### Phase 7: Testing Strategy

#### 7.1 Test Environment Setup

1. **Load unpacked extension:**
   - Navigate to `edge://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select extension directory

2. **Enable service worker debugging:**
   - Open DevTools for service worker
   - Keep DevTools open during testing
   - Monitor "Application" → "Service Workers"

3. **Enable logging:**
   - All console.log statements preserved
   - Use color-coded logs for debugging

#### 7.2 Test Categories

##### Category 1: Service Worker Lifecycle
- [ ] Service worker activates on extension load
- [ ] State restores from chrome.storage.local
- [ ] State restores from IndexedDB (backup)
- [ ] State persists when service worker terminates
- [ ] Service worker re-activates on event (tabs, webRequest)
- [ ] Keep-alive alarm fires every minute
- [ ] State restoration time < 100ms

##### Category 2: Cookie Isolation
- [ ] Cookies injected in HTTP requests (onBeforeSendHeaders)
- [ ] Set-Cookie headers captured (onHeadersReceived)
- [ ] Cookies isolated per session
- [ ] Cookie cleaner alarm fires every 2 seconds
- [ ] Cookies don't leak between sessions
- [ ] Document.cookie override still works
- [ ] chrome.cookies.onChanged still captures JS-set cookies

##### Category 3: Storage Isolation
- [ ] localStorage isolated per session
- [ ] sessionStorage isolated per session
- [ ] ES6 Proxy still intercepts operations
- [ ] Session ID fetched with exponential backoff
- [ ] Storage operations queued before session ready

##### Category 4: Session Management
- [ ] Create new session
- [ ] Delete session
- [ ] Session survives service worker restart
- [ ] Session survives browser restart
- [ ] Tab-to-session mapping restored
- [ ] URL-based tab matching works (Edge restart)
- [ ] Dormant sessions saved/restored

##### Category 5: License Validation
- [ ] License activates successfully
- [ ] Periodic validation alarm fires hourly
- [ ] Grace period warnings displayed
- [ ] License downgrade handled correctly
- [ ] Tier detection works
- [ ] Invalid license notification shown

##### Category 6: Session Limits
- [ ] Free tier: 3 concurrent sessions enforced
- [ ] Premium/Enterprise: unlimited sessions
- [ ] Session creation blocked at limit
- [ ] Warning displayed before limit

##### Category 7: Session Export/Import
- [ ] Export single session (Premium)
- [ ] Export all sessions (Enterprise)
- [ ] Import sessions with conflict resolution
- [ ] Encryption works (Enterprise)
- [ ] Compression works (files >100KB)

##### Category 8: Auto-Restore (Enterprise)
- [ ] Auto-restore preference saved
- [ ] Sessions restored on browser restart
- [ ] URL-based tab matching works
- [ ] Edge detection notification shown
- [ ] Downgrade disables auto-restore

##### Category 9: Tab Lifecycle
- [ ] New session tab created
- [ ] Popup inherits parent session (webNavigation)
- [ ] Target="_blank" links inherit session
- [ ] Noopener links inherit by domain heuristic
- [ ] Badge colors display correctly
- [ ] Favicon badges render

##### Category 10: Performance
- [ ] State restoration < 100ms
- [ ] Session creation < 200ms
- [ ] Cookie injection latency < 10ms
- [ ] Service worker activation < 500ms
- [ ] Memory usage < 50MB (service worker)

---

### Phase 8: Rollback Strategy

#### 8.1 Dual Manifest Support

**Keep both manifests during transition:**
- `manifest.json` - MV2 (stable)
- `manifest_v3.json` - MV3 (testing)

**To switch between versions:**
```bash
# Test MV3
cp manifest_v3.json manifest.json

# Rollback to MV2
cp manifest_v2_backup.json manifest.json
```

#### 8.2 Version Numbering

- **MV2:** v3.2.x (current stable)
- **MV3 Beta:** v4.0.0-beta.x (testing)
- **MV3 Stable:** v4.0.0 (production)

#### 8.3 Rollback Triggers

**Rollback to MV2 if:**
- Critical bug discovered (data loss, session corruption)
- Performance degradation > 50%
- Service worker reliability < 95%
- User-reported critical issues > 10%

---

## Risk Assessment

### High Risk Areas

#### 1. Service Worker Termination
**Risk:** State loss when service worker terminates unexpectedly
**Mitigation:**
- Multi-layer persistence (session, local, IndexedDB)
- Aggressive state persistence (1-second debounce)
- State restoration on every event
- Keep-alive alarm

**Test:** Manually terminate service worker, verify state restores

#### 2. Cookie Cleaner Timing
**Risk:** Cookie leakage if cleaner doesn't run frequently enough
**Mitigation:**
- Use chrome.alarms with minimum interval
- Run cleaner before every cookie operation
- Defense-in-depth: HTTP interception + chrome.cookies capture

**Test:** Set cookie in non-session tab, verify removal within 2 seconds

#### 3. Race Conditions
**Risk:** State restoration racing with state modification
**Mitigation:**
- Singleton pattern for state restoration
- Promise-based restoration (await before operations)
- Mutex locks for critical operations

**Test:** Rapid session creation during state restoration

#### 4. IndexedDB Persistence
**Risk:** IndexedDB data not committed to disk before browser close
**Mitigation:**
- Transaction-based writes with `oncomplete` verification
- Verification reads after critical writes
- Multi-layer redundancy

**Test:** Save session, close browser immediately, verify restoration

### Medium Risk Areas

#### 5. Alarm Reliability
**Risk:** Alarms not firing on time
**Mitigation:**
- Use chrome.alarms.getAll() to verify alarm creation
- Recreate alarms on service worker activation
- Multiple redundant alarms (keep-alive + specific tasks)

**Test:** Monitor alarm firing in production for 24 hours

#### 6. Message Passing
**Risk:** Messages lost if service worker not active
**Mitigation:**
- Service worker activates on runtime.sendMessage
- Retry logic in content scripts
- Queue messages if needed

**Test:** Send message while service worker inactive, verify delivery

### Low Risk Areas

#### 7. Content Scripts
**Risk:** Minimal - no changes to content scripts
**Mitigation:** None needed

#### 8. UI Components
**Risk:** Minimal - action API compatible
**Mitigation:** Find/replace browserAction → action

---

## Performance Targets

### Manifest V3 Performance Goals

| Metric | Target | Current (MV2) | Notes |
|--------|--------|---------------|-------|
| State restoration time | < 100ms | N/A (persistent) | From chrome.storage.session |
| Service worker activation | < 500ms | Instant | From inactive to ready |
| Cookie injection latency | < 10ms | < 5ms | No regression allowed |
| Session creation time | < 200ms | < 150ms | Slight increase acceptable |
| Memory usage (SW) | < 50MB | < 30MB (bg page) | Service worker overhead |
| Browser restart time | < 2000ms | < 1500ms | URL-based tab matching |

### Optimization Strategies

1. **State Restoration:**
   - Use chrome.storage.session for fast access
   - Cache frequently accessed data in memory
   - Lazy-load large datasets (cookieStore)

2. **Cookie Operations:**
   - Batch cookie reads/writes
   - Use Map() for O(1) lookups
   - Debounce persistence (1 second)

3. **Service Worker Lifecycle:**
   - Minimize activation time (< 500ms)
   - Use keep-alive alarm to stay warm
   - Batch operations to reduce activations

---

## Implementation Timeline

### Week 1: Foundation
- ✅ Day 1-2: Create manifest_v3.json
- ✅ Day 2-3: Create service worker state manager
- Day 4-5: Migrate background.js to modules
- Day 6-7: Update license-manager.js for MV3

### Week 2: Core Features
- Day 1-2: Replace setInterval with chrome.alarms
- Day 3-4: Implement state persistence layer
- Day 5: Update action API calls
- Day 6-7: Test cookie isolation

### Week 3: Testing & Refinement
- Day 1-2: Integration testing (all features)
- Day 3-4: Performance testing
- Day 5: Edge case testing
- Day 6-7: Bug fixes

### Week 4: Documentation & Release
- Day 1-2: Create migration test guide
- Day 3-4: Update user-facing documentation
- Day 5: Beta release (v4.0.0-beta.1)
- Day 6-7: Monitor beta feedback

---

## Success Criteria

### Must Have (Release Blockers)
- [ ] All MV2 features working in MV3
- [ ] No data loss on service worker restart
- [ ] No data loss on browser restart
- [ ] Cookie isolation verified (100% success rate)
- [ ] Storage isolation verified (100% success rate)
- [ ] License validation working
- [ ] Session limits enforced
- [ ] State restoration < 100ms

### Should Have (Post-Release)
- [ ] Performance equal to MV2
- [ ] Service worker stays active (keep-alive)
- [ ] Comprehensive error logging
- [ ] Migration guide for users

### Nice to Have (Future)
- [ ] Reduce memory usage
- [ ] Improve activation time
- [ ] Better state compression

---

## Conclusion

The Manifest V3 migration is **feasible and low-risk** for this extension because:

1. ✅ WebRequest API fully supported (with blocking)
2. ✅ Content scripts unchanged
3. ✅ Storage APIs unchanged
4. ✅ Multi-layer persistence mitigates service worker volatility
5. ✅ Alarms API replaces setInterval cleanly

**Primary Challenge:** Service worker state management

**Solution:** Multi-layer state persistence + aggressive restoration

**Timeline:** 4 weeks (foundation → testing → release)

**Risk Level:** Medium (manageable with proper testing)

---

## Next Steps

1. ✅ Review and approve migration plan
2. 🔄 Create service worker modules (in progress)
3. ⏳ Implement state manager
4. ⏳ Update background.js
5. ⏳ Test extensively
6. ⏳ Beta release
7. ⏳ Production release

---

## References

- [Chrome Extensions MV3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Service Workers in Extensions](https://developer.chrome.com/docs/extensions/mv3/service_workers/)
- [WebRequest API in MV3](https://developer.chrome.com/docs/extensions/reference/webRequest/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome Alarms API](https://developer.chrome.com/docs/extensions/reference/alarms/)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-04
**Author:** Claude (JavaScript Pro Agent)
**Status:** Ready for Implementation
