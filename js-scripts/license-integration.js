/**
 * License Integration for background.js
 * Provides message handlers and session limit enforcement
 *
 * Include this file in manifest.json background scripts AFTER license-manager.js
 */

'use strict';

/**
 * Initialize license system on extension startup
 */
async function initializeLicenseSystem() {
  console.log('[License Integration] Initializing license system...');

  try {
    await licenseManager.initialize();
    console.log('[License Integration] ✓ License system ready');
    console.log('[License Integration] Current tier:', licenseManager.getTier());
    console.log('[License Integration] Features:', licenseManager.getFeatures());
  } catch (error) {
    console.error('[License Integration] Initialization error:', error);
  }
}

/**
 * Check if creating a new session is allowed based on license tier
 *
 * @returns {{allowed: boolean, reason?: string, tier: string, currentCount: number, maxAllowed: number}}
 */
function checkSessionCreationAllowed() {
  const tier = licenseManager.getTier();
  const features = licenseManager.getFeatures();
  const currentSessionCount = Object.keys(sessionStore.sessions).length;

  // Unlimited sessions for premium/enterprise
  if (features.maxSessions === Infinity) {
    return {
      allowed: true,
      tier: tier,
      currentCount: currentSessionCount,
      maxAllowed: Infinity
    };
  }

  // Check against limit for free tier
  if (currentSessionCount >= features.maxSessions) {
    return {
      allowed: false,
      reason: `Session limit reached (${features.maxSessions} for ${tier.toUpperCase()} tier). Upgrade to Premium for unlimited sessions.`,
      tier: tier,
      currentCount: currentSessionCount,
      maxAllowed: features.maxSessions
    };
  }

  return {
    allowed: true,
    tier: tier,
    currentCount: currentSessionCount,
    maxAllowed: features.maxSessions
  };
}

/**
 * Enforce session persistence based on tier
 * Called periodically to clean up old sessions
 */
async function enforceSessionPersistence() {
  // CRITICAL: Wait for license manager to initialize before checking tier
  // If we check too early, we'll get 'free' tier and delete all sessions!
  if (typeof licenseManager !== 'undefined' && !licenseManager.isInitialized) {
    console.log('[License Integration] Waiting for license manager to initialize...');

    // Wait up to 30 seconds for license manager (slow systems, disk I/O)
    const maxWait = 30000;
    const startTime = Date.now();

    while (!licenseManager.isInitialized && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!licenseManager.isInitialized) {
      console.error('[License Integration] CRITICAL: License manager not initialized after 30s');
      console.error('[License Integration] Skipping persistence enforcement to prevent data loss');
      return; // EXIT - don't enforce persistence!
    } else {
      console.log('[License Integration] ✓ License manager ready');
    }
  }

  const tier = licenseManager.getTier();
  const features = licenseManager.getFeatures();

  // Permanent persistence for premium/enterprise
  if (features.sessionPersistenceDays === Infinity) {
    return;
  }

  const now = Date.now();
  const maxAge = features.sessionPersistenceDays * 24 * 60 * 60 * 1000;
  const sessionsToRemove = [];

  // Find sessions older than max age
  Object.values(sessionStore.sessions).forEach(session => {
    const age = now - session.createdAt;
    if (age > maxAge) {
      // Only remove if no active tabs
      if (!session.tabs || session.tabs.length === 0) {
        sessionsToRemove.push(session.id);
      }
    }
  });

  // Remove expired sessions
  for (const sessionId of sessionsToRemove) {
    console.log(`[License Integration] Removing expired session (${tier} tier, ${features.sessionPersistenceDays} day limit):`, sessionId);
    delete sessionStore.sessions[sessionId];
    delete sessionStore.cookieStore[sessionId];
  }

  if (sessionsToRemove.length > 0) {
    await persistSessions(true);
    console.log(`[License Integration] Removed ${sessionsToRemove.length} expired sessions`);
  }
}

