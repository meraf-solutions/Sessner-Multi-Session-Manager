/**
 * Injected Script: Cookie Override (runs in page context)
 *
 * This script runs in the page's JavaScript context to override document.cookie.
 * It uses window.postMessage to communicate with the content script.
 *
 * ARCHITECTURE:
 * Page Context (this file) ←postMessage→ Content Script ←runtime.sendMessage→ Background
 *
 * @file inject-cookie-override.js
 * @context page (injected via web_accessible_resources)
 */

(function() {
  'use strict';

  // Skip execution on browser internal pages
  const isBrowserInternalPage = window.location.protocol === 'chrome:' ||
                                window.location.protocol === 'edge:' ||
                                window.location.protocol === 'about:' ||
                                window.location.protocol === 'chrome-search:' ||
                                window.location.protocol === 'chrome-extension:' ||
                                window.location.protocol === 'edge-extension:';

  if (isBrowserInternalPage) {
    // Silent skip for browser internal pages
    return;
  }

  // Prevent multiple injections in page context
  if (window.__COOKIE_OVERRIDE_INSTALLED__) {
    console.log('[Cookie Override] Already installed, skipping');
    return;
  }
  window.__COOKIE_OVERRIDE_INSTALLED__ = true;

  console.log('[Cookie Isolation - Page] Installing cookie override...');

  /**
   * Message ID counter for request/response matching
   * @type {number}
   */
  let messageIdCounter = 0;

  /**
   * Pending cookie requests awaiting responses
   * @type {Map<number, {resolve: Function, reject: Function}>}
   */
  const pendingRequests = new Map();

  /**
   * Listen for responses from content script
   */
  window.addEventListener('message', function(event) {
    // Only accept messages from same origin
    if (event.source !== window) {
      return;
    }

    const message = event.data;

    // Handle cookie operation responses
    if (message && message.type === 'COOKIE_GET_RESPONSE') {
      const request = pendingRequests.get(message.messageId);
      if (request) {
        pendingRequests.delete(message.messageId);
        request.resolve(message.cookies || '');
      }
    } else if (message && message.type === 'COOKIE_SET_RESPONSE') {
      const request = pendingRequests.get(message.messageId);
      if (request) {
        pendingRequests.delete(message.messageId);
        if (message.success) {
          request.resolve();
        } else {
          request.reject(new Error(message.error || 'Failed to set cookie'));
        }
      }
    }
  }, false);

  /**
   * Sends a message to the content script and waits for response
   * @param {Object} message - The message to send
   * @returns {Promise} Promise that resolves with the response
   */
  function sendMessageToContentScript(message) {
    return new Promise((resolve, reject) => {
      const messageId = ++messageIdCounter;
      message.messageId = messageId;

      pendingRequests.set(messageId, { resolve, reject });

      // Send message to content script
      window.postMessage(message, '*');

      // Timeout after 5 seconds
      setTimeout(() => {
        if (pendingRequests.has(messageId)) {
          pendingRequests.delete(messageId);
          reject(new Error('Cookie operation timeout'));
        }
      }, 5000);
    });
  }

  /**
   * Cookie storage for synchronous access
   * @type {string}
   */
  let cachedCookies = '';

  /**
   * Flag indicating if initial cookie fetch is complete
   * @type {boolean}
   */
  let cookiesInitialized = false;

  /**
   * Timestamp of last cache refresh
   * @type {number}
   */
  let lastCacheRefreshTime = 0;

  /**
   * Cache refresh interval (milliseconds)
   * SECURITY FIX: Periodic refresh to ensure HTTP-set cookies are visible
   */
  const CACHE_REFRESH_INTERVAL = 500;

  /**
   * Fetches cookies asynchronously and updates cache
   * @param {boolean} force - Force refresh even if recently refreshed
   */
  async function fetchCookies(force = false) {
    const now = Date.now();

    // SECURITY FIX: Check if cache needs refresh
    if (!force && cookiesInitialized && (now - lastCacheRefreshTime) < CACHE_REFRESH_INTERVAL) {
      // Cache is still fresh
      return;
    }

    try {
      const cookies = await sendMessageToContentScript({
        type: 'GET_COOKIE'
      });
      cachedCookies = cookies;
      cookiesInitialized = true;
      lastCacheRefreshTime = now;
      console.log('[Cookie Isolation - Page] Cookies fetched and cached');
    } catch (error) {
      console.error('[Cookie Isolation - Page] Error fetching cookies:', error);
      cookiesInitialized = true; // Mark as initialized even on error
    }
  }

  /**
   * Sets a cookie asynchronously
   * @param {string} cookieString - The cookie string to set
   */
  async function setCookie(cookieString) {
    try {
      await sendMessageToContentScript({
        type: 'SET_COOKIE',
        cookie: cookieString
      });
      console.log('[Cookie Isolation - Page] Cookie set:', cookieString);

      // SECURITY FIX: Force refresh to get updated cookie list
      await fetchCookies(true);
    } catch (error) {
      console.error('[Cookie Isolation - Page] Error setting cookie:', error);
      throw error;
    }
  }

  // Override document.cookie
  try {
    const cookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
                            Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

    if (cookieDescriptor && cookieDescriptor.configurable) {
      Object.defineProperty(document, 'cookie', {
        get() {
          // SECURITY FIX: Trigger cache refresh on read to get latest HTTP-set cookies
          // This is async but fire-and-forget to maintain synchronous API
          fetchCookies(false).catch(err => {
            console.error('[Cookie Isolation - Page] Background refresh failed:', err);
          });

          // For synchronous access, return cached cookies
          if (!cookiesInitialized) {
            console.warn('[Cookie Isolation - Page] Cookies not yet initialized, returning empty string');
            return '';
          }
          console.log('[Cookie Isolation - Page] document.cookie (get) =>', cachedCookies);
          return cachedCookies;
        },

        set(cookieString) {
          console.log('[Cookie Isolation - Page] document.cookie (set) =>', cookieString);

          // Cookie setting is async, but the API is synchronous
          // We fire and forget, updating cache when complete
          setCookie(cookieString).catch(error => {
            console.error('[Cookie Isolation - Page] Failed to set cookie:', error);
          });

          // For immediate reads after write, update cache optimistically
          // This is a best-effort approach for synchronous API compatibility
          if (cachedCookies) {
            cachedCookies += '; ' + cookieString.split(';')[0];
          } else {
            cachedCookies = cookieString.split(';')[0];
          }
        },

        configurable: false,
        enumerable: true
      });

      console.log('[Cookie Isolation - Page] document.cookie override installed');

      // Fetch initial cookies
      fetchCookies();

    } else {
      console.error('[Cookie Isolation - Page] document.cookie is not configurable, cannot override');
    }
  } catch (error) {
    console.error('[Cookie Isolation - Page] Failed to override document.cookie:', error);
  }

  console.log('[Cookie Isolation - Page] Injected script initialization complete');
})();
