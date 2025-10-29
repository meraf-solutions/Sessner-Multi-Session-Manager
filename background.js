/**
 * Background Script - Multi-Session Manager
 * Handles session management, cookie isolation, and request interception
 */

// ============= CRITICAL: Edge Wake-Up Mechanism =============
/**
 * Edge browser has a critical bug where persistent background pages don't load
 * on browser startup if no tabs were open when browser closed.
 *
 * This storage change listener triggers initialization when:
 * - Edge restores previous session (reads storage)
 * - Any extension writes to storage on startup
 * - Fallback alarm writes to storage
 */
let storageWakeUpHandled = false;

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (!storageWakeUpHandled && areaName === 'local') {
    storageWakeUpHandled = true;
    console.log('[Edge Wake-Up] ========================================');
    console.log('[Edge Wake-Up] Storage change detected - forcing initialization');
    console.log('[Edge Wake-Up] Changed keys:', Object.keys(changes));
    console.log('[Edge Wake-Up] ========================================');

    // Small delay to ensure background script is fully loaded
    setTimeout(() => {
      // Check if initialization already started
      if (typeof initializationManager !== 'undefined') {
        const currentState = initializationManager.currentState;
        console.log('[Edge Wake-Up] Current state:', currentState);

        // Only initialize if not already ready or in progress
        if (currentState === 'LOADING' || currentState === 'ERROR') {
          console.log('[Edge Wake-Up] Triggering initialization...');
          initializationManager.initialize().catch(error => {
            console.error('[Edge Wake-Up] Failed to initialize:', error);
          });
        } else {
          console.log('[Edge Wake-Up] Initialization already in progress or complete');
        }
      } else {
        console.warn('[Edge Wake-Up] initializationManager not yet defined, will retry via alarm');
      }
    }, 100);
  }
});

console.log('[Edge Wake-Up] ✓ Storage change listener installed');

// ============= Initialization Manager =============

/**
 * Manages phased initialization to prevent race conditions
 * Ensures license manager initializes BEFORE any session operations
 */
