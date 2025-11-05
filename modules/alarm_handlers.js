/**
 * Alarm Handlers Module for MV3 Service Worker
 *
 * Replaces setInterval timers with chrome.alarms API.
 * Handles periodic tasks: cookie cleaning, license validation, session cleanup, keep-alive.
 *
 * MV3 Requirement: Service workers cannot use setInterval (unreliable due to suspension).
 * chrome.alarms API persists across service worker lifecycle.
 *
 * @module alarm_handlers
 */

import { getState, persistState, cleanupState } from './state_manager.js';
import { getSessionTabIds, getSessionForTab, getCookiesForSession } from '../background.js';

// Alarm names
const ALARM_NAMES = {
  COOKIE_CLEANER: 'cookieCleaner',
  LICENSE_VALIDATION: 'licenseValidation',
  SESSION_CLEANUP: 'sessionCleanup',
  KEEP_ALIVE: 'keepAlive'
};

/**
 * Setup all alarms on extension startup
 * @returns {Promise<void>}
 */
export async function setupAlarms() {
  console.log('[Alarm Handlers] Setting up alarms...');

  // Clear any existing alarms first
  await chrome.alarms.clearAll();

  // Cookie cleaner - every 1 minute (minimum allowed by chrome.alarms API)
  // CRITICAL: In Chrome MV3, we cannot use 'blocking' mode in webRequest
  // This means cookies temporarily leak to browser's native store
  // The 1-minute cleaner ensures leaked cookies are removed quickly
  await chrome.alarms.create(ALARM_NAMES.COOKIE_CLEANER, {
    periodInMinutes: 1
  });
  console.log('[Alarm Handlers] ✓ Cookie cleaner alarm created (every 1 minute)');

  // License validation - every 24 hours
  await chrome.alarms.create(ALARM_NAMES.LICENSE_VALIDATION, {
    periodInMinutes: 1440
  });
  console.log('[Alarm Handlers] ✓ License validation alarm created (every 24 hours)');

  // Session cleanup - every 1 hour
  await chrome.alarms.create(ALARM_NAMES.SESSION_CLEANUP, {
    periodInMinutes: 60
  });
  console.log('[Alarm Handlers] ✓ Session cleanup alarm created (every 1 hour)');

  // Keep-alive - every 1 minute
  await chrome.alarms.create(ALARM_NAMES.KEEP_ALIVE, {
    periodInMinutes: 1
  });
  console.log('[Alarm Handlers] ✓ Keep-alive alarm created (every 1 minute)');

  console.log('[Alarm Handlers] All alarms set up successfully');
}

/**
 * Handle alarm triggers
 * @param {chrome.alarms.Alarm} alarm - Alarm object
 * @returns {Promise<void>}
 */
export async function handleAlarm(alarm) {
  console.log(`[Alarm] Triggered: ${alarm.name} at ${new Date(alarm.scheduledTime).toISOString()}`);

  switch (alarm.name) {
    case ALARM_NAMES.COOKIE_CLEANER:
      await runCookieCleaner();
      break;

    case ALARM_NAMES.LICENSE_VALIDATION:
      await runLicenseValidation();
      break;

    case ALARM_NAMES.SESSION_CLEANUP:
      await runSessionCleanup();
      break;

    case ALARM_NAMES.KEEP_ALIVE:
      await runKeepAlive();
      break;

    default:
      console.warn(`[Alarm] Unknown alarm: ${alarm.name}`);
  }
}

/**
 * Cookie Cleaner - Core Implementation
 * Removes cookies from browser's native store that leaked past our interception
 *
 * Chrome MV3 Limitation: Cannot use 'blocking' mode in webRequest.onHeadersReceived
 * This means Set-Cookie headers reach the browser and cookies leak temporarily.
 *
 * @param {string} context - Context for logging ('periodic', 'immediate', etc.)
 * @returns {Promise<void>}
 */
