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

/**
 * Format time ago from timestamp
 * @param {number} timestamp - Timestamp in milliseconds
 * @returns {string} Human-readable time ago
 */
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Unknown';

  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor(diff / (60 * 60 * 1000));
  const minutes = Math.floor(diff / (60 * 1000));

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

/**
 * Calculate days remaining until session expires (free tier only)
 * @param {number} lastAccessed - Last accessed timestamp in ms
 * @param {string} tier - License tier
 * @returns {number|null} Days remaining or null if permanent
 */
function calculateDaysRemaining(lastAccessed, tier) {
  if (tier !== 'free') return null; // Premium/Enterprise never expire

  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const inactiveDuration = now - lastAccessed;
  const daysInactive = Math.floor(inactiveDuration / (24 * 60 * 60 * 1000));
  const daysRemaining = 7 - daysInactive;

  return Math.max(0, daysRemaining);
}

// ============= Color Selection State =============

let selectedColor = null; // Stores user-selected color for new session
let currentColorTier = 'free'; // Current tier for color selection
let availableColors = []; // Available colors for current tier

/**
 * Initialize color selection UI
 * Fetches available colors and sets up color picker
 */
async function initializeColorSelection() {
  try {
    const response = await sendMessage({ action: 'getAvailableColors' });

    if (response && response.success) {
      currentColorTier = response.tier;
      availableColors = response.colors;
      const allowCustom = response.allowCustom;

      console.log('[Color Selection] Tier:', currentColorTier, 'Colors:', availableColors.length, 'Custom allowed:', allowCustom);

      // Update color picker UI
      renderColorPicker(availableColors, allowCustom);
    }
  } catch (error) {
    console.error('[Color Selection] Error fetching colors:', error);
  }
}

/**
 * Render color picker UI
 * @param {Array<string>} colors - Available color hex codes
 * @param {boolean} allowCustom - Whether custom color input is allowed
 */
function renderColorPicker(colors, allowCustom) {
  const container = $('#colorPickerContainer');
  if (!container) return;

  let html = '<div class="color-picker-section">';
  html += '<div class="color-picker-label">Session Color (optional):</div>';
  html += '<div class="color-swatches">';

  // Add "Auto" option (no custom color)
  html += `
    <div class="color-swatch auto-color ${!selectedColor ? 'selected' : ''}"
         data-color="auto"
         title="Auto-assign color">
      <span class="auto-text">Auto</span>
    </div>
  `;

  // Add color swatches
  colors.forEach(color => {
    html += `
      <div class="color-swatch ${selectedColor === color ? 'selected' : ''}"
           data-color="${color}"
           style="background-color: ${color};"
           title="${color}">
      </div>
    `;
  });

  html += '</div>'; // Close color-swatches

  // Add custom color input for enterprise tier
  if (allowCustom) {
    html += `
      <div class="custom-color-input-container">
        <label for="customColorInput" class="custom-color-label">
          Or enter custom color (HEX):
        </label>
        <div class="custom-color-input-wrapper">
          <input
            type="text"
            id="customColorInput"
            class="custom-color-input"
            placeholder="#FF6B6B"
            maxlength="7"
            pattern="^#[0-9A-Fa-f]{6}$"
          />
          <div id="customColorPreview" class="custom-color-preview"></div>
        </div>
        <div class="custom-color-hint">Enterprise feature: Choose any hex color</div>
      </div>
    `;
  }

  html += '</div>'; // Close color-picker-section

  container.innerHTML = html;

  // Attach event listeners
  attachColorPickerListeners(allowCustom);
}

/**
 * Attach event listeners to color picker elements
 * @param {boolean} allowCustom - Whether custom color input is enabled
 */