const initializationManager = {
  // Initialization states
  STATES: {
    LOADING: 'LOADING',
    LICENSE_INIT: 'LICENSE_INIT',
    LICENSE_READY: 'LICENSE_READY',
    AUTO_RESTORE_CHECK: 'AUTO_RESTORE_CHECK',
    SESSION_LOAD: 'SESSION_LOAD',
    CLEANUP: 'CLEANUP',
    READY: 'READY',
    ERROR: 'ERROR'
  },

  currentState: 'LOADING',
  initializationError: null,
  startTime: Date.now(),

  /**
   * Set initialization state and broadcast to popup
   * @param {string} state - New state
   * @param {Object} data - Additional data to broadcast
   */
  setState(state, data = {}) {
    this.currentState = state;
    const elapsed = Date.now() - this.startTime;

    console.log(`[INIT] State changed: ${state} (${elapsed}ms elapsed)`);

    // Broadcast state to all popup windows
    chrome.runtime.sendMessage({
      action: 'initializationStateChanged',
      state: state,
      data: data,
      elapsed: elapsed
    }, () => {
      // Ignore errors (no popup may be listening)
      if (chrome.runtime.lastError) {
        // Silent ignore
      }
    });
  },

  /**
   * Get current initialization state
   * @returns {{state: string, isReady: boolean, error: string|null}}
   */
  getState() {
    return {
      state: this.currentState,
      isReady: this.currentState === this.STATES.READY,
      error: this.initializationError
    };
  },

  /**
   * Wait for initialization to complete
   * @param {number} timeout - Max wait time in ms (default: 30000)
   * @returns {Promise<boolean>} True if ready, false if timeout
   */
  async waitForReady(timeout = 30000) {
    const startTime = Date.now();

    while (this.currentState !== this.STATES.READY && this.currentState !== this.STATES.ERROR) {
      if (Date.now() - startTime > timeout) {
        console.error('[INIT] Timeout waiting for initialization');
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return this.currentState === this.STATES.READY;
  },

  /**
   * Run complete initialization sequence
   */
  async initialize() {
    // Prevent duplicate initialization - if already READY or in progress, skip
    if (this.currentState === this.STATES.READY) {
      console.log('[INIT] Already initialized and ready, skipping duplicate initialization');
      return;
    }

    // If already initializing, wait for completion instead of starting new initialization
    if (this.currentState !== this.STATES.LOADING && this.currentState !== this.STATES.ERROR) {
      console.log('[INIT] Initialization already in progress (state:', this.currentState, '), waiting for completion...');
      await this.waitForReady();
      return;
    }

    try {
      console.log('[INIT] ========================================');
      console.log('[INIT] Starting extension initialization...');
      console.log('[INIT] ========================================');

      // Phase 0: Storage Persistence Manager Initialization
      console.log('[INIT] Phase 0: Initializing storage persistence manager...');

      if (typeof storagePersistenceManager !== 'undefined') {
        try {
          await storagePersistenceManager.initialize();
          console.log('[STORAGE] ✓ Storage persistence manager ready');
        } catch (error) {
          console.error('[STORAGE] ⚠️ Storage persistence manager failed, using fallback:', error);
          // Continue with fallback - not critical for startup
        }
      } else {
        console.warn('[STORAGE] ⚠️ Storage persistence manager not loaded, using fallback');
      }

      // Phase 1: License Manager Initialization
      this.setState(this.STATES.LICENSE_INIT);
      console.log('[INIT] Phase 1: Initializing license manager...');

      if (typeof licenseManager === 'undefined') {
        throw new Error('License manager not loaded');
      }

      await licenseManager.initialize();

      const tier = licenseManager.getTier();
      const features = licenseManager.getFeatures();

      console.log('[LICENSE] ✓ License manager ready');
      console.log('[LICENSE] Tier:', tier);
      console.log('[LICENSE] Features:', JSON.stringify(features, null, 2));

      this.setState(this.STATES.LICENSE_READY, { tier, features });

      // Phase 2: Auto-Restore Check (Enterprise only)
      this.setState(this.STATES.AUTO_RESTORE_CHECK);
      console.log('[INIT] Phase 2: Checking auto-restore settings...');

      if (tier === 'enterprise') {
        // Check if auto-restore is enabled
        const prefs = await new Promise(resolve => {
          chrome.storage.local.get(['autoRestorePreference'], data => {
            resolve(data.autoRestorePreference || {});
          });
        });

        console.log('[AUTO-RESTORE] Preferences loaded:', JSON.stringify(prefs));

        if (prefs.enabled) {
          console.log('[AUTO-RESTORE] ✓ Auto-restore enabled');
          // TODO: Implement auto-restore logic (Feature #02)
          console.log('[AUTO-RESTORE] Auto-restore implementation coming in Feature #02');
        } else {
          console.log('[AUTO-RESTORE] Auto-restore disabled');
        }
      } else {
        console.log('[AUTO-RESTORE] Not Enterprise tier, skipping auto-restore check');
      }

      // Phase 3: Load Persisted Sessions
      this.setState(this.STATES.SESSION_LOAD);
      console.log('[INIT] Phase 3: Loading persisted sessions...');

      loadPersistedSessions();

      console.log('[INIT] ✓ Sessions loaded successfully');

      // Phase 3.5: Detect Edge Browser Restore (Free/Premium only)
      // Use async pattern with retry logic (similar to Enterprise auto-restore)
      // No await - let detection run in background without blocking initialization
      detectEdgeBrowserRestore();

      // Phase 4: Run Cleanup (only after license ready!)
      this.setState(this.STATES.CLEANUP);
      console.log('[INIT] Phase 4: Running session cleanup...');

      await cleanupExpiredSessions();

      console.log('[INIT] ✓ Cleanup complete');

      // Phase 5: Ready
      this.setState(this.STATES.READY, { tier, features });
      console.log('[INIT] ========================================');
      console.log('[INIT] ✓ Initialization complete - extension ready');
      console.log('[INIT] Total time:', Date.now() - this.startTime, 'ms');
      console.log('[INIT] ========================================');

    } catch (error) {
      console.error('[INIT] ✗ Initialization error:', error);
      this.initializationError = error.message || error.toString();
      this.setState(this.STATES.ERROR, { error: this.initializationError });
      throw error;
    }
  }
};

// ============= State Management =============

// In-memory storage for session data
const sessionStore = {
  // Map of tabId to sessionId
  tabToSession: {},

  // Map of sessionId to session data
  sessions: {},

  // Map of sessionId to cookie store
  // Structure: { sessionId: { domain: { path: { cookieName: cookieObject } } } }
  cookieStore: {},

  // Map of domain to recent session activity (for noopener link inheritance)
  // Structure: { domain: { sessionId: lastAccessTime } }
  domainToSessionActivity: {}
};

// ============= Utilities =============

/**
 * Generate a unique session ID
 * @returns {string}
 */
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============= Tier-Based Color Palettes =============

/**
 * Color palettes by tier
 * Free: 6 colors (basic high-contrast palette)
 * Premium: 13 colors (expanded palette with exclusive color)
 * Enterprise: 35 colors (comprehensive palette with exclusive colors) + custom color support
 */
const COLOR_PALETTES = {
  free: [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Orange
    '#98D8C8', // Mint
    '#F7DC6F'  // Yellow
  ],
  premium: [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#FFA07A', // Orange
    '#98D8C8', // Mint
    '#F7DC6F', // Yellow
    '#BB8FCE', // Purple
    '#85C1E2', // Light Blue
    '#F06292', // Pink
    '#64B5F6', // Sky Blue
    '#81C784', // Green
    '#FFD54F', // Amber
    '#AB47BC'  // Medium Purple
  ],
  enterprise: [
    // All premium colors
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F06292', '#64B5F6', '#81C784', '#FFD54F',
    '#AB47BC', // Medium Purple (from Premium)
    // Extended enterprise colors (16 colors)
    '#E91E63', // Deep Pink
    '#9C27B0', // Deep Purple
    '#673AB7', // Indigo
    '#3F51B5', // Blue
    '#2196F3', // Light Blue
    '#00BCD4', // Cyan
    '#009688', // Teal
    '#4CAF50', // Green
    '#8BC34A', // Light Green
    '#CDDC39', // Lime
    '#FFEB3B', // Yellow
    '#FFC107', // Amber
    '#FF9800', // Orange
    '#FF5722', // Deep Orange
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#26A69A', // Teal Accent
    '#66BB6A', // Light Green Accent
    '#FFA726', // Orange Accent
    '#EF5350', // Red Accent
    '#5C6BC0', // Indigo Accent
  ]
};

/**
 * Get color palette for a specific tier
 * @param {string} tier - License tier ('free', 'premium', 'enterprise')
 * @returns {Array<string>} Array of color hex codes
 */
function getColorPaletteForTier(tier) {
  return COLOR_PALETTES[tier] || COLOR_PALETTES.free;
}

/**
 * Generate color for session based on ID and tier
 * @param {string} sessionId - The session ID
 * @param {string} tier - License tier ('free', 'premium', 'enterprise')
 * @param {string} customColor - Optional custom color (enterprise only)
 * @returns {string} Hex color code
 */
function sessionColor(sessionId, tier = null, customColor = null) {
  // If custom color provided and valid (enterprise only), use it
  if (customColor && isValidHexColor(customColor)) {
    return customColor;
  }

  // Get tier from license manager if not provided
  if (!tier) {
    try {
      if (typeof licenseManager !== 'undefined' && licenseManager.isInitialized) {
        tier = licenseManager.getTier();
      } else {
        tier = 'free'; // Default to free tier
      }
    } catch (error) {
      console.error('[Session Color] Error getting tier:', error);
      tier = 'free';
    }
  }

  // Get color palette for tier
  const colors = getColorPaletteForTier(tier);

  // Hash session ID to select color from palette
  const hash = sessionId.split('').reduce((acc, char) =>
    acc + char.charCodeAt(0), 0);

  return colors[hash % colors.length];
}

/**
 * Validate hex color format
 * @param {string} color - Color hex code
 * @returns {boolean} True if valid hex color
 */
function isValidHexColor(color) {
  if (!color || typeof color !== 'string') {
    return false;
  }

  // Remove whitespace
  color = color.trim();

  // Check format: #RRGGBB or #RGB
  const hexPattern = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;
  return hexPattern.test(color);
}

/**
 * Normalize hex color to 6-digit format
 * Converts #RGB to #RRGGBB
 * @param {string} color - Color hex code
 * @returns {string} Normalized hex color
 */
function normalizeHexColor(color) {
  if (!color) return null;

  color = color.trim().toUpperCase();

  // If 3-digit hex (#RGB), expand to 6-digit (#RRGGBB)
  if (color.length === 4) {
    return '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  }

  return color;
}

/**
 * Check color contrast ratio for badge visibility
 * Warns if contrast is too low against common backgrounds
 * @param {string} color - Hex color code
 * @returns {boolean} True if sufficient contrast
 */
function hasGoodContrast(color) {
  if (!color) return false;

  // Convert hex to RGB
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  // Calculate relative luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Check if color is too light (poor contrast on light backgrounds)
  // or too dark (poor contrast on dark backgrounds)
  // Good colors should be in middle range (0.2 - 0.8)
  return luminance >= 0.15 && luminance <= 0.85;
}

/**
 * Set colored badge (glowing dot) for a session tab
 * @param {number} tabId - The tab ID
 * @param {string} color - Hex color code
 */
function setSessionBadge(tabId, color) {
  chrome.browserAction.setBadgeText({ text: '●', tabId: tabId });
  chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: tabId });
}

/**
 * Clear badge for non-session tabs
 * @param {number} tabId - The tab ID
 */
function clearBadge(tabId) {
  chrome.browserAction.setBadgeText({ text: '', tabId: tabId });
}

/**
 * Validates that a cookie domain is valid for the given tab URL
 * SECURITY: Prevents cookie injection attacks across domains
 * @param {string} cookieDomain - The domain from the cookie
 * @param {string} tabUrl - The URL of the tab setting the cookie
 * @returns {boolean} True if domain is valid for this tab
 */
function isValidCookieDomain(cookieDomain, tabUrl) {
  try {
    const url = new URL(tabUrl);
    const tabHostname = url.hostname;

    // Remove leading dot from cookie domain for comparison
    const normalizedCookieDomain = cookieDomain.startsWith('.')
      ? cookieDomain.substring(1)
      : cookieDomain;

    // Cookie domain must match tab hostname exactly OR be a parent domain
    // Examples:
    // - tab: sub.example.com, cookie: sub.example.com ✓
    // - tab: sub.example.com, cookie: .example.com ✓
    // - tab: sub.example.com, cookie: example.com ✓
    // - tab: sub.example.com, cookie: evil.com ✗
    // - tab: example.com, cookie: sub.example.com ✗

    if (tabHostname === normalizedCookieDomain) {
      return true; // Exact match
    }

    if (tabHostname.endsWith('.' + normalizedCookieDomain)) {
      return true; // Parent domain match
    }

    return false;
  } catch (e) {
    console.error('[SECURITY] Invalid URL in domain validation:', e);
    return false;
  }
}

/**
 * Parse cookie string into object
 * @param {string} cookieString
 * @param {string} tabUrl - Optional tab URL for domain validation
 * @returns {Object|null} Parsed cookie object or null if invalid
 */
function parseCookie(cookieString, tabUrl = null) {
  const parts = cookieString.split(';').map(p => p.trim());
  const [nameValue, ...attributes] = parts;
  const [name, value] = nameValue.split('=');

  const cookie = {
    name: name.trim(),
    value: value || '',
    domain: '',
    path: '/',
    secure: false,
    httpOnly: false,
    sameSite: 'no_restriction'
  };

  attributes.forEach(attr => {
    const [key, val] = attr.split('=').map(s => s.trim());
    const lowerKey = key.toLowerCase();

    if (lowerKey === 'domain') {
      cookie.domain = val;
    } else if (lowerKey === 'path') {
      cookie.path = val;
    } else if (lowerKey === 'secure') {
      cookie.secure = true;
    } else if (lowerKey === 'httponly') {
      cookie.httpOnly = true;
    } else if (lowerKey === 'samesite') {
      cookie.sameSite = val.toLowerCase();
    } else if (lowerKey === 'max-age' || lowerKey === 'expires') {
      // Store expiration info
      cookie.expirationDate = val;
    }
  });

  // SECURITY: Validate cookie domain if tabUrl provided
  if (tabUrl && cookie.domain) {
    if (!isValidCookieDomain(cookie.domain, tabUrl)) {
      console.error('[SECURITY] Cookie domain validation failed:', cookie.domain, 'for URL:', tabUrl);
      return null; // Reject invalid cookie
    }
  }

  return cookie;
}

/**
 * Format cookies for Cookie header
 * @param {Array} cookies
 * @returns {string}
 */
function formatCookieHeader(cookies) {
  return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * Get session ID for a tab
 * @param {number} tabId
 * @returns {string|null}
 */
function getSessionForTab(tabId) {
  return sessionStore.tabToSession[tabId] || null;
}

/**
 * Remove expired cookies from session store
 * @param {string} sessionId
 */
function removeExpiredCookies(sessionId) {
  const sessionCookies = sessionStore.cookieStore[sessionId];
  if (!sessionCookies) return;

  let removedCount = 0;

  Object.keys(sessionCookies).forEach(domain => {
    Object.keys(sessionCookies[domain]).forEach(path => {
      Object.keys(sessionCookies[domain][path]).forEach(cookieName => {
        const cookie = sessionCookies[domain][path][cookieName];
        if (isExpiredCookie(cookie)) {
          delete sessionCookies[domain][path][cookieName];
          removedCount++;
          console.log(`[Cookie Expiration] Removed expired cookie: ${cookieName} for ${domain}`);
        }
      });

      // Clean up empty path objects
      if (Object.keys(sessionCookies[domain][path]).length === 0) {
        delete sessionCookies[domain][path];
      }
    });

    // Clean up empty domain objects
    if (Object.keys(sessionCookies[domain]).length === 0) {
      delete sessionCookies[domain];
    }
  });

  if (removedCount > 0) {
    console.log(`[Cookie Expiration] Removed ${removedCount} expired cookies from session ${sessionId}`);
  }
}

/**
 * Store cookie in session store
 * @param {string} sessionId
 * @param {string} domain
 * @param {Object} cookie
 */
function storeCookie(sessionId, domain, cookie) {
  // SECURITY: Don't store already-expired cookies
  if (isExpiredCookie(cookie)) {
    console.log(`[Cookie Expiration] Rejecting expired cookie: ${cookie.name} for ${domain}`);
    return;
  }

  if (!sessionStore.cookieStore[sessionId]) {
    sessionStore.cookieStore[sessionId] = {};
  }

  if (!sessionStore.cookieStore[sessionId][domain]) {
    sessionStore.cookieStore[sessionId][domain] = {};
  }

  if (!sessionStore.cookieStore[sessionId][domain][cookie.path]) {
    sessionStore.cookieStore[sessionId][domain][cookie.path] = {};
  }

  sessionStore.cookieStore[sessionId][domain][cookie.path][cookie.name] = cookie;

  // Persist cookies after storing (debounced to avoid excessive writes)
  persistSessions(false);
}

/**
 * Checks if a cookie has expired
 * @param {Object} cookie - The cookie object
 * @returns {boolean} True if cookie is expired
 */
function isExpiredCookie(cookie) {
  if (!cookie.expirationDate) {
    return false; // No expiration = session cookie, never expires in our store
  }

  // Handle numeric timestamp (seconds since epoch)
  if (typeof cookie.expirationDate === 'number') {
    return Date.now() / 1000 > cookie.expirationDate;
  }

  // Handle date string
  try {
    const expiryTime = new Date(cookie.expirationDate).getTime();
    return Date.now() > expiryTime;
  } catch (e) {
    console.error('[Cookie Expiration] Error parsing expiration date:', cookie.expirationDate, e);
    return false; // Keep cookie if we can't parse expiration
  }
}

/**
 * Checks if a hostname is an IP address (IPv4 or IPv6)
 * @param {string} hostname - The hostname to check
 * @returns {boolean} True if this is an IP address
 */
function isIPAddress(hostname) {
  // IPv4 pattern: 0.0.0.0 to 255.255.255.255
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  // IPv6 patterns: handles various formats including ::1, [::1], full addresses
  const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  const ipv6WithBracketsPattern = /^\[([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]$/;

  // Check IPv4
  if (ipv4Pattern.test(hostname)) {
    // Validate each octet is 0-255
    const octets = hostname.split('.');
    const isValid = octets.every(octet => {
      const num = parseInt(octet, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
    return isValid;
  }

  // Check IPv6 (with or without brackets)
  if (ipv6Pattern.test(hostname) || ipv6WithBracketsPattern.test(hostname)) {
    return true;
  }

  return false;
}

/**
 * Checks if a domain part is a valid hostname for cookie matching
 * SECURITY: Prevents matching across TLDs (e.g., .com, .co.uk)
 * COMPATIBILITY: Allows localhost, IP addresses, and single-word hostnames
 * @param {string} domainPart - The domain part to check
 * @returns {boolean} True if this is a valid hostname for cookie matching
 */
function isValidSLDPlusTLD(domainPart) {
  // Handle localhost (common in development)
  if (domainPart === 'localhost') {
    return true;
  }

  // Handle IP addresses (IPv4 and IPv6)
  // IMPORTANT: Check for IP address pattern FIRST, before splitting into parts
  // This prevents invalid IPs like "256.1.1.1" from being treated as domains
  const looksLikeIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(domainPart);
  const looksLikeIPv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/.test(domainPart) ||
                        /^\[([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}\]$/.test(domainPart);

  if (looksLikeIPv4 || looksLikeIPv6) {
    // If it looks like an IP, validate it properly
    // This rejects invalid IPs like "256.1.1.1"
    return isIPAddress(domainPart);
  }

  // Comprehensive list of TLDs (Top-Level Domains)
  // SECURITY: This list prevents cookie leakage across bare TLDs (e.g., .com, .co.uk)
  // while allowing valid domain names (e.g., google.com, google.co.uk)
  const commonTLDs = [
    // ===== Generic TLDs (gTLD) =====
    'com', 'org', 'net', 'info', 'biz', 'name', 'pro', 'tel', 'mobi',

    // ===== Sponsored TLDs (sTLD) =====
    'edu', 'gov', 'mil', 'int', 'aero', 'asia', 'cat', 'coop', 'jobs',
    'museum', 'post', 'travel', 'xxx',

    // ===== New Generic TLDs (ngTLD) - Popular & Tech-focused =====
    'app', 'dev', 'io', 'ai', 'cloud', 'tech', 'digital', 'online', 'site',
    'website', 'space', 'host', 'store', 'shop', 'blog', 'news', 'media',
    'email', 'link', 'live', 'social', 'network', 'web', 'services',
    'solutions', 'systems', 'technology', 'software', 'codes', 'computer',
    'domains', 'download', 'academy', 'agency', 'center', 'consulting',
    'expert', 'management', 'marketing', 'support', 'wiki', 'design',
    'studio', 'graphics', 'photos', 'video', 'works', 'zone', 'xyz',
    'top', 'win', 'click', 'fun', 'cool', 'lol', 'game', 'games',
    'play', 'rocks', 'world', 'city', 'today', 'life', 'style',
    'art', 'club', 'plus', 'red', 'blue', 'pink', 'black', 'green',

    // ===== Country Code TLDs (ccTLD) - Alphabetical =====
    // A
    'ac', 'ad', 'ae', 'af', 'ag', 'ai', 'al', 'am', 'ao', 'aq', 'ar', 'as', 'at', 'au', 'aw', 'ax', 'az',
    // B
    'ba', 'bb', 'bd', 'be', 'bf', 'bg', 'bh', 'bi', 'bj', 'bm', 'bn', 'bo', 'br', 'bs', 'bt', 'bw', 'by', 'bz',
    // C
    'ca', 'cc', 'cd', 'cf', 'cg', 'ch', 'ci', 'ck', 'cl', 'cm', 'cn', 'co', 'cr', 'cu', 'cv', 'cw', 'cx', 'cy', 'cz',
    // D
    'de', 'dj', 'dk', 'dm', 'do', 'dz',
    // E
    'ec', 'ee', 'eg', 'er', 'es', 'et', 'eu',
    // F
    'fi', 'fj', 'fk', 'fm', 'fo', 'fr',
    // G
    'ga', 'gd', 'ge', 'gf', 'gg', 'gh', 'gi', 'gl', 'gm', 'gn', 'gp', 'gq', 'gr', 'gs', 'gt', 'gu', 'gw', 'gy',
    // H
    'hk', 'hm', 'hn', 'hr', 'ht', 'hu',
    // I
    'id', 'ie', 'il', 'im', 'in', 'io', 'iq', 'ir', 'is', 'it',
    // J
    'je', 'jm', 'jo', 'jp',
    // K
    'ke', 'kg', 'kh', 'ki', 'km', 'kn', 'kp', 'kr', 'kw', 'ky', 'kz',
    // L
    'la', 'lb', 'lc', 'li', 'lk', 'lr', 'ls', 'lt', 'lu', 'lv', 'ly',
    // M
    'ma', 'mc', 'md', 'me', 'mg', 'mh', 'mk', 'ml', 'mm', 'mn', 'mo', 'mp', 'mq', 'mr', 'ms', 'mt', 'mu', 'mv', 'mw', 'mx', 'my', 'mz',
    // N
    'na', 'nc', 'ne', 'nf', 'ng', 'ni', 'nl', 'no', 'np', 'nr', 'nu', 'nz',
    // O
    'om',
    // P
    'pa', 'pe', 'pf', 'pg', 'ph', 'pk', 'pl', 'pm', 'pn', 'pr', 'ps', 'pt', 'pw', 'py',
    // Q
    'qa',
    // R
    're', 'ro', 'rs', 'ru', 'rw',
    // S
    'sa', 'sb', 'sc', 'sd', 'se', 'sg', 'sh', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sr', 'ss', 'st', 'su', 'sv', 'sx', 'sy', 'sz',
    // T
    'tc', 'td', 'tf', 'tg', 'th', 'tj', 'tk', 'tl', 'tm', 'tn', 'to', 'tr', 'tt', 'tv', 'tw', 'tz',
    // U
    'ua', 'ug', 'uk', 'us', 'uy', 'uz',
    // V
    'va', 'vc', 've', 'vg', 'vi', 'vn', 'vu',
    // W
    'wf', 'ws',
    // Y
    'ye', 'yt',
    // Z
    'za', 'zm', 'zw',

    // ===== Multi-part TLDs (Second-Level Domains) =====
    // United Kingdom
    'co.uk', 'ac.uk', 'gov.uk', 'org.uk', 'net.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'sch.uk',
    // Japan
    'co.jp', 'ac.jp', 'go.jp', 'or.jp', 'ne.jp', 'gr.jp', 'ed.jp', 'lg.jp',
    // Australia
    'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au', 'asn.au', 'id.au',
    // New Zealand
    'co.nz', 'ac.nz', 'govt.nz', 'geek.nz', 'gen.nz', 'kiwi.nz', 'maori.nz', 'net.nz', 'org.nz', 'school.nz',
    // Brazil
    'com.br', 'net.br', 'org.br', 'gov.br', 'edu.br', 'mil.br', 'art.br', 'blog.br',
    // India
    'co.in', 'net.in', 'org.in', 'gen.in', 'firm.in', 'ind.in',
    // South Africa
    'co.za', 'net.za', 'org.za', 'web.za', 'gov.za', 'ac.za',
    // Canada
    'co.ca', 'ab.ca', 'bc.ca', 'mb.ca', 'nb.ca', 'nf.ca', 'nl.ca', 'ns.ca', 'nt.ca', 'nu.ca', 'on.ca', 'pe.ca', 'qc.ca', 'sk.ca', 'yk.ca',
    // Mexico
    'com.mx', 'net.mx', 'org.mx', 'edu.mx', 'gob.mx',
    // Singapore
    'com.sg', 'net.sg', 'org.sg', 'gov.sg', 'edu.sg', 'per.sg',
    // Hong Kong
    'com.hk', 'net.hk', 'org.hk', 'edu.hk', 'gov.hk',
    // China
    'com.cn', 'net.cn', 'org.cn', 'edu.cn', 'gov.cn', 'ac.cn',
    // Taiwan
    'com.tw', 'net.tw', 'org.tw', 'edu.tw', 'gov.tw', 'idv.tw',
    // South Korea
    'co.kr', 'ne.kr', 'or.kr', 're.kr', 'pe.kr', 'go.kr', 'mil.kr', 'ac.kr', 'hs.kr', 'ms.kr', 'es.kr', 'sc.kr', 'kg.kr',
    // Russia
    'com.ru', 'net.ru', 'org.ru', 'pp.ru', 'msk.ru', 'spb.ru',
    // Germany
    'com.de', 'net.de', 'org.de',
    // France
    'com.fr', 'asso.fr', 'nom.fr', 'presse.fr', 'tm.fr', 'gouv.fr',
    // Italy
    'com.it', 'net.it', 'org.it', 'edu.it', 'gov.it',
    // Spain
    'com.es', 'nom.es', 'org.es', 'gob.es', 'edu.es',
    // Netherlands
    'co.nl', 'net.nl', 'org.nl',
    // Argentina
    'com.ar', 'net.ar', 'org.ar', 'gov.ar', 'edu.ar',
    // Chile
    'co.cl', 'gob.cl', 'gov.cl', 'mil.cl',
    // Colombia
    'com.co', 'net.co', 'nom.co', 'edu.co', 'org.co', 'gov.co', 'mil.co',
    // Venezuela
    'co.ve', 'net.ve', 'org.ve', 'edu.ve', 'gov.ve', 'mil.ve',
    // Peru
    'com.pe', 'net.pe', 'org.pe', 'edu.pe', 'gob.pe', 'mil.pe', 'nom.pe',
    // UAE
    'co.ae', 'net.ae', 'org.ae', 'sch.ae', 'ac.ae', 'gov.ae', 'mil.ae',
    // Saudi Arabia
    'com.sa', 'net.sa', 'org.sa', 'gov.sa', 'edu.sa', 'sch.sa', 'med.sa', 'pub.sa',
    // Israel
    'co.il', 'net.il', 'org.il', 'ac.il', 'gov.il', 'idf.il', 'muni.il',
    // Turkey
    'com.tr', 'net.tr', 'org.tr', 'edu.tr', 'gov.tr', 'mil.tr', 'bel.tr', 'pol.tr',
    // Thailand
    'co.th', 'ac.th', 'go.th', 'in.th', 'mi.th', 'net.th', 'or.th',
    // Malaysia
    'com.my', 'net.my', 'org.my', 'edu.my', 'gov.my', 'mil.my', 'name.my',
    // Indonesia
    'co.id', 'ac.id', 'or.id', 'go.id', 'mil.id', 'net.id', 'web.id', 'sch.id',
    // Philippines
    'com.ph', 'net.ph', 'org.ph', 'edu.ph', 'gov.ph', 'mil.ph', 'ngo.ph',
    // Vietnam
    'com.vn', 'net.vn', 'org.vn', 'edu.vn', 'gov.vn', 'int.vn', 'ac.vn', 'biz.vn', 'info.vn', 'name.vn', 'pro.vn', 'health.vn',
    // Pakistan
    'com.pk', 'net.pk', 'org.pk', 'edu.pk', 'gov.pk', 'gob.pk', 'gok.pk', 'gop.pk', 'gos.pk', 'info.pk', 'web.pk',
    // Bangladesh
    'com.bd', 'net.bd', 'org.bd', 'edu.bd', 'gov.bd', 'mil.bd', 'ac.bd',
    // Nigeria
    'com.ng', 'net.ng', 'org.ng', 'edu.ng', 'gov.ng', 'mil.ng', 'mobi.ng', 'name.ng', 'sch.ng',
    // Kenya
    'co.ke', 'ac.ke', 'or.ke', 'go.ke', 'ne.ke', 'sc.ke', 'me.ke', 'mobi.ke', 'info.ke',
    // Egypt
    'com.eg', 'net.eg', 'org.eg', 'edu.eg', 'gov.eg', 'mil.eg', 'sci.eg',
    // Poland
    'com.pl', 'net.pl', 'org.pl', 'edu.pl', 'gov.pl', 'mil.pl', 'biz.pl', 'info.pl',
    // Czech Republic
    'co.cz',
    // Greece
    'com.gr', 'net.gr', 'org.gr', 'edu.gr', 'gov.gr',
    // Portugal
    'com.pt', 'edu.pt', 'gov.pt', 'int.pt', 'net.pt', 'nome.pt', 'org.pt', 'publ.pt',
    // Sweden
    'com.se', 'org.se',
    // Norway
    'com.no', 'net.no', 'org.no',
    // Denmark
    'co.dk',
    // Finland
    'com.fi',
    // Ireland
    'ie',
    // Belgium
    'co.be',
    // Switzerland
    'com.ch',
    // Austria
    'co.at', 'or.at', 'gv.at', 'ac.at',
    // Ukraine
    'com.ua', 'net.ua', 'org.ua', 'edu.ua', 'gov.ua',
    // Belarus
    'com.by', 'net.by', 'org.by',
    // Kazakhstan
    'com.kz', 'net.kz', 'org.kz', 'edu.kz', 'gov.kz', 'mil.kz'
  ];

  const parts = domainPart.split('.');

  // SECURITY: Reject bare TLDs (.com, .org, etc.)
  // But allow single-word hostnames (intranet, server01, etc.)
  if (parts.length === 1) {
    // Single word: allow it unless it's a bare TLD
    return !commonTLDs.includes(parts[0]);
  }

  // Check against known multi-part TLDs (e.g., co.uk)
  const lastTwoParts = parts.slice(-2).join('.');
  if (commonTLDs.includes(lastTwoParts)) {
    return true; // e.g., co.uk
  }

  // Check against known single-part TLDs (e.g., google.com)
  const lastPart = parts[parts.length - 1];
  if (commonTLDs.includes(lastPart) && parts.length === 2) {
    return true; // e.g., google.com
  }

  // If not in list but has 2+ parts, assume valid (conservative approach)
  return parts.length >= 2;
}

/**
 * Get cookies for session and domain
 * @param {string} sessionId
 * @param {string} domain
 * @param {string} path
 * @returns {Array}
 */
function getCookiesForSession(sessionId, domain, path) {
  const cookies = [];
  const sessionCookies = sessionStore.cookieStore[sessionId];

  if (!sessionCookies) {
    return cookies;
  }

  // Match domain and parent domains
  const domainParts = domain.split('.');
  const domainsToCheck = [];

  // Add current domain and parent domains
  // SECURITY FIX: Stop at valid SLD+TLD to prevent TLD-level matching
  for (let i = 0; i < domainParts.length; i++) {
    const domainToCheck = domainParts.slice(i).join('.');

    // SECURITY: Only add domain if it's a valid SLD+TLD or more specific
    // Prevents matching against bare TLDs like ".com"
    if (isValidSLDPlusTLD(domainToCheck)) {
      domainsToCheck.push(domainToCheck);
      domainsToCheck.push('.' + domainToCheck);
    } else {
      // Stop iteration once we hit invalid domains (bare TLDs)
      break;
    }
  }

  domainsToCheck.forEach(d => {
    if (sessionCookies[d]) {
      Object.keys(sessionCookies[d]).forEach(p => {
        // Check if path matches
        if (path.startsWith(p)) {
          Object.values(sessionCookies[d][p]).forEach(cookie => {
            // SECURITY: Check expiration before adding
            if (!cookie.expirationDate || !isExpiredCookie(cookie)) {
              cookies.push(cookie);
            }
          });
        }
      });
    }
  });

  return cookies;
}

// ============= Persistence Functions =============

/**
 * Debounce timer for persistence
 */
let persistTimer = null;

/**
 * Collect tab metadata (URLs) for session restoration
 * CRITICAL: Edge assigns NEW tab IDs on browser restart
 * Solution: Store tab URLs and match by URL on restoration
 * @returns {Promise<Object>} Map of tabId -> { url, sessionId, title }
 */
async function collectTabMetadata() {
  return new Promise((resolve) => {
    const metadata = {};

    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) {
        console.error('[Tab Metadata] Failed to query tabs:', chrome.runtime.lastError);
        resolve(metadata);
        return;
      }

      let processed = 0;
      const total = tabs.length;

      if (total === 0) {
        resolve(metadata);
        return;
      }

      tabs.forEach(tab => {
        const sessionId = sessionStore.tabToSession[tab.id];

        if (sessionId && sessionStore.sessions[sessionId]) {
          metadata[tab.id] = {
            url: tab.url,
            sessionId: sessionId,
            title: tab.title || 'Untitled',
            index: tab.index,
            pinned: tab.pinned || false,
            windowId: tab.windowId
          };
        }

        processed++;
        if (processed === total) {
          console.log(`[Tab Metadata] Collected metadata for ${Object.keys(metadata).length} session tabs`);
          resolve(metadata);
        }
      });
    });
  });
}

/**
 * Save sessions and cookies to persistent storage (debounced)
 * Uses multi-layer storage persistence (chrome.storage.local + IndexedDB + sync)
 * @param {boolean} immediate - If true, persist immediately without debouncing
 */
function persistSessions(immediate = false) {
  if (immediate) {
    // Clear any pending timer
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    // Collect tab metadata (URLs for restoration)
    collectTabMetadata().then(async tabMetadata => {
      // Persist immediately to all layers
      const data = {
        sessions: sessionStore.sessions,
        cookieStore: sessionStore.cookieStore,
        tabToSession: sessionStore.tabToSession,
        tabMetadata: tabMetadata  // NEW: Tab URLs for restoration
      };

      // Use storage persistence manager if initialized
      if (typeof storagePersistenceManager !== 'undefined' && storagePersistenceManager.isInitialized) {
        try {
          await storagePersistenceManager.saveData(data);

          // CRITICAL FIX: Add flush delay to ensure IndexedDB commits to disk
          // This is especially important for Edge when browser closes immediately
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log('[Persist] ✓ Data flushed to disk (100ms flush delay completed)');

        } catch (error) {
          console.error('[Persist] Multi-layer save error:', error);
          // Fallback to basic chrome.storage.local
          fallbackPersist(data, 'immediate');
        }
      } else {
        // Fallback if persistence manager not ready
        fallbackPersist(data, 'immediate');
      }
    }).catch(error => {
      console.error('[Persist] Failed to collect tab metadata:', error);
      // Persist without metadata as fallback
      const data = {
        sessions: sessionStore.sessions,
        cookieStore: sessionStore.cookieStore,
        tabToSession: sessionStore.tabToSession
      };
      fallbackPersist(data, 'immediate');
    });
  } else {
    // Debounce persistence to avoid excessive writes during rapid cookie updates
    if (persistTimer) {
      clearTimeout(persistTimer);
    }

    persistTimer = setTimeout(() => {
      // Collect tab metadata (URLs for restoration)
      collectTabMetadata().then(tabMetadata => {
        const data = {
          sessions: sessionStore.sessions,
          cookieStore: sessionStore.cookieStore,
          tabToSession: sessionStore.tabToSession,
          tabMetadata: tabMetadata  // NEW: Tab URLs for restoration
        };

        // Use storage persistence manager if initialized
        if (typeof storagePersistenceManager !== 'undefined' && storagePersistenceManager.isInitialized) {
          storagePersistenceManager.saveData(data).catch(error => {
            console.error('[Persist] Multi-layer save error:', error);
            // Fallback to basic chrome.storage.local
            fallbackPersist(data, 'debounced');
          });
        } else {
          // Fallback if persistence manager not ready
          fallbackPersist(data, 'debounced');
        }

        persistTimer = null;
      }).catch(error => {
        console.error('[Persist] Failed to collect tab metadata:', error);
        // Persist without metadata as fallback
        const data = {
          sessions: sessionStore.sessions,
          cookieStore: sessionStore.cookieStore,
          tabToSession: sessionStore.tabToSession
        };
        fallbackPersist(data, 'debounced');
        persistTimer = null;
      });
    }, 1000); // Wait 1 second before persisting
  }
}

/**
 * Fallback persistence using only chrome.storage.local
 * @param {Object} data - Data to persist
 * @param {string} mode - 'immediate' or 'debounced'
 */
function fallbackPersist(data, mode) {
  chrome.storage.local.set({
    sessions: data.sessions || {},
    cookieStore: data.cookieStore || {},
    tabToSession: data.tabToSession || {},
    tabMetadata: data.tabMetadata || {},  // NEW: Include tab metadata
    _lastSaved: Date.now()
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('[Persist] Failed to persist sessions:', chrome.runtime.lastError);
    } else {
      console.log(`[Persist] Sessions persisted to storage (${mode}) [FALLBACK]`);
    }
  });
}

/**
 * Load persisted sessions from storage (multi-layer)
 * FEATURE: Auto-Restore (Enterprise-only)
 * - Free/Premium: Session data retained but tab mappings NOT restored
 * - Enterprise: Full auto-restore with tab-to-session mappings
 */
async function loadPersistedSessions() {
  console.log('[Session Restore] ================================================');
  console.log('[Session Restore] Loading persisted sessions from all storage layers...');

  // ========== STEP 1: Check Tier and Auto-Restore Preference ==========
  let tier = 'free'; // Default to free tier (fail-safe)
  let autoRestoreEnabled = false;

  try {
    // Get current tier from license manager
    tier = licenseManager.getTier();
    console.log('[Session Restore] Current tier:', tier);
  } catch (error) {
    console.error('[Session Restore] Error getting tier:', error);
    console.warn('[Session Restore] Defaulting to Free tier (fail-safe)');
    tier = 'free';
  }

  // Get auto-restore preference from storage
  try {
    const prefs = await new Promise((resolve) => {
      chrome.storage.local.get(['autoRestorePreference'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Session Restore] Error reading auto-restore preference:', chrome.runtime.lastError);
          resolve({ autoRestorePreference: { enabled: false } });
        } else {
          resolve(result);
        }
      });
    });

    let preference = prefs.autoRestorePreference || {};

    // CLEANUP STALE DOWNGRADE METADATA: If user is Enterprise and has stale downgrade metadata, clean it
    if (tier === 'enterprise' && preference.disabledReason === 'tier_downgrade') {
      console.log('[Session Restore] ⚠ Detected stale downgrade metadata for Enterprise user');
      console.log('[Session Restore] Cleaning up stale metadata from previous tier downgrade...');

      // Keep only the essential fields
      const cleanPreference = {
        enabled: preference.enabled !== false, // Default to true for Enterprise if not explicitly false
        dontShowNotice: preference.dontShowNotice || false
      };

      // Log the cleanup
      console.log('[Session Restore] Before cleanup:', preference);
      console.log('[Session Restore] After cleanup:', cleanPreference);

      // Save cleaned preference back to storage
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({ autoRestorePreference: cleanPreference }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
        console.log('[Session Restore] ✓ Stale downgrade metadata cleaned successfully');
        preference = cleanPreference; // Use cleaned preference
      } catch (cleanupError) {
        console.error('[Session Restore] ✗ Error saving cleaned preference:', cleanupError);
        // Continue with uncleaned preference (fail gracefully)
      }
    }

    // Boolean coercion for safety (handles corrupted preferences)
    autoRestoreEnabled = Boolean(preference.enabled);
    console.log('[Session Restore] Auto-restore preference:', autoRestoreEnabled);
  } catch (error) {
    console.error('[Session Restore] Error loading auto-restore preference:', error);
    autoRestoreEnabled = false;
  }

  // Determine if auto-restore should execute
  const shouldAutoRestore = (tier === 'enterprise') && autoRestoreEnabled;
  console.log('[Session Restore] Should auto-restore:', shouldAutoRestore);
  console.log('[Session Restore]   - Tier is Enterprise:', tier === 'enterprise');
  console.log('[Session Restore]   - Auto-restore enabled:', autoRestoreEnabled);

  if (!shouldAutoRestore) {
    if (tier !== 'enterprise') {
      console.log('[Session Restore] ⚠ Auto-restore DISABLED: Not Enterprise tier');
    } else {
      console.log('[Session Restore] ⚠ Auto-restore DISABLED: Preference not enabled');
    }
  } else {
    console.log('[Session Restore] ✓ Auto-restore ENABLED');
  }

  // ========== STEP 2: Load Session Data from Storage ==========
  let data = null;

  // Try multi-layer storage if available
  if (typeof storagePersistenceManager !== 'undefined' && storagePersistenceManager.isInitialized) {
    try {
      data = await storagePersistenceManager.loadData();
      console.log('[Session Restore] Loaded from storage layer:', data.source);
      console.log('[Session Restore] Data timestamp:', data.timestamp ? new Date(data.timestamp).toISOString() : 'unknown');
    } catch (error) {
      console.error('[Session Restore] Multi-layer load error:', error);
      // Fall through to fallback
    }
  }

  // Fallback to basic chrome.storage.local
  if (!data || data.source === 'none') {
    console.log('[Session Restore] Using fallback chrome.storage.local...');
    data = await new Promise((resolve) => {
      chrome.storage.local.get(['sessions', 'cookieStore', 'tabToSession', 'tabMetadata'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Session Restore] Failed to load sessions:', chrome.runtime.lastError);
          resolve({ sessions: {}, cookieStore: {}, tabToSession: {}, tabMetadata: {}, source: 'none' });
        } else {
          resolve({
            sessions: result.sessions || {},
            cookieStore: result.cookieStore || {},
            tabToSession: result.tabToSession || {},
            tabMetadata: result.tabMetadata || {},  // NEW: Include tab metadata
            source: 'local-fallback'
          });
        }
      });
    });
  }

  // Initialize with empty objects if no data
  if (!data.sessions || Object.keys(data.sessions).length === 0) {
    sessionStore.sessions = {};
    sessionStore.cookieStore = {};
    sessionStore.tabToSession = {};
    console.log('[Session Restore] No persisted data found, starting fresh');
    console.log('[Session Restore] Active sessions (with tabs): 0');
    console.log('[Session Restore] Total sessions in storage: 0');
    console.log('[Session Restore] ================================================');
    return;
  }

  // ========== STEP 3: Restore Session Data (All Tiers) ==========
  // Load sessions and cookieStore temporarily
  const loadedSessions = data.sessions || {};
  const loadedCookieStore = data.cookieStore || {};
  const loadedTabToSession = data.tabToSession || {};

  console.log('[Session Restore] Loaded from storage:', Object.keys(loadedSessions).length, 'sessions');
  console.log('[Session Restore] Loaded from storage:', Object.keys(loadedTabToSession).length, 'tab mappings');

  // Ensure all sessions have lastAccessed field (for backward compatibility)
  Object.keys(loadedSessions).forEach(sessionId => {
    const session = loadedSessions[sessionId];
    if (!session.lastAccessed) {
      // Set to createdAt or current time as fallback
      session.lastAccessed = session.createdAt || Date.now();
      console.log('[Session Restore] Added lastAccessed to session:', sessionId);
    }

    // Ensure all sessions have name field (for backward compatibility with session naming feature)
    if (session.name === undefined) {
      session.name = null; // Initialize to null (no custom name)
      console.log('[Session Restore] Added name field to session:', sessionId);
    }

    // Remove _isCreating flag if present (shouldn't persist across restarts)
    if (session._isCreating) {
      delete session._isCreating;
      console.log('[Session Restore] Removed stale _isCreating flag from session:', sessionId);
    }
  });

  // ========== STEP 4: TIER-BASED SESSION RESTORATION ==========

  if (!shouldAutoRestore) {
    // ========== FREE/PREMIUM TIER: Immediate Cleanup (No Tab Restoration) ==========
    console.log('[Session Restore] FREE/PREMIUM TIER: No auto-restore, applying immediate cleanup...');

    // Clear tab mappings immediately (no tabs to restore)
    sessionStore.tabToSession = {};

    // Cleanup sessions with invalid/missing tabs
    const sessionsToDelete = [];

    // For Free/Premium: Any session with tabs should be validated
    // Since we're not restoring tabs, sessions from previous browser session have stale tab IDs
    // We need to check if those tab IDs still exist in current browser

    // Query current tabs to check if any session tabs still exist
    const tabs = await new Promise((resolve) => {
      chrome.tabs.query({}, (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Session Restore] Failed to query tabs:', chrome.runtime.lastError);
          resolve([]);
        } else {
          resolve(result || []);
        }
      });
    });

    const existingTabIds = new Set(tabs.map(t => t.id));
    console.log('[Session Restore] Found', existingTabIds.size, 'existing tabs in browser');

    // Validate each session's tab list
    Object.keys(loadedSessions).forEach(sessionId => {
      const session = loadedSessions[sessionId];

      // Ensure session has tabs array
      if (!session.tabs) {
        session.tabs = [];
      }

      // Filter out non-existent tabs (stale tab IDs from before restart)
      const originalTabCount = session.tabs.length;
      const validTabs = session.tabs.filter(tabId => existingTabIds.has(tabId));

      if (validTabs.length !== originalTabCount) {
        const removedCount = originalTabCount - validTabs.length;
        console.log(`[Session Restore] Session ${sessionId}: Removed ${removedCount} stale tabs (${originalTabCount} -> ${validTabs.length})`);
        session.tabs = validTabs;
      }

      // If no valid tabs remain, mark session for deletion
      if (validTabs.length === 0) {
        console.log('[Session Restore] Marking empty session for deletion:', sessionId);
        sessionsToDelete.push(sessionId);
      }
    });

    // Delete orphaned sessions (no valid tabs)
    if (sessionsToDelete.length > 0) {
      console.log('[Session Restore] Deleting', sessionsToDelete.length, 'orphaned sessions');
      sessionsToDelete.forEach(sessionId => {
        console.log('[Session Restore] Deleting session:', sessionId);

        // Clear badges and favicon for all tabs that belonged to this session
        const session = loadedSessions[sessionId];
        if (session && session.tabs && session.tabs.length > 0) {
          session.tabs.forEach(tabId => {
            console.log(`[Session Restore] Clearing badges for orphaned tab ${tabId}`);

            // Clear extension icon badge
            clearBadge(tabId);

            // Clear favicon badge by notifying content script to remove overlay
            chrome.tabs.sendMessage(tabId, {
              action: 'clearSessionFavicon'
            }, (response) => {
              if (chrome.runtime.lastError) {
                // Tab might not exist or content script not loaded - silent ignore
                console.log(`[Session Restore] Could not clear favicon for tab ${tabId} (tab may not exist)`);
              } else {
                console.log(`[Session Restore] Cleared favicon badge for tab ${tabId}`);
              }
            });
          });
        }

        delete loadedSessions[sessionId];
        delete loadedCookieStore[sessionId];
      });
    }

    // Apply cleaned data to sessionStore IMMEDIATELY
    sessionStore.sessions = loadedSessions;
    sessionStore.cookieStore = loadedCookieStore;

    // Persist cleaned state if we made changes
    if (sessionsToDelete.length > 0) {
      console.log('[Session Restore] Persisting cleaned-up state (Free/Premium)...');
      persistSessions(true);
    }

    // Log final state
    const activeCount = getActiveSessionCount();
    const totalCount = Object.keys(sessionStore.sessions).length;

    console.log('[Session Restore] ✓ FREE/PREMIUM cleanup complete');
    console.log('[Session Restore] Active sessions (with tabs):', activeCount);
    console.log('[Session Restore] Total sessions in storage:', totalCount);
    console.log('[Session Restore] Tier:', tier);
    console.log('[Session Restore] ================================================');

    return; // Exit early, no need for Enterprise auto-restore logic
  }

  // ========== ENTERPRISE TIER: Auto-Restore with Tab Matching ==========
  console.log('[Session Restore] ENTERPRISE TIER: Starting auto-restore with tab matching...');
  console.log('[Session Restore] Waiting for Edge to restore tabs...');

  setTimeout(async () => {
    // Retry logic: Try up to 3 times to get restored tabs
    let tabs = [];
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      tabs = await new Promise((resolve) => {
        chrome.tabs.query({}, (result) => {
          if (chrome.runtime.lastError) {
            console.error('[Session Restore] Failed to query tabs:', chrome.runtime.lastError);
            resolve([]);
          } else {
            resolve(result || []);
          }
        });
      });

      console.log(`[Session Restore] Tab query attempt ${attempt + 1}: Found ${tabs.length} tabs`);

      // If we found tabs, break out of retry loop
      if (tabs.length > 0) {
        break;
      }

      // If no tabs found, wait and retry
      if (attempt < maxAttempts - 1) {
        console.log(`[Session Restore] No tabs found, waiting 1 second before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      attempt++;
    }

    if (tabs.length === 0) {
      console.warn('[Session Restore] No tabs found after 3 attempts - proceeding with empty tab list');
      // Don't return early - continue with restoration logic
      // This allows sessions to be loaded even if tabs aren't ready yet
    }

    const existingTabIds = new Set(tabs.map(t => t.id));
    console.log('[Session Restore] Found', existingTabIds.size, 'existing tabs in browser');

    // ========== ENTERPRISE: URL-BASED TAB MAPPING RESTORATION ==========
    console.log('[Session Restore] ✓ ENTERPRISE AUTO-RESTORE: Restoring tab mappings...');

    // CRITICAL FIX: Use URL-based matching for tab restoration
    // Edge assigns NEW tab IDs on restart, so old ID mappings are invalid
    const loadedTabMetadata = data.tabMetadata || {};
    const restoredMappings = {};
    let urlMatchCount = 0;
    let idMatchCount = 0;

    console.log('[Session Restore] Tab metadata entries:', Object.keys(loadedTabMetadata).length);

    // Step 1: Try URL-based matching first (primary method)
    if (Object.keys(loadedTabMetadata).length > 0) {
      console.log('[Session Restore] Using URL-based tab matching...');

      tabs.forEach(tab => {
        // Skip chrome:// and edge:// URLs (internal browser pages)
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
          return;
        }

        // Find matching URL in saved metadata
        const savedTabEntry = Object.values(loadedTabMetadata).find(
          saved => saved.url === tab.url
        );

        if (savedTabEntry && loadedSessions[savedTabEntry.sessionId]) {
          // Restore session mapping with NEW tab ID
          restoredMappings[tab.id] = savedTabEntry.sessionId;
          urlMatchCount++;
          console.log(`[Session Restore] ✓ URL match: Tab ${tab.id} (${tab.url}) -> session ${savedTabEntry.sessionId}`);

          // Update session's tab list with NEW tab ID
          if (!loadedSessions[savedTabEntry.sessionId].tabs) {
            loadedSessions[savedTabEntry.sessionId].tabs = [];
          }
          if (!loadedSessions[savedTabEntry.sessionId].tabs.includes(tab.id)) {
            loadedSessions[savedTabEntry.sessionId].tabs.push(tab.id);
          }
        }
      });

      console.log(`[Session Restore] URL-based matching: ${urlMatchCount} tabs restored`);
    }

    // Step 2: Fallback to ID-based matching for any remaining tabs
    // This handles tabs that existed before URL-based matching was implemented
    Object.keys(loadedTabToSession).forEach(tabIdStr => {
      const tabId = parseInt(tabIdStr);
      if (existingTabIds.has(tabId) && !restoredMappings[tabId]) {
        restoredMappings[tabId] = loadedTabToSession[tabIdStr];
        idMatchCount++;
        console.log('[Session Restore] ✓ ID match: Tab', tabId, '-> session', loadedTabToSession[tabIdStr]);
      }
    });

    if (idMatchCount > 0) {
      console.log(`[Session Restore] ID-based matching: ${idMatchCount} tabs restored (legacy)`);
    }

    console.log('[Session Restore] ✓ ENTERPRISE: Total restored:', Object.keys(restoredMappings).length, 'tab mappings');

    // Apply restored tab mappings
    sessionStore.tabToSession = restoredMappings;

    // Step 2: Clean up sessions - validate tab lists and remove empty sessions
    const sessionsToDelete = [];
    let staleTabCount = 0;

    Object.keys(loadedSessions).forEach(sessionId => {
      const session = loadedSessions[sessionId];

      // Ensure session has tabs array
      if (!session.tabs) {
        session.tabs = [];
      }

      // Filter out non-existent tabs from session.tabs array
      const originalTabCount = session.tabs.length;
      const validTabs = session.tabs.filter(tabId => existingTabIds.has(tabId));

      if (validTabs.length !== originalTabCount) {
        const removedCount = originalTabCount - validTabs.length;
        staleTabCount += removedCount;
        console.log(`[Session Restore] Session ${sessionId}: Removed ${removedCount} stale tabs (${originalTabCount} -> ${validTabs.length})`);
        session.tabs = validTabs;
      }

      // If no valid tabs remain, mark session for deletion
      if (validTabs.length === 0) {
        console.log('[Session Restore] Marking empty session for deletion:', sessionId);
        sessionsToDelete.push(sessionId);
      }
    });

    // Step 3: Delete sessions without valid tabs
    sessionsToDelete.forEach(sessionId => {
      console.log('[Session Restore] Deleting session:', sessionId);
      delete loadedSessions[sessionId];
      delete loadedCookieStore[sessionId];
    });

    if (sessionsToDelete.length > 0) {
      console.log('[Session Restore] Deleted', sessionsToDelete.length, 'stale sessions');
    }

    // Step 4: Apply cleaned data to sessionStore
    sessionStore.sessions = loadedSessions;
    sessionStore.cookieStore = loadedCookieStore;

    // Step 5: Persist cleaned-up state immediately if we made changes
    const madeChanges = staleTabCount > 0 || sessionsToDelete.length > 0;
    if (madeChanges) {
      console.log('[Session Restore] Persisting cleaned-up state...');
      persistSessions(true);
    }

    // Step 6: Update badges for restored tabs
    tabs.forEach(tab => {
      const sessionId = sessionStore.tabToSession[tab.id];
      if (sessionId && sessionStore.sessions[sessionId]) {
        const color = sessionStore.sessions[sessionId].color;
        setSessionBadge(tab.id, color);
        console.log(`[Session Restore] Restored badge for tab ${tab.id} in session ${sessionId}`);
      }
    });

    // Step 7: Log final state
    const activeCount = getActiveSessionCount();
    const totalCount = Object.keys(sessionStore.sessions).length;

    console.log('[Session Restore] ✓ Validation complete');
    console.log('[Session Restore] Active sessions (with tabs):', activeCount);
    console.log('[Session Restore] Total sessions in storage:', totalCount);
    console.log('[Session Restore] Tier:', tier);
    console.log('[Session Restore] Auto-restore enabled:', shouldAutoRestore);

    if (activeCount !== totalCount) {
      console.warn('[Session Restore] WARNING: Active count', activeCount, '!=', 'Total count', totalCount);
      console.warn('[Session Restore] This should not happen after cleanup!');
    }

    console.log('[Session Restore] ================================================');
  }, 2000); // 2 second delay before tab validation
}

// ============= Session Persistence Configuration =============

/**
 * Session persistence limits by tier (in milliseconds)
 * Free: 7 days of inactivity
 * Premium/Enterprise: Never expire (Infinity)
 */
const PERSISTENCE_CONFIG = {
  free: 7 * 24 * 60 * 60 * 1000,        // 7 days in ms
  premium: Infinity,                     // Never expire
  enterprise: Infinity,                  // Never expire
  cleanupInterval: 6 * 60 * 60 * 1000   // Run cleanup every 6 hours
};

/**
 * Clean up expired sessions based on tier persistence limits
 * Free tier: 7 days inactivity
 * Premium/Enterprise: Never expire
 */
/**
 * Clean up orphaned sessions from IndexedDB
 * (Sessions that exist in IndexedDB but not in sessionStore)
 * @returns {Promise<number>} Number of orphans deleted
 */
async function cleanupOrphanedIndexedDBSessions() {
  console.log('[Orphan Cleanup] Starting IndexedDB orphan cleanup...');

  try {
    // Check if storage persistence manager is available
    if (!storagePersistenceManager || !storagePersistenceManager.getAllSessionIds) {
      console.warn('[Orphan Cleanup] StoragePersistenceManager not available, skipping orphan cleanup');
      return 0;
    }

    // Get valid session IDs from in-memory store (source of truth)
    const validSessionIds = Object.keys(sessionStore.sessions);
    console.log('[Orphan Cleanup] Valid sessions in memory:', validSessionIds.length);

    // Get all session IDs from IndexedDB
    const indexedDBSessions = await storagePersistenceManager.getAllSessionIds();
    console.log('[Orphan Cleanup] Sessions in IndexedDB:', indexedDBSessions.length);

    // Find orphans (in IndexedDB but not in sessionStore)
    const orphans = indexedDBSessions.filter(id => !validSessionIds.includes(id));

    if (orphans.length === 0) {
      console.log('[Orphan Cleanup] No orphaned sessions found');
      return 0;
    }

    console.log('[Orphan Cleanup] Found', orphans.length, 'orphaned IndexedDB sessions');
    console.log('[Orphan Cleanup] Orphan IDs:', orphans);

    // Delete orphans
    let deletedCount = 0;
    for (const orphanId of orphans) {
      try {
        await storagePersistenceManager.deleteSession(orphanId);
        deletedCount++;
        console.log('[Orphan Cleanup] Deleted orphan session:', orphanId);
      } catch (error) {
        console.error('[Orphan Cleanup] Error deleting orphan session:', orphanId, error);
      }
    }

    console.log('[Orphan Cleanup] Successfully deleted', deletedCount, '/', orphans.length, 'orphans');
    return deletedCount;

  } catch (error) {
    console.error('[Orphan Cleanup] Error during orphan cleanup:', error);
    return 0;
  }
}

async function cleanupExpiredSessions() {
  console.log('[Session Cleanup] Starting cleanup job...');

  const now = Date.now();
  const SEVEN_DAYS_MS = PERSISTENCE_CONFIG.free;

  // Get current tier
  let tier = 'free';
  try {
    if (typeof licenseManager !== 'undefined' && licenseManager.isInitialized) {
      tier = licenseManager.getTier();
    }
  } catch (error) {
    console.error('[Session Cleanup] Error getting tier:', error);
    tier = 'free'; // Fail safely to free tier
  }

  console.log('[Session Cleanup] Current tier:', tier);

  // Premium/Enterprise: No cleanup needed
  if (tier === 'premium' || tier === 'enterprise') {
    console.log('[Session Cleanup] Premium/Enterprise tier - sessions never expire');

    // Still clean up orphaned IndexedDB sessions
    await cleanupOrphanedIndexedDBSessions();

    return;
  }

  // Free tier: Check for expired sessions
  const sessionsToDelete = [];

  Object.keys(sessionStore.sessions).forEach(sessionId => {
    const session = sessionStore.sessions[sessionId];
    const lastAccessed = session.lastAccessed || session.createdAt || 0;
    const inactiveDuration = now - lastAccessed;
    const daysInactive = Math.floor(inactiveDuration / (24 * 60 * 60 * 1000));

    if (inactiveDuration > SEVEN_DAYS_MS) {
      console.log(`[Session Cleanup] Session ${sessionId} expired (${daysInactive} days inactive)`);
      sessionsToDelete.push(sessionId);
    } else {
      console.log(`[Session Cleanup] Session ${sessionId} active (${daysInactive} days inactive)`);
    }
  });

  // Delete expired sessions
  if (sessionsToDelete.length > 0) {
    console.log(`[Session Cleanup] Deleting ${sessionsToDelete.length} expired sessions`);

    for (const sessionId of sessionsToDelete) {
      const session = sessionStore.sessions[sessionId];

      // Close all tabs in expired session
      if (session.tabs && session.tabs.length > 0) {
        session.tabs.forEach(tabId => {
          chrome.tabs.remove(tabId, () => {
            if (chrome.runtime.lastError) {
              console.log('[Session Cleanup] Tab already closed:', tabId);
            }
          });
        });
      }

      // Remove session data from in-memory store
      delete sessionStore.sessions[sessionId];
      delete sessionStore.cookieStore[sessionId];

      // Remove tab mappings
      Object.keys(sessionStore.tabToSession).forEach(tabId => {
        if (sessionStore.tabToSession[tabId] === sessionId) {
          delete sessionStore.tabToSession[tabId];
        }
      });

      // Delete from persistent storage (IndexedDB + chrome.storage.local)
      if (storagePersistenceManager && storagePersistenceManager.deleteSession) {
        try {
          await storagePersistenceManager.deleteSession(sessionId);
        } catch (error) {
          console.error('[Session Cleanup] Error deleting session from storage:', sessionId, error);
        }
      }
    }

    // Persist changes (backup/fallback)
    persistSessions(true);

    // Show notification to user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Sessions Expired',
      message: `${sessionsToDelete.length} inactive session(s) were automatically deleted (FREE tier: 7-day limit). Upgrade to Premium for permanent storage.`,
      priority: 1
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Session Cleanup] Notification error:', chrome.runtime.lastError.message);
      }
    });
  } else {
    console.log('[Session Cleanup] No expired sessions found');
  }

  // Clean up orphaned IndexedDB sessions
  await cleanupOrphanedIndexedDBSessions();
}

// ============= Notification Listener (Singleton) =============
// CRITICAL FIX: Use single global listener to prevent memory leaks
// Multiple calls to addListener create duplicate listeners
let notificationListenerInitialized = false;

function ensureNotificationListener() {
  if (notificationListenerInitialized) return;

  chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
    console.log('[Notification] Button clicked:', notifId, 'button:', buttonIndex);

    if (buttonIndex === 0) {
      // "Upgrade to Enterprise" / "View Enterprise Plans" button
      chrome.tabs.create({ url: 'popup-license.html' });
    }
    chrome.notifications.clear(notifId);
  });

  notificationListenerInitialized = true;
  console.log('[Notification] ✓ Global notification listener initialized');
}

// ============= Tier Change Debouncing =============
// CRITICAL FIX: Prevent tier flapping (rapid tier changes)
// Use debouncing to wait 5 seconds before processing tier change
let tierChangeTimer = null;
let lastTierChangeAttempt = null;

function debouncedHandleTierChange(oldTier, newTier) {
  console.log('[Tier Change Debounce] Tier change request:', oldTier, '->', newTier);

  // Store the change request
  lastTierChangeAttempt = { oldTier, newTier, timestamp: Date.now() };

  // Clear any existing timer
  if (tierChangeTimer) {
    console.log('[Tier Change Debounce] Clearing previous timer (debouncing)');
    clearTimeout(tierChangeTimer);
  }

  // Wait 5 seconds before processing
  tierChangeTimer = setTimeout(() => {
    console.log('[Tier Change Debounce] Timer expired, processing tier change');
    handleTierChange(lastTierChangeAttempt.oldTier, lastTierChangeAttempt.newTier);
    tierChangeTimer = null;
    lastTierChangeAttempt = null;
  }, 5000);

  console.log('[Tier Change Debounce] Timer set (5 seconds)');
}

/**
 * Handle license tier change (Enterprise → Free/Premium)
 * Automatically disables auto-restore when user downgrades from Enterprise
 * @param {string} oldTier - Previous tier ('free', 'premium', or 'enterprise')
 * @param {string} newTier - New tier ('free', 'premium', or 'enterprise')
 */
async function handleTierChange(oldTier, newTier) {
  // Ensure notification listener is initialized (singleton pattern)
  ensureNotificationListener();

  console.log('[Tier Change] ================================================');
  console.log('[Tier Change] Tier changed:', oldTier, '->', newTier);

  // Only handle downgrades from Enterprise
  if (oldTier !== 'enterprise') {
    console.log('[Tier Change] Previous tier was not Enterprise, no action needed');
    console.log('[Tier Change] ================================================');
    return;
  }

  if (newTier === 'enterprise') {
    console.log('[Tier Change] New tier is also Enterprise, no action needed');
    console.log('[Tier Change] ================================================');
    return;
  }

  // Downgrade from Enterprise → Free/Premium
  console.log('[Tier Change] ⚠ Downgrade detected: Enterprise → ' + newTier.toUpperCase());

  // Check if auto-restore is currently enabled
  let prefs = null;
  try {
    prefs = await new Promise((resolve) => {
      chrome.storage.local.get(['autoRestorePreference'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[Tier Change] Error reading auto-restore preference:', chrome.runtime.lastError);
          resolve(null);
        } else {
          resolve(result.autoRestorePreference || null);
        }
      });
    });
  } catch (error) {
    console.error('[Tier Change] Error loading auto-restore preference:', error);
    prefs = null;
  }

  if (!prefs) {
    console.log('[Tier Change] No auto-restore preference found, nothing to disable');
    console.log('[Tier Change] ================================================');
    return;
  }

  if (!prefs.enabled) {
    console.log('[Tier Change] Auto-restore already disabled, nothing to change');
    console.log('[Tier Change] ================================================');
    return;
  }

  // Auto-restore is enabled - disable it
  console.log('[Tier Change] Auto-restore is currently ENABLED');
  console.log('[Tier Change] Disabling auto-restore due to tier downgrade...');

  try {
    const updatedPrefs = {
      enabled: false,
      dontShowNotice: prefs.dontShowNotice || false,
      disabledReason: 'tier_downgrade',
      disabledAt: Date.now(),
      previousTier: oldTier,
      newTier: newTier,
      previouslyEnabled: true  // Track that it was enabled before downgrade
    };

    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ autoRestorePreference: updatedPrefs }, () => {
        if (chrome.runtime.lastError) {
          console.error('[Tier Change] Error saving auto-restore preference:', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });

    console.log('[Tier Change] ✓ Auto-restore preference disabled');
    console.log('[Tier Change] Reason: tier_downgrade');
    console.log('[Tier Change] Previous tier:', oldTier);
    console.log('[Tier Change] New tier:', newTier);

    // Show notification to user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Auto-Restore Disabled',
      message: `Your license tier has changed to ${newTier.toUpperCase()}. Auto-restore is only available for Enterprise tier. Your sessions are still saved but won't automatically restore on browser restart.`,
      priority: 2,
      buttons: [
        { title: 'Upgrade to Enterprise' },
        { title: 'Dismiss' }
      ]
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Tier Change] Notification error:', chrome.runtime.lastError.message);
      } else {
        console.log('[Tier Change] ✓ Notification shown to user');
      }
    });

    // Note: Notification button handler is registered globally via ensureNotificationListener()

  } catch (error) {
    console.error('[Tier Change] ✗ Error disabling auto-restore preference:', error);
  }

  console.log('[Tier Change] ================================================');
}

