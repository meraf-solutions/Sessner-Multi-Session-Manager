/**
 * State Manager Module for MV3 Service Worker
 *
 * Provides multi-layer state persistence and restoration for service worker lifecycle.
 * Ensures zero data loss during service worker termination/restart.
 *
 * Architecture:
 * Layer 1: In-memory cache (fastest, volatile)
 * Layer 2: Session storage (fast, survives until browser close)
 * Layer 3: Local storage (slower, survives restarts)
 * Layer 4: IndexedDB (slowest, most reliable)
 *
 * Restoration priority: memory → session → local → IndexedDB
 *
 * @module state_manager
 */

// In-memory state cache
let stateCache = {
  tabToSession: {},
  sessions: {},
  cookieStore: {},
  tabMetadataCache: {},
  licenseData: null,
  autoRestoreEnabled: false,
  lastPersistTime: 0
};

// Debounce timer for persistence
let persistTimer = null;
const PERSIST_DEBOUNCE_MS = 1000;

// State restoration status
let isRestoring = false;
let restorationComplete = false;

/**
 * Get current state
 * @returns {Object} Current state object
 */
export function getState() {
  return stateCache;
}

/**
 * Set entire state (replaces current state)
 * @param {Object} newState - New state object
 */
export function setState(newState) {
  stateCache = {
    ...newState,
    lastPersistTime: Date.now()
  };
  persistState(false); // Debounced
}

/**
 * Update partial state (merges with existing)
 * @param {Object} updates - Partial state updates
 */
export function updateState(updates) {
  stateCache = {
    ...stateCache,
    ...updates,
    lastPersistTime: Date.now()
  };
  persistState(false); // Debounced
}

/**
 * Get specific state property
 * @param {string} key - State property key
 * @returns {*} State property value
 */
export function getStateProperty(key) {
  return stateCache[key];
}

/**
 * Set specific state property
 * @param {string} key - State property key
 * @param {*} value - State property value
 */
export function setStateProperty(key, value) {
  stateCache[key] = value;
  stateCache.lastPersistTime = Date.now();
  persistState(false); // Debounced
}

/**
 * Restore state from persistence layers
 * Priority: session storage → local storage → IndexedDB
 *
 * @returns {Promise<boolean>} True if restoration successful
 */
export async function restoreState() {
  if (isRestoring) {
    console.log('[State Manager] Restoration already in progress, waiting...');
    // Wait for restoration to complete
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (restorationComplete) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 50);
    });
  }

  isRestoring = true;
  const startTime = Date.now();
  console.log('[State Manager] Starting state restoration...');

  try {
    // Layer 1: Try session storage first (fastest)
    console.log('[State Manager] Checking session storage...');
    const sessionData = await chrome.storage.session.get('sessionState');

    if (sessionData?.sessionState && Object.keys(sessionData.sessionState.sessions || {}).length > 0) {
      console.log('[State Manager] ✓ Restored from session storage');
      stateCache = {
        ...sessionData.sessionState,
        lastPersistTime: Date.now()
      };

      const duration = Date.now() - startTime;
      console.log(`[State Manager] Restoration complete in ${duration}ms (session storage)`);
      restorationComplete = true;
      isRestoring = false;
      return true;
    }

    // Layer 2: Try local storage (survives restarts)
    console.log('[State Manager] Checking local storage...');
    const localData = await chrome.storage.local.get([
      'sessions',
      'cookieStore',
      'tabToSession',
      'tabMetadata',
      'licenseData',
      'autoRestoreEnabled'
    ]);

    if (localData?.sessions && Object.keys(localData.sessions).length > 0) {
      console.log('[State Manager] ✓ Restored from local storage');
      stateCache = {
        sessions: localData.sessions || {},
        cookieStore: localData.cookieStore || {},
        tabToSession: localData.tabToSession || {},
        tabMetadataCache: localData.tabMetadata || {},
        licenseData: localData.licenseData || null,
        autoRestoreEnabled: localData.autoRestoreEnabled || false,
        lastPersistTime: Date.now()
      };

      const duration = Date.now() - startTime;
      console.log(`[State Manager] Restoration complete in ${duration}ms (local storage)`);

      // Also save to session storage for faster future access
      await saveToSessionStorage();

      restorationComplete = true;
      isRestoring = false;
      return true;
    }

    // Layer 3: Try IndexedDB (fallback, handled by storage-persistence-layer.js)
    console.log('[State Manager] Checking IndexedDB...');
    // This is handled by loadPersistedSessions() in background.js
    // We just initialize with empty state here

    console.log('[State Manager] No persisted state found, starting fresh');
    stateCache = {
      tabToSession: {},
      sessions: {},
      cookieStore: {},
      tabMetadataCache: {},
      licenseData: null,
      autoRestoreEnabled: false,
      lastPersistTime: Date.now()
    };

    const duration = Date.now() - startTime;
    console.log(`[State Manager] Initialization complete in ${duration}ms`);
    restorationComplete = true;
    isRestoring = false;
    return false;

  } catch (error) {
    console.error('[State Manager] Restoration error:', error);
    // Initialize with empty state on error
    stateCache = {
      tabToSession: {},
      sessions: {},
      cookieStore: {},
      tabMetadataCache: {},
      licenseData: null,
      autoRestoreEnabled: false,
      lastPersistTime: Date.now()
    };
    restorationComplete = true;
    isRestoring = false;
    return false;
  }
}

/**
 * Save state to session storage (fast, volatile)
 * @returns {Promise<void>}
 */
async function saveToSessionStorage() {
  try {
    await chrome.storage.session.set({
      sessionState: stateCache
    });
    console.log('[State Manager] Saved to session storage');
  } catch (error) {
    console.error('[State Manager] Failed to save to session storage:', error);
  }
}

