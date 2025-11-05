/**
 * Service Worker Entry Point for Manifest V3
 *
 * This file serves as the entry point for the MV3 service worker.
 * It imports the state manager and alarm handlers, then loads the
 * existing background.js logic with MV3-compatible modifications.
 *
 * Architecture:
 * - State Manager: Multi-layer persistence (session → local → IndexedDB)
 * - Alarm Handlers: Replaces setInterval with chrome.alarms
 * - Keep-Alive: Prevents service worker termination during critical operations
 *
 * @module background_sw
 */

console.log('[Service Worker] Loading Sessner MV3 Service Worker...');

// Import ES6 modules
import {
  restoreState,
  persistState,
  getState,
  setState,
  updateState,
  getStateProperty,
  setStateProperty,
  validateState,
  cleanupState as cleanupStateManager,
  getStateStats
} from './modules/state_manager.js';

import {
  setupAlarms,
  handleAlarm as handleAlarmEvent,
  getAlarmStatus,
  ALARM_NAMES
} from './modules/alarm_handlers.js';

import {
  createSessionStoreProxy,
  persistSessions as persistSessionsCompat,
  getTabMetadataCache,
  setTabMetadataCache,
  updateTabMetadata,
  deleteTabMetadata,
  getDomainToSessionActivity,
  setDomainToSessionActivity,
  updateDomainActivity
} from './modules/background_compatibility.js';

// Import background.js (now converted to ES6 module)
import {
  initializationManager,
  sessionStore as backgroundSessionStore,
  tabMetadataCache as backgroundTabMetadataCache,
  COLOR_PALETTES,
  getColorPaletteForTier,
  sessionColor,
  isValidHexColor,
  generateSessionId,
  createNewSession,
  getSessionForTab,
  cleanupSession,
  getActiveSessionCount,
  canCreateNewSession,
  getSessionStatus,
  setSessionName,
  validateSessionName,
  clearSessionName,
  deleteDormantSession,
  deleteAllDormantSessions,
  parseCookie,
  formatCookieHeader,
  storeCookie,
  getCookiesForSession,
  clearBrowserCookiesForTab,
  persistSessions as persistSessionsBackground,
  loadPersistedSessions,
  cleanupExpiredSessions,
  detectEdgeBrowserRestore,
  exportSession,
  exportAllSessions,
  importSessions,
  compressData,
  decompressData
} from './background.js';

// Import other dependencies
import { cryptoUtils } from './crypto-utils.js';
import { storagePersistenceManager } from './storage-persistence-layer.js';
import { licenseManager } from './license-manager.js';
import { getPako, testPako } from './libs/pako-wrapper.js';

console.log('[Service Worker] ✓ All ES6 modules loaded');
console.log('[Service Worker] ✓ background.js loaded successfully');
console.log('[Service Worker] ✓ initializationManager ready:', !!initializationManager);

// Export state manager functions to global scope for background.js compatibility
self.stateManager = {
  restoreState,
  persistState,
  getState,
  setState,
  updateState,
  getStateProperty,
  setStateProperty,
  validateState,
  cleanupState: cleanupStateManager,
  getStateStats
};

// Export alarm functions to global scope
self.alarmManager = {
  setupAlarms,
  handleAlarm: handleAlarmEvent,
  getAlarmStatus,
  ALARM_NAMES
};

// Export compatibility functions to global scope
self.backgroundCompat = {
  createSessionStoreProxy,
  persistSessions: persistSessionsCompat,
  getTabMetadataCache,
  setTabMetadataCache,
  updateTabMetadata,
  deleteTabMetadata,
  getDomainToSessionActivity,
  setDomainToSessionActivity,
  updateDomainActivity
};

// Create sessionStore proxy and export to global scope
// This allows background.js to use sessionStore.sessions[id] syntax
self.sessionStore = createSessionStoreProxy();

// Create tabMetadataCache and export to global scope
self.tabMetadataCache = getTabMetadataCache();

