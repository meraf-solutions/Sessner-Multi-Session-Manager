/**
 * Content Script - Dynamic Favicon with Session Badge
 * Overlays session badge color onto site's favicon
 */

(function() {
  'use strict';

  // Skip execution on extension pages, local files, and browser internal pages
  const isExtensionProtocol = window.location.protocol === 'chrome-extension:' ||
                              window.location.protocol === 'edge-extension:';
  const isFileProtocol = window.location.protocol === 'file:';
  const isBrowserInternalPage = window.location.protocol === 'chrome:' ||
                                window.location.protocol === 'edge:' ||
                                window.location.protocol === 'about:' ||
                                window.location.protocol === 'chrome-search:';
  const isExtensionHTML = window.location.href.includes('storage-diagnostics.html') ||
                          window.location.href.includes('popup-license.html') ||
                          window.location.href.includes('license-details.html');
  const isPopup = window.location.href.includes('/popup.html');

  if ((isExtensionProtocol && !isPopup) || isFileProtocol || isBrowserInternalPage || (isExtensionHTML && !isPopup)) {
    // Silent skip for browser internal pages (chrome://newtab/, edge://newtab/, etc.)
    return;
  }

  console.log('[Favicon] Script loaded');

  let sessionColor = null;
  let isInitialized = false;

  /**
   * Get session ID and color from background script
   */
  async function getSessionColor() {
    try {
      // Check if chrome.runtime is available
      if (!chrome || !chrome.runtime) {
        console.error('[Favicon] chrome.runtime not available');
        return false;
      }

      console.log('[Favicon] Requesting session ID from background...');

      // Use Promise wrapper for better error handling
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getSessionId' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[Favicon] Runtime error:', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        });
      });

      console.log('[Favicon] Session ID response:', response);

      if (response?.success && response.sessionId) {
        console.log('[Favicon] Got session ID:', response.sessionId);

        // Now get the session color
        const colorResponse = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            action: 'getSessionColor',
            sessionId: response.sessionId
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[Favicon] Runtime error:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });

        console.log('[Favicon] Session color response:', colorResponse);

        if (colorResponse?.success && colorResponse.color) {
          sessionColor = colorResponse.color;
          console.log('[Favicon] ✓ Got session color:', sessionColor);
          return true;
        } else {
          console.log('[Favicon] Failed to get session color');
          return false;
        }
      } else {
        console.log('[Favicon] Tab has no session, skipping favicon overlay');
        return false;
      }
    } catch (error) {
      console.error('[Favicon] Error getting session color:', error);
      return false;
    }
  }

  /**
   * Create a canvas with the extension icon and colored badge overlay
   * @param {HTMLImageElement} img - Extension icon image
   * @param {string} color - Hex color code for badge
   * @returns {string} Data URL of badged icon
   */
  function createBadgedIcon(img, color) {
    const canvas = document.createElement('canvas');
    const size = 32; // Standard favicon size
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');

    // Draw extension icon
    ctx.drawImage(img, 0, 0, size, size);

    // Draw colored badge in bottom-right corner
    const badgeSize = 12;
    const badgeX = size - badgeSize - 2;
    const badgeY = size - badgeSize - 2;

    // Draw badge background (white circle with slight shadow)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Draw colored badge
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(badgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2 - 1, 0, Math.PI * 2);
    ctx.fill();

    return canvas.toDataURL('image/png');
  }

  /**
   * Apply extension icon with colored badge
   */
  function applyBadgedFavicon() {
    if (!sessionColor) {
      console.log('[Favicon] No session color, skipping');
      return;
    }

    console.log('[Favicon] Applying extension icon with colored badge...');

    // Load extension icon
    const extensionIconUrl = chrome.runtime.getURL('icons/icon48.png');
    const iconImg = new Image();

    iconImg.onload = function() {
      console.log('[Favicon] Extension icon loaded, creating badged version');

      // Create badged favicon using extension icon
      const badgedDataUrl = createBadgedIcon(iconImg, sessionColor);

      // Remove existing favicons
      const existingLinks = document.querySelectorAll('link[rel*="icon"]');
      existingLinks.forEach(link => link.remove());

      // Add badged extension icon
      const newLink = document.createElement('link');
      newLink.rel = 'icon';
      newLink.type = 'image/png';
      newLink.href = badgedDataUrl;
      newLink.dataset.sessionFavicon = 'true'; // Mark as our favicon
      document.head.appendChild(newLink);

      console.log('[Favicon] ✓ Extension icon with badge applied');
    };

    iconImg.onerror = function() {
      console.error('[Favicon] Failed to load extension icon');
    };

    // Load extension icon
    iconImg.src = extensionIconUrl;
  }

  /**
   * Initialize the favicon overlay
   */
  async function initialize() {
    if (isInitialized) {
      return;
    }

    console.log('[Favicon] Initializing session favicon...');

    // Get session color
    const hasSession = await getSessionColor();

    if (!hasSession) {
      console.log('[Favicon] No session assigned to this tab, skipping favicon change');
      return;
    }

    isInitialized = true;

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyBadgedFavicon);
    } else {
      // DOM already loaded
      applyBadgedFavicon();
    }

    console.log('[Favicon] ✓ Session favicon initialized');
  }

  // Start initialization with retry logic
  let retryCount = 0;
  const maxRetries = 5;
  const retryDelays = [100, 500, 1000, 2000, 3000];

  async function initWithRetry() {
    console.log('[Favicon] Init attempt', retryCount + 1, 'of', maxRetries + 1);
    const hasSession = await getSessionColor();

    if (hasSession) {
      console.log('[Favicon] Session found, initializing...');
      initialize();
    } else if (retryCount < maxRetries) {
      console.log('[Favicon] No session yet, retrying in', retryDelays[retryCount], 'ms');
      // Retry after delay
      setTimeout(() => {
        retryCount++;
        initWithRetry();
      }, retryDelays[retryCount]);
    } else {
      console.log('[Favicon] Max retries reached, tab likely has no session');
    }
  }

  /**
   * Remove session favicon and restore original favicon
   */
  function clearSessionFavicon() {
    console.log('[Favicon] Clearing session favicon...');

    // Remove our custom favicon
    const sessionFavicons = document.querySelectorAll('link[data-session-favicon="true"]');
    sessionFavicons.forEach(link => {
      console.log('[Favicon] Removing session favicon:', link.href);
      link.remove();
    });

    // Reset state
    sessionColor = null;
    isInitialized = false;

    console.log('[Favicon] ✓ Session favicon cleared (original favicon restored)');
  }

  // Listen for session color changes and clear requests
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'sessionColorChanged' && message.color) {
      console.log('[Favicon] Session color changed to:', message.color);
      sessionColor = message.color;

      // Reapply favicon with new color
      applyBadgedFavicon();

      sendResponse({ success: true });
    } else if (message.action === 'clearSessionFavicon') {
      console.log('[Favicon] Received clear session favicon request');
      clearSessionFavicon();
      sendResponse({ success: true });
    }
  });

  // Start initialization
  console.log('[Favicon] Starting initialization...');
  initWithRetry();

})();
