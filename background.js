/**
 * Background Script - Multi-Session Manager
 * Handles session management, cookie isolation, and request interception
 */

// ============= State Management =============

// In-memory storage for session data
const sessionStore = {
  // Map of tabId to sessionId
  tabToSession: {},

  // Map of sessionId to session data
  sessions: {},

  // Map of sessionId to cookie store
  // Structure: { sessionId: { domain: { path: { cookieName: cookieObject } } } }
  cookieStore: {}
};

// ============= Utilities =============

/**
 * Generate a unique session ID
 * @returns {string}
 */
function generateSessionId() {
  return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Generate color for session based on ID
 * @param {string} sessionId
 * @returns {string}
 */
function sessionColor(sessionId) {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F06292', '#64B5F6', '#81C784', '#FFD54F'
  ];
  const hash = sessionId.split('').reduce((acc, char) =>
    acc + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

/**
 * Parse cookie string into object
 * @param {string} cookieString
 * @returns {Object}
 */
function parseCookie(cookieString) {
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
 * Store cookie in session store
 * @param {string} sessionId
 * @param {string} domain
 * @param {Object} cookie
 */
function storeCookie(sessionId, domain, cookie) {
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
  for (let i = 0; i < domainParts.length; i++) {
    domainsToCheck.push(domainParts.slice(i).join('.'));
    domainsToCheck.push('.' + domainParts.slice(i).join('.'));
  }

  domainsToCheck.forEach(d => {
    if (sessionCookies[d]) {
      Object.keys(sessionCookies[d]).forEach(p => {
        // Check if path matches
        if (path.startsWith(p)) {
          Object.values(sessionCookies[d][p]).forEach(cookie => {
            cookies.push(cookie);
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
 * Save sessions and cookies to persistent storage (debounced)
 * @param {boolean} immediate - If true, persist immediately without debouncing
 */
function persistSessions(immediate = false) {
  if (immediate) {
    // Clear any pending timer
    if (persistTimer) {
      clearTimeout(persistTimer);
      persistTimer = null;
    }

    // Persist immediately
    chrome.storage.local.set({
      sessions: sessionStore.sessions,
      cookieStore: sessionStore.cookieStore,
      tabToSession: sessionStore.tabToSession
    }, () => {
      if (chrome.runtime.lastError) {
        console.error('Failed to persist sessions:', chrome.runtime.lastError);
      } else {
        console.log('Sessions persisted to storage (immediate)');
      }
    });
  } else {
    // Debounce persistence to avoid excessive writes during rapid cookie updates
    if (persistTimer) {
      clearTimeout(persistTimer);
    }

    persistTimer = setTimeout(() => {
      chrome.storage.local.set({
        sessions: sessionStore.sessions,
        cookieStore: sessionStore.cookieStore,
        tabToSession: sessionStore.tabToSession
      }, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to persist sessions:', chrome.runtime.lastError);
        } else {
          console.log('Sessions persisted to storage (debounced)');
        }
      });
      persistTimer = null;
    }, 1000); // Wait 1 second before persisting
  }
}

/**
 * Load persisted sessions from storage
 */
function loadPersistedSessions() {
  chrome.storage.local.get(['sessions', 'cookieStore', 'tabToSession'], (data) => {
    if (chrome.runtime.lastError) {
      console.error('Failed to load sessions:', chrome.runtime.lastError);
      return;
    }

    if (data.sessions) {
      sessionStore.sessions = data.sessions;
      console.log('Loaded', Object.keys(data.sessions).length, 'persisted sessions');
    }

    if (data.cookieStore) {
      sessionStore.cookieStore = data.cookieStore;
      console.log('Loaded persisted cookie store');
    }

    if (data.tabToSession) {
      // Only restore tab mappings for tabs that still exist
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to query tabs:', chrome.runtime.lastError);
          return;
        }

        const existingTabIds = new Set(tabs.map(t => t.id));
        const restoredMappings = {};

        Object.keys(data.tabToSession).forEach(tabId => {
          const tabIdNum = parseInt(tabId);
          if (existingTabIds.has(tabIdNum)) {
            restoredMappings[tabIdNum] = data.tabToSession[tabId];
          }
        });

        sessionStore.tabToSession = restoredMappings;
        console.log('Restored', Object.keys(restoredMappings).length, 'tab-to-session mappings');

        // Update badges for restored tabs
        tabs.forEach(tab => {
          const sessionId = sessionStore.tabToSession[tab.id];
          if (sessionId && sessionStore.sessions[sessionId]) {
            const color = sessionStore.sessions[sessionId].color;
            chrome.browserAction.setBadgeText({ text: '●', tabId: tab.id });
            chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: tab.id });
          }
        });
      });
    }
  });
}

// ============= Session Management =============

/**
 * Create a new session and open a new tab
 * @param {string} url - Optional URL to open (defaults to 'about:blank')
 * @param {Function} callback - Callback with result object
 */
function createNewSession(url, callback) {
  const sessionId = generateSessionId();
  const color = sessionColor(sessionId);

  // Default to about:blank if no URL provided
  const targetUrl = url && url.trim() ? url.trim() : 'about:blank';

  console.log('Creating new session with ID:', sessionId, 'URL:', targetUrl);

  // Create session object
  sessionStore.sessions[sessionId] = {
    id: sessionId,
    color: color,
    createdAt: Date.now(),
    tabs: []
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

    // Set badge
    chrome.browserAction.setBadgeText({ text: '●', tabId: tab.id });
    chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: tab.id });

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

    callback({
      success: true,
      sessionId: sessionId,
      tabId: tab.id,
      color: color
    });
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
          sessionMap[sessionId] = {
            sessionId: sessionId,
            color: sessionStore.sessions[sessionId]?.color || sessionColor(sessionId),
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
function cleanupSession(sessionId) {
  if (sessionStore.sessions[sessionId]) {
    // Check if session has any tabs left
    const tabs = sessionStore.sessions[sessionId].tabs || [];
    const activeTabs = tabs.filter(tabId => sessionStore.tabToSession[tabId] === sessionId);

    if (activeTabs.length === 0) {
      console.log(`Cleaning up session ${sessionId}`);
      delete sessionStore.sessions[sessionId];
      delete sessionStore.cookieStore[sessionId];

      // Persist after cleanup immediately
      persistSessions(true);
    }
  }
}

// ============= WebRequest Interception =============

/**
 * Intercept outgoing requests and inject session cookies
 */
chrome.webRequest.onBeforeSendHeaders.addListener(
  function(details) {
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

          // Immediately remove the cookie from browser's native store
          // to maintain isolation
          const cookieUrl = `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path || '/'}`;
          chrome.cookies.remove({
            url: cookieUrl,
            name: cookie.name,
            storeId: cookie.storeId
          }, (removedCookie) => {
            if (chrome.runtime.lastError) {
              console.error('[chrome.cookies.onChanged] Failed to remove browser cookie:', chrome.runtime.lastError);
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

// ============= Message Handler =============

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'createNewSession') {
      // Create new session with optional URL and callback
      const url = message.url || 'about:blank';
      createNewSession(url, (result) => {
        if (result.success) {
          sendResponse({ success: true, data: result });
        } else {
          sendResponse({ success: false, error: result.error });
        }
      });
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

      try {
        const cookie = parseCookie(message.cookie);

        // Extract domain from URL if not specified
        if (!cookie.domain && message.url) {
          const url = new URL(message.url);
          cookie.domain = url.hostname;
        }

        if (!cookie.domain) {
          console.error('setCookie: No domain specified');
          sendResponse({ success: false, error: 'No domain specified' });
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

    } else {
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
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    console.log('[Navigation] Tab', tabId, 'navigated to', changeInfo.url);
    const sessionId = sessionStore.tabToSession[tabId];
    if (sessionId) {
      console.log('[Navigation] Tab', tabId, 'still has session', sessionId);
      // Update badge
      const session = sessionStore.sessions[sessionId];
      if (session) {
        chrome.browserAction.setBadgeText({ text: '●', tabId: tabId });
        chrome.browserAction.setBadgeBackgroundColor({ color: session.color, tabId: tabId });
      }
    } else {
      console.log('[Navigation] Tab', tabId, 'has no session');
    }
  }
});

/**
 * Update badge when tab is activated
 */
chrome.tabs.onActivated.addListener((activeInfo) => {
  const sessionId = getSessionForTab(activeInfo.tabId);

  if (sessionId) {
    const color = sessionStore.sessions[sessionId]?.color || sessionColor(sessionId);
    chrome.browserAction.setBadgeText({ text: '●', tabId: activeInfo.tabId });
    chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: activeInfo.tabId });
  } else {
    chrome.browserAction.setBadgeText({ text: '', tabId: activeInfo.tabId });
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

  // Set badge immediately
  const color = sourceSession.color || sessionColor(sourceSessionId);
  chrome.browserAction.setBadgeText({ text: '●', tabId: targetTabId });
  chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: targetTabId });

  console.log(`[Popup Inheritance] ✓ Tab ${targetTabId} now has session ${sourceSessionId}`);

  // Persist the change immediately (important for popups that might close quickly)
  persistSessions(true);
});

/**
 * Handle links opened in new tabs (target="_blank")
 * This catches cases where webNavigation.onCreatedNavigationTarget doesn't fire
 */
chrome.tabs.onCreated.addListener((tab) => {
  console.log(`[Tab Created] New tab ${tab.id} created`);

  // If the tab has an openerTabId, it was opened from another tab
  if (tab.openerTabId) {
    const parentSessionId = sessionStore.tabToSession[tab.openerTabId];

    if (parentSessionId) {
      console.log(`[Tab Created] Inheriting session ${parentSessionId} from opener tab ${tab.openerTabId}`);

      sessionStore.tabToSession[tab.id] = parentSessionId;

      const session = sessionStore.sessions[parentSessionId];
      if (session && !session.tabs.includes(tab.id)) {
        session.tabs.push(tab.id);
      }

      const color = session?.color || sessionColor(parentSessionId);
      chrome.browserAction.setBadgeText({ text: '●', tabId: tab.id });
      chrome.browserAction.setBadgeBackgroundColor({ color: color, tabId: tab.id });

      console.log(`[Tab Created] ✓ Tab ${tab.id} inherited session ${parentSessionId}`);

      persistSessions(true);
    } else {
      console.log(`[Tab Created] Opener tab ${tab.openerTabId} has no session`);
    }
  } else {
    console.log(`[Tab Created] Tab ${tab.id} has no opener, not inheriting session`);
  }
});

/**
 * Initialize on install
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('Multi-Session Manager installed/updated');
  // Load persisted sessions after extension install/update
  loadPersistedSessions();
});

/**
 * Initialize on startup
 */
chrome.runtime.onStartup.addListener(() => {
  console.log('Multi-Session Manager started');
  // Load persisted sessions on browser startup
  loadPersistedSessions();
});

// Load persisted sessions when background script loads
console.log('Multi-Session Manager background script loaded');
loadPersistedSessions();

// Test if webRequest listeners are registered
console.log('Testing webRequest listeners...');
console.log('onBeforeSendHeaders registered:', chrome.webRequest.onBeforeSendHeaders.hasListeners());
console.log('onHeadersReceived registered:', chrome.webRequest.onHeadersReceived.hasListeners());
