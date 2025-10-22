/**
 * Popup Script - Multi-Session Manager
 * Simple UI for creating and managing isolated sessions
 */

// ============= Utilities =============

const $ = (selector) => document.querySelector(selector);

/**
 * Send message to background script
 * @param {Object} message
 * @returns {Promise<any>}
 */
async function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      resolve(response);
    });
  });
}

/**
 * Format session limit for display (handles Infinity, null, undefined, -1)
 * Background sends -1 for unlimited (Infinity doesn't survive JSON serialization)
 * JSON.stringify converts Infinity to null, so we handle that case too
 * @param {number|null|undefined} limit - Session limit
 * @returns {string} Formatted limit ('3', '∞', etc.)
 */
function formatSessionLimit(limit) {
  console.log('[formatSessionLimit] Input:', limit, 'Type:', typeof limit);

  // Handle all possible "unlimited" representations
  if (limit === -1 || limit === Infinity || limit === null || limit === undefined) {
    console.log('[formatSessionLimit] Detected unlimited, returning ∞');
    return '∞';
  }
  // Handle edge case where limit might be a string
  if (typeof limit === 'string') {
    const parsed = parseInt(limit, 10);
    if (isNaN(parsed)) {
      console.log('[formatSessionLimit] Invalid string, returning ∞');
      return '∞'; // Invalid number = unlimited
    }
    if (parsed === -1) {
      console.log('[formatSessionLimit] String "-1" detected, returning ∞');
      return '∞';
    }
    console.log('[formatSessionLimit] Valid string number, returning:', parsed);
    return String(parsed);
  }
  console.log('[formatSessionLimit] Numeric limit, returning:', limit);
  return String(limit);
}

/** Get current year for copyright footer */
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('year');
  if (!el) {
    console.error('Year element not found');
    return;
  }
  el.textContent = new Date().getFullYear();
});

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text with ellipsis
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// ============= Session Management =============

/**
 * Create a new session
 */