// Export all background.js functions to global scope
self.initializationManager = initializationManager;
self.COLOR_PALETTES = COLOR_PALETTES;
self.getColorPaletteForTier = getColorPaletteForTier;
self.sessionColor = sessionColor;
self.isValidHexColor = isValidHexColor;
self.generateSessionId = generateSessionId;
self.createNewSession = createNewSession;
self.getSessionForTab = getSessionForTab;
self.cleanupSession = cleanupSession;
self.getActiveSessionCount = getActiveSessionCount;
self.canCreateNewSession = canCreateNewSession;
self.getSessionStatus = getSessionStatus;
self.setSessionName = setSessionName;
self.validateSessionName = validateSessionName;
self.clearSessionName = clearSessionName;
self.deleteDormantSession = deleteDormantSession;
self.deleteAllDormantSessions = deleteAllDormantSessions;
self.parseCookie = parseCookie;
self.formatCookieHeader = formatCookieHeader;
self.storeCookie = storeCookie;
self.getCookiesForSession = getCookiesForSession;
self.clearBrowserCookiesForTab = clearBrowserCookiesForTab;
self.persistSessions = persistSessionsBackground;
self.loadPersistedSessions = loadPersistedSessions;
self.cleanupExpiredSessions = cleanupExpiredSessions;
self.detectEdgeBrowserRestore = detectEdgeBrowserRestore;
self.exportSession = exportSession;
self.exportAllSessions = exportAllSessions;
self.importSessions = importSessions;
self.compressData = compressData;
self.decompressData = decompressData;

// Export dependencies to global scope
self.cryptoUtils = cryptoUtils;
self.storagePersistenceManager = storagePersistenceManager;
self.licenseManager = licenseManager;
self.getPako = getPako;
self.testPako = testPako;

console.log('[Service Worker] ✓ State manager, alarm manager, compatibility layer, and background.js exported to global scope');

// ============= Service Worker Lifecycle =============

/**
 * Service worker installation
 * Triggered on first install or when service worker code changes
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install event triggered');

  event.waitUntil((async () => {
    try {
      console.log('[Service Worker] Restoring state from persistence...');
      await restoreState();
      console.log('[Service Worker] ✓ State restored successfully');

      // Skip waiting to activate immediately
      await self.skipWaiting();
      console.log('[Service Worker] ✓ Skip waiting - activation ready');

    } catch (error) {
      console.error('[Service Worker] Installation error:', error);
      throw error;
    }
  })());
});

/**
 * Service worker activation
 * Triggered after installation, claims all clients
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate event triggered');

  event.waitUntil((async () => {
    try {
      // Claim all clients immediately
      await self.clients.claim();
      console.log('[Service Worker] ✓ Claimed all clients');

      // Restore state if not already restored
      await restoreState();
      console.log('[Service Worker] ✓ State restoration complete');

      // Setup alarms
      await setupAlarms();
      console.log('[Service Worker] ✓ Alarms configured');

      // Run initialization (from background.js)
      if (typeof initializationManager !== 'undefined') {
        await initializationManager.initialize();
        console.log('[Service Worker] ✓ Extension initialized');
      } else {
        console.warn('[Service Worker] initializationManager not found, skipping initialization');
      }

      console.log('[Service Worker] ✓ Activation complete - service worker ready');

    } catch (error) {
      console.error('[Service Worker] Activation error:', error);
      throw error;
    }
  })());
});

/**
 * chrome.runtime.onStartup listener
 * Triggered when browser starts (with extension already installed)
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[Service Worker] Browser startup detected');

  try {
    // Restore state from persistence
    await restoreState();
    console.log('[Service Worker] ✓ State restored on startup');

    // Setup alarms
    await setupAlarms();
    console.log('[Service Worker] ✓ Alarms reconfigured on startup');

    // Run initialization
    if (typeof initializationManager !== 'undefined') {
      await initializationManager.initialize();
      console.log('[Service Worker] ✓ Extension initialized on startup');
    }

  } catch (error) {
    console.error('[Service Worker] Startup error:', error);
  }
});

/**
 * chrome.runtime.onInstalled listener
 * Triggered on first install, update, or Chrome update
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log(`[Service Worker] Extension installed: ${details.reason}`);

  try {
    // Restore state from persistence
    await restoreState();
    console.log('[Service Worker] ✓ State restored on install');

    // Setup alarms
    await setupAlarms();
    console.log('[Service Worker] ✓ Alarms configured on install');

    // Run initialization
    if (typeof initializationManager !== 'undefined') {
      await initializationManager.initialize();
      console.log('[Service Worker] ✓ Extension initialized on install');
    }

    // Log installation details
    if (details.reason === 'install') {
      console.log('[Service Worker] First-time installation');
    } else if (details.reason === 'update') {
      console.log(`[Service Worker] Updated from version ${details.previousVersion} to ${chrome.runtime.getManifest().version}`);
    } else if (details.reason === 'chrome_update') {
      console.log('[Service Worker] Chrome browser updated');
    }

  } catch (error) {
    console.error('[Service Worker] Install error:', error);
  }
});

/**
 * chrome.alarms listener
 * Handles all alarm events (cookie cleaner, license validation, etc.)
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  console.log(`[Service Worker] Alarm triggered: ${alarm.name}`);

  try {
    await handleAlarmEvent(alarm);
  } catch (error) {
    console.error(`[Service Worker] Alarm handler error (${alarm.name}):`, error);
  }
});

/**
 * Service worker suspend handler
 * Saves state before service worker terminates
 *
 * IMPORTANT: Chrome's runtime.onSuspend is the correct API for service workers.
 * The 'suspend' DOM event doesn't exist in service workers.
 */
