/**
 * Content Script: Cookie Isolation
 *
 * This script provides transparent document.cookie isolation using a two-part
 * architecture: an injected script running in the page context and a content
 * script running in the extension context.
 *
 * Architecture:
 * 1. Injected Script (page context): Overrides document.cookie getter/setter
 * 2. Content Script (extension context): Forwards requests to background script
 *
 * @file content-script-cookie.js
 * @injects document_start (must run before page scripts)
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__COOKIE_ISOLATION_INJECTED__) {
    console.warn('[Cookie Isolation] Already injected, skipping');
    return;
  }
  window.__COOKIE_ISOLATION_INJECTED__ = true;

  console.log('[Cookie Isolation] Initializing cookie isolation...');

  /**
   * Part A: Injected Script (runs in page context)
   * This script overrides document.cookie and uses postMessage to communicate
   */
  const injectedScript = function() {
    // Prevent multiple injections in page context
    if (window.__COOKIE_OVERRIDE_INSTALLED__) {
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
     * Fetches cookies asynchronously and updates cache
     */
    async function fetchCookies() {
      try {
        const cookies = await sendMessageToContentScript({
          type: 'GET_COOKIE'
        });
        cachedCookies = cookies;
        cookiesInitialized = true;
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

        // Refresh cached cookies after setting
        await fetchCookies();
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
            // For synchronous access, return cached cookies
            // Note: This may be stale if cookies were modified elsewhere
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
  };

  /**
   * Injects the page script into the page context
   */
  function injectPageScript() {
    try {
      const script = document.createElement('script');
      script.textContent = '(' + injectedScript.toString() + ')();';

      // Inject before any other scripts
      (document.head || document.documentElement).appendChild(script);

      // Remove script element after execution
      script.remove();

      console.log('[Cookie Isolation] Page script injected successfully');
    } catch (error) {
      console.error('[Cookie Isolation] Failed to inject page script:', error);
    }
  }

  /**
   * Part B: Content Script (runs in extension context)
   * This script forwards messages between page and background
   */

  /**
   * Current session ID
   * @type {string|null}
   */
  let currentSessionId = null;

  /**
   * Fetches the current session ID from background script with retry logic
   * @returns {Promise<boolean>}
   */
  async function fetchSessionId() {
    let attempts = 0;
    const maxAttempts = 5;
    const delays = [100, 500, 1000, 2000, 3000]; // Increasing delays in milliseconds

    while (attempts < maxAttempts) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getSessionId' }, (response) => {
            resolve(response);
          });
        });

        if (response && response.success && response.sessionId) {
          currentSessionId = response.sessionId;
          console.log('%c[Cookie Isolation] ✓ Session ready:', 'color: green; font-weight: bold', currentSessionId);
          return true;
        }
      } catch (error) {
        // Silent retry
      }

      attempts++;
      if (attempts < maxAttempts) {
        const delay = delays[attempts - 1];
        console.debug(`[Cookie Isolation] Retry ${attempts}/${maxAttempts} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Only warn on final failure
    console.warn('%c[Cookie Isolation] ⚠ No session assigned to this tab', 'color: orange; font-weight: bold');
    console.warn('[Cookie Isolation] Cookie operations will not work without a session');
    currentSessionId = null;
    return false;
  }

  /**
   * Handles messages from the injected page script
   */
  window.addEventListener('message', async function(event) {
    // Only accept messages from same origin
    if (event.source !== window) {
      return;
    }

    const message = event.data;

    // Handle GET_COOKIE request
    if (message && message.type === 'GET_COOKIE') {
      try {
        console.log('[Cookie Isolation] Handling GET_COOKIE request');

        // Ensure we have session ID
        if (!currentSessionId) {
          await fetchSessionId();
        }

        // Forward to background script
        const response = await chrome.runtime.sendMessage({
          action: 'getCookies',
          url: window.location.href
        });

        // Check if we have a valid response
        if (!response) {
          console.debug('[Cookie Isolation] No response from background (normal during page load)');
          window.postMessage({
            type: 'COOKIE_GET_RESPONSE',
            messageId: message.messageId,
            cookies: ''
          }, '*');
          return;
        }

        if (response.success && response.cookies !== undefined) {
          // Send response back to page
          window.postMessage({
            type: 'COOKIE_GET_RESPONSE',
            messageId: message.messageId,
            cookies: response.cookies
          }, '*');
          console.log('[Cookie Isolation] GET_COOKIE response sent:', response.cookies);
        } else {
          console.debug('[Cookie Isolation] No cookies available yet');
          window.postMessage({
            type: 'COOKIE_GET_RESPONSE',
            messageId: message.messageId,
            cookies: ''
          }, '*');
        }
      } catch (error) {
        console.error('[Cookie Isolation] Error handling GET_COOKIE:', error);

        // Send error response
        window.postMessage({
          type: 'COOKIE_GET_RESPONSE',
          messageId: message.messageId,
          cookies: '',
          error: error.message
        }, '*');
      }
    }
    // Handle SET_COOKIE request
    else if (message && message.type === 'SET_COOKIE') {
      try {
        console.log('[Cookie Isolation] Handling SET_COOKIE request:', message.cookie);

        // Ensure we have session ID
        if (!currentSessionId) {
          await fetchSessionId();
        }

        // Parse cookie string to extract name and value
        const cookieString = message.cookie;

        // Forward to background script
        const response = await chrome.runtime.sendMessage({
          action: 'setCookie',
          url: window.location.href,
          cookie: cookieString
        });

        // Send response back to page
        window.postMessage({
          type: 'COOKIE_SET_RESPONSE',
          messageId: message.messageId,
          success: response.success || false,
          error: response.error
        }, '*');

        console.log('[Cookie Isolation] SET_COOKIE response sent:', response.success);
      } catch (error) {
        console.error('[Cookie Isolation] Error handling SET_COOKIE:', error);

        // Send error response
        window.postMessage({
          type: 'COOKIE_SET_RESPONSE',
          messageId: message.messageId,
          success: false,
          error: error.message
        }, '*');
      }
    }
  }, false);

  /**
   * Initialize content script
   */
  async function initialize() {
    // Fetch session ID first
    await fetchSessionId();

    // Inject page script
    injectPageScript();

    console.log('[Cookie Isolation] Content script initialization complete');
  }

  // Start initialization
  initialize();

})();