/**
 * Detect Edge browser restore and show upgrade notification for Free/Premium users
 * This function checks if Edge restored multiple tabs and the user is not on Enterprise tier
 * If detected, shows a one-time notification prompting upgrade to Enterprise for auto-restore
 *
 * TIMING STRATEGY (similar to Enterprise auto-restore):
 * - Initial delay: 2 seconds (wait for Edge to start restoring tabs)
 * - Retry logic: Up to 3 attempts with 1-second intervals
 * - Total max wait: 2s + 1s + 1s = 4 seconds
 */
// Flag to ensure Edge restore detection only runs once per browser session
let edgeRestoreDetectionCompleted = false;

async function detectEdgeBrowserRestore() {
  // Ensure detection only runs once per browser session
  if (edgeRestoreDetectionCompleted) {
    console.log('[Edge Restore Detection] Already completed, skipping duplicate execution');
    return;
  }

  edgeRestoreDetectionCompleted = true;

  // Ensure notification listener is initialized (singleton pattern)
  ensureNotificationListener();

  try {
    console.log('[Edge Restore Detection] ================================================');
    console.log('[Edge Restore Detection] Checking for Edge browser restore...');

    // Get current tier
    let tier = 'free';
    try {
      tier = licenseManager.getTier();
      console.log('[Edge Restore Detection] Current tier:', tier);
    } catch (error) {
      console.error('[Edge Restore Detection] Error getting tier:', error);
      tier = 'free';
    }

    // Only run for Free/Premium users (Enterprise users already have auto-restore)
    if (tier === 'enterprise') {
      console.log('[Edge Restore Detection] User is Enterprise tier, no notification needed');
      console.log('[Edge Restore Detection] ================================================');
      return;
    }

    // Wait 2 seconds for Edge to start restoring tabs (same as Enterprise auto-restore)
    console.log('[Edge Restore Detection] Waiting 2 seconds for Edge to restore tabs...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Retry logic: Try up to 3 times to detect restored tabs
    let tabs = [];
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
      tabs = await new Promise((resolve) => {
        chrome.tabs.query({}, (result) => {
          if (chrome.runtime.lastError) {
            console.error('[Edge Restore Detection] Error querying tabs:', chrome.runtime.lastError);
            resolve([]);
          } else {
            resolve(result || []);
          }
        });
      });

      console.log(`[Edge Restore Detection] Tab query attempt ${attempt + 1}/${maxAttempts}: Found ${tabs.length} tabs`);

      // Check if Edge browser restored multiple tabs
      // Heuristic: More than 1 tab suggests browser restore (not just new tab page)
      if (tabs.length > 1) {
        console.log('[Edge Restore Detection] ✓ Restored tabs detected, breaking out of retry loop');
        break;
      }

      // If only 0-1 tabs found and we have more attempts, wait and retry
      if (attempt < maxAttempts - 1) {
        console.log(`[Edge Restore Detection] Only ${tabs.length} tab(s) found, waiting 1 second before retry...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      attempt++;
    }

    // After all retries, check final result
    const hasRestoredTabs = tabs.length > 1;

    if (!hasRestoredTabs) {
      console.log('[Edge Restore Detection] No restored tabs detected after', maxAttempts, 'attempts (found', tabs.length, 'tab(s))');
      console.log('[Edge Restore Detection] User likely started fresh browser session or has single-tab workflow');
      console.log('[Edge Restore Detection] ================================================');
      return;
    }

    console.log('[Edge Restore Detection] ✓ Edge browser restore detected:', tabs.length, 'tabs');
    console.log('[Edge Restore Detection] User is', tier.toUpperCase(), 'tier (not Enterprise)');
    console.log('[Edge Restore Detection] Showing upgrade notification...');

    // Show notification prompting upgrade to Enterprise
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'Upgrade to Enterprise for Auto-Restore',
      message: `Your browser restored ${tabs.length} tabs from the previous session. Upgrade to Enterprise tier to automatically restore your session mappings and badges on browser restart!`,
      priority: 1,
      buttons: [
        { title: 'View Enterprise Plans' },
        { title: 'Dismiss' }
      ]
    }, (notificationId) => {
      if (chrome.runtime.lastError) {
        console.warn('[Edge Restore Detection] Notification error:', chrome.runtime.lastError.message);
      } else {
        console.log('[Edge Restore Detection] ✓ Notification shown:', notificationId);
      }
    });

    // Note: Notification button handler is registered globally via ensureNotificationListener()

    console.log('[Edge Restore Detection] ================================================');
  } catch (error) {
    console.error('[Edge Restore Detection] Error:', error);
  }
}

// ============= Session Limits Configuration =============

/**
 * Session limits by tier
 * Free: 3 sessions, Premium/Enterprise: Unlimited
 */
const SESSION_LIMITS = {
  free: 3,
  premium: Infinity,
  enterprise: Infinity
};

/**
 * Get count of sessions that have active tabs
 * @returns {number} Count of active sessions
 */
function getActiveSessionCount() {
  let count = 0;

  Object.keys(sessionStore.sessions).forEach(sessionId => {
    const session = sessionStore.sessions[sessionId];
    if (session.tabs && session.tabs.length > 0) {
      count++;
    }
  });

  return count;
}

/**
 * Check if creating a new session is allowed based on license tier
 * @returns {Promise<{allowed: boolean, tier: string, current: number, limit: number, reason?: string}>}
 */
async function canCreateNewSession() {
  // Get current tier from license manager
  let tier = 'free';
  try {
    if (typeof licenseManager !== 'undefined' && licenseManager.isInitialized) {
      tier = licenseManager.getTier();
    }
  } catch (error) {
    console.error('[Session Limits] Error getting tier:', error);
    tier = 'free'; // Fail safely to free tier
  }

  // Count only sessions with active tabs
  const activeSessionCount = getActiveSessionCount();
  const limit = SESSION_LIMITS[tier];

  console.log('[Session Limits] Current tier:', tier);
  console.log('[Session Limits] Active sessions (with tabs):', activeSessionCount);
  console.log('[Session Limits] Total sessions in storage:', Object.keys(sessionStore.sessions).length);
  console.log('[Session Limits] Limit:', limit);

  const canCreate = activeSessionCount < limit;

  // Format limit for display (use ∞ for Infinity)
  const limitDisplay = limit === Infinity ? '∞' : limit;

  // IMPORTANT: JSON.stringify converts Infinity to null
  // Use -1 to represent unlimited (Infinity), which survives JSON serialization
  const limitForSerialization = limit === Infinity ? -1 : limit;

  return {
    allowed: canCreate,
    tier: tier,
    current: activeSessionCount,
    limit: limitForSerialization,
    reason: canCreate ? undefined : `You've reached the ${tier.toUpperCase()} tier limit of ${limitDisplay} concurrent sessions. Upgrade to Premium for unlimited sessions!`
  };
}

/**
 * Get session status for UI display
 * @returns {Promise<{canCreateNew: boolean, isOverLimit: boolean, activeCount: number, limit: number, tier: string}>}
 */
async function getSessionStatus() {
  const canCreate = await canCreateNewSession();
  const isOverLimit = canCreate.current > canCreate.limit;

  const result = {
    canCreateNew: canCreate.allowed,
    isOverLimit: isOverLimit,
    activeCount: canCreate.current,
    // IMPORTANT: JSON.stringify converts Infinity to null
    // Use -1 to represent unlimited (Infinity), which survives JSON serialization
    limit: canCreate.limit === Infinity ? -1 : canCreate.limit,
    tier: canCreate.tier
  };

  // Debug logging
  console.log('[getSessionStatus] Returning:', result);
  console.log('[getSessionStatus] limit value:', result.limit);
  console.log('[getSessionStatus] limit type:', typeof result.limit);
  console.log('[getSessionStatus] limit === -1:', result.limit === -1);
  console.log('[getSessionStatus] limit === null:', result.limit === null);
  console.log('[getSessionStatus] Original limit:', canCreate.limit);
  console.log('[getSessionStatus] Was Infinity:', canCreate.limit === Infinity);
  console.log('[getSessionStatus] JSON serialization test:', JSON.stringify(result));

  return result;
}

/**
 * Get storage statistics for debugging (Edge storage issue)
 * @returns {Promise<Object>} Storage stats
 */
async function getStorageStatsHelper() {
  console.log('[getStorageStatsHelper] ================================================');
  console.log('[getStorageStatsHelper] Getting storage statistics...');
  console.log('[getStorageStatsHelper] ================================================');

  let stats = {
    timestamp: Date.now(),
    currentState: {
      sessions: Object.keys(sessionStore.sessions).length,
      tabs: Object.keys(sessionStore.tabToSession).length,
      cookieSessions: Object.keys(sessionStore.cookieStore).length,
      orphans: 0, // Will be populated below
      sessionList: Object.keys(sessionStore.sessions) // NEW: List of session IDs for clearAllStorage
    }
  };

  console.log('[getStorageStatsHelper] Current state:', stats.currentState);

  // Get storage persistence stats if available
  if (typeof storagePersistenceManager !== 'undefined') {
    console.log('[getStorageStatsHelper] storagePersistenceManager is available');
    console.log('[getStorageStatsHelper] Manager state:');
    console.log('[getStorageStatsHelper]   - isInitialized:', storagePersistenceManager.isInitialized);
    console.log('[getStorageStatsHelper]   - db exists:', !!storagePersistenceManager.db);

    // ALWAYS call getStorageStats, even if not fully initialized
    // This allows us to see partial state during reinitialization
    try {
      stats.persistence = await storagePersistenceManager.getStorageStats();
      console.log('[getStorageStatsHelper] ✓ Got persistence stats:', JSON.stringify(stats.persistence));

      // Calculate orphan count (IndexedDB sessions not in memory) - only if initialized
      if (storagePersistenceManager.isInitialized && stats.persistence.sources?.indexedDB?.available) {
        try {
          console.log('[getStorageStatsHelper] Calculating orphan count...');
          const orphanCount = await storagePersistenceManager.getOrphanSessionCount();
          stats.currentState.orphans = orphanCount;
          console.log('[getStorageStatsHelper] ✓ Orphan count:', orphanCount);
        } catch (error) {
          console.error('[getStorageStatsHelper] Failed to get orphan count:', error);
          stats.currentState.orphans = 0;
        }
      } else {
        console.log('[getStorageStatsHelper] Skipping orphan count (not initialized or IndexedDB unavailable)');
      }
    } catch (error) {
      console.error('[getStorageStatsHelper] Error getting persistence stats:', error);
      stats.persistence = {
        error: 'Failed to get persistence stats: ' + error.message,
        health: { local: false, indexedDB: false, sync: false },
        isInitialized: storagePersistenceManager.isInitialized,
        dbConnected: !!storagePersistenceManager.db
      };
    }
  } else {
    console.warn('[getStorageStatsHelper] storagePersistenceManager not available');
    stats.persistence = {
      error: 'Storage persistence manager not available',
      health: { local: false, indexedDB: false, sync: false }
    };
  }

  console.log('[getStorageStatsHelper] ================================================');
  console.log('[getStorageStatsHelper] Statistics complete');
  console.log('[getStorageStatsHelper] ================================================');

  return stats;
}

// ============= Session Management =============

/**
 * Create a new session and open a new tab
 * @param {string} url - Optional URL to open (defaults to 'about:blank')
 * @param {Function} callback - Callback with result object
 * @param {string} customColor - Optional custom color (enterprise only)
 */
function createNewSession(url, callback, customColor = null) {
  // Check session limits before creating
  canCreateNewSession().then(canCreate => {
    if (!canCreate.allowed) {
      console.warn('[Session Limits] Session creation blocked:', canCreate.reason);
      callback({
        success: false,
        error: canCreate.reason,
        blocked: true,
        tier: canCreate.tier,
        current: canCreate.current,
        limit: canCreate.limit
      });
      return;
    }

    // Get current tier
    const tier = canCreate.tier;

    // Validate custom color if provided
    let validatedCustomColor = null;
    if (customColor) {
      // Only allow custom colors for enterprise tier
      if (tier !== 'enterprise') {
        console.warn('[Session Color] Custom color not allowed for tier:', tier);
        callback({
          success: false,
          error: 'Custom colors are only available in Enterprise tier',
          tier: tier
        });
        return;
      }

      // Validate and normalize color
      if (isValidHexColor(customColor)) {
        validatedCustomColor = normalizeHexColor(customColor);

        // Check contrast
        if (!hasGoodContrast(validatedCustomColor)) {
          console.warn('[Session Color] Poor contrast for color:', validatedCustomColor);
          // Don't block, just warn
        }
      } else {
        console.warn('[Session Color] Invalid hex color format:', customColor);
        callback({
          success: false,
          error: 'Invalid color format. Use hex format like #FF6B6B',
          tier: tier
        });
        return;
      }
    }

    // Proceed with session creation
    const sessionId = generateSessionId();
    const color = sessionColor(sessionId, tier, validatedCustomColor);
    const timestamp = Date.now();

    // Default to about:blank if no URL provided
    const targetUrl = url && url.trim() ? url.trim() : 'about:blank';

    console.log('[Session Limits] Creating new session (tier:', canCreate.tier, 'count:', canCreate.current + 1, '/', canCreate.limit === Infinity ? '∞' : canCreate.limit + ')');
    console.log('Creating new session with ID:', sessionId, 'URL:', targetUrl);

    // Create session object
    sessionStore.sessions[sessionId] = {
      id: sessionId,
      name: null, // Custom session name (Premium/Enterprise only)
      color: color,
      customColor: validatedCustomColor, // Store custom color if provided (enterprise only)
      createdAt: timestamp,
      lastAccessed: timestamp, // Initialize lastAccessed to creation time
      tabs: [],
      _isCreating: true  // Flag to prevent immediate lastAccessed updates during creation
    };

    // Initialize cookie store for this session
    sessionStore.cookieStore[sessionId] = {};

    // Open new tab with specified URL
    chrome.tabs.create({
      url: targetUrl,
      active: true
    }, (tab) => {
      if (chrome.runtime.lastError) {
        console.error('Tab creation error:', chrome.runtime.lastError);
        delete sessionStore.sessions[sessionId];
        delete sessionStore.cookieStore[sessionId];
        callback({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      console.log('Created new session', sessionId, 'with tab', tab.id);

      // Map tab to session
      sessionStore.tabToSession[tab.id] = sessionId;
      sessionStore.sessions[sessionId].tabs.push(tab.id);

      // Set colored badge for this session
      setSessionBadge(tab.id, color);

      // Clear any existing browser cookies for this tab
      // This prevents cookie leakage from previous browsing
      setTimeout(() => {
        if (tab.url && tab.url !== 'about:blank') {
          try {
            const url = new URL(tab.url);
            chrome.cookies.getAll({ url: tab.url }, (cookies) => {
              if (!cookies || cookies.length === 0) {
                console.log(`[${sessionId}] No existing cookies to clear for new session`);
                return;
              }

              console.log(`[${sessionId}] Clearing ${cookies.length} existing cookies for new session`);

              cookies.forEach(cookie => {
                const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
                chrome.cookies.remove({
                  url: cookieUrl,
                  name: cookie.name,
                  storeId: cookie.storeId
                }, (removedCookie) => {
                  if (removedCookie) {
                    console.log(`[${sessionId}] Cleared existing cookie: ${cookie.name}`);
                  }
                });
              });
            });
          } catch (e) {
            console.error(`[${sessionId}] Error clearing initial cookies:`, e);
          }
        }
      }, 100);

      // Persist the session immediately
      persistSessions(true);

      // Remove the _isCreating flag after a short delay to allow creation to complete
      setTimeout(() => {
        if (sessionStore.sessions[sessionId]) {
          delete sessionStore.sessions[sessionId]._isCreating;
          console.log(`[Session Creation] Removed _isCreating flag for session ${sessionId}`);
        }
      }, 100); // 100ms delay to let creation complete

      callback({
        success: true,
        sessionId: sessionId,
        tabId: tab.id,
        color: color,
        tier: canCreate.tier
      });
    });
  }).catch(error => {
    console.error('[Session Limits] Error checking session limits:', error);
    callback({ success: false, error: 'Failed to check session limits: ' + error.message });
  });
}

/**
 * Get all active sessions with their tabs
 * @param {Function} callback - Callback with sessions array
 */
function getActiveSessions(callback) {
  chrome.tabs.query({}, (tabs) => {
    if (chrome.runtime.lastError) {
      console.error('tabs.query error:', chrome.runtime.lastError);
      callback({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    // Build map of sessionId to tab info
    const sessionMap = {};

    for (const tab of tabs) {
      const sessionId = sessionStore.tabToSession[tab.id];
      if (sessionId) {
        if (!sessionMap[sessionId]) {
          const session = sessionStore.sessions[sessionId];
          sessionMap[sessionId] = {
            sessionId: sessionId,
            name: session?.name || null, // Include custom name if exists
            color: session?.color || sessionColor(sessionId),
            tabs: []
          };
        }

        sessionMap[sessionId].tabs.push({
          tabId: tab.id,
          title: tab.title || 'Untitled',
          url: tab.url || '',
          domain: extractDomain(tab.url || ''),
          favIconUrl: tab.favIconUrl
        });
      }
    }

    callback({ success: true, sessions: Object.values(sessionMap) });
  });
}

/**
 * Extract domain from URL
 * @param {string} url
 * @returns {string}
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return '';
  }
}

/**
 * Cleanup session when all tabs are closed
 * @param {string} sessionId
 */
async function cleanupSession(sessionId) {
  if (sessionStore.sessions[sessionId]) {
    // Check if session has any tabs left
    const tabs = sessionStore.sessions[sessionId].tabs || [];
    const activeTabs = tabs.filter(tabId => sessionStore.tabToSession[tabId] === sessionId);

    if (activeTabs.length === 0) {
      console.log(`[cleanupSession] Starting cleanup for session ${sessionId}`);
      console.log(`[cleanupSession] Session has ${tabs.length} total tabs, ${activeTabs.length} active tabs`);

      // Delete from in-memory store FIRST
      console.log(`[cleanupSession] Deleting from in-memory store...`);
      delete sessionStore.sessions[sessionId];
      delete sessionStore.cookieStore[sessionId];
      console.log(`[cleanupSession] ✓ Deleted from in-memory store`);

      // Delete from persistent storage (IndexedDB + chrome.storage.local)
      // CRITICAL: Wait for deleteSession to complete before persisting
      console.log(`[cleanupSession] Checking storagePersistenceManager...`);
      if (storagePersistenceManager && storagePersistenceManager.isInitialized) {
        console.log(`[cleanupSession] storagePersistenceManager is initialized, calling deleteSession()...`);
        try {
          const deleteResults = await storagePersistenceManager.deleteSession(sessionId);
          console.log(`[cleanupSession] ✓ deleteSession() completed:`, deleteResults);

          if (deleteResults.errors && deleteResults.errors.length > 0) {
            console.error(`[cleanupSession] ⚠️ deleteSession() had errors:`, deleteResults.errors);
          }

          if (deleteResults.indexedDB) {
            console.log(`[cleanupSession] ✓ Session deleted from IndexedDB`);
          } else {
            console.error(`[cleanupSession] ✗ Session NOT deleted from IndexedDB!`);
          }

          if (deleteResults.local) {
            console.log(`[cleanupSession] ✓ Session deleted from chrome.storage.local`);
          } else {
            console.error(`[cleanupSession] ✗ Session NOT deleted from chrome.storage.local!`);
          }

        } catch (error) {
          console.error('[cleanupSession] ✗ Error calling deleteSession():', error);
          console.error('[cleanupSession] Stack trace:', error.stack);

          // Fallback: persist without the deleted session
          console.log('[cleanupSession] Using fallback persistSessions() due to deleteSession() error');
          persistSessions(true);
        }
      } else {
        console.warn('[cleanupSession] ⚠️ storagePersistenceManager not initialized or not available');
        console.log('[cleanupSession] storagePersistenceManager exists:', !!storagePersistenceManager);
        console.log('[cleanupSession] storagePersistenceManager.isInitialized:', storagePersistenceManager?.isInitialized);

        // Fallback to legacy persist (saves current state without deleted session)
        console.log('[cleanupSession] Using fallback persistSessions()');
        persistSessions(true);
      }

      console.log(`[cleanupSession] ✓ Cleanup complete for session ${sessionId}`);
    } else {
      console.log(`[cleanupSession] Session ${sessionId} still has ${activeTabs.length} active tabs, not cleaning up`);
    }
  } else {
    console.warn(`[cleanupSession] Session ${sessionId} not found in sessionStore`);
  }
}

// ============= Session Naming (Premium/Enterprise Feature) =============

/**
 * Session name validation rules and error messages
 */
const SESSION_NAME_RULES = {
  MIN_LENGTH: 1,              // After trimming
  MAX_LENGTH: 50,             // Characters (including emojis)
  ALLOW_EMOJIS: true,         // ✅ "🎨 Work Gmail"
  ALLOW_SPACES: true,         // ✅ "Work Gmail"
  ALLOW_NUMBERS: true,        // ✅ "Client 1"
  ALLOW_PUNCTUATION: true,    // ✅ "Client A - Facebook"
  BLOCK_HTML: true,           // ❌ "<script>alert(1)</script>"
  BLOCK_DANGEROUS_CHARS: ['<', '>', '"', "'", '`'],
  TRIM_WHITESPACE: true,      // "  Work  " → "Work"
  COLLAPSE_SPACES: true,      // "Work    Gmail" → "Work Gmail"
  ALLOW_DUPLICATES: false,    // ❌ Case-insensitive unique names
  CASE_SENSITIVE_CHECK: false // "Work Gmail" = "work gmail"
};

const SESSION_NAME_ERRORS = {
  EMPTY: 'Session name cannot be empty',
  TOO_LONG: 'Session name must be 50 characters or less',
  INVALID_CHARS: 'Session name contains invalid characters (< > " \' `)',
  DUPLICATE: 'Session name already exists. Please choose a different name.',
  NOT_STRING: 'Session name must be text',
  SESSION_NOT_FOUND: 'Session not found',
  TIER_RESTRICTED: 'Session naming is a Premium feature'
};

/**
 * Sanitize session name for safe display
 * Removes dangerous characters and normalizes whitespace
 * @param {string} name - Session name to sanitize
 * @returns {string} Sanitized name
 */
function sanitizeSessionName(name) {
  if (typeof name !== 'string') {
    return '';
  }

  let sanitized = name;

  // Trim whitespace
  if (SESSION_NAME_RULES.TRIM_WHITESPACE) {
    sanitized = sanitized.trim();
  }

  // Collapse multiple spaces into single space
  if (SESSION_NAME_RULES.COLLAPSE_SPACES) {
    sanitized = sanitized.replace(/\s+/g, ' ');
  }

  // Remove dangerous characters
  if (SESSION_NAME_RULES.BLOCK_HTML) {
    SESSION_NAME_RULES.BLOCK_DANGEROUS_CHARS.forEach(char => {
      sanitized = sanitized.split(char).join('');
    });
  }

  return sanitized;
}

/**
 * Validate session name
 * @param {string} name - Session name to validate
 * @param {string} currentSessionId - Current session ID (to exclude from duplicate check)
 * @returns {Object} Validation result {valid: boolean, error?: string}
 */
function validateSessionName(name, currentSessionId = null) {
  // Check if name is a string
  if (typeof name !== 'string') {
    return { valid: false, error: SESSION_NAME_ERRORS.NOT_STRING };
  }

  // Sanitize and trim
  const sanitized = sanitizeSessionName(name);

  // Check if empty after sanitization
  if (sanitized.length < SESSION_NAME_RULES.MIN_LENGTH) {
    return { valid: false, error: SESSION_NAME_ERRORS.EMPTY };
  }

  // Check length (count characters including emojis)
  // Use spread operator to handle multi-byte characters (emojis) correctly
  const charCount = [...sanitized].length;
  if (charCount > SESSION_NAME_RULES.MAX_LENGTH) {
    return { valid: false, error: SESSION_NAME_ERRORS.TOO_LONG };
  }

  // Check for dangerous characters
  if (SESSION_NAME_RULES.BLOCK_HTML) {
    const hasDangerousChars = SESSION_NAME_RULES.BLOCK_DANGEROUS_CHARS.some(char =>
      sanitized.includes(char)
    );
    if (hasDangerousChars) {
      return { valid: false, error: SESSION_NAME_ERRORS.INVALID_CHARS };
    }
  }

  // Check for duplicates (case-insensitive)
  if (!SESSION_NAME_RULES.ALLOW_DUPLICATES) {
    const isDuplicate = isSessionNameDuplicate(sanitized, currentSessionId);
    if (isDuplicate) {
      return { valid: false, error: SESSION_NAME_ERRORS.DUPLICATE };
    }
  }

  return { valid: true, sanitized: sanitized };
}

/**
 * Check if session name is duplicate (case-insensitive)
 * @param {string} name - Session name to check
 * @param {string} excludeSessionId - Session ID to exclude from check (for editing)
 * @returns {boolean} True if duplicate exists
 */
function isSessionNameDuplicate(name, excludeSessionId = null) {
  const normalizedName = SESSION_NAME_RULES.CASE_SENSITIVE_CHECK
    ? name
    : name.toLowerCase();

  for (const [sessionId, session] of Object.entries(sessionStore.sessions)) {
    // Skip the current session if editing
    if (sessionId === excludeSessionId) {
      continue;
    }

    // Check if session has a custom name
    if (session.name) {
      const existingName = SESSION_NAME_RULES.CASE_SENSITIVE_CHECK
        ? session.name
        : session.name.toLowerCase();

      if (existingName === normalizedName) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Get display name for session (custom name or fallback to session ID)
 * @param {string} sessionId - Session ID
 * @returns {string} Display name
 */
function getSessionDisplayName(sessionId) {
  const session = sessionStore.sessions[sessionId];
  if (!session) {
    return sessionId; // Fallback to session ID if session not found
  }

  // Return custom name if exists, otherwise return session ID
  return session.name || sessionId;
}

/**
 * Set custom name for a session (Premium/Enterprise only)
 * @param {string} sessionId - Session ID
 * @param {string} name - Custom name (max 50 characters)
 * @returns {Promise<Object>} Result with success status
 */
async function setSessionName(sessionId, name) {
  console.log('[setSessionName] Request to set name for session:', sessionId);
  console.log('[setSessionName] Name:', name);

  // Check if session exists
  const session = sessionStore.sessions[sessionId];
  if (!session) {
    console.error('[setSessionName] Session not found:', sessionId);
    return {
      success: false,
      message: SESSION_NAME_ERRORS.SESSION_NOT_FOUND
    };
  }

  // Check tier restriction (Premium/Enterprise only)
  let tier = 'free';
  try {
    if (typeof licenseManager !== 'undefined' && licenseManager.isInitialized) {
      tier = licenseManager.getTier();
    }
  } catch (error) {
    console.error('[setSessionName] Error getting tier:', error);
  }

  if (tier === 'free') {
    console.warn('[setSessionName] Session naming not allowed for Free tier');
    return {
      success: false,
      tier: tier,
      message: SESSION_NAME_ERRORS.TIER_RESTRICTED
    };
  }

  // Validate name
  const validation = validateSessionName(name, sessionId);
  if (!validation.valid) {
    console.error('[setSessionName] Validation failed:', validation.error);
    return {
      success: false,
      message: validation.error
    };
  }

  // Store sanitized name
  const sanitizedName = validation.sanitized;
  session.name = sanitizedName;

  console.log('[setSessionName] ✓ Session name set:', sanitizedName);
  console.log('[setSessionName] Session:', sessionId);

  // Persist immediately
  persistSessions(true);

  return {
    success: true,
    sessionId: sessionId,
    name: sanitizedName,
    tier: tier
  };
}

/**
 * Get session name
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Result with session name
 */
async function getSessionName(sessionId) {
  console.log('[getSessionName] Request for session:', sessionId);

  const session = sessionStore.sessions[sessionId];
  if (!session) {
    console.error('[getSessionName] Session not found:', sessionId);
    return {
      success: false,
      message: SESSION_NAME_ERRORS.SESSION_NOT_FOUND
    };
  }

  const name = session.name || null;
  console.log('[getSessionName] ✓ Session name:', name);

  return {
    success: true,
    sessionId: sessionId,
    name: name
  };
}

/**
 * Clear session name (revert to session ID)
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Result with success status
 */
async function clearSessionName(sessionId) {
  console.log('[clearSessionName] Request to clear name for session:', sessionId);

  const session = sessionStore.sessions[sessionId];
  if (!session) {
    console.error('[clearSessionName] Session not found:', sessionId);
    return {
      success: false,
      message: SESSION_NAME_ERRORS.SESSION_NOT_FOUND
    };
  }

  // Clear name
  session.name = null;

  console.log('[clearSessionName] ✓ Session name cleared');
  console.log('[clearSessionName] Session:', sessionId);

  // Persist immediately
  persistSessions(true);

  return {
    success: true,
    sessionId: sessionId
  };
}

// ============= WebRequest Interception =============

/**
 * Intercept outgoing requests and inject session cookies
 */
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
    // CRITICAL FIX: Wait for initialization before processing requests
    // This prevents tab requests during browser startup from executing before
    // session restoration completes (fixes tab restoration race condition)
    if (initializationManager.currentState !== initializationManager.STATES.READY) {
      console.log(`[onBeforeSendHeaders] ⏳ Waiting for initialization (state: ${initializationManager.currentState})`);
      console.log(`[onBeforeSendHeaders] Tab ${details.tabId} requesting ${details.url}`);
      console.log(`[onBeforeSendHeaders] Request proceeding WITHOUT session cookies (will reload after initialization)`);
      // Allow request to proceed without session cookies
      // Tab will reload after session restoration completes
      return { requestHeaders: details.requestHeaders };
    }

    // Log every request for debugging
    console.log(`[onBeforeSendHeaders] Tab ${details.tabId} requesting ${details.url}`);

    const sessionId = getSessionForTab(details.tabId);

    if (!sessionId) {
      console.log(`[onBeforeSendHeaders] No session for tab ${details.tabId}`);
      return { requestHeaders: details.requestHeaders };
    }

    console.log(`[onBeforeSendHeaders] Tab ${details.tabId} has session ${sessionId}`);

    try {
      const url = new URL(details.url);
      const domain = url.hostname;
      const path = url.pathname;

      // SECURITY: Track domain activity for session inheritance (noopener links)
      // This helps match new tabs to recent session activity on the same domain
      if (!sessionStore.domainToSessionActivity[domain]) {
        sessionStore.domainToSessionActivity[domain] = {};
      }
      sessionStore.domainToSessionActivity[domain][sessionId] = Date.now();

      // Get cookies for this session and domain
      const cookies = getCookiesForSession(sessionId, domain, path);

      console.log(`[${sessionId}] Found ${cookies.length} cookies for ${domain}`);

      if (cookies.length > 0) {
        // Remove existing Cookie header
        const headers = details.requestHeaders.filter(h =>
          h.name.toLowerCase() !== 'cookie'
        );

        // Add session-specific cookies
        const cookieHeader = formatCookieHeader(cookies);
        headers.push({
          name: 'Cookie',
          value: cookieHeader
        });

        console.log(`[${sessionId}] Injecting ${cookies.length} cookies for ${domain}`);

        return { requestHeaders: headers };
      } else {
        console.log(`[${sessionId}] No cookies to inject for ${domain}`);
      }
    } catch (e) {
      console.error('Error in onBeforeSendHeaders:', e);
    }

    return { requestHeaders: details.requestHeaders };
  },
  {
    urls: ['http://*/*', 'https://*/*']  // Only HTTP/HTTPS requests
  },
  ['blocking', 'requestHeaders', 'extraHeaders']  // Added 'extraHeaders'
);

/**
 * Intercept responses and capture Set-Cookie headers
 */
chrome.webRequest.onHeadersReceived.addListener(
  function(details) {
    // CRITICAL FIX: Wait for initialization before processing responses
    // This prevents cookie capture during browser startup before session restoration
    if (initializationManager.currentState !== initializationManager.STATES.READY) {
      console.log(`[onHeadersReceived] ⏳ Waiting for initialization (state: ${initializationManager.currentState})`);
      console.log(`[onHeadersReceived] Tab ${details.tabId} received response from ${details.url}`);
      console.log(`[onHeadersReceived] Response proceeding WITHOUT cookie capture`);
      // Allow response to proceed without capturing cookies
      return { responseHeaders: details.responseHeaders };
    }

    // Log every response for debugging
    console.log(`[onHeadersReceived] Tab ${details.tabId} received response from ${details.url}`);

    const sessionId = getSessionForTab(details.tabId);

    if (!sessionId) {
      console.log(`[onHeadersReceived] No session for tab ${details.tabId}`);
      return { responseHeaders: details.responseHeaders };
    }

    console.log(`[onHeadersReceived] Tab ${details.tabId} has session ${sessionId}`);

    // Check if responseHeaders exist
    if (!details.responseHeaders) {
      console.warn(`[onHeadersReceived] No responseHeaders for tab ${details.tabId}`);
      return { responseHeaders: details.responseHeaders };
    }

    console.log(`[onHeadersReceived] Response has ${details.responseHeaders.length} headers`);

    try {
      const url = new URL(details.url);
      const domain = url.hostname;

      let cookieCount = 0;

      // Look for Set-Cookie headers (case insensitive)
      details.responseHeaders.forEach(header => {
        const headerName = header.name.toLowerCase();

        // Log all header names for debugging
        if (headerName === 'set-cookie') {
          console.log(`[onHeadersReceived] Found Set-Cookie header: ${header.value}`);

          const cookie = parseCookie(header.value);

          // Set domain if not specified
          if (!cookie.domain) {
            cookie.domain = domain;
          }

          // Store cookie in session store
          storeCookie(sessionId, cookie.domain, cookie);

          console.log(`[${sessionId}] Stored cookie ${cookie.name} for ${cookie.domain}`);
          cookieCount++;
        }
      });

      if (cookieCount > 0) {
        console.log(`[${sessionId}] Stored ${cookieCount} cookies from ${domain}`);
      } else {
        console.log(`[${sessionId}] No Set-Cookie headers found in response from ${domain}`);
      }

      // Remove Set-Cookie headers to prevent browser from storing them
      const filteredHeaders = details.responseHeaders.filter(h =>
        h.name.toLowerCase() !== 'set-cookie'
      );

      return { responseHeaders: filteredHeaders };
    } catch (e) {
      console.error('Error in onHeadersReceived:', e);
    }

    return { responseHeaders: details.responseHeaders };
  },
  {
    urls: ['http://*/*', 'https://*/*']  // Only HTTP/HTTPS requests
  },
  ['blocking', 'responseHeaders', 'extraHeaders']  // Added 'extraHeaders'
);

// ============= Chrome Cookies API Monitoring =============

/**
 * Monitor cookies set via chrome.cookies API or JavaScript
 * This captures cookies set by document.cookie or chrome.cookies.set()
 */
chrome.cookies.onChanged.addListener((changeInfo) => {
  // Only process cookies that are being added or updated
  if (changeInfo.removed) {
    return;
  }

  const cookie = changeInfo.cookie;

  console.log('[chrome.cookies.onChanged] Cookie changed:', cookie.name, 'for domain:', cookie.domain);

  // Find which tab triggered this cookie change
  // We need to check all tabs and see which one matches the domain
  chrome.tabs.query({}, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.log('[chrome.cookies.onChanged] No tabs found');
      return;
    }

    // Check each tab to see if it has a session and matches the domain
    tabs.forEach(tab => {
      const sessionId = sessionStore.tabToSession[tab.id];

      if (!sessionId || !tab.url) {
        return;
      }

      try {
        const tabUrl = new URL(tab.url);
        const tabDomain = tabUrl.hostname;

        // Check if cookie domain matches tab domain
        const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain;
        const isMatch = tabDomain === cookieDomain || tabDomain.endsWith('.' + cookieDomain);

        if (isMatch) {
          console.log(`[chrome.cookies.onChanged] Storing cookie ${cookie.name} for session ${sessionId}`);

          // Store the cookie in our session store
          if (!sessionStore.cookieStore[sessionId]) {
            sessionStore.cookieStore[sessionId] = {};
          }
          if (!sessionStore.cookieStore[sessionId][cookie.domain]) {
            sessionStore.cookieStore[sessionId][cookie.domain] = {};
          }
          if (!sessionStore.cookieStore[sessionId][cookie.domain][cookie.path || '/']) {
            sessionStore.cookieStore[sessionId][cookie.domain][cookie.path || '/'] = {};
          }

          sessionStore.cookieStore[sessionId][cookie.domain][cookie.path || '/'][cookie.name] = {
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path || '/',
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            sameSite: cookie.sameSite || 'no_restriction',
            expirationDate: cookie.expirationDate
          };

          console.log(`[${sessionId}] Captured cookie ${cookie.name} via chrome.cookies API`);

          // Persist the change
          persistSessions(false); // debounced

          // SECURITY FIX: Immediately and aggressively remove cookie from browser's native store
          // Use immediate callback-free removal for faster execution
          const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path || '/'}`;

          // Attempt 1: Immediate removal (fastest)
          chrome.cookies.remove({
            url: cookieUrl,
            name: cookie.name,
            storeId: cookie.storeId
          }, (removedCookie) => {
            if (chrome.runtime.lastError) {
              console.error('[chrome.cookies.onChanged] Failed to remove browser cookie:', chrome.runtime.lastError);

              // SECURITY: Retry removal on failure
              setTimeout(() => {
                chrome.cookies.remove({
                  url: cookieUrl,
                  name: cookie.name,
                  storeId: cookie.storeId
                }, (retryRemoved) => {
                  if (retryRemoved) {
                    console.log(`[${sessionId}] Removed browser cookie on retry: ${cookie.name}`);
                  }
                });
              }, 100);
            } else if (removedCookie) {
              console.log(`[${sessionId}] Removed browser cookie: ${cookie.name} (keeping only in session store)`);
            }
          });
        }
      } catch (e) {
        // Invalid URL or other error
        console.error('[chrome.cookies.onChanged] Error processing tab:', e);
      }
    });
  });
});

// ============= Browser Cookie Clearing =============

/**
 * Clear all browser-native cookies for a session tab
 * This forces cookies to only exist in our sessionStore
 * @param {number} tabId
 */
async function clearBrowserCookiesForTab(tabId) {
  const sessionId = sessionStore.tabToSession[tabId];

  if (!sessionId) {
    return;
  }

  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url) {
      return;
    }

    try {
      const url = new URL(tab.url);
      const domain = url.hostname;

      // Get all cookies for this domain from browser's native store
      chrome.cookies.getAll({ domain: domain }, (cookies) => {
        if (!cookies || cookies.length === 0) {
          return;
        }

        console.log(`[${sessionId}] Clearing ${cookies.length} browser cookies for ${domain}`);

        // Remove each cookie from browser's native store
        cookies.forEach(cookie => {
          const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`;
          chrome.cookies.remove({
            url: cookieUrl,
            name: cookie.name,
            storeId: cookie.storeId
          }, (removedCookie) => {
            if (chrome.runtime.lastError) {
              // Ignore errors - cookie may have already been removed
            } else if (removedCookie) {
              console.log(`[${sessionId}] Removed browser cookie: ${cookie.name}`);
            }
          });
        });
      });
    } catch (e) {
      console.error('[clearBrowserCookiesForTab] Error:', e);
    }
  });
}

/**
 * Clear browser cookies for all session tabs periodically
 * This ensures cookies stay isolated even if they leak into browser store
 */
setInterval(() => {
  const tabIds = Object.keys(sessionStore.tabToSession);

  if (tabIds.length > 0) {
    console.log(`[Cookie Cleaner] Checking ${tabIds.length} session tabs for browser cookies`);

    tabIds.forEach(tabIdStr => {
      const tabId = parseInt(tabIdStr);
      clearBrowserCookiesForTab(tabId);
    });
  }
}, 2000); // Check every 2 seconds

/**
 * SECURITY: Periodically remove expired cookies from all sessions
 * This prevents expired cookies from accumulating in storage
 */
setInterval(() => {
  const sessionIds = Object.keys(sessionStore.sessions);

  if (sessionIds.length > 0) {
    console.log(`[Cookie Expiration] Checking ${sessionIds.length} sessions for expired cookies`);

    sessionIds.forEach(sessionId => {
      removeExpiredCookies(sessionId);
    });
  }
}, 60000); // Check every 60 seconds

// ============= Message Handler =============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'createNewSession') {
      // Create new session with optional URL, custom color, and callback
      const url = message.url || 'about:blank';
      const customColor = message.customColor || null;
      createNewSession(url, (result) => {
        if (result.success) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: result.error, blocked: result.blocked, tier: result.tier });
        }
      }, customColor);
      return true; // Keep channel open for async response

    } else if (message.action === 'getActiveSessions') {
      // Get active sessions with callback
      getActiveSessions((result) => {
        if (result.success) {
          sendResponse({ success: true, sessions: result.sessions });
        } else {
          sendResponse({ success: false, error: result.error });
        }
      });
      return true; // Keep channel open for async response

    } else if (message.action === 'getSessionId') {
      // Called from content script to get session ID for current tab
      const tabId = sender.tab ? sender.tab.id : null;

      console.log('[getSessionId] Request from tab:', tabId);
      console.log('[getSessionId] Current tabToSession map:', JSON.stringify(sessionStore.tabToSession));

      const sessionId = tabId ? getSessionForTab(tabId) : null;

      console.log('[getSessionId] Found session ID:', sessionId);

      if (!sessionId) {
        console.warn('[getSessionId] No session for tab', tabId);
        sendResponse({ success: false, sessionId: null, error: 'No session assigned' });
      } else {
        console.log('[getSessionId] Returning session:', sessionId);
        sendResponse({ success: true, sessionId: sessionId });
      }
      return false; // Synchronous response

    } else if (message.action === 'getCookies') {
      // Get cookies for content script
      const tabId = sender.tab ? sender.tab.id : null;
      const sessionId = tabId ? getSessionForTab(tabId) : null;

      if (!sessionId) {
        console.warn('getCookies: No session for tab', tabId);
        sendResponse({ success: false, cookies: '' });
        return false;
      }

      const session = sessionStore.sessions[sessionId];
      if (!session) {
        console.warn('getCookies: Session not found', sessionId);
        sendResponse({ success: false, cookies: '' });
        return false;
      }

      // Parse URL from message
      try {
        const url = new URL(message.url);
        const domain = url.hostname;
        const path = url.pathname || '/';

        const cookies = getCookiesForSession(sessionId, domain, path);
        const cookieString = formatCookieHeader(cookies);
        sendResponse({ success: true, cookies: cookieString });
      } catch (error) {
        console.error('getCookies: Invalid URL', message.url, error);
        sendResponse({ success: false, cookies: '' });
      }
      return false; // Synchronous response

    } else if (message.action === 'setCookie') {
      // Set cookie from content script
      const tabId = sender.tab ? sender.tab.id : null;
      const sessionId = tabId ? getSessionForTab(tabId) : null;

      if (!sessionId) {
        console.warn('setCookie: No session for tab', tabId);
        sendResponse({ success: false, error: 'No session assigned' });
        return false;
      }

      const session = sessionStore.sessions[sessionId];
      if (!session) {
        console.warn('setCookie: Session not found', sessionId);
        sendResponse({ success: false, error: 'Session not found' });
        return false;
      }

      if (!message.cookie) {
        sendResponse({ success: false, error: 'No cookie data provided' });
        return false;
      }

      if (!message.url) {
        console.error('[SECURITY] setCookie: No URL provided for domain validation');
        sendResponse({ success: false, error: 'No URL provided' });
        return false;
      }

      try {
        // SECURITY: Parse cookie with domain validation
        const cookie = parseCookie(message.cookie, message.url);

        if (!cookie) {
          console.error('[SECURITY] setCookie: Cookie validation failed');
          sendResponse({ success: false, error: 'Invalid cookie domain' });
          return false;
        }

        // Extract domain from URL if not specified in cookie
        if (!cookie.domain && message.url) {
          const url = new URL(message.url);
          cookie.domain = url.hostname;
        }

        if (!cookie.domain) {
          console.error('setCookie: No domain specified');
          sendResponse({ success: false, error: 'No domain specified' });
          return false;
        }

        // SECURITY: Final domain validation check
        if (!isValidCookieDomain(cookie.domain, message.url)) {
          console.error('[SECURITY] setCookie: Domain validation failed:', cookie.domain, 'for URL:', message.url);
          sendResponse({ success: false, error: 'Invalid cookie domain' });
          return false;
        }

        storeCookie(sessionId, cookie.domain, cookie);
        console.log(`[${sessionId}] Cookie set: ${cookie.name} for ${cookie.domain}`);
        sendResponse({ success: true });
      } catch (error) {
        console.error('setCookie: Error parsing cookie', error);
        sendResponse({ success: false, error: error.message });
      }
      return false; // Synchronous response

    } else if (message.action === 'getSessionColor') {
      // Get color for a specific session
      const sessionId = message.sessionId;

      if (!sessionId) {
        sendResponse({ success: false, error: 'No session ID provided' });
        return false;
      }

      const session = sessionStore.sessions[sessionId];

      if (!session) {
        console.warn('getSessionColor: Session not found', sessionId);
        sendResponse({ success: false, error: 'Session not found' });
        return false;
      }

      const color = session.color || sessionColor(sessionId);
      sendResponse({ success: true, color: color });
      return false; // Synchronous response

    } else if (message.action === 'switchToTab') {
      // Switch to a specific tab
      if (!message.tabId) {
        sendResponse({ success: false, error: 'No tab ID provided' });
        return false;
      }

      chrome.tabs.update(message.tabId, { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          console.error('tabs.update error:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true; // Keep channel open for async response

    } else if (message.action === 'canCreateSession') {
      // Check if session creation is allowed
      canCreateNewSession().then(result => {
        sendResponse({ success: true, ...result });
      }).catch(error => {
        console.error('[canCreateSession] Error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response

    } else if (message.action === 'getSessionStatus') {
      // Get session status for UI
      getSessionStatus().then(status => {
        sendResponse({ success: true, ...status });
      }).catch(error => {
        console.error('[getSessionStatus] Error:', error);
        sendResponse({ success: false, error: error.message });
      });
      return true; // Keep channel open for async response

    } else if (message.action === 'getSessionMetadata') {
      // Get full session metadata for UI (includes lastAccessed timestamps)
      const sessionId = message.sessionId;

      if (!sessionId) {
        // Return all sessions metadata
        sendResponse({ success: true, sessions: sessionStore.sessions });
      } else {
        // Return specific session metadata
        const session = sessionStore.sessions[sessionId];
        if (session) {
          sendResponse({ success: true, session: session });
        } else {
          sendResponse({ success: false, error: 'Session not found' });
        }
      }
      return false; // Synchronous response

    } else if (message.action === 'getStorageStats') {
      // Get storage statistics for debugging (Edge storage issue)
      getStorageStatsHelper()
        .then(stats => {
          sendResponse({ success: true, stats });
        })
        .catch(error => {
          console.error('[getStorageStats] Error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Keep channel open for async response

    } else if (message.action === 'getOrphanCount') {
      // Get orphan session count (IndexedDB sessions not in memory)
      if (typeof storagePersistenceManager !== 'undefined' && storagePersistenceManager.isInitialized) {
        storagePersistenceManager.getOrphanSessionCount()
          .then(count => {
            console.log('[getOrphanCount] Found ' + count + ' orphan sessions in IndexedDB');
            sendResponse({ success: true, orphanCount: count });
          })
          .catch(error => {
            console.error('[getOrphanCount] Error:', error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        console.warn('[getOrphanCount] Storage persistence manager not initialized');
        sendResponse({ success: false, error: 'Storage persistence manager not initialized' });
      }
      return true; // Keep channel open for async response

    } else if (message.action === 'cleanupOrphans') {
      // Clean up orphan sessions (IndexedDB sessions not in memory)
      console.log('[cleanupOrphans] Starting orphan cleanup...');
      if (typeof storagePersistenceManager !== 'undefined' && storagePersistenceManager.isInitialized) {
        storagePersistenceManager.cleanupOrphanSessions()
          .then(result => {
            console.log('[cleanupOrphans] Cleanup complete:', result);
            sendResponse({ success: true, ...result });
          })
          .catch(error => {
            console.error('[cleanupOrphans] Error:', error);
            sendResponse({ success: false, error: error.message });
          });
      } else {
        console.warn('[cleanupOrphans] Storage persistence manager not initialized');
        sendResponse({ success: false, error: 'Storage persistence manager not initialized' });
      }
      return true; // Keep channel open for async response

    } else if (message.action === 'getAvailableColors') {
      // Get available colors for current tier
      let tier = 'free';
      try {
        if (typeof licenseManager !== 'undefined' && licenseManager.isInitialized) {
          tier = licenseManager.getTier();
        }
      } catch (error) {
        console.error('[getAvailableColors] Error getting tier:', error);
      }

      const colors = getColorPaletteForTier(tier);
      const allowCustom = tier === 'enterprise';

      sendResponse({
        success: true,
        tier: tier,
        colors: colors,
        allowCustom: allowCustom
      });
      return false; // Synchronous response

    } else if (message.action === 'setSessionColor') {
      // Set custom color for session (enterprise only)
      const sessionId = message.sessionId;
      const newColor = message.color;

      if (!sessionId) {
        sendResponse({ success: false, error: 'No session ID provided' });
        return false;
      }

      if (!newColor) {
        sendResponse({ success: false, error: 'No color provided' });
        return false;
      }

      // Check tier
      let tier = 'free';
      try {
        if (typeof licenseManager !== 'undefined' && licenseManager.isInitialized) {
          tier = licenseManager.getTier();
        }
      } catch (error) {
        console.error('[setSessionColor] Error getting tier:', error);
      }

      if (tier !== 'enterprise') {
        sendResponse({
          success: false,
          error: 'Custom colors are only available in Enterprise tier',
          tier: tier
        });
        return false;
      }

      // Validate color
      if (!isValidHexColor(newColor)) {
        sendResponse({
          success: false,
          error: 'Invalid color format. Use hex format like #FF6B6B'
        });
        return false;
      }

      const normalizedColor = normalizeHexColor(newColor);

      // Check contrast
      if (!hasGoodContrast(normalizedColor)) {
        console.warn('[setSessionColor] Poor contrast for color:', normalizedColor);
        // Don't block, just warn
      }

      // Check if session exists
      const session = sessionStore.sessions[sessionId];
      if (!session) {
        sendResponse({ success: false, error: 'Session not found' });
        return false;
      }

      // Update session color
      session.color = normalizedColor;
      session.customColor = normalizedColor;

      // Update badge for all tabs in this session
      if (session.tabs && session.tabs.length > 0) {
        session.tabs.forEach(tabId => {
          setSessionBadge(tabId, normalizedColor);
          console.log(`[setSessionColor] Updated badge for tab ${tabId} to ${normalizedColor}`);

          // Also update favicon badge
          chrome.tabs.sendMessage(tabId, {
            action: 'sessionColorChanged',
            color: normalizedColor
          }, (response) => {
            if (chrome.runtime.lastError) {
              // Tab might not have content script loaded yet, that's OK
              console.log(`[setSessionColor] Could not update favicon for tab ${tabId}:`, chrome.runtime.lastError.message);
            } else {
              console.log(`[setSessionColor] Updated favicon for tab ${tabId}`);
            }
          });
        });
      }

      // Persist changes
      persistSessions(true);

      console.log(`[setSessionColor] Session ${sessionId} color changed to ${normalizedColor}`);
      sendResponse({ success: true, color: normalizedColor });
      return false; // Synchronous response

    } else if (message.action === 'getAutoRestorePreference') {
      // Get auto-restore preference (Enterprise only)
      (async () => {
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(['autoRestorePreference'], (data) => {
              resolve(data);
            });
          });

          let prefs = result.autoRestorePreference || {};
          console.log('[Auto-Restore] Get preference (before cleanup):', prefs);

          // CLEANUP STALE DOWNGRADE METADATA: If user is Enterprise and has stale downgrade metadata, clean it
          const tier = licenseManager.getTier();
          if (tier === 'enterprise' && prefs.disabledReason === 'tier_downgrade') {
            console.log('[Auto-Restore] ⚠ Detected stale downgrade metadata for Enterprise user');
            console.log('[Auto-Restore] Cleaning up stale metadata from previous tier downgrade...');

            // Keep only the essential fields
            const cleanPreference = {
              enabled: prefs.enabled !== false, // Default to true for Enterprise if not explicitly false
              dontShowNotice: prefs.dontShowNotice || false
            };

            // Log the cleanup
            console.log('[Auto-Restore] Before cleanup:', prefs);
            console.log('[Auto-Restore] After cleanup:', cleanPreference);

            // Save cleaned preference back to storage
            try {
              await new Promise((resolve, reject) => {
                chrome.storage.local.set({ autoRestorePreference: cleanPreference }, () => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve();
                  }
                });
              });
              console.log('[Auto-Restore] ✓ Stale downgrade metadata cleaned successfully');
              prefs = cleanPreference; // Use cleaned preference
            } catch (cleanupError) {
              console.error('[Auto-Restore] ✗ Error saving cleaned preference:', cleanupError);
              // Continue with uncleaned preference (fail gracefully)
            }
          }

          console.log('[Auto-Restore] Get preference (after cleanup):', prefs);

          sendResponse({
            success: true,
            enabled: prefs.enabled || false,
            dontShowNotice: prefs.dontShowNotice || false
          });
        } catch (error) {
          console.error('[Auto-Restore] Error getting preference:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep channel open for async response

    } else if (message.action === 'setAutoRestorePreference') {
      // Set auto-restore preference (Enterprise only)
      (async () => {
        try {
          // Get current preferences
          const currentPrefs = await new Promise((resolve) => {
            chrome.storage.local.get(['autoRestorePreference'], (data) => {
              resolve(data);
            });
          });

          let prefs = currentPrefs.autoRestorePreference || {};

          // CLEANUP STALE DOWNGRADE METADATA: If user is Enterprise and has stale downgrade metadata, clean it first
          const tier = licenseManager.getTier();
          if (tier === 'enterprise' && prefs.disabledReason === 'tier_downgrade') {
            console.log('[Auto-Restore] ⚠ Detected stale downgrade metadata for Enterprise user');
            console.log('[Auto-Restore] Cleaning stale metadata before updating preference...');

            // Keep only essential fields, removing all downgrade metadata
            prefs = {
              enabled: prefs.enabled !== false, // Default to true for Enterprise if not explicitly false
              dontShowNotice: prefs.dontShowNotice || false
            };

            console.log('[Auto-Restore] ✓ Stale metadata cleaned');
          }

          // Update preferences
          if (message.hasOwnProperty('enabled')) {
            prefs.enabled = message.enabled;
            console.log('[Auto-Restore] Preference set to:', message.enabled);
          }

          if (message.hasOwnProperty('dontShowNotice')) {
            prefs.dontShowNotice = message.dontShowNotice;
            console.log('[Auto-Restore] "Don\'t show notice" set to:', message.dontShowNotice);
          }

          // Ensure we only save the essential fields (no stale metadata)
          const cleanPrefs = {
            enabled: prefs.enabled || false,
            dontShowNotice: prefs.dontShowNotice || false
          };

          // Save to storage
          await new Promise((resolve, reject) => {
            chrome.storage.local.set({ autoRestorePreference: cleanPrefs }, () => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else {
                resolve();
              }
            });
          });

          console.log('[Auto-Restore] Preferences saved:', cleanPrefs);
          sendResponse({ success: true, preference: cleanPrefs });
        } catch (error) {
          console.error('[Auto-Restore] Error setting preference:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Keep channel open for async response

    } else if (message.action === 'getInitializationState') {
      // Get current initialization state for popup loading UI
      const state = initializationManager.getState();
      sendResponse({ success: true, ...state });
      return false; // Synchronous response

    } else if (message.action === 'clearAllSessions') {
      try {
        console.log('[clearAllSessions] Clearing all in-memory session data...');

        // Get all session tab IDs before clearing
        const allTabIds = Object.keys(sessionStore.tabToSession).map(id => parseInt(id));

        // Clear in-memory state
        sessionStore.sessions = {};
        sessionStore.tabToSession = {};
        sessionStore.cookieStore = {};

        console.log('[clearAllSessions] In-memory state cleared');

        // Close all session tabs
        if (allTabIds.length > 0) {
          console.log('[clearAllSessions] Closing ' + allTabIds.length + ' session tabs...');
          chrome.tabs.remove(allTabIds, () => {
            if (chrome.runtime.lastError) {
              console.error('[clearAllSessions] Error closing tabs:', chrome.runtime.lastError);
            }
          });
        }

        sendResponse({ success: true, message: 'All sessions cleared from memory', tabsClosed: allTabIds.length });
      } catch (error) {
        console.error('[clearAllSessions] Error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return false; // Synchronous response

    } else if (message.action === 'deleteSessionById') {
      // Delete a specific session by ID (used by clearAllStorage in diagnostics)
      console.log('[deleteSessionById] Request to delete session:', message.sessionId);

      if (!message.sessionId) {
        sendResponse({ success: false, error: 'Session ID required' });
        return false;
      }

      const sessionId = message.sessionId;

      // Delete from persistence layer first (critical)
      if (typeof storagePersistenceManager !== 'undefined' && storagePersistenceManager.isInitialized) {
        storagePersistenceManager.deleteSession(sessionId)
          .then(results => {
            console.log('[deleteSessionById] Persistence layer deletion results:', results);

            // Delete from in-memory state
            if (sessionStore.sessions[sessionId]) {
              const tabIds = sessionStore.sessions[sessionId].tabs || [];

              // Close tabs associated with this session
              if (tabIds.length > 0) {
                console.log('[deleteSessionById] Closing', tabIds.length, 'tabs for session:', sessionId);
                chrome.tabs.remove(tabIds, () => {
                  if (chrome.runtime.lastError) {
                    console.error('[deleteSessionById] Error closing tabs:', chrome.runtime.lastError);
                  }
                });
              }

              // Remove from in-memory structures
              delete sessionStore.sessions[sessionId];
              delete sessionStore.cookieStore[sessionId];

              // Remove tab mappings
              tabIds.forEach(tabId => {
                delete sessionStore.tabToSession[tabId];
              });

              console.log('[deleteSessionById] ✓ Session deleted from all layers:', sessionId);
              sendResponse({
                success: true,
                message: 'Session deleted successfully',
                sessionId: sessionId,
                results: results
              });
            } else {
              console.log('[deleteSessionById] Session not found in memory:', sessionId);
              sendResponse({
                success: true,
                message: 'Session not found in memory (may have already been deleted)',
                sessionId: sessionId,
                results: results
              });
            }
          })
          .catch(error => {
            console.error('[deleteSessionById] Persistence layer deletion error:', error);
            sendResponse({ success: false, error: error.message, sessionId: sessionId });
          });
      } else {
        console.error('[deleteSessionById] Storage persistence manager not initialized');
        sendResponse({ success: false, error: 'Storage persistence manager not initialized' });
      }

      return true; // Async response

    } else if (message.action === 'closeIndexedDB') {
      // Close IndexedDB connection (used by clearAllStorage to enable database deletion)
      console.log('[closeIndexedDB] Request to close IndexedDB connection');

      if (typeof storagePersistenceManager !== 'undefined' && storagePersistenceManager.db) {
        try {
          console.log('[closeIndexedDB] Closing database connection...');
          storagePersistenceManager.db.close();
          storagePersistenceManager.db = null;
          storagePersistenceManager.isInitialized = false;
          console.log('[closeIndexedDB] ✓ Database connection closed');
          sendResponse({ success: true, message: 'IndexedDB connection closed' });
        } catch (error) {
          console.error('[closeIndexedDB] Error closing database:', error);
          sendResponse({ success: false, error: error.message });
        }
      } else {
        console.log('[closeIndexedDB] Database not initialized or already closed');
        sendResponse({ success: true, message: 'Database not initialized or already closed' });
      }

      return false; // Synchronous response

    } else if (message.action === 'reinitializeStorage') {
      // Reinitialize storage persistence manager after database deletion
      (async () => {
        try {
          console.log('[reinitializeStorage] ================================================');
          console.log('[reinitializeStorage] Request to reinitialize storage persistence manager');
          console.log('[reinitializeStorage] ================================================');

          if (typeof storagePersistenceManager !== 'undefined') {
            console.log('[reinitializeStorage] storagePersistenceManager is available');
            console.log('[reinitializeStorage] Current state before reinit:');
            console.log('[reinitializeStorage]   - isInitialized:', storagePersistenceManager.isInitialized);
            console.log('[reinitializeStorage]   - db exists:', !!storagePersistenceManager.db);

            console.log('[reinitializeStorage] Calling initialize(forceReinit=true)...');
            await storagePersistenceManager.initialize(true); // CRITICAL: Pass forceReinit=true

            console.log('[reinitializeStorage] ================================================');
            console.log('[reinitializeStorage] ✅ Storage persistence manager reinitialized');
            console.log('[reinitializeStorage] New state after reinit:');
            console.log('[reinitializeStorage]   - isInitialized:', storagePersistenceManager.isInitialized);
            console.log('[reinitializeStorage]   - db exists:', !!storagePersistenceManager.db);
            console.log('[reinitializeStorage]   - health:', JSON.stringify(storagePersistenceManager.storageHealth));
            console.log('[reinitializeStorage] ================================================');

            sendResponse({ success: true, message: 'Storage persistence manager reinitialized' });
          } else {
            console.error('[reinitializeStorage] ❌ storagePersistenceManager not defined');
            sendResponse({ success: false, error: 'Storage persistence manager not available' });
          }
        } catch (error) {
          console.error('[reinitializeStorage] ================================================');
          console.error('[reinitializeStorage] ❌ Error reinitializing storage');
          console.error('[reinitializeStorage] Error:', error);
          console.error('[reinitializeStorage] Error stack:', error.stack);
          console.error('[reinitializeStorage] ================================================');
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Async response

    } else if (message.action === 'setSessionName') {
      // Set custom name for session (Premium/Enterprise only)
      Promise.resolve(setSessionName(message.sessionId, message.name))
        .then(result => {
          try {
            sendResponse(result);
          } catch (error) {
            console.error('[setSessionName] sendResponse error:', error);
          }
        })
        .catch(error => {
          console.error('[setSessionName] Error:', error);
          sendResponse({
            success: false,
            message: error.message
          });
        });
      return true; // Keep message channel open for async response

    } else if (message.action === 'getSessionName') {
      // Get session name
      Promise.resolve(getSessionName(message.sessionId))
        .then(result => {
          try {
            sendResponse(result);
          } catch (error) {
            console.error('[getSessionName] sendResponse error:', error);
          }
        })
        .catch(error => {
          console.error('[getSessionName] Error:', error);
          sendResponse({
            success: false,
            message: error.message
          });
        });
      return true; // Keep message channel open for async response

    } else if (message.action === 'clearSessionName') {
      // Clear session name (revert to session ID)
      Promise.resolve(clearSessionName(message.sessionId))
        .then(result => {
          try {
            sendResponse(result);
          } catch (error) {
            console.error('[clearSessionName] sendResponse error:', error);
          }
        })
        .catch(error => {
          console.error('[clearSessionName] Error:', error);
          sendResponse({
            success: false,
            message: error.message
          });
        });
      return true; // Keep message channel open for async response

    } else if (message.action === 'tierChanged') {
      // Handle tier change notification from license-manager.js
      // This is called when user downgrades from Enterprise or license becomes invalid
      console.log('[tierChanged] ================================================');
      console.log('[tierChanged] Tier change notification received');
      console.log('[tierChanged] Old tier:', message.oldTier);
      console.log('[tierChanged] New tier:', message.newTier);
      console.log('[tierChanged] Reason:', message.reason);

      // Use debounced handler to prevent tier flapping
      debouncedHandleTierChange(message.oldTier, message.newTier);

      console.log('[tierChanged] ✓ Tier change queued (debounced)');
      console.log('[tierChanged] ================================================');
      sendResponse({ success: true });
      return false; // Synchronous response (debouncing is async internally)

    } else {
      // Try license message handlers
      if (typeof handleLicenseMessage !== 'undefined') {
        console.log('[Background] Trying license message handler for action:', message.action);
        const handled = handleLicenseMessage(message, sender, sendResponse);
        console.log('[Background] License handler returned:', handled);
        if (handled) {
          return handled; // License handler will manage response
        }
      }

      console.log('[Background] Unknown action:', message.action);
      sendResponse({ success: false, error: 'Unknown action' });
      return false;
    }
  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

// ============= Tab Event Listeners =============

/**
 * Cleanup when tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  const sessionId = sessionStore.tabToSession[tabId];

  if (sessionId) {
    console.log(`Tab ${tabId} closed, removing from session ${sessionId}`);

    // Remove from tab mapping
    delete sessionStore.tabToSession[tabId];

    // Remove from session's tab list
    if (sessionStore.sessions[sessionId]) {
      const tabs = sessionStore.sessions[sessionId].tabs || [];
      sessionStore.sessions[sessionId].tabs = tabs.filter(t => t !== tabId);
    }

    // Cleanup session if no more tabs (this also persists)
    cleanupSession(sessionId);
  }
});

/**
 * Keep session when tab navigates to new URL
 * Also updates lastAccessed timestamp for session persistence tracking
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Update badge when URL changes OR when page finishes loading
  // This ensures badge is set during both navigation and refresh (Ctrl+R)
  if (changeInfo.url || changeInfo.status === 'complete') {
    if (changeInfo.url) {
      console.log('[Navigation] Tab', tabId, 'navigated to', changeInfo.url);
    }
    if (changeInfo.status === 'complete') {
      console.log('[Navigation] Tab', tabId, 'page load complete');
    }

    const sessionId = sessionStore.tabToSession[tabId];
    if (sessionId) {
      console.log('[Navigation] Tab', tabId, 'has session', sessionId);

      // Update badge
      const session = sessionStore.sessions[sessionId];
      if (session) {
        // Skip lastAccessed update if session is still being created
        if (session._isCreating) {
          console.log(`[Session Activity] Skipping lastAccessed update for session ${sessionId} (still creating)`);
        } else {
          // Update lastAccessed timestamp for persistence tracking
          session.lastAccessed = Date.now();
          console.log(`[Session Activity] Session ${sessionId} accessed (tab updated)`);

          // Persist with debouncing
          persistSessions(false);
        }

        setSessionBadge(tabId, session.color);
      }
    } else {
      console.log('[Navigation] Tab', tabId, 'has no session');
      // Clear badge for non-session tabs
      clearBadge(tabId);
    }
  }
});

/**
 * Update badge when tab is activated
 * Also updates lastAccessed timestamp for session persistence tracking
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  const sessionId = getSessionForTab(activeInfo.tabId);

  if (sessionId) {
    const session = sessionStore.sessions[sessionId];

    if (session) {
      // Skip lastAccessed update if session is still being created
      if (session._isCreating) {
        console.log(`[Session Activity] Skipping lastAccessed update for session ${sessionId} (still creating)`);
      } else {
        // Update lastAccessed timestamp for persistence tracking
        session.lastAccessed = Date.now();
        console.log(`[Session Activity] Session ${sessionId} accessed (tab activated)`);

        // Persist with debouncing (don't save on every tab switch)
        persistSessions(false);
      }

      // Update badge (always update badge, even during creation)
      const color = session.color || sessionColor(sessionId);
      setSessionBadge(activeInfo.tabId, color);
    }
  } else {
    clearBadge(activeInfo.tabId);
  }
});

// ============= Popup Window Session Inheritance =============

/**
 * When a new tab/popup is created from an existing tab, inherit the session
 * This is critical for popups, reports, downloads, OAuth flows, etc.
 */
chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  const sourceTabId = details.sourceTabId;  // Parent tab that opened the popup
  const targetTabId = details.tabId;        // New popup/tab that was created

  console.log(`[Popup Inheritance] New tab ${targetTabId} created from tab ${sourceTabId}`);

  // Check if the source tab has a session
  const sourceSessionId = sessionStore.tabToSession[sourceTabId];

  if (!sourceSessionId) {
    console.log(`[Popup Inheritance] Source tab ${sourceTabId} has no session, skipping`);
    return;
  }

  // Check if the source session exists
  const sourceSession = sessionStore.sessions[sourceSessionId];
  if (!sourceSession) {
    console.log(`[Popup Inheritance] Source session ${sourceSessionId} not found, skipping`);
    return;
  }

  console.log(`[Popup Inheritance] Inheriting session ${sourceSessionId} from tab ${sourceTabId} to tab ${targetTabId}`);

  // Assign the same session to the new tab
  sessionStore.tabToSession[targetTabId] = sourceSessionId;

  // Add tab to session's tab list
  if (!sourceSession.tabs.includes(targetTabId)) {
    sourceSession.tabs.push(targetTabId);
  }

  // Set colored badge immediately
  const color = sourceSession.color || sessionColor(sourceSessionId);
  setSessionBadge(targetTabId, color);

  console.log(`[Popup Inheritance] ✓ Tab ${targetTabId} now has session ${sourceSessionId}`);

  // Persist the change immediately (important for popups that might close quickly)
  persistSessions(true);
});

/**
 * Find most recent session for a domain (for noopener link inheritance)
 * @param {string} domain - The domain to find a session for
 * @param {number} maxAgeMs - Maximum age of activity to consider (default 30 seconds)
 * @returns {string|null} Session ID or null
 */
function findRecentSessionForDomain(domain, maxAgeMs = 30000) {
  const domainActivity = sessionStore.domainToSessionActivity[domain];
  if (!domainActivity) {
    return null;
  }

  const now = Date.now();
  let mostRecentSessionId = null;
  let mostRecentTime = 0;

  // Find the session with most recent activity on this domain
  Object.keys(domainActivity).forEach(sessionId => {
    const activityTime = domainActivity[sessionId];
    const age = now - activityTime;

    // Only consider recent activity (within maxAgeMs)
    if (age <= maxAgeMs && activityTime > mostRecentTime) {
      // Verify session still exists
      if (sessionStore.sessions[sessionId]) {
        mostRecentTime = activityTime;
        mostRecentSessionId = sessionId;
      }
    }
  });

  if (mostRecentSessionId) {
    console.log(`[Session Inheritance] Found recent session ${mostRecentSessionId} for domain ${domain} (${(now - mostRecentTime) / 1000}s ago)`);
  }

  return mostRecentSessionId;
}

/**
 * Handle links opened in new tabs (target="_blank")
 * This catches cases where webNavigation.onCreatedNavigationTarget doesn't fire
 * NOTE: Does NOT inherit for new blank tabs (user clicked + button)
 */
chrome.tabs.onCreated.addListener((tab) => {
  console.log(`[Tab Created] New tab ${tab.id} created, URL: ${tab.url || 'none'}`);

  // Check if this is a new blank tab (user clicked + button)
  // New tab button creates tabs with about:blank, newtab, or no URL
  const isNewTabButton = !tab.url ||
                         tab.url === '' ||
                         tab.url === 'about:blank' ||
                         tab.url === 'chrome://newtab/' ||
                         tab.url === 'edge://newtab/' ||
                         tab.url.includes('://newtab');

  if (isNewTabButton) {
    console.log(`[Tab Created] Tab ${tab.id} is a new blank tab (+ button), NOT inheriting session`);
    return;
  }

  // If the tab has an openerTabId and a real URL, it was opened from a link
  if (tab.openerTabId && tab.url) {
    const parentSessionId = sessionStore.tabToSession[tab.openerTabId];

    if (parentSessionId) {
      console.log(`[Tab Created] Inheriting session ${parentSessionId} from opener tab ${tab.openerTabId}`);

      sessionStore.tabToSession[tab.id] = parentSessionId;

      const session = sessionStore.sessions[parentSessionId];
      if (session && !session.tabs.includes(tab.id)) {
        session.tabs.push(tab.id);
      }

      const color = session?.color || sessionColor(parentSessionId);
      setSessionBadge(tab.id, color);

      console.log(`[Tab Created] ✓ Tab ${tab.id} inherited session ${parentSessionId}`);

      persistSessions(true);
    } else {
      console.log(`[Tab Created] Opener tab ${tab.openerTabId} has no session`);
    }
  } else if (tab.url && !tab.openerTabId) {
    // SECURITY FIX: Handle noopener links (no openerTabId due to rel="noopener")
    // Use domain-based heuristic to find recent session activity
    console.log(`[Tab Created] Tab ${tab.id} has no opener (noopener link?), checking domain heuristic`);

    try {
      const url = new URL(tab.url);
      const domain = url.hostname;

      // Find most recent session for this domain (within last 30 seconds)
      const recentSessionId = findRecentSessionForDomain(domain, 30000);

      if (recentSessionId) {
        console.log(`[Session Inheritance - Noopener] Inheriting session ${recentSessionId} for domain ${domain}`);

        sessionStore.tabToSession[tab.id] = recentSessionId;

        const session = sessionStore.sessions[recentSessionId];
        if (session && !session.tabs.includes(tab.id)) {
          session.tabs.push(tab.id);
        }

        const color = session?.color || sessionColor(recentSessionId);
        setSessionBadge(tab.id, color);

        console.log(`[Session Inheritance - Noopener] ✓ Tab ${tab.id} inherited session ${recentSessionId}`);

        persistSessions(true);
      } else {
        console.log(`[Session Inheritance - Noopener] No recent session found for domain ${domain}`);
      }
    } catch (e) {
      console.error('[Session Inheritance - Noopener] Error parsing URL:', e);
    }
  } else {
    console.log(`[Tab Created] Tab ${tab.id} has no opener or URL, not inheriting session`);
  }
});

/**
 * Initialize on install
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Multi-Session Manager installed/updated');
  console.log('[onInstalled] Reason:', details.reason);

  // Run migration logic on extension update
  if (details.reason === 'update') {
    console.log('[Migration] ================================================');
    console.log('[Migration] Extension updated - running migration logic');

    try {
      // Get current tier
      let tier = 'free';
      try {
        // Wait a moment for license manager to be available
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (typeof licenseManager !== 'undefined' && licenseManager.getTier) {
          tier = licenseManager.getTier();
          console.log('[Migration] Current tier:', tier);
        }
      } catch (error) {
        console.error('[Migration] Error getting tier:', error);
      }

      // Clear invalid auto-restore preferences for Free/Premium users
      if (tier !== 'enterprise') {
        console.log('[Migration] User is not Enterprise tier, checking auto-restore preference');

        const prefs = await new Promise((resolve) => {
          chrome.storage.local.get(['autoRestorePreference'], (result) => {
            if (chrome.runtime.lastError) {
              console.error('[Migration] Error reading preference:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(result.autoRestorePreference || null);
            }
          });
        });

        console.log('[Migration] Current auto-restore preference:', prefs);

        // If auto-restore is enabled (bug from previous versions), disable it
        if (prefs && prefs.enabled) {
          console.log('[Migration] ⚠ Auto-restore is enabled for non-Enterprise user (bug)');
          console.log('[Migration] Disabling auto-restore preference');

          await new Promise((resolve, reject) => {
            chrome.storage.local.set({
              autoRestorePreference: {
                enabled: false,
                dontShowNotice: prefs.dontShowNotice || false,
                disabledReason: 'migration_tier_restriction',
                disabledAt: Date.now(),
                previouslyEnabled: true
              }
            }, () => {
              if (chrome.runtime.lastError) {
                console.error('[Migration] Error saving preference:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });

          console.log('[Migration] ✓ Auto-restore preference cleared for Free/Premium user');
        } else {
          console.log('[Migration] Auto-restore already disabled or not set');
        }
      } else {
        console.log('[Migration] User is Enterprise tier, no migration needed');
      }

      console.log('[Migration] ✓ Migration complete');
      console.log('[Migration] ================================================');
    } catch (error) {
      console.error('[Migration] ❌ Migration error:', error);
    }
  }

  // Trigger full initialization
  initializationManager.initialize().catch(error => {
    console.error('[INIT] Failed to initialize on install:', error);
  });
});

/**
 * Initialize on startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('Multi-Session Manager started');
  // Trigger full initialization
  initializationManager.initialize().catch(error => {
    console.error('[INIT] Failed to initialize on startup:', error);
  });
});

// Initialize when background script loads
console.log('Multi-Session Manager background script loaded');
initializationManager.initialize().catch(error => {
  console.error('[INIT] Failed to initialize on script load:', error);
});

// Schedule periodic cleanup job (every 6 hours)
// Cleanup is deferred and will only run after initialization completes
setInterval(async () => {
  // Wait for initialization to complete before running cleanup
  const ready = await initializationManager.waitForReady(5000);
  if (ready) {
    cleanupExpiredSessions();
  } else {
    console.warn('[Session Cleanup] Skipping cleanup - initialization not ready');
  }
}, PERSISTENCE_CONFIG.cleanupInterval);
console.log('[Session Cleanup] Scheduled cleanup job to run every 6 hours');

// Test if webRequest listeners are registered
console.log('Testing webRequest listeners...');
console.log('onBeforeSendHeaders registered:', chrome.webRequest.onBeforeSendHeaders.hasListeners());
console.log('onHeadersReceived registered:', chrome.webRequest.onHeadersReceived.hasListeners());

// ============= Edge Browser Restart Fix =============
/**
 * CRITICAL FIX: Force background script to execute on browser restart in Edge
 *
 * Problem: Edge (Chromium) lazy-loads background scripts even with persistent: true
 * - Script doesn't execute until an event fires
 * - onStartup listener can't fire if script hasn't loaded to register it
 * - Direct initialize() call at script load never executes
 *
 * Solution: Use an alarm as a "wake-up" mechanism
 * - Alarms ALWAYS fire, even if background script not loaded
 * - Edge must load script to handle alarm event
 * - This triggers our initialization code
 *
 * Implementation:
 * 1. Create a startup alarm on onInstalled (runs once)
 * 2. Alarm fires immediately on next browser startup
 * 3. Alarm handler runs initialization
 * 4. Recreate alarm for next restart
 */

// Create startup alarm on extension install/update
chrome.runtime.onInstalled.addListener(details => {
  console.log('[Edge Restart Fix] Extension installed/updated, creating startup alarms');

  // Create immediate wake-up alarm (fires 1 second after creation)
  chrome.alarms.create('startupWakeUp', {
    when: Date.now() + 1000
  });

  // Create periodic wake-up alarm (every 5 minutes as safety net)
  chrome.alarms.create('periodicWakeUp', {
    delayInMinutes: 5,
    periodInMinutes: 5
  });

  console.log('[Edge Restart Fix] ✓ Startup alarms created (immediate + periodic)');
});

// Handle startup alarm - this FORCES Edge to load background script
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'startupWakeUp') {
    console.log('[Edge Restart Fix] ========================================');
    console.log('[Edge Restart Fix] Startup alarm fired - triggering storage wake-up');
    console.log('[Edge Restart Fix] ========================================');

    // Write to storage to trigger onChanged listener
    // This ensures initialization even if alarm fires before storage listener ready
    chrome.storage.local.set({
      _edgeWakeUp: Date.now()
    }, () => {
      console.log('[Edge Restart Fix] Storage wake-up triggered');

      // Also try direct initialization as backup
      if (typeof initializationManager !== 'undefined') {
        initializationManager.initialize().catch(error => {
          console.error('[Edge Restart Fix] Failed to initialize on alarm:', error);
        });
      }
    });

    // Recreate alarm for next browser restart
    chrome.alarms.create('startupWakeUp', {
      when: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    });

    console.log('[Edge Restart Fix] ✓ Alarm handled, recreated for next restart');
  } else if (alarm.name === 'periodicWakeUp') {
    console.log('[Edge Restart Fix] Periodic wake-up alarm fired');

    // Write to storage to ensure background script stays active
    chrome.storage.local.set({
      _edgeWakeUp: Date.now()
    }, () => {
      console.log('[Edge Restart Fix] Periodic storage wake-up triggered');

      // Check if initialization is needed
      if (typeof initializationManager !== 'undefined' &&
          initializationManager.currentState === 'LOADING') {
        console.log('[Edge Restart Fix] Initialization needed, triggering now');
        initializationManager.initialize().catch(error => {
          console.error('[Edge Restart Fix] Failed to initialize on periodic alarm:', error);
        });
      }
    });
  }
});

// Alternative: Listen to first tab activation as backup wake-up
let firstTabActivationHandled = false;

chrome.tabs.onActivated.addListener(activeInfo => {
  if (!firstTabActivationHandled) {
    console.log('[Edge Restart Fix] First tab activation detected - backup wake-up');

    // Check if initialization already happened
    if (initializationManager.currentState === initializationManager.STATES.LOADING) {
      console.log('[Edge Restart Fix] Initialization not started, triggering now');

      initializationManager.initialize().catch(error => {
        console.error('[Edge Restart Fix] Failed to initialize on tab activation:', error);
      });
    } else {
      console.log('[Edge Restart Fix] Initialization already started/complete, skipping');
    }

    firstTabActivationHandled = true;
  }
});

console.log('[Edge Restart Fix] ✓ Wake-up mechanisms installed (alarm + tab activation)');