if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(async () => {
    console.log('[Service Worker] chrome.runtime.onSuspend - saving state immediately');

    try {
      // Save state synchronously (must complete before suspension)
      await persistState(true); // Immediate, non-debounced save
      console.log('[Service Worker] ✓ State saved before suspension');
    } catch (error) {
      console.error('[Service Worker] Suspend save error:', error);
    }
  });

  console.log('[Service Worker] ✓ chrome.runtime.onSuspend listener registered');
} else {
  console.warn('[Service Worker] chrome.runtime.onSuspend not available');
}

// ============= Keep-Alive Mechanism =============

/**
 * Keep service worker alive during critical operations
 * Prevents termination during cookie interception, session management, etc.
 */
let keepAliveInterval = null;
let keepAliveActive = false;

function startKeepAlive() {
  if (keepAliveActive) {
    return;
  }

  keepAliveActive = true;
  console.log('[Keep-Alive] Starting keep-alive mechanism');

  // Ping every 20 seconds to prevent termination
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // Just keep service worker alive
      const stats = getStateStats();
      console.log('[Keep-Alive] Ping -',
        `Sessions: ${stats.sessionCount},`,
        `Tabs: ${stats.tabCount},`,
        `Last persist: ${Date.now() - stats.lastPersistTime}ms ago`
      );
    });
  }, 20000);
}

function stopKeepAlive() {
  if (!keepAliveActive) {
    return;
  }

  keepAliveActive = false;
  console.log('[Keep-Alive] Stopping keep-alive mechanism');

  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Start keep-alive immediately (service worker should stay alive)
startKeepAlive();

// Export keep-alive functions to global scope
self.keepAlive = {
  start: startKeepAlive,
  stop: stopKeepAlive,
  isActive: () => keepAliveActive
};

// ============= Message Handler Wrapper =============

/**
 * REMOVED: Message handler wrapper was interfering with background.js listener
 *
 * The service worker wrapper was returning `true` which kept the message channel open,
 * but it was NOT sending a response. This caused the popup to wait indefinitely.
 *
 * Instead, we let background.js handle all messages directly. We start keep-alive
 * via a separate mechanism (already running via setInterval).
 *
 * If we need to intercept messages, we should do it WITHOUT returning anything
 * (which allows other listeners to handle the message).
 */

// Just log messages for debugging (don't interfere with background.js handler)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Start keep-alive for all message operations
  startKeepAlive();

  // Log message for debugging
  console.log('[Service Worker] Message received:', message.action || message.type || 'unknown');

  // DO NOT return true - let background.js handler respond
  // Returning nothing (undefined) allows other listeners to handle the message
});