async function cleanBrowserCookies(context = 'periodic') {
  console.log(`[Cookie Cleaner] Starting ${context} cookie cleanup...`);

  try {
    // Get live session tabs from background.js (not from state manager)
    const tabIds = getSessionTabIds();

    if (tabIds.length === 0) {
      console.log('[Cookie Cleaner] No session tabs to check');
      return;
    }

    console.log(`[Cookie Cleaner] Checking ${tabIds.length} session tabs for browser cookies`);

    let totalCleaned = 0;

    for (const tabId of tabIds) {

      try {
        // Get session ID for this tab
        const sessionId = getSessionForTab(tabId);
        if (!sessionId) {
          console.log(`[Cookie Cleaner] Tab ${tabId} has no session, skipping`);
          continue;
        }

        // Get tab info
        const tab = await chrome.tabs.get(tabId);
        if (!tab || !tab.url) {
          continue;
        }

        const url = new URL(tab.url);
        if (!url.hostname) {
          continue;
        }

        // Get session's stored cookies for this domain
        const sessionCookies = getCookiesForSession(sessionId, url.hostname, url.pathname);
        const sessionCookieNames = new Set(sessionCookies.map(c => c.name));

        console.log(`[Cookie Cleaner] Tab ${tabId} (session ${sessionId}): ${sessionCookieNames.size} session cookies for ${url.hostname}`);

        // Get all cookies from browser's native store
        const browserCookies = await chrome.cookies.getAll({
          domain: url.hostname
        });

        if (browserCookies.length > 0) {
          console.log(`[Cookie Cleaner] Found ${browserCookies.length} browser cookies for ${url.hostname}`);

          // CRITICAL FIX: Check if cookie belongs to OTHER sessions before removing
          // PROBLEM: Old logic removed cookies just because they're not in CURRENT session
          // SOLUTION: Only remove if cookie doesn't belong to ANY session

          // Build a map of ALL session cookies across ALL sessions for this domain
          const allSessionCookies = new Map(); // cookieName -> Set<sessionId>
          const state = getState();

          for (const [sid, sessionData] of Object.entries(state.sessions || {})) {
            // Only check sessions with active tabs
            if (!sessionData.tabs || sessionData.tabs.length === 0) continue;

            const cookies = getCookiesForSession(sid, url.hostname, url.pathname);
            for (const c of cookies) {
              if (!allSessionCookies.has(c.name)) {
                allSessionCookies.set(c.name, new Set());
              }
              allSessionCookies.get(c.name).add(sid);
            }
          }

          let cleanedForTab = 0;
          for (const cookie of browserCookies) {
            const belongsToSessions = allSessionCookies.get(cookie.name);

            if (!belongsToSessions) {
              // Cookie doesn't belong to ANY session → Could be from regular browsing
              // KEEP IT (don't interfere with non-session tabs)
              console.log(`[Cookie Cleaner] Keeping unmanaged cookie: ${cookie.name} (not in any session)`);
            } else if (belongsToSessions.has(sessionId)) {
              // Cookie belongs to CURRENT session → KEEP IT
              console.log(`[Cookie Cleaner] Keeping session cookie: ${cookie.name} (belongs to current session ${sessionId})`);
            } else {
              // Cookie belongs to OTHER session(s) but NOT current session
              // This means the browser has leaked a cookie from another session
              // REMOVE IT to maintain isolation
              const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path || '/'}`;
              await chrome.cookies.remove({
                url: cookieUrl,
                name: cookie.name,
                storeId: cookie.storeId
              });
              cleanedForTab++;
              totalCleaned++;
              const otherSessions = Array.from(belongsToSessions).join(', ');
              console.log(`[Cookie Cleaner] Removed leaked cookie: ${cookie.name} (belongs to other session(s): ${otherSessions}, not ${sessionId})`);
            }
          }

          if (cleanedForTab === 0) {
            console.log(`[Cookie Cleaner] No leaked cookies to clean for tab ${tabId}`);
          }
        }

      } catch (error) {
        // Tab may have closed, ignore error
        if (error.message && error.message.includes('No tab with id')) {
          continue;
        }
        console.error(`[Cookie Cleaner] Error cleaning tab ${tabId}:`, error);
      }
    }

    if (totalCleaned > 0) {
      console.log(`[Cookie Cleaner] ✓ Cleaned ${totalCleaned} leaked cookies`);
    } else {
      console.log('[Cookie Cleaner] ✓ No leaked cookies found');
    }

  } catch (error) {
    console.error('[Cookie Cleaner] Error during cleanup:', error);
  }
}

/**
 * Periodic Cookie Cleaner (runs every 1 minute via alarm)
 * @returns {Promise<void>}
 */
async function runCookieCleaner() {
  await cleanBrowserCookies('periodic');
}

/**
 * Immediate Cookie Cleaner (exported for manual triggering)
 * Called after cookies are set to clean up leaked cookies immediately
 * @returns {Promise<void>}
 */
export async function cleanBrowserCookiesNow() {
  await cleanBrowserCookies('immediate');
}

/**
 * License Validation
 * Validates license key every 24 hours
 * Ensures tier remains accurate and license hasn't been revoked
 *
 * @returns {Promise<void>}
 */
async function runLicenseValidation() {
  console.log('[License Validation] Starting periodic validation...');

  try {
    // Get license manager instance (will be available in service worker context)
    if (typeof licenseManager !== 'undefined' && licenseManager) {
      await licenseManager.validateLicenseOnline();
      console.log('[License Validation] ✓ Validation complete');
    } else {
      console.warn('[License Validation] License manager not available');
    }

  } catch (error) {
    console.error('[License Validation] Error during validation:', error);
  }
}

/**
 * Session Cleanup
 * Removes orphaned sessions and expired sessions
 * Runs every 1 hour
 *
 * @returns {Promise<void>}
 */
async function runSessionCleanup() {
  console.log('[Session Cleanup] Starting periodic cleanup...');

  try {
    const state = getState();

    // 1. Remove stale tab mappings
    const tabToSession = state.tabToSession || {};
    const openTabs = await chrome.tabs.query({});
    const openTabIds = new Set(openTabs.map(tab => tab.id));

    let removedMappings = 0;
    for (const tabIdStr of Object.keys(tabToSession)) {
      const tabId = parseInt(tabIdStr);
      if (!openTabIds.has(tabId)) {
        delete tabToSession[tabIdStr];
        removedMappings++;
      }
    }

    if (removedMappings > 0) {
      console.log(`[Session Cleanup] Removed ${removedMappings} stale tab mappings`);
    }

    // 2. Remove sessions with no tabs
    const sessions = state.sessions || {};
    const cookieStore = state.cookieStore || {};
    let removedSessions = 0;

    for (const [sessionId, session] of Object.entries(sessions)) {
      if (!session.tabs || session.tabs.length === 0) {
        delete sessions[sessionId];
        delete cookieStore[sessionId];
        removedSessions++;
        console.log(`[Session Cleanup] Removed orphaned session ${sessionId}`);
      }
    }

    if (removedSessions > 0) {
      console.log(`[Session Cleanup] Removed ${removedSessions} orphaned sessions`);
    }

    // 3. Clean up expired sessions (Free tier: 7 days)
    if (typeof licenseManager !== 'undefined' && licenseManager) {
      const tier = await licenseManager.getTier();

      if (tier === 'free') {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        let expiredSessions = 0;

        for (const [sessionId, session] of Object.entries(sessions)) {
          if (session.lastAccessed && session.lastAccessed < sevenDaysAgo) {
            delete sessions[sessionId];
            delete cookieStore[sessionId];
            expiredSessions++;
            console.log(`[Session Cleanup] Removed expired session ${sessionId} (inactive for 7+ days)`);
          }
        }

        if (expiredSessions > 0) {
          console.log(`[Session Cleanup] Removed ${expiredSessions} expired sessions (Free tier 7-day limit)`);
        }
      }
    }

    // Persist changes if anything was removed
    if (removedMappings > 0 || removedSessions > 0) {
      await persistState(true);
    }

    console.log('[Session Cleanup] ✓ Cleanup complete');

  } catch (error) {
    console.error('[Session Cleanup] Error during cleanup:', error);
  }
}

/**
 * Keep-Alive
 * Keeps service worker alive by performing lightweight operation
 * Runs every 1 minute
 *
 * @returns {Promise<void>}
 */
async function runKeepAlive() {
  // Just query platform info to keep service worker alive
  await chrome.runtime.getPlatformInfo();
  console.log('[Keep-Alive] ✓ Service worker kept alive');
}

/**
 * Get alarm status for debugging
 * @returns {Promise<Object>} Alarm status object
 */
export async function getAlarmStatus() {
  const alarms = await chrome.alarms.getAll();

  const status = {
    activeAlarms: alarms.length,
    alarms: {}
  };

  for (const alarm of alarms) {
    status.alarms[alarm.name] = {
      scheduledTime: new Date(alarm.scheduledTime).toISOString(),
      periodInMinutes: alarm.periodInMinutes || null
    };
  }

  return status;
}

/**
 * Clear all alarms (for testing/debugging)
 * @returns {Promise<void>}
 */
export async function clearAllAlarms() {
  await chrome.alarms.clearAll();
  console.log('[Alarm Handlers] All alarms cleared');
}

// Export alarm names for external use
export { ALARM_NAMES };