/**
 * Extended message handler for license operations
 * Add these handlers to your existing chrome.runtime.onMessage listener
 *
 * @param {Object} request - Message request
 * @param {Object} sender - Message sender
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} - True if async response
 */
function handleLicenseMessage(request, sender, sendResponse) {
  // License activation
  if (request.action === 'activateLicense') {
    console.log('[License Integration] Handling activateLicense message');
    console.log('[License Integration] sendResponse type:', typeof sendResponse);

    // Execute async operation and send response
    // CRITICAL: Wrap in Promise.resolve().then() to ensure proper async handling
    Promise.resolve(licenseManager.activateLicense(request.licenseKey))
      .then(result => {
        console.log('[License Integration] Activation result:', result);
        console.log('[License Integration] About to call sendResponse with:', result);

        // CRITICAL: Use try-catch to detect sendResponse errors
        try {
          sendResponse(result);
          console.log('[License Integration] ✓ sendResponse called successfully');
        } catch (error) {
          console.error('[License Integration] ✗ sendResponse error:', error);
        }

        // Show notification after response is sent (only on success)
        if (result.success) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'License Activated',
            message: `Welcome to Sessner ${result.tier.toUpperCase()}!`,
            priority: 2
          });
        }
      })
      .catch(error => {
        console.error('[License Integration] Activation error:', error);
        const errorResponse = {
          success: false,
          tier: 'free',
          message: error.message || error.toString(),
          error_code: null
        };
        console.log('[License Integration] Sending error response:', errorResponse);

        try {
          sendResponse(errorResponse);
          console.log('[License Integration] ✓ Error response sent');
        } catch (err) {
          console.error('[License Integration] ✗ sendResponse error:', err);
        }
      });

    return true; // Keep message channel open for async response
  }

  // License validation
  if (request.action === 'validateLicense') {
    console.log('[License Integration] Handling validateLicense message');

    Promise.resolve(licenseManager.validateLicense())
      .then(result => {
        console.log('[License Integration] Validation result:', result);
        try {
          sendResponse(result);
          console.log('[License Integration] ✓ Validation response sent');
        } catch (error) {
          console.error('[License Integration] ✗ sendResponse error:', error);
        }
      })
      .catch(error => {
        console.error('[License Integration] Validation error:', error);
        const errorResponse = {
          success: false,
          message: error.message || error.toString(),
          error_code: null
        };
        try {
          sendResponse(errorResponse);
        } catch (err) {
          console.error('[License Integration] ✗ sendResponse error:', err);
        }
      });

    return true; // Keep channel open for async response
  }

  // License deactivation
  if (request.action === 'deactivateLicense') {
    console.log('[License Integration] Handling deactivateLicense message');

    Promise.resolve(licenseManager.deactivateLicense())
      .then(result => {
        console.log('[License Integration] Deactivation result:', result);

        // Send response first
        try {
          sendResponse(result);
          console.log('[License Integration] ✓ Deactivation response sent');
        } catch (error) {
          console.error('[License Integration] ✗ sendResponse error:', error);
        }

        // Then show notification
        if (result.success) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'License Deactivated',
            message: 'Your license has been deactivated. Reverting to Free tier.',
            priority: 1
          });
        }
      })
      .catch(error => {
        console.error('[License Integration] Deactivation error:', error);
        const errorResponse = {
          success: false,
          message: error.message || error.toString(),
          error_code: null
        };
        try {
          sendResponse(errorResponse);
        } catch (err) {
          console.error('[License Integration] ✗ sendResponse error:', err);
        }
      });

    return true; // Keep channel open for async response
  }

  // Get license info
  if (request.action === 'getLicenseInfo') {
    const info = licenseManager.getLicenseInfo();
    sendResponse({ success: true, ...info });
    return true; // Message handled (sync response)
  }

  // Get license status (alias for getLicenseInfo, used by popup.js)
  if (request.action === 'getLicenseStatus') {
    const info = licenseManager.getLicenseInfo();
    sendResponse({ success: true, licenseData: info });
    return true; // Message handled (sync response)
  }

  // Get current tier
  if (request.action === 'getTier') {
    const tier = licenseManager.getTier();
    const features = licenseManager.getFeatures();
    sendResponse({
      success: true,
      tier: tier,
      features: features
    });
    return true; // Message handled (sync response)
  }

  // Check feature availability
  if (request.action === 'hasFeature') {
    const hasFeature = licenseManager.hasFeature(request.featureName);
    sendResponse({
      success: true,
      hasFeature: hasFeature,
      featureName: request.featureName
    });
    return true; // Message handled (sync response)
  }

  // Check session creation allowed
  if (request.action === 'checkSessionCreationAllowed') {
    const check = checkSessionCreationAllowed();
    sendResponse({ success: true, ...check });
    return true; // Message handled (sync response)
  }

  return false; // Not a license message
}