function attachColorPickerListeners(allowCustom) {
  // Color swatch selection
  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;

      // Remove previous selection
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));

      // Mark as selected
      swatch.classList.add('selected');

      // Update selected color (null if "Auto")
      selectedColor = color === 'auto' ? null : color;

      // Clear custom color input if exists
      const customInput = $('#customColorInput');
      if (customInput) {
        customInput.value = '';
        $('#customColorPreview').style.backgroundColor = 'transparent';
      }

      console.log('[Color Selection] Selected:', selectedColor || 'auto');
    });
  });

  // Custom color input (enterprise only)
  if (allowCustom) {
    const customInput = $('#customColorInput');
    const preview = $('#customColorPreview');

    if (customInput && preview) {
      customInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();

        // Validate hex color format
        const hexPattern = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

        if (hexPattern.test(value)) {
          // Valid color - show preview
          preview.style.backgroundColor = value;
          selectedColor = value;

          // Remove selection from swatches
          document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));

          console.log('[Color Selection] Custom color:', value);
        } else {
          // Invalid - clear preview
          preview.style.backgroundColor = 'transparent';
          if (value.length === 0) {
            selectedColor = null;
          }
        }
      });
    }
  }
}

/**
 * Show color change modal for existing session
 * @param {string} sessionId - Session ID to change color for
 */