async function createNewSession() {
  try {
    console.log('Creating new session...');

    // Check if session creation is allowed
    const canCreateResponse = await sendMessage({ action: 'canCreateSession' });

    if (canCreateResponse && !canCreateResponse.allowed) {
      console.warn('Session creation blocked:', canCreateResponse.reason);
      showSessionLimitWarning(canCreateResponse);
      return;
    }

    // Get URL from input field
    const urlInput = $('#sessionUrl');
    const url = urlInput ? urlInput.value.trim() : '';

    const response = await sendMessage({
      action: 'createNewSession',
      url: url || undefined
    });

    if (response && response.success) {
      console.log('New session created:', response.data);

      // Clear input field
      if (urlInput) {
        urlInput.value = '';
      }

      // Close popup and let the new tab open
      window.close();
    } else if (response && response.blocked) {
      // Session was blocked by license limits
      console.warn('Session creation blocked:', response.error);
      showSessionLimitWarning(response);
    } else {
      console.error('Failed to create session:', response);
      alert('Failed to create new session: ' + (response?.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error creating session:', error);
    alert('Error creating new session: ' + error.message);
  }
}

/**
 * Show session limit warning
 * @param {Object} limitInfo - Limit information from canCreateSession
 */
function showSessionLimitWarning(limitInfo) {
  const tier = limitInfo.tier || 'free';
  const current = limitInfo.current || 0;
  const limit = formatSessionLimit(limitInfo.limit);
  const reason = limitInfo.reason || 'Session limit reached';

  // Create warning message
  let message = reason;

  if (tier === 'free') {
    message += '\n\nClick "View License" to upgrade to Premium for unlimited sessions.';
  }

  alert(message);
}

/**
 * Update session button state based on limits
 * @param {Object} status - Session status from getSessionStatus
 */
function updateSessionButtonState(status) {
  const button = $('#newSessionBtn');
  const warningContainer = $('#sessionLimitWarning');

  if (!button) return;

  if (!status.canCreateNew) {
    // Disable button and show warning
    button.disabled = true;
    button.style.opacity = '0.5';
    button.style.cursor = 'not-allowed';
    const limitDisplay = formatSessionLimit(status.limit);
    button.title = `Session limit reached (${status.activeCount}/${limitDisplay})`;

    // Show warning message
    if (warningContainer) {
      const tier = status.tier || 'free';
      const upgradeText = tier === 'free' ? ' <a href="license-details.html" style="color: #1ea7e8; text-decoration: underline;">Upgrade to Premium</a> for unlimited sessions.' : '';
      const limitDisplay = formatSessionLimit(status.limit);

      warningContainer.innerHTML = `
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 13px; color: #856404; text-align: center;">
          <strong>⚠️ Session Limit Reached</strong><br>
          You have ${status.activeCount} active sessions (${tier.toUpperCase()} tier limit: ${limitDisplay}).${upgradeText}
        </div>
      `;
      warningContainer.style.display = 'block';
    }
  } else {
    // Enable button
    button.disabled = false;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
    button.title = 'Create a new isolated session';

    // Hide warning if shown
    if (warningContainer) {
      warningContainer.style.display = 'none';
    }

    // Show approaching limit warning (for free tier only, not unlimited)
    // Only show if: free tier AND approaching numeric limit AND limit is not unlimited
    const isUnlimited = (status.limit === -1 || status.limit === Infinity || status.limit === null || status.limit === undefined);
    if (status.tier === 'free' && !isUnlimited && status.activeCount >= status.limit - 1 && warningContainer) {
      const limitDisplay = formatSessionLimit(status.limit);
      warningContainer.innerHTML = `
        <div style="background: #e7f3ff; border: 1px solid #1ea7e8; border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 12px; color: #0066cc; text-align: center;">
          <strong>ℹ️ Approaching Limit</strong><br>
          ${status.activeCount} of ${limitDisplay} sessions used. <a href="license-details.html" style="color: #0066cc; text-decoration: underline;">Upgrade to Premium</a> for unlimited sessions.
        </div>
      `;
      warningContainer.style.display = 'block';
    }
  }
}

/**
 * Switch to a specific tab
 * @param {number} tabId
 */
async function switchToTab(tabId) {
  try {
    const response = await sendMessage({
      action: 'switchToTab',
      tabId: tabId
    });

    if (response && response.success) {
      // Close popup after switching
      window.close();
    } else {
      console.error('Failed to switch tab:', response);
    }
  } catch (error) {
    console.error('Error switching tab:', error);
  }
}

/**
 * Refresh the list of active sessions
 */
async function refreshSessions() {
  try {
    console.log('Refreshing sessions...');
    const response = await sendMessage({ action: 'getActiveSessions' });

    if (!response || !response.success) {
      console.error('Failed to get sessions:', response);
      $('#sessionsList').innerHTML = '<div class="empty-state"><div class="empty-state-text">Error loading sessions</div></div>';
      return;
    }

    const sessions = response.sessions || [];
    console.log('Active sessions:', sessions);

    // Get session status for limit display
    const statusResponse = await sendMessage({ action: 'getSessionStatus' });

    // Debug logging for limit detection
    console.log('[Popup] getSessionStatus response:', statusResponse);
    console.log('[Popup] statusResponse.limit:', statusResponse?.limit);
    console.log('[Popup] typeof limit:', typeof statusResponse?.limit);
    console.log('[Popup] limit === Infinity:', statusResponse?.limit === Infinity);
    console.log('[Popup] limit === null:', statusResponse?.limit === null);
    console.log('[Popup] limit === -1:', statusResponse?.limit === -1);

    // Ensure we have a valid status object with proper defaults
    const status = statusResponse && statusResponse.success ? {
      activeCount: statusResponse.activeCount ?? sessions.length,
      limit: statusResponse.limit ?? 3,
      tier: statusResponse.tier || 'free',
      canCreateNew: statusResponse.canCreateNew ?? (sessions.length < 3)
    } : {
      activeCount: sessions.length,
      limit: 3,
      tier: 'free',
      canCreateNew: sessions.length < 3
    };

    // Update session count with limit info
    // Use activeCount from status for accurate count (matches backend logic)
    const count = status.activeCount;
    const limitDisplay = formatSessionLimit(status.limit);
    $('#sessionCount').textContent = `${count} / ${limitDisplay} sessions`;

    // Verify consistency between popup sessions and backend active count
    if (sessions.length !== count) {
      console.warn('[Popup] Session count mismatch: popup shows', sessions.length, 'sessions but backend reports', count, 'active sessions');
    }

    // Update button state based on limits
    updateSessionButtonState(status);

    if (sessions.length === 0) {
      $('#sessionsList').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📂</div>
          <div class="empty-state-text">No active sessions</div>
          <div class="empty-state-hint">Click "New Session" to create one</div>
        </div>
      `;
      return;
    }

    // Build HTML for sessions
    let html = '';

    sessions.forEach(session => {
      const sessionId = escapeHtml(session.sessionId);
      const sessionColor = session.color || '#999';
      const tabs = session.tabs || [];

      html += `
        <div class="session-group">
          <div class="session-header-bar">
            <div class="session-color-dot" style="background-color: ${sessionColor}"></div>
            <div class="session-id">${truncate(sessionId, 30)}</div>
          </div>
          <div class="tab-list">
      `;

      tabs.forEach(tab => {
        const tabTitle = escapeHtml(tab.title || 'Untitled');
        const tabDomain = escapeHtml(tab.domain || 'No domain');
        const tabId = tab.tabId;
        const favIconUrl = tab.favIconUrl || '';

        html += `
          <div class="tab-item" data-tab-id="${tabId}">
            <div class="tab-favicon">
              ${favIconUrl ? `<img src="${escapeHtml(favIconUrl)}" alt="" onerror="this.style.display='none'">` : '📄'}
            </div>
            <div class="tab-info">
              <div class="tab-title">${truncate(tabTitle, 40)}</div>
              <div class="tab-domain">${truncate(tabDomain, 40)}</div>
            </div>
            <div class="tab-actions">
              <button class="tab-switch-btn" data-tab-id="${tabId}">Go</button>
            </div>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    $('#sessionsList').innerHTML = html;

    // Attach event listeners to tab items
    attachTabListeners();

  } catch (error) {
    console.error('Error refreshing sessions:', error);
    $('#sessionsList').innerHTML = '<div class="empty-state"><div class="empty-state-text">Error loading sessions</div></div>';
  }
}

/**
 * Attach event listeners to tab items
 */
function attachTabListeners() {
  // Tab switch buttons
  document.querySelectorAll('.tab-switch-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabId = parseInt(btn.dataset.tabId);
      await switchToTab(tabId);
    });
  });

  // Tab items (click anywhere on the item to switch)
  document.querySelectorAll('.tab-item').forEach(item => {
    item.addEventListener('click', async (e) => {
      // Don't trigger if clicking the button
      if (e.target.classList.contains('tab-switch-btn')) return;

      const tabId = parseInt(item.dataset.tabId);
      await switchToTab(tabId);
    });
  });
}

// ============= License Status =============

/**
 * Refresh license status display
 */
async function refreshLicenseStatus() {
  try {
    const response = await sendMessage({ action: 'getLicenseStatus' });

    if (!response || !response.success) {
      console.log('No license or error fetching license status');
      await displayFreeTier();
      return;
    }

    const license = response.licenseData;

    if (!license || license.tier === 'free') {
      await displayFreeTier();
    } else if (license.tier === 'premium') {
      await displayPremiumTier(license);
    } else if (license.tier === 'enterprise') {
      await displayEnterpriseTier(license);
    }
  } catch (error) {
    console.error('Error refreshing license status:', error);
    await displayFreeTier();
  }
}

/**
 * Display Free tier badge
 */
async function displayFreeTier() {
  const badge = $('#licenseTierBadge');
  const details = $('#licenseDetails');

  badge.className = 'license-tier-badge free';
  badge.textContent = 'Free Version';
  badge.href = 'popup-license.html';
  badge.title = 'Activate license';

  // Get current session count
  const statusResponse = await sendMessage({ action: 'getSessionStatus' });
  const activeCount = statusResponse && statusResponse.success ? statusResponse.activeCount : 0;

  details.innerHTML = `
    <div class="license-details-item">
      <span class="license-details-label">Status:</span>
      <span>Limited to 3 sessions (${activeCount}/3 active)</span>
    </div>
  `;
}

/**
 * Display Premium tier badge
 * @param {Object} license
 */
async function displayPremiumTier(license) {
  const badge = $('#licenseTierBadge');
  const details = $('#licenseDetails');

  badge.className = 'license-tier-badge premium';
  badge.textContent = 'Premium Version';
  badge.href = 'license-details.html';
  badge.title = 'View license details';

  const registeredName = `${license.first_name || ''} ${license.last_name || ''}`.trim() || license.email || 'Unknown';

  // Get current session count
  const statusResponse = await sendMessage({ action: 'getSessionStatus' });
  const activeCount = statusResponse && statusResponse.success ? statusResponse.activeCount : 0;

  details.innerHTML = `
    <div class="license-details-item">
      <span class="license-details-label">Registered:</span>
      <span>${escapeHtml(registeredName)}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Sessions:</span>
      <span>Unlimited (${activeCount} active)</span>
    </div>
  `;
}

/**
 * Display Enterprise tier badge
 * @param {Object} license
 */
async function displayEnterpriseTier(license) {
  const badge = $('#licenseTierBadge');
  const details = $('#licenseDetails');

  badge.className = 'license-tier-badge enterprise';
  badge.textContent = 'Enterprise Version';
  badge.href = 'license-details.html';
  badge.title = 'View license details';

  const registeredName = `${license.first_name || ''} ${license.last_name || ''}`.trim() || license.email || 'Unknown';

  // Get current session count
  const statusResponse = await sendMessage({ action: 'getSessionStatus' });
  const activeCount = statusResponse && statusResponse.success ? statusResponse.activeCount : 0;

  details.innerHTML = `
    <div class="license-details-item">
      <span class="license-details-label">Registered:</span>
      <span>${escapeHtml(registeredName)}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Sessions:</span>
      <span>Unlimited (${activeCount} active)</span>
    </div>
  `;
}

/**
 * Format date for display
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
function formatDate(dateString) {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  } catch (error) {
    return 'N/A';
  }
}

// ============= Event Listeners =============

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  // Load initial data
  await refreshSessions();
  await refreshLicenseStatus();

  // New Session button
  $('#newSessionBtn').addEventListener('click', async () => {
    await createNewSession();
  });

  // Refresh on tab activation (if popup is still open)
  chrome.tabs.onActivated.addListener(async () => {
    await refreshSessions();
  });

  // Refresh when tabs are updated
  chrome.tabs.onUpdated.addListener(async () => {
    await refreshSessions();
  });

  // Refresh when tabs are removed
  chrome.tabs.onRemoved.addListener(async () => {
    await refreshSessions();
  });
});

console.log('Popup script loaded');