/**
 * Modified createNewSession with license enforcement
 * Replace your existing createNewSession function with this version
 *
 * @param {string} url - URL to open in new session
 * @param {Function} callback - Callback with result
 */
function createNewSessionWithLicense(url, callback) {
  // Check if session creation is allowed
  const check = checkSessionCreationAllowed();

  if (!check.allowed) {
    console.warn('[License Integration] Session creation blocked:', check.reason);
    callback({
      success: false,
      error: check.reason,
      tier: check.tier,
      currentCount: check.currentCount,
      maxAllowed: check.maxAllowed
    });
    return;
  }

  // Proceed with original session creation
  const sessionId = generateSessionId();
  const color = sessionColors[Object.keys(sessionStore.sessions).length % sessionColors.length];

  sessionStore.sessions[sessionId] = {
    id: sessionId,
    color: color,
    createdAt: Date.now(),
    tabs: [],
    name: null // For premium/enterprise features
  };

  sessionStore.cookieStore[sessionId] = {};

  chrome.tabs.create({ url: url || 'about:blank' }, (tab) => {
    sessionStore.tabToSession[tab.id] = sessionId;
    sessionStore.sessions[sessionId].tabs.push(tab.id);

    // Set badge
    chrome.browserAction.setBadgeText({ text: '●', tabId: tab.id });
    chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: tab.id });

    // Update favicon badge
    updateFaviconBadge(tab.id, color);

    // Clear any browser cookies
    clearBrowserCookiesForTab(tab.id);

    // Persist
    persistSessions(true);

    console.log(`[License Integration] ✓ New session created (${check.tier} tier, ${check.currentCount + 1}/${check.maxAllowed === Infinity ? '∞' : check.maxAllowed}):`, sessionId);

    callback({
      success: true,
      sessionId: sessionId,
      tabId: tab.id,
      color: color,
      tier: check.tier
    });
  });
}

/**
 * Setup persistence enforcement timer
 * Runs daily to clean up expired sessions
 */
function setupPersistenceEnforcement() {
  // Run immediately
  enforceSessionPersistence();

  // Run daily
  setInterval(enforceSessionPersistence, 24 * 60 * 60 * 1000);

  console.log('[License Integration] Persistence enforcement timer started (runs daily)');
}

/**
 * Integration initialization
 * DEPRECATED: Now handled by initializationManager in background.js
 * This function is kept for backwards compatibility but is no longer called automatically
 */
async function initializeLicenseIntegration() {
  console.warn('[License Integration] DEPRECATED: initializeLicenseIntegration() called directly');
  console.warn('[License Integration] This function is deprecated - initialization is now managed by initializationManager');
  console.warn('[License Integration] See background.js initializationManager.initialize() for the new flow');

  // Initialize license system
  await initializeLicenseSystem();

  // Setup persistence enforcement
  setupPersistenceEnforcement();

  console.log('[License Integration] ✓ Integration complete (legacy mode)');
}

// REMOVED: Auto-initialization on script load
// Initialization is now controlled by initializationManager in background.js
// This prevents race conditions where license operations run before license manager is ready
console.log('[License Integration] License integration loaded (initialization managed by initializationManager)');