async function showColorChangeModal(sessionId) {
  // Check if enterprise tier
  const colorsResponse = await sendMessage({ action: 'getAvailableColors' });

  if (!colorsResponse || !colorsResponse.success) {
    alert('Failed to load color options');
    return;
  }

  if (!colorsResponse.allowCustom) {
    alert('Custom colors are only available in Enterprise tier. Upgrade to change session colors!');
    return;
  }

  const colors = colorsResponse.colors;

  // Create modal HTML
  let modalHTML = `
    <div class="color-modal-overlay" id="colorModalOverlay">
      <div class="color-modal">
        <div class="color-modal-header">
          <h3>Change Session Color</h3>
          <button class="color-modal-close" id="colorModalClose">&times;</button>
        </div>
        <div class="color-modal-body">
          <div class="color-swatches-modal">
  `;

  // Add color swatches
  colors.forEach(color => {
    modalHTML += `
      <div class="color-swatch-modal"
           data-color="${color}"
           style="background-color: ${color};"
           title="${color}">
      </div>
    `;
  });

  modalHTML += `
          </div>
          <div class="custom-color-modal-input">
            <label for="modalCustomColorInput">Custom HEX Color:</label>
            <input
              type="text"
              id="modalCustomColorInput"
              placeholder="#FF6B6B"
              maxlength="7"
            />
            <div id="modalCustomColorPreview" class="custom-color-preview"></div>
          </div>
        </div>
        <div class="color-modal-footer">
          <button id="colorModalCancel" class="btn-secondary">Cancel</button>
          <button id="colorModalApply" class="btn-primary">Apply Color</button>
        </div>
      </div>
    </div>
  `;

  // Inject modal into page
  const modalContainer = document.createElement('div');
  modalContainer.innerHTML = modalHTML;
  document.body.appendChild(modalContainer.firstElementChild);

  // Attach modal event listeners
  let selectedModalColor = null;

  // Swatch selection
  document.querySelectorAll('.color-swatch-modal').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.color-swatch-modal').forEach(s => s.classList.remove('selected'));
      swatch.classList.add('selected');
      selectedModalColor = swatch.dataset.color;
      $('#modalCustomColorInput').value = '';
    });
  });

  // Custom color input
  $('#modalCustomColorInput').addEventListener('input', (e) => {
    const value = e.target.value.trim();
    const hexPattern = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

    if (hexPattern.test(value)) {
      $('#modalCustomColorPreview').style.backgroundColor = value;
      selectedModalColor = value;
      document.querySelectorAll('.color-swatch-modal').forEach(s => s.classList.remove('selected'));
    } else {
      $('#modalCustomColorPreview').style.backgroundColor = 'transparent';
    }
  });

  // Close modal
  const closeModal = () => {
    $('#colorModalOverlay').remove();
  };

  $('#colorModalClose').addEventListener('click', closeModal);
  $('#colorModalCancel').addEventListener('click', closeModal);
  $('#colorModalOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'colorModalOverlay') {
      closeModal();
    }
  });

  // Apply color
  $('#colorModalApply').addEventListener('click', async () => {
    if (!selectedModalColor) {
      alert('Please select a color');
      return;
    }

    try {
      const response = await sendMessage({
        action: 'setSessionColor',
        sessionId: sessionId,
        color: selectedModalColor
      });

      if (response && response.success) {
        console.log('[Color Change] Success:', response.color);
        closeModal();
        await refreshSessions(); // Refresh to show new color
      } else {
        alert('Failed to change color: ' + (response?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('[Color Change] Error:', error);
      alert('Error changing color: ' + error.message);
    }
  });
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

    // Prepare message with optional custom color
    const message = {
      action: 'createNewSession',
      url: url || undefined
    };

    // Add custom color if selected (enterprise only)
    if (selectedColor) {
      message.customColor = selectedColor;
    }

    const response = await sendMessage(message);

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

    // Get session metadata from storage to access lastAccessed timestamps
    const sessionMetadata = await new Promise((resolve) => {
      chrome.storage.local.get(['sessions'], (data) => {
        resolve(data.sessions || {});
      });
    });

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

    // Check for expiring sessions (free tier only, approaching 7-day limit)
    if (status.tier === 'free' && sessions.length > 0) {
      const expiringSoon = sessions.filter(session => {
        const metadata = sessionMetadata[session.sessionId] || {};
        const lastAccessed = metadata.lastAccessed || metadata.createdAt || Date.now();
        const daysRemaining = calculateDaysRemaining(lastAccessed, status.tier);
        return daysRemaining !== null && daysRemaining <= 2; // Warn when 2 days or less
      });

      if (expiringSoon.length > 0) {
        const warningContainer = $('#sessionLimitWarning');
        if (warningContainer) {
          warningContainer.innerHTML = `
            <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 12px; margin-bottom: 12px; font-size: 13px; color: #856404; text-align: center;">
              <strong>⚠️ Sessions Expiring Soon</strong><br>
              ${expiringSoon.length} session(s) will expire in 2 days or less. <a href="license-details.html" style="color: #856404; text-decoration: underline;">Upgrade to Premium</a> for permanent storage.
            </div>
          `;
          warningContainer.style.display = 'block';
        }
      }
    }

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

      // Get session metadata for lastAccessed
      const metadata = sessionMetadata[session.sessionId] || {};
      const lastAccessed = metadata.lastAccessed || metadata.createdAt || Date.now();
      const lastAccessedText = formatTimeAgo(lastAccessed);

      // Calculate days remaining for free tier
      const daysRemaining = calculateDaysRemaining(lastAccessed, status.tier);
      const expiresText = daysRemaining !== null
        ? ` <span style="color: ${daysRemaining <= 2 ? '#f5576c' : '#999'};">(expires in ${daysRemaining}d)</span>`
        : ' <span style="color: #4ECDC4;">(permanent)</span>';

      html += `
        <div class="session-group">
          <div class="session-header-bar">
            <div class="session-color-dot" style="background-color: ${sessionColor}"></div>

            ${status.tier === 'enterprise' ? `
              <button class="session-settings-icon"
                      data-session-id="${sessionId}"
                      title="Session settings"
                      aria-label="Open session settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M12 1v6m0 6v6M1 12h6m6 0h6"></path>
                  <path d="M4.22 4.22l4.24 4.24m5.66 5.66l4.24 4.24M19.78 4.22l-4.24 4.24m-5.66 5.66l-4.24 4.24"></path>
                </svg>
              </button>
            ` : ''}

            <div class="session-id" style="display: flex; flex-direction: column; gap: 2px;">
              <span>${truncate(sessionId, 30)}</span>
              <span style="font-size: 10px; font-weight: normal; color: #999;">
                Last used: ${lastAccessedText}${expiresText}
              </span>
            </div>
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

    // Attach event listeners to tab items and session settings
    attachTabListeners();
    attachSessionSettingsListeners();

    // Update auto-restore UI after sessions are rendered
    await updateAutoRestoreUI();

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

/**
 * Attach event listeners to session settings icons (Enterprise only)
 */
function attachSessionSettingsListeners() {
  document.querySelectorAll('.session-settings-icon').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const sessionId = btn.dataset.sessionId;

      console.log('[Session Settings] Opening for session:', sessionId);
      await showColorChangeModal(sessionId);
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

// ============= Auto-Restore UI (Enterprise) =============

/**
 * Initialize auto-restore UI (call in refreshSessions)
 */
async function updateAutoRestoreUI() {
  const section = $('#autoRestoreSection');
  if (!section) return;

  try {
    const response = await sendMessage({ action: 'getLicenseStatus' });
    const tier = response?.licenseData?.tier || 'free';

    console.log('[Auto-Restore UI] Tier detected:', tier);

    if (tier === 'enterprise') {
      section.style.display = 'block';

      // Load saved preference
      const prefs = await sendMessage({ action: 'getAutoRestorePreference' });
      const toggle = $('#autoRestoreToggle');
      if (toggle) {
        toggle.checked = prefs?.enabled || false;
        console.log('[Auto-Restore UI] Toggle state:', toggle.checked);

        // Show/hide notice based on preference
        const notice = $('#autoRestoreNotice');
        const dontShowAgain = prefs?.dontShowNotice || false;
        if (notice) {
          notice.style.display = (toggle.checked && !dontShowAgain) ? 'flex' : 'none';
          console.log('[Auto-Restore UI] Notice display:', notice.style.display);
        }
      }
    } else {
      section.style.display = 'none';
      console.log('[Auto-Restore UI] Section hidden (not Enterprise tier)');
    }
  } catch (error) {
    console.error('[Auto-Restore UI] Error updating UI:', error);
    section.style.display = 'none';
  }
}

/**
 * Attach auto-restore event listeners
 */
function attachAutoRestoreListeners() {
  const toggle = $('#autoRestoreToggle');
  if (toggle) {
    toggle.addEventListener('change', async (e) => {
      const enabled = e.target.checked;

      console.log('[Auto-Restore] Toggle changed:', enabled);

      await sendMessage({
        action: 'setAutoRestorePreference',
        enabled: enabled
      });

      // Show/hide notice
      const prefs = await sendMessage({ action: 'getAutoRestorePreference' });
      const notice = $('#autoRestoreNotice');
      const dontShowAgain = prefs?.dontShowNotice || false;

      if (notice) {
        notice.style.display = (enabled && !dontShowAgain) ? 'flex' : 'none';
        console.log('[Auto-Restore] Notice updated, display:', notice.style.display);
      }
    });
  }

  const openSettings = $('#openEdgeSettings');
  if (openSettings) {
    openSettings.addEventListener('click', () => {
      console.log('[Auto-Restore] Opening Edge settings');
      chrome.tabs.create({ url: 'edge://settings/onStartup' });
    });
  }

  const dontShowAgain = $('#dontShowAgain');
  if (dontShowAgain) {
    dontShowAgain.addEventListener('click', async () => {
      console.log('[Auto-Restore] "Don\'t show again" clicked');

      await sendMessage({
        action: 'setAutoRestorePreference',
        dontShowNotice: true
      });

      const notice = $('#autoRestoreNotice');
      if (notice) {
        notice.style.display = 'none';
        console.log('[Auto-Restore] Notice hidden permanently');
      }
    });
  }
}

// ============= Event Listeners =============

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  // Load initial data
  await refreshSessions();
  await refreshLicenseStatus();
  await initializeColorSelection(); // Initialize color picker
  await updateAutoRestoreUI(); // Initialize auto-restore UI
  attachAutoRestoreListeners(); // Attach auto-restore event listeners

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