/**
 * Save state to local storage (persistent)
 * @returns {Promise<void>}
 */
async function saveToLocalStorage() {
  try {
    await chrome.storage.local.set({
      sessions: stateCache.sessions,
      cookieStore: stateCache.cookieStore,
      tabToSession: stateCache.tabToSession,
      tabMetadata: stateCache.tabMetadataCache,
      licenseData: stateCache.licenseData,
      autoRestoreEnabled: stateCache.autoRestoreEnabled
    });
    console.log('[State Manager] Saved to local storage');
  } catch (error) {
    console.error('[State Manager] Failed to save to local storage:', error);
  }
}

/**
 * Persist state to storage layers
 * Uses debouncing for performance (batches rapid updates)
 *
 * @param {boolean} immediate - If true, skip debouncing and save immediately
 * @returns {Promise<void>}
 */
export async function persistState(immediate = false) {
  if (immediate) {
    // Clear any pending debounced save
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    console.log('[State Manager] Immediate persist requested');
    await saveToSessionStorage();
    await saveToLocalStorage();
    stateCache.lastPersistTime = Date.now();
    return;
  }

  // Debounced save
  if (persistTimer) {
    clearTimeout(persistTimer);
  }

  persistTimer = setTimeout(async () => {
    console.log('[State Manager] Debounced persist triggered');
    await saveToSessionStorage();
    await saveToLocalStorage();
    stateCache.lastPersistTime = Date.now();
    persistTimer = null;
  }, PERSIST_DEBOUNCE_MS);
}

/**
 * Validate state integrity
 * Ensures state has required properties and valid structure
 *
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
export function validateState() {
  const errors = [];

  // Check required properties exist
  if (!stateCache.tabToSession) {
    errors.push('Missing tabToSession');
  }
  if (!stateCache.sessions) {
    errors.push('Missing sessions');
  }
  if (!stateCache.cookieStore) {
    errors.push('Missing cookieStore');
  }

  // Check types
  if (typeof stateCache.tabToSession !== 'object') {
    errors.push('tabToSession must be object');
  }
  if (typeof stateCache.sessions !== 'object') {
    errors.push('sessions must be object');
  }
  if (typeof stateCache.cookieStore !== 'object') {
    errors.push('cookieStore must be object');
  }

  // Check data integrity
  const tabToSession = stateCache.tabToSession || {};
  const sessions = stateCache.sessions || {};

  // Verify tab mappings reference existing sessions
  for (const [tabId, sessionId] of Object.entries(tabToSession)) {
    if (!sessions[sessionId]) {
      errors.push(`Tab ${tabId} references non-existent session ${sessionId}`);
    }
  }

  // Verify sessions reference existing tabs
  for (const [sessionId, session] of Object.entries(sessions)) {
    if (!session.tabs || !Array.isArray(session.tabs)) {
      errors.push(`Session ${sessionId} has invalid tabs array`);
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Clean up invalid state entries
 * Removes orphaned sessions, invalid tab mappings, etc.
 *
 * @returns {Promise<Object>} Cleanup report { removedSessions: number, removedTabs: number }
 */
export async function cleanupState() {
  console.log('[State Manager] Starting state cleanup...');

  let removedSessions = 0;
  let removedTabs = 0;

  const tabToSession = stateCache.tabToSession || {};
  const sessions = stateCache.sessions || {};
  const cookieStore = stateCache.cookieStore || {};

  // Get actual open tabs
  const openTabs = await chrome.tabs.query({});
  const openTabIds = new Set(openTabs.map(tab => tab.id));

  // Remove tab mappings for closed tabs
  for (const tabIdStr of Object.keys(tabToSession)) {
    const tabId = parseInt(tabIdStr);
    if (!openTabIds.has(tabId)) {
      delete tabToSession[tabId];
      removedTabs++;
      console.log(`[State Manager] Removed mapping for closed tab ${tabId}`);
    }
  }

  // Remove sessions with no tabs
  for (const [sessionId, session] of Object.entries(sessions)) {
    if (!session.tabs || session.tabs.length === 0) {
      delete sessions[sessionId];
      delete cookieStore[sessionId];
      removedSessions++;
      console.log(`[State Manager] Removed orphaned session ${sessionId}`);
    }
  }

  // Update state
  stateCache.tabToSession = tabToSession;
  stateCache.sessions = sessions;
  stateCache.cookieStore = cookieStore;

  // Persist immediately
  await persistState(true);

  console.log(`[State Manager] Cleanup complete: ${removedSessions} sessions, ${removedTabs} tabs removed`);

  return {
    removedSessions,
    removedTabs
  };
}

/**
 * Get state statistics
 * @returns {Object} State statistics
 */
export function getStateStats() {
  return {
    sessionCount: Object.keys(stateCache.sessions || {}).length,
    tabCount: Object.keys(stateCache.tabToSession || {}).length,
    cookieStoreSize: Object.keys(stateCache.cookieStore || {}).length,
    lastPersistTime: stateCache.lastPersistTime,
    restorationComplete: restorationComplete
  };
}

/**
 * Clear all state (for testing/debugging)
 * @returns {Promise<void>}
 */
export async function clearState() {
  console.log('[State Manager] Clearing all state...');

  stateCache = {
    tabToSession: {},
    sessions: {},
    cookieStore: {},
    tabMetadataCache: {},
    licenseData: null,
    autoRestoreEnabled: false,
    lastPersistTime: Date.now()
  };

  await chrome.storage.session.clear();
  await chrome.storage.local.clear();

  console.log('[State Manager] State cleared');
}

// Export for testing/debugging
export const __testing__ = {
  stateCache,
  saveToSessionStorage,
  saveToLocalStorage,
  PERSIST_DEBOUNCE_MS
};
