/**
 * Background.js Integration Snippet
 * Add this code to your existing background.js file
 *
 * STEP 1: Replace existing createNewSession function (around line 711)
 * STEP 2: Add license message handler to existing message listener (around line 1214)
 */

// ============================================================================
// STEP 1: REPLACE YOUR EXISTING createNewSession FUNCTION WITH THIS VERSION
// ============================================================================

/**
 * Create new session with license enforcement
 * This is a wrapper that calls the license-enforced version
 *
 * @param {string} url - URL to open in new session
 * @param {function} callback - Callback with result
 */
function createNewSession(url, callback) {
  // Use the license-enforced version from license-integration.js
  // This automatically checks tier limits before creating session
  createNewSessionWithLicense(url, callback);
}

// ============================================================================
// STEP 2: UPDATE YOUR MESSAGE LISTENER (around line 1214)
// ============================================================================

// REPLACE your existing chrome.runtime.onMessage.addListener with this:

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    // ===== LICENSE MESSAGE HANDLER (ADD THIS FIRST) =====
    // Try license message handler first
    const isLicenseMessage = handleLicenseMessage(message, sender, sendResponse);
    if (isLicenseMessage) {
      return true; // Async response handled by license handler
    }
    // ===================================================

    // ===== YOUR EXISTING MESSAGE HANDLERS BELOW =====
    // (Keep all your existing handlers unchanged)

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
        sendResponse({ success: false, cookies: '', error: 'No session' });
        return false;
      }

      if (!message.url) {
        sendResponse({ success: false, cookies: '', error: 'No URL provided' });
        return false;
      }

      try {
        const url = new URL(message.url);
        const cookies = getCookiesForSession(sessionId, url.hostname, url.pathname);
        const cookieHeader = formatCookieHeader(cookies);
        sendResponse({ success: true, cookies: cookieHeader });
      } catch (error) {
        console.error('getCookies error:', error);
        sendResponse({ success: false, cookies: '', error: error.message });
      }
      return false; // Synchronous response

    } else if (message.action === 'setCookie') {
      // Set cookie for content script
      const tabId = sender.tab ? sender.tab.id : null;
      const sessionId = tabId ? getSessionForTab(tabId) : null;

      if (!sessionId) {
        sendResponse({ success: false, error: 'No session' });
        return false;
      }

      if (!message.url || !message.cookie) {
        sendResponse({ success: false, error: 'Missing URL or cookie' });
        return false;
      }

      try {
        const url = new URL(message.url);
        const cookie = parseCookie(message.cookie);

        if (!cookie.domain) {
          cookie.domain = url.hostname;
        }

        // Security check
        if (!isValidCookieDomain(cookie.domain, message.url)) {
          console.error('[setCookie] Invalid domain:', cookie.domain, 'for URL:', message.url);
          sendResponse({ success: false, error: 'Invalid cookie domain' });
          return false;
        }

        storeCookie(sessionId, cookie.domain, cookie);
        sendResponse({ success: true });
      } catch (error) {
        console.error('setCookie error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return false; // Synchronous response

    } else if (message.action === 'switchToTab') {
      // Switch to a specific tab
      if (!message.tabId) {
        sendResponse({ success: false, error: 'No tabId provided' });
        return false;
      }

      chrome.tabs.update(message.tabId, { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else if (tab) {
          chrome.windows.update(tab.windowId, { focused: true }, () => {
            sendResponse({ success: true });
          });
        } else {
          sendResponse({ success: false, error: 'Tab not found' });
        }
      });
      return true; // Async response

    } else {
      // Unknown action
      sendResponse({ success: false, error: 'Unknown action: ' + message.action });
      return false;
    }

  } catch (error) {
    console.error('Message handler error:', error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
});

// ============================================================================
// OPTIONAL: ADD TIER BADGE TO POPUP
// ============================================================================

// If you want to show the current tier in your popup, add this to popup.js:

/*
async function displayTierBadge() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getTier' });

    if (response.success) {
      const tierElement = document.getElementById('tier-badge');
      if (tierElement) {
        tierElement.textContent = response.tier.toUpperCase();
        tierElement.className = `tier-badge tier-${response.tier}`;
      }
    }
  } catch (error) {
    console.error('Failed to get tier:', error);
  }
}

// Call this in your popup initialization
document.addEventListener('DOMContentLoaded', () => {
  displayTierBadge();
  // ... rest of your popup init
});
*/

// And add this CSS to popup.html:

/*
<style>
.tier-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-left: 10px;
}

.tier-free {
  background: #e0e0e0;
  color: #666;
}

.tier-premium {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.tier-enterprise {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}
</style>
*/

// And add this HTML to your popup header:

/*
<div class="header">
  <h1>
    Sessner
    <span id="tier-badge" class="tier-badge tier-free">FREE</span>
  </h1>
  <a href="popup-license.html" target="_blank" style="color: white; font-size: 12px;">
    Manage License
  </a>
</div>
*/

// ============================================================================
// VERIFICATION
// ============================================================================

// After making these changes:
// 1. Reload the extension (chrome://extensions → Reload)
// 2. Open background console (chrome://extensions → background page)
// 3. Run: testLicenseSystem()
// 4. Run: licenseStatus()
// 5. Test creating sessions (should enforce limits for free tier)

console.log('[License Integration] Integration code loaded');
console.log('[License Integration] Run testLicenseSystem() to verify installation');