console.log('[Service Worker] ✓ Message listener (debug only) installed');

// ============= Periodic State Persistence =============

/**
 * Periodic state persistence (every 30 seconds)
 * Backup mechanism in addition to event-driven persistence
 */
setInterval(async () => {
  try {
    const stats = getStateStats();

    // Only persist if there's actual data and it's been more than 10 seconds since last persist
    if (stats.sessionCount > 0 && (Date.now() - stats.lastPersistTime > 10000)) {
      console.log('[Service Worker] Periodic state persistence triggered');
      await persistState(false); // Debounced
    }
  } catch (error) {
    console.error('[Service Worker] Periodic persistence error:', error);
  }
}, 30000);

// ============= State Validation (Debug) =============

/**
 * Periodic state validation (every 5 minutes)
 * Validates state integrity and logs warnings if issues found
 */
setInterval(() => {
  try {
    const validation = validateState();

    if (!validation.valid) {
      console.warn('[Service Worker] State validation failed:', validation.errors);

      // Attempt cleanup
      cleanupStateManager().then((report) => {
        console.log('[Service Worker] State cleanup completed:', report);
      }).catch(error => {
        console.error('[Service Worker] State cleanup error:', error);
      });
    } else {
      const stats = getStateStats();
      console.log('[Service Worker] State validation passed -',
        `${stats.sessionCount} sessions,`,
        `${stats.tabCount} tabs`
      );
    }
  } catch (error) {
    console.error('[Service Worker] State validation error:', error);
  }
}, 5 * 60 * 1000);

// ============= Service Worker Load Initialization =============

/**
 * CRITICAL FIX: Initialize state when service worker loads
 *
 * Service workers can wake up at any time (not just browser startup or install).
 * When Chrome terminates the service worker after 30 seconds of inactivity,
 * all in-memory state (sessionStore, tabToSession, cookieStore) is lost.
 *
 * When the service worker wakes up again (e.g., user clicks extension icon,
 * tab navigation triggers webRequest, etc.), we MUST restore state from
 * chrome.storage.local, otherwise all sessions appear empty.
 *
 * This initialization happens:
 * 1. First load (extension install) - via onInstalled listener
 * 2. Browser startup - via onStartup listener
 * 3. Service worker wake-up after termination - HERE (this is the fix)
 */
console.log('[Service Worker] Initializing state on service worker load...');

// Initialize extension state (loads persisted sessions from storage)
// This is safe to call multiple times - initializationManager has singleton guard
initializationManager.initialize().then(() => {
  console.log('[Service Worker] ✓ State initialized successfully');

  const stats = getStateStats();
  console.log(`[Service Worker] Loaded ${stats.sessionCount} sessions, ${stats.tabCount} tab mappings`);
}).catch(error => {
  console.error('[Service Worker] ✗ Initialization failed:', error);
});

// ============= Ready =============

console.log('[Service Worker] ========================================');
console.log('[Service Worker] Sessner MV3 Service Worker Loaded');
console.log('[Service Worker] Version:', chrome.runtime.getManifest().version);
console.log('[Service Worker] Keep-Alive:', keepAliveActive ? 'ACTIVE' : 'INACTIVE');
console.log('[Service Worker] ========================================');

// Notify that service worker is ready
chrome.runtime.sendMessage({
  action: 'serviceWorkerReady',
  timestamp: Date.now()
}, () => {
  // Ignore errors (no listeners yet)
  if (chrome.runtime.lastError) {
    // Silent ignore
  }
});
