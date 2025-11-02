/**
 * Popup Script - Multi-Session Manager
 * Simple UI for creating and managing isolated sessions
 */

// ============= Utilities =============

const $ = (selector) => document.querySelector(selector);

/**
 * Update popup height dynamically based on content and browser constraints
 *
 * IMPORTANT: Browser extension popups have hardcoded maximum dimensions:
 * - Chrome/Edge: max-width: 800px, max-height: 600px (cannot be overridden)
 * - These limits are enforced at the browser level, not CSS
 *
 * This function optimizes height within the 600px constraint for best UX
 */
function updatePopupHeight() {
  requestAnimationFrame(() => {
    // Browser-enforced maximum (Chrome/Edge hardcoded limit)
    const BROWSER_MAX_HEIGHT = 600;
    const minHeight = 400;

    // Get content height
    const contentHeight = document.body.scrollHeight;

    // Calculate optimal height within browser constraints
    const optimalHeight = Math.min(contentHeight, BROWSER_MAX_HEIGHT);
    const finalHeight = Math.max(optimalHeight, minHeight);

    // Apply height (will be capped at 600px by browser anyway)
    document.body.style.height = finalHeight + 'px';
    document.body.style.maxHeight = BROWSER_MAX_HEIGHT + 'px';

    console.log('[Popup] Browser max height:', BROWSER_MAX_HEIGHT + 'px',
                '| Content height:', contentHeight + 'px',
                '| Final height:', finalHeight + 'px',
                '| Scrollable:', contentHeight > BROWSER_MAX_HEIGHT);
  });
}

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

/** Get extension version from manifest and display in footer */
document.addEventListener('DOMContentLoaded', () => {
  const versionEl = document.getElementById('version');
  if (!versionEl) {
    console.error('Version element not found');
    return;
  }

  try {
    const manifest = chrome.runtime.getManifest();
    versionEl.textContent = `Version ${manifest.version}`;
  } catch (error) {
    console.error('Failed to get manifest version:', error);
    versionEl.textContent = 'Version —';
  }
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
 * Extract domain from URL
 * @param {string} url - URL to extract domain from
 * @returns {string} Domain name or fallback text
 */
function extractDomain(url) {
  if (!url || url === 'about:blank') return 'No domain';
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    return 'Invalid URL';
  }
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
let showingAllColors = false; // Track if all colors are visible (enterprise only)

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

  // For Enterprise tier: split colors into visible and hidden sections
  // #E91E63 is at index 13 (14th color) - show colors BEFORE this index initially
  const isEnterprise = currentColorTier === 'enterprise';
  const splitIndex = 13; // Show colors 0-12, hide 13-34

  let visibleColors = colors;
  let hiddenColors = [];

  if (isEnterprise && !showingAllColors) {
    visibleColors = colors.slice(0, splitIndex);
    hiddenColors = colors.slice(splitIndex);
  }

  // Add visible color swatches
  visibleColors.forEach(color => {
    html += `
      <div class="color-swatch ${selectedColor === color ? 'selected' : ''}"
           data-color="${color}"
           style="background-color: ${color};"
           title="${color}">
      </div>
    `;
  });

  // Add hidden color swatches (initially hidden via CSS class)
  if (isEnterprise && !showingAllColors && hiddenColors.length > 0) {
    hiddenColors.forEach(color => {
      html += `
        <div class="color-swatch hidden-color ${selectedColor === color ? 'selected' : ''}"
             data-color="${color}"
             style="background-color: ${color}; display: none;"
             title="${color}">
        </div>
      `;
    });
  }

  html += '</div>'; // Close color-swatches

  // Add "Load More Colors" button for Enterprise tier (only when not showing all)
  if (isEnterprise && !showingAllColors && hiddenColors.length > 0) {
    html += `
      <button id="loadMoreColorsBtn" class="load-more-colors-btn">
        Load More Colors (${hiddenColors.length} more)
      </button>
    `;
  }

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

  // Load More Colors button (Enterprise only)
  const loadMoreBtn = $('#loadMoreColorsBtn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', () => {
      console.log('[Color Selection] Load More Colors clicked');

      // Show all hidden colors with smooth transition
      const hiddenSwatches = document.querySelectorAll('.color-swatch.hidden-color');
      hiddenSwatches.forEach((swatch, index) => {
        // Stagger the animation slightly for better visual effect
        setTimeout(() => {
          swatch.style.display = '';
          swatch.classList.remove('hidden-color');
          // Trigger reflow for animation
          swatch.offsetHeight;
          swatch.style.animation = 'fadeIn 0.3s ease-in';
        }, index * 20);
      });

      // Update state
      showingAllColors = true;

      // Hide the "Load More" button
      loadMoreBtn.style.display = 'none';

      console.log('[Color Selection] All colors now visible');
    });
  }

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

  // Fetch current session name
  const nameResponse = await sendMessage({
    action: 'getSessionName',
    sessionId: sessionId
  });
  const currentSessionName = nameResponse?.name || '';

  // Create modal HTML
  let modalHTML = `
    <div class="color-modal-overlay" id="colorModalOverlay">
      <div class="color-modal">
        <div class="color-modal-header">
          <h3>Session Settings</h3>
          <button class="color-modal-close" id="colorModalClose">&times;</button>
        </div>
        <div class="color-modal-body">
          <!-- Session Name Section -->
          <div class="session-name-modal-section">
            <label for="modalSessionNameInput">Session Name:</label>
            <div class="session-name-modal-input-wrapper">
              <input
                type="text"
                id="modalSessionNameInput"
                placeholder="e.g., Work Gmail"
                maxlength="50"
                value="${escapeHtml(currentSessionName)}"
              />
              <span class="session-name-counter session-name-counter-normal" id="modalSessionNameCounter">
                0/50 characters
              </span>
            </div>
            <div id="modalSessionNameError" class="session-name-error" style="display: none;"></div>
          </div>

          <!-- Divider -->
          <div class="modal-section-divider"></div>

          <!-- Session Color Section -->
          <div class="session-color-modal-section">
            <label>Session Color:</label>
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
        </div>
        <div class="color-modal-footer">
          <button id="colorModalCancel" class="btn-secondary">Cancel</button>
          <button id="colorModalApply" class="btn-primary">Apply Settings</button>
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

  // Initialize character counter
  const nameInput = $('#modalSessionNameInput');
  const nameCounter = $('#modalSessionNameCounter');
  const updateCharCounter = () => {
    const value = nameInput.value;
    const length = [...value].length; // Emoji-aware length

    nameCounter.textContent = `${length}/50 characters`;

    // Update color classes based on length
    nameCounter.className = 'session-name-counter';
    if (length < 40) {
      nameCounter.classList.add('session-name-counter-normal');
    } else if (length < 45) {
      nameCounter.classList.add('session-name-counter-warning');
    } else {
      nameCounter.classList.add('session-name-counter-danger');
    }
  };

  // Initialize counter on load
  updateCharCounter();

  // Session name input handler
  nameInput.addEventListener('input', (e) => {
    updateCharCounter();

    // Clear error on input
    const errorDiv = $('#modalSessionNameError');
    errorDiv.style.display = 'none';
  });

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

  // Apply settings (name + color)
  $('#colorModalApply').addEventListener('click', async () => {
    const newName = nameInput.value.trim();
    const newColor = selectedModalColor;
    const errorDiv = $('#modalSessionNameError');

    // Clear previous errors
    errorDiv.style.display = 'none';

    // Track if any changes were made
    let changesMade = false;

    try {
      // Save session name if changed
      if (newName !== currentSessionName) {
        // Validate and save name (empty name clears custom name)
        const nameValidation = await sendMessage({
          action: 'setSessionName',
          sessionId: sessionId,
          name: newName
        });

        if (!nameValidation.success) {
          // Show validation error
          errorDiv.textContent = nameValidation.message;
          errorDiv.style.display = 'block';
          return; // Don't proceed if name validation fails
        }

        console.log('[Session Settings] Name saved:', newName || '(cleared)');
        changesMade = true;
      }

      // Save color if changed
      if (newColor) {
        const colorResponse = await sendMessage({
          action: 'setSessionColor',
          sessionId: sessionId,
          color: newColor
        });

        if (colorResponse && colorResponse.success) {
          console.log('[Session Settings] Color saved:', newColor);
          changesMade = true;
        } else {
          alert('Failed to change color: ' + (colorResponse?.error || 'Unknown error'));
          return;
        }
      }

      // Close modal and refresh if changes were made
      if (changesMade) {
        closeModal();
        await refreshSessions(); // Refresh to show new name/color
      } else {
        // No changes made, just close
        closeModal();
      }

    } catch (error) {
      console.error('[Session Settings] Error:', error);
      alert('Error saving settings: ' + error.message);
    }
  });
}

// ============= Session Management =============

/**
 * Get current tier from license status
 * @returns {Promise<string>} Tier ('free', 'premium', 'enterprise')
 */
async function getTier() {
  try {
    const response = await sendMessage({ action: 'getLicenseStatus' });
    return response?.licenseData?.tier || 'free';
  } catch (error) {
    console.error('[getTier] Error:', error);
    return 'free';
  }
}

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
 * Show upgrade prompt for Free tier users
 */
function showUpgradePrompt() {
  const message = 'Session naming is a Premium/Enterprise feature.\n\n' +
                  'Click "View License" to upgrade for unlimited sessions and custom names.';

  if (confirm(message)) {
    // Open license page
    window.location.href = 'popup-license.html';
  }
}

/**
 * Show validation error inline
 * @param {HTMLElement} container - Container to show error in
 * @param {string} message - Error message
 */
function showValidationError(container, message) {
  // Remove existing error if present
  const existingError = container.querySelector('.session-name-error');
  if (existingError) {
    existingError.remove();
  }

  // Create error element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'session-name-error';
  // Removed inline styles - let CSS handle styling for proper dark mode support
  errorDiv.textContent = message;

  // Insert error at the END of the column container (below the input wrapper)
  // The container has flex-direction: column, so this will stack vertically
  container.appendChild(errorDiv);

  console.log('[Session Name] Validation error:', message);
}

/**
 * Create edit input for session name
 * @param {string} currentName - Current session name or ID
 * @param {string} sessionId - Session ID
 * @returns {HTMLElement} Input element
 */
function createEditInput(currentName, sessionId) {
  const container = document.createElement('div');
  container.className = 'session-name-edit-container';
  container.style.cssText = 'display: flex; flex-direction: column; gap: 4px; flex: 1;';

  const inputWrapper = document.createElement('div');
  inputWrapper.style.cssText = 'display: flex; gap: 4px; align-items: center;';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-name-input';
  input.value = currentName.startsWith('session_') ? '' : currentName; // Clear if it's an ID
  input.maxLength = 50;
  input.placeholder = 'Enter session name...';
  input.style.cssText = 'flex: 1; padding: 6px 8px; border: 2px solid #667eea; border-radius: 4px; font-size: 13px; font-family: inherit; outline: none;';
  input.dataset.sessionId = sessionId;

  // Character counter
  const counter = document.createElement('span');
  counter.className = 'session-name-counter session-name-counter-normal';
  counter.textContent = `${input.value.length}/50`;

  inputWrapper.appendChild(input);
  inputWrapper.appendChild(counter);
  container.appendChild(inputWrapper);

  // Update counter on input
  input.addEventListener('input', () => {
    const length = [...input.value].length; // Emoji-aware length
    counter.textContent = `${length}/50`;

    // Change color if approaching limit using CSS classes
    counter.className = 'session-name-counter';
    if (length >= 45) {
      counter.classList.add('session-name-counter-danger');
    } else if (length >= 40) {
      counter.classList.add('session-name-counter-warning');
    } else {
      counter.classList.add('session-name-counter-normal');
    }

    // Clear validation error on input (user is correcting the error)
    const existingError = container.querySelector('.session-name-error');
    if (existingError) {
      existingError.remove();
      console.log('[Session Name] Validation error cleared on input');
    }
  });

  return container;
}

/**
 * Save session name
 * @param {string} sessionId - Session ID
 * @param {string} name - New session name
 * @returns {Promise<boolean>} Success status
 */
async function saveSessionName(sessionId, name) {
  try {
    console.log('[Session Name] Saving:', sessionId, name);

    const response = await sendMessage({
      action: 'setSessionName',
      sessionId: sessionId,
      name: name.trim()
    });

    if (!response || !response.success) {
      console.error('[Session Name] Save failed:', response?.message);
      return { success: false, message: response?.message || 'Failed to save session name' };
    }

    console.log('[Session Name] Save successful');
    return { success: true };
  } catch (error) {
    console.error('[Session Name] Error saving:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Enter edit mode for session name
 * @param {string} sessionId - Session ID
 * @param {HTMLElement} nameElement - Session name element
 * @param {string} currentName - Current session name or ID
 */
async function enterEditMode(sessionId, nameElement, currentName) {
  // Check tier
  const tier = await getTier();

  if (tier === 'free') {
    showUpgradePrompt();
    return;
  }

  console.log('[Session Name] Entering edit mode for:', sessionId);

  // Create input
  const editContainer = createEditInput(currentName, sessionId);
  const input = editContainer.querySelector('.session-name-input');

  // Replace name element with input
  const parentContainer = nameElement.closest('.session-name-container');
  if (!parentContainer) {
    console.error('[Session Name] Parent container not found');
    return;
  }

  // Store original for cancel
  const originalHTML = parentContainer.innerHTML;

  // Replace content
  parentContainer.innerHTML = '';
  parentContainer.appendChild(editContainer);

  // Focus and select
  input.focus();
  input.select();

  // Cancel edit mode
  const cancelEdit = () => {
    console.log('[Session Name] Canceling edit mode');
    parentContainer.innerHTML = originalHTML;
    // Re-attach double-click listener
    const newNameElement = parentContainer.querySelector('.session-name');
    if (newNameElement) {
      attachSessionNameListener(newNameElement, sessionId, currentName);
    }
  };

  // Save on Enter
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newName = input.value.trim();

      if (newName === '') {
        // Empty name - treat as cancel
        cancelEdit();
        return;
      }

      // Show loading state
      input.disabled = true;
      input.style.opacity = '0.5';

      const result = await saveSessionName(sessionId, newName);

      if (result.success) {
        // Refresh sessions to show new name
        await refreshSessions();
      } else {
        // Show error inline
        input.disabled = false;
        input.style.opacity = '1';
        showValidationError(editContainer, result.message);
        input.focus();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelEdit();
    }
  });

  // Save on blur (after a short delay to allow clicking buttons)
  input.addEventListener('blur', async () => {
    setTimeout(async () => {
      const newName = input.value.trim();

      // Only save if input still exists and has a value
      if (document.contains(input) && newName !== '') {
        const result = await saveSessionName(sessionId, newName);
        if (result.success) {
          await refreshSessions();
        } else {
          // Re-focus to show error
          input.focus();
          showValidationError(editContainer, result.message);
        }
      } else if (document.contains(input)) {
        // Empty name - cancel
        cancelEdit();
      }
    }, 150);
  });
}

/**
 * Attach double-click listener to session name element
 * @param {HTMLElement} element - Session name element
 * @param {string} sessionId - Session ID
 * @param {string} currentName - Current session name
 */
function attachSessionNameListener(element, sessionId, currentName) {
  element.addEventListener('dblclick', async (e) => {
    e.stopPropagation();
    e.preventDefault();
    await enterEditMode(sessionId, element, currentName);
  });
}

/**
 * Refresh the list of active sessions and dormant sessions
 */
async function refreshSessions() {
  try {
    console.log('Refreshing sessions...');
    const response = await sendMessage({ action: 'getAllSessions' });

    if (!response || !response.success) {
      console.error('Failed to get sessions:', response);
      $('#sessionsList').innerHTML = '<div class="empty-state"><div class="empty-state-text">Error loading sessions</div></div>';
      return;
    }

    const activeSessions = response.activeSessions || [];
    const dormantSessions = response.dormantSessions || [];
    console.log('Active sessions:', activeSessions);
    console.log('Dormant sessions:', dormantSessions);

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
      activeCount: statusResponse.activeCount ?? activeSessions.length,
      limit: statusResponse.limit ?? 3,
      tier: statusResponse.tier || 'free',
      canCreateNew: statusResponse.canCreateNew ?? (activeSessions.length < 3)
    } : {
      activeCount: activeSessions.length,
      limit: 3,
      tier: 'free',
      canCreateNew: activeSessions.length < 3
    };

    // Update session count with limit info
    // Use activeCount from status for accurate count (matches backend logic)
    // ONLY count active sessions (not dormant)
    const count = status.activeCount;
    const limitDisplay = formatSessionLimit(status.limit);
    $('#sessionCount').textContent = `${count} / ${limitDisplay} sessions`;

    // Verify consistency between popup sessions and backend active count
    if (activeSessions.length !== count) {
      console.warn('[Popup] Session count mismatch: popup shows', activeSessions.length, 'sessions but backend reports', count, 'active sessions');
    }

    // Update button state based on limits
    updateSessionButtonState(status);

    // Check for expiring sessions (free tier only, approaching 7-day limit)
    if (status.tier === 'free' && activeSessions.length > 0) {
      const expiringSoon = activeSessions.filter(session => {
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

    if (activeSessions.length === 0 && dormantSessions.length === 0) {
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

    // Active Sessions Section
    if (activeSessions.length > 0) {
      html += '<div class="sessions-section-title">Active Sessions</div>';
    }

    activeSessions.forEach(session => {
      const sessionId = escapeHtml(session.sessionId);
      const sessionColor = session.color || '#999';
      const tabs = session.tabs || [];

      // Get session metadata for lastAccessed and name
      const metadata = sessionMetadata[session.sessionId] || {};
      const lastAccessed = metadata.lastAccessed || metadata.createdAt || Date.now();
      const lastAccessedText = formatTimeAgo(lastAccessed);
      const sessionName = metadata.name || ''; // Get session name from metadata

      // Display name: custom name or fallback to session ID
      const displayName = sessionName || sessionId;
      const isEditable = status.tier !== 'free';

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

            ${status.tier === 'premium' || status.tier === 'enterprise' ? `
              <button class="session-export-icon"
                      data-export-session="${sessionId}"
                      title="Export session (${status.tier === 'premium' ? 'Premium' : 'Enterprise'} feature)"
                      aria-label="Export session">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              </button>
            ` : ''}

            <div class="session-info-wrapper">
              <div class="session-name-container" data-session-id="${sessionId}">
                <span class="session-name ${isEditable ? 'editable' : ''}"
                      style="cursor: ${isEditable ? 'pointer' : 'default'};"
                      title="${isEditable ? 'Double-click to edit session name' : 'Upgrade to Premium/Enterprise to edit session name'}">
                  ${truncate(displayName, 30)}
                </span>
                ${status.tier === 'free' ? '<span class="session-name-pro-badge">PRO</span>' : ''}
              </div>
              <div class="session-timestamp">
                Last used: ${lastAccessedText}${expiresText}
              </div>
            </div>
          </div>
          <div class="tab-list">
      `;

      tabs.forEach(tab => {
        const tabTitle = escapeHtml(tab.title || 'Untitled');
        const tabDomain = escapeHtml(tab.domain || 'No domain');
        const tabId = tab.tabId;
        const favIconUrl = tab.favIconUrl || '';

        // Add session name prefix to tab title if name exists
        const displayTabTitle = sessionName
          ? `[${escapeHtml(sessionName)}] ${tabTitle}`
          : tabTitle;

        html += `
          <div class="tab-item" data-tab-id="${tabId}">
            <div class="tab-favicon">
              ${favIconUrl ? `<img src="${escapeHtml(favIconUrl)}" alt="" onerror="this.style.display='none'">` : '📄'}
            </div>
            <div class="tab-info">
              <div class="tab-title">${truncate(displayTabTitle, 50)}</div>
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

    // Dormant Sessions Section
    if (dormantSessions.length > 0) {
      html += '<div class="sessions-section-title dormant-title">Imported Sessions</div>';
      html += '<div class="dormant-section">';

      dormantSessions.forEach(session => {
        html += buildDormantSessionHTML(session, sessionMetadata, status.tier);
      });

      html += '</div>';
    }

    $('#sessionsList').innerHTML = html;

    // Attach event listeners to tab items, session settings, session names, and export
    attachTabListeners();
    attachSessionSettingsListeners();
    attachSessionNameListeners(activeSessions, sessionMetadata);
    attachExportListeners();
    attachDormantSessionListeners();

    // Update auto-restore UI after sessions are rendered
    await updateAutoRestoreUI();

    // Show/hide bulk export button (Enterprise only)
    const bulkExportContainer = $('#bulkExportContainer');
    if (bulkExportContainer) {
      if (status.tier === 'enterprise' && activeSessions.length > 0) {
        bulkExportContainer.style.display = 'block';
      } else {
        bulkExportContainer.style.display = 'none';
      }
    }

  } catch (error) {
    console.error('Error refreshing sessions:', error);
    $('#sessionsList').innerHTML = '<div class="empty-state"><div class="empty-state-text">Error loading sessions</div></div>';
  }
}

/**
 * Build HTML for a dormant session (session without tabs)
 * @param {Object} session - Dormant session object
 * @param {Object} sessionMetadata - Session metadata from storage
 * @param {string} tier - User's license tier
 * @returns {string} HTML string
 */
function buildDormantSessionHTML(session, sessionMetadata, tier) {
  const sessionId = escapeHtml(session.sessionId);
  const sessionColor = session.customColor || session.color || '#999';

  // Get session metadata for lastAccessed and name
  const metadata = sessionMetadata[session.sessionId] || {};
  const lastAccessed = metadata.lastAccessed || metadata.createdAt || Date.now();
  const lastAccessedText = formatTimeAgo(lastAccessed);
  const sessionName = metadata.name || '';

  // Display name: custom name or fallback to session ID
  const displayName = sessionName || sessionId;

  // Calculate days remaining for free tier
  const daysRemaining = calculateDaysRemaining(lastAccessed, tier);
  const expiresText = daysRemaining !== null
    ? ` <span style="color: ${daysRemaining <= 2 ? '#f5576c' : '#999'};">(expires in ${daysRemaining}d)</span>`
    : ' <span style="color: #4ECDC4;">(permanent)</span>';

  // Build persisted tab info (similar to active session tabs)
  let persistedTabHTML = '';
  if (session.persistedTabs && session.persistedTabs.length > 0) {
    const tab = session.persistedTabs[0];
    const domain = extractDomain(tab.url);
    const title = escapeHtml(tab.title || domain || 'Untitled');
    const displayTitle = sessionName
      ? `[${escapeHtml(sessionName)}] ${title}`
      : title;

    persistedTabHTML = `
      <div class="tab-item">
        <div class="tab-favicon">📄</div>
        <div class="tab-info">
          <div class="tab-title">${truncate(displayTitle, 50)}</div>
          <div class="tab-domain">${truncate(escapeHtml(domain), 40)}</div>
        </div>
        <div class="tab-actions">
          <button class="open-dormant-session-btn" data-session-id="${sessionId}">Open Session</button>
        </div>
      </div>
    `;
  } else {
    persistedTabHTML = `
      <div class="tab-item">
        <div class="tab-favicon">📄</div>
        <div class="tab-info">
          <div class="tab-title">No saved page</div>
          <div class="tab-domain">about:blank</div>
        </div>
        <div class="tab-actions">
          <button class="open-dormant-session-btn" data-session-id="${sessionId}">Open Session</button>
        </div>
      </div>
    `;
  }

  return `
    <div class="dormant-session-card">
      <div class="dormant-session-header">
        <div class="session-color-dot" style="background-color: ${sessionColor}"></div>
        <div class="dormant-session-info">
          <div class="dormant-session-name">${truncate(displayName, 35)}</div>
          <div class="dormant-session-timestamp">
            Last used: ${lastAccessedText}${expiresText}
          </div>
        </div>
      </div>
      <div class="tab-list">
        ${persistedTabHTML}
      </div>
    </div>
  `;
}

/**
 * Attach event listeners to dormant session "Open Session" buttons
 */
function attachDormantSessionListeners() {
  document.querySelectorAll('.open-dormant-session-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const sessionId = btn.dataset.sessionId;

      console.log('[Dormant Session] Opening session:', sessionId);

      // Disable button and show loading state
      btn.disabled = true;
      btn.textContent = 'Opening...';

      try {
        const response = await sendMessage({
          action: 'openDormantSession',
          sessionId: sessionId
          // url parameter omitted - allows persistedTabs extraction in background.js
        });

        if (response && response.success) {
          console.log('[Dormant Session] Successfully opened session:', sessionId);
          // Refresh sessions to show updated state
          await refreshSessions();
        } else {
          console.error('[Dormant Session] Failed to open session:', response?.error);
          alert('Failed to open session: ' + (response?.error || 'Unknown error'));
          // Re-enable button
          btn.disabled = false;
          btn.textContent = 'Open Session';
        }
      } catch (error) {
        console.error('[Dormant Session] Error opening session:', error);
        alert('Error opening session: ' + error.message);
        // Re-enable button
        btn.disabled = false;
        btn.textContent = 'Open Session';
      }
    });
  });
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

/**
 * Attach event listeners to session name elements for inline editing
 * @param {Array} sessions - Array of session objects
 * @param {Object} sessionMetadata - Session metadata from storage
 */
function attachSessionNameListeners(sessions, sessionMetadata) {
  document.querySelectorAll('.session-name').forEach(nameElement => {
    const container = nameElement.closest('.session-name-container');
    if (!container) return;

    const sessionId = container.dataset.sessionId;
    const metadata = sessionMetadata[sessionId] || {};
    const currentName = metadata.name || sessionId;

    // Attach double-click listener
    attachSessionNameListener(nameElement, sessionId, currentName);
  });
}

/**
 * Attach event listeners to export icons
 */
function attachExportListeners() {
  document.querySelectorAll('.session-export-icon').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const sessionId = btn.dataset.exportSession;

      console.log('[Export] Export button clicked for session:', sessionId);
      await handleSessionExport(sessionId);
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

// ============= Initialization State Management =============

/**
 * Update loading UI based on initialization state
 * @param {string} state - Initialization state
 * @param {Object} data - Additional state data
 */
function updateLoadingUI(state, data = {}) {
  const overlay = $('#loadingOverlay');
  const subtext = $('#loadingSubtext');

  if (!overlay || !subtext) return;

  const stateMessages = {
    LOADING: 'Starting up...',
    LICENSE_INIT: 'Initializing license system...',
    LICENSE_READY: 'License ready',
    AUTO_RESTORE_CHECK: 'Checking auto-restore settings...',
    SESSION_LOAD: 'Loading sessions...',
    CLEANUP: 'Running cleanup...',
    READY: 'Ready',
    ERROR: 'Initialization error'
  };

  subtext.textContent = stateMessages[state] || 'Initializing...';

  if (state === 'READY') {
    // Hide loading overlay
    overlay.style.display = 'none';
    console.log('[Popup] Initialization complete, showing UI');
  } else if (state === 'ERROR') {
    // Show error in overlay
    subtext.textContent = 'Error: ' + (data.error || 'Unknown error');
    subtext.style.color = '#ff6b6b';
  } else {
    // Show loading overlay
    overlay.style.display = 'flex';
  }
}

/**
 * Wait for initialization to complete
 */
async function waitForInitialization() {
  console.log('[Popup] Waiting for extension initialization...');

  const overlay = $('#loadingOverlay');
  if (overlay) {
    overlay.style.display = 'flex';
  }

  try {
    // Check initialization state
    const stateResponse = await sendMessage({ action: 'getInitializationState' });

    if (stateResponse && stateResponse.success) {
      console.log('[Popup] Current state:', stateResponse.state);

      if (stateResponse.isReady) {
        console.log('[Popup] Extension already ready');
        updateLoadingUI('READY');
        return true;
      }

      if (stateResponse.state === 'ERROR') {
        console.error('[Popup] Initialization error:', stateResponse.error);
        updateLoadingUI('ERROR', { error: stateResponse.error });
        return false;
      }

      // Update UI with current state
      updateLoadingUI(stateResponse.state);
    }

    // Wait for READY state (max 30 seconds)
    const timeout = 30000;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        const elapsed = Date.now() - startTime;

        if (elapsed > timeout) {
          console.error('[Popup] Initialization timeout');
          clearInterval(checkInterval);
          updateLoadingUI('ERROR', { error: 'Initialization timeout' });
          resolve(false);
          return;
        }

        const stateResponse = await sendMessage({ action: 'getInitializationState' });

        if (stateResponse && stateResponse.success) {
          if (stateResponse.isReady) {
            console.log('[Popup] Extension ready');
            clearInterval(checkInterval);
            updateLoadingUI('READY');
            resolve(true);
          } else if (stateResponse.state === 'ERROR') {
            console.error('[Popup] Initialization error:', stateResponse.error);
            clearInterval(checkInterval);
            updateLoadingUI('ERROR', { error: stateResponse.error });
            resolve(false);
          } else {
            // Update UI with current state
            updateLoadingUI(stateResponse.state, stateResponse.data);
          }
        }
      }, 100); // Check every 100ms
    });
  } catch (error) {
    console.error('[Popup] Error waiting for initialization:', error);
    updateLoadingUI('ERROR', { error: error.message });
    return false;
  }
}

// ============= Session Export/Import (v3.2.0) =============

/**
 * Download file to user's downloads folder
 * @param {string} filename - Filename
 * @param {string} content - File content
 */
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  chrome.downloads.download({
    url: url,
    filename: filename,
    saveAs: true
  }, (downloadId) => {
    if (chrome.runtime.lastError) {
      console.error('[Export] Download error:', chrome.runtime.lastError);
      alert('Export failed: ' + chrome.runtime.lastError.message);
    } else {
      console.log('[Export] ✓ Download started, ID:', downloadId);
      // Revoke object URL after download starts
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  });
}

/**
 * Handle session export (Premium/Enterprise only)
 * @param {string} sessionId - Session ID to export
 */
async function handleSessionExport(sessionId) {
  console.log('[Export] Export requested for session:', sessionId);

  try {
    // Check tier first
    const tier = await getTier();

    if (tier === 'free') {
      if (confirm('Session export requires Premium or Enterprise tier.\n\nClick "View License" to upgrade?')) {
        window.location.href = 'popup-license.html';
      }
      return;
    }

    // Show progress
    const exportBtn = document.querySelector(`[data-export-session="${sessionId}"]`);
    const originalHTML = exportBtn ? exportBtn.innerHTML : '';
    if (exportBtn) {
      exportBtn.innerHTML = '⏳';
      exportBtn.disabled = true;
    }

    // For Enterprise: Ask if user wants encryption
    let encrypt = false;
    let password = null;

    if (tier === 'enterprise') {
      encrypt = confirm('Encrypt export file with password?\n\n(Enterprise feature - protects session data)');

      if (encrypt) {
        password = prompt('Enter encryption password (minimum 8 characters):');
        if (!password) {
          if (exportBtn) {
            exportBtn.innerHTML = originalHTML;
            exportBtn.disabled = false;
          }
          return;
        }
        if (password.length < 8) {
          alert('Password must be at least 8 characters');
          if (exportBtn) {
            exportBtn.innerHTML = originalHTML;
            exportBtn.disabled = false;
          }
          return;
        }
      }
    }

    // Export session
    const response = await sendMessage({
      action: 'exportSession',
      sessionId: sessionId,
      options: {
        encrypt: encrypt,
        password: password
      }
    });

    if (exportBtn) {
      exportBtn.innerHTML = originalHTML;
      exportBtn.disabled = false;
    }

    if (response && response.success) {
      console.log('[Export] ✓ Export successful');

      // Download file
      downloadFile(response.filename, response.data);

      // Show success message
      const sizeKB = (response.size / 1024).toFixed(2);
      const compressed = response.compressed ? ' (compressed)' : '';
      const encrypted = response.encrypted ? ' (encrypted)' : '';

      alert(`✓ Session exported successfully!\n\nFilename: ${response.filename}\nSize: ${sizeKB} KB${compressed}${encrypted}`);
    } else if (response && response.requiresUpgrade) {
      if (confirm(response.message + '\n\nClick "View License" to upgrade?')) {
        window.location.href = 'popup-license.html';
      }
    } else {
      console.error('[Export] Export failed:', response);
      alert('Export failed: ' + (response?.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('[Export] Error:', error);
    alert('Export failed: ' + error.message);
  }
}

/**
 * Handle bulk export of all sessions (Enterprise only)
 */
async function handleBulkExport() {
  console.log('[Export] Bulk export requested');

  try {
    const tier = await getTier();

    if (tier !== 'enterprise') {
      if (confirm('Bulk export requires Enterprise tier.\n\nClick "View License" to upgrade?')) {
        window.location.href = 'popup-license.html';
      }
      return;
    }

    // Ask if user wants encryption
    const encrypt = confirm('Encrypt export file with password?\n\n(Recommended for protecting session data)');

    let password = null;
    if (encrypt) {
      password = prompt('Enter encryption password (minimum 8 characters):');
      if (!password) return;
      if (password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
      }
    }

    // Show progress
    const exportBtn = $('#exportAllSessionsBtn');
    const originalText = exportBtn ? exportBtn.textContent : '';
    if (exportBtn) {
      exportBtn.textContent = 'Exporting...';
      exportBtn.disabled = true;
    }

    // Export all sessions
    const response = await sendMessage({
      action: 'exportAllSessions',
      options: {
        encrypt: encrypt,
        password: password
      }
    });

    if (exportBtn) {
      exportBtn.textContent = originalText;
      exportBtn.disabled = false;
    }

    if (response && response.success) {
      console.log('[Export] ✓ Bulk export successful');

      // Download file
      downloadFile(response.filename, response.data);

      // Show success message
      const sizeKB = (response.size / 1024).toFixed(2);
      const compressed = response.compressed ? ' (compressed)' : '';
      const encrypted = response.encrypted ? ' (encrypted)' : '';

      alert(`✓ Bulk export successful!\n\nSessions: ${response.sessionCount}\nFilename: ${response.filename}\nSize: ${sizeKB} KB${compressed}${encrypted}`);
    } else {
      console.error('[Export] Bulk export failed:', response);
      alert('Bulk export failed: ' + (response?.message || 'Unknown error'));
    }
  } catch (error) {
    console.error('[Export] Error:', error);
    alert('Bulk export failed: ' + error.message);
  }
}

/**
 * Show import modal
 */
async function showImportModal() {
  console.log('[Import] Opening import modal');

  try {
    const tier = await getTier();

    if (tier === 'free') {
      if (confirm('Session import requires Premium or Enterprise tier.\n\nClick "View License" to upgrade?')) {
        window.location.href = 'popup-license.html';
      }
      return;
    }

    // Create modal HTML
    const modalHTML = `
      <div class="import-modal-overlay" id="importModalOverlay">
        <div class="import-modal">
          <div class="import-modal-header">
            <h3>Import Sessions</h3>
            <button class="import-modal-close" id="importModalClose">&times;</button>
          </div>
          <div class="import-modal-body">
            <div class="import-file-browser">
              <input type="file" id="importFileInput" accept=".json" style="display: none;">
              <div class="import-drop-zone" id="importDropZone">
                <div class="import-drop-icon">📁</div>
                <div class="import-drop-text">Drag & drop JSON file here</div>
                <div class="import-drop-subtext">or</div>
                <button class="btn-primary" id="importBrowseBtn">Browse Files</button>
              </div>
            </div>
            <div id="importProgress" class="import-progress" style="display: none;">
              <div class="import-progress-text">Processing file...</div>
              <div class="import-progress-bar">
                <div class="import-progress-fill"></div>
              </div>
            </div>
            <div id="importPassword" class="import-password-section" style="display: none;">
              <label for="importPasswordInput">This file is encrypted. Enter password:</label>
              <input type="password" id="importPasswordInput" placeholder="Enter password">
              <button class="btn-primary" id="importDecryptBtn">Decrypt & Import</button>
            </div>
            <div id="importResult" class="import-result" style="display: none;"></div>
          </div>
        </div>
      </div>
    `;

    // Inject modal
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHTML;
    document.body.appendChild(modalContainer.firstElementChild);

    // Attach event listeners
    const closeModal = () => {
      $('#importModalOverlay').remove();
    };

    $('#importModalClose').addEventListener('click', closeModal);
    $('#importModalOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'importModalOverlay') {
        closeModal();
      }
    });

    // File input
    const fileInput = $('#importFileInput');
    $('#importBrowseBtn').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await processImportFile(file);
      }
    });

    // Drag & drop
    const dropZone = $('#importDropZone');

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#1ea7e8';
      dropZone.style.backgroundColor = 'rgba(30, 167, 232, 0.1)';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#e0e0e0';
      dropZone.style.backgroundColor = 'transparent';
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '#e0e0e0';
      dropZone.style.backgroundColor = 'transparent';

      const file = e.dataTransfer.files[0];
      if (file) {
        await processImportFile(file);
      }
    });

  } catch (error) {
    console.error('[Import] Error showing modal:', error);
    alert('Error opening import modal: ' + error.message);
  }
}

/**
 * Process import file
 * @param {File} file - File to import
 */
async function processImportFile(file) {
  console.log('[Import] Processing file:', file.name, 'Size:', file.size);

  try {
    // Show progress
    $('#importDropZone').style.display = 'none';
    $('#importProgress').style.display = 'block';
    $('#importPassword').style.display = 'none';
    $('#importResult').style.display = 'none';

    // Read file
    const reader = new FileReader();
    reader.onload = async (e) => {
      const fileData = e.target.result;

      console.log('[Import] File read, size:', fileData.length, 'bytes');

      // Validate file
      const validation = await sendMessage({
        action: 'validateImport',
        fileData: fileData,
        password: null
      });

      $('#importProgress').style.display = 'none';

      if (validation && validation.requiresPassword) {
        // Show password input
        console.log('[Import] File requires password');
        $('#importPassword').style.display = 'block';

        $('#importDecryptBtn').onclick = async () => {
          const password = $('#importPasswordInput').value;
          if (!password) {
            alert('Please enter a password');
            return;
          }

          await performImport(fileData, password);
        };
      } else if (validation && validation.success) {
        // Show preview and confirm
        console.log('[Import] Validation successful');
        const conflicts = validation.conflicts || [];
        const conflictText = conflicts.length > 0
          ? `\n\n⚠️ ${conflicts.length} session name(s) will be renamed to avoid conflicts.`
          : '';

        const confirmed = confirm(
          `Ready to import ${validation.sessionCount} session(s)${conflictText}\n\nProceed with import?`
        );

        if (confirmed) {
          await performImport(fileData, null);
        } else {
          $('#importModalOverlay').remove();
        }
      } else {
        // Show error
        console.error('[Import] Validation failed:', validation);
        $('#importResult').style.display = 'block';
        $('#importResult').innerHTML = `<div class="import-error">❌ ${escapeHtml(validation?.message || 'Validation failed')}</div>`;
      }
    };

    reader.onerror = () => {
      $('#importProgress').style.display = 'none';
      $('#importResult').style.display = 'block';
      $('#importResult').innerHTML = '<div class="import-error">❌ Failed to read file</div>';
    };

    reader.readAsText(file);
  } catch (error) {
    console.error('[Import] Error processing file:', error);
    $('#importProgress').style.display = 'none';
    $('#importResult').style.display = 'block';
    $('#importResult').innerHTML = `<div class="import-error">❌ ${escapeHtml(error.message)}</div>`;
  }
}

/**
 * Perform import
 * @param {string} fileData - File content
 * @param {string|null} password - Decryption password
 */
async function performImport(fileData, password) {
  console.log('[Import] Performing import, password:', password ? 'provided' : 'none');

  try {
    $('#importProgress').style.display = 'block';
    $('#importPassword').style.display = 'none';
    $('#importResult').style.display = 'none';

    const response = await sendMessage({
      action: 'importSessions',
      fileData: fileData,
      options: {
        password: password
      }
    });

    $('#importProgress').style.display = 'none';

    if (response && response.success) {
      console.log('[Import] ✓ Import successful');

      const renamedText = response.renamedCount > 0
        ? `\n\n⚠️ ${response.renamedCount} session(s) renamed to avoid conflicts.`
        : '';

      $('#importResult').style.display = 'block';
      $('#importResult').innerHTML = `
        <div class="import-success">
          ✓ Import successful!<br>
          Imported: ${response.importedCount} session(s)${renamedText}
        </div>
      `;

      // Refresh sessions list
      setTimeout(async () => {
        await refreshSessions();
        $('#importModalOverlay').remove();
      }, 2000);

    } else {
      console.error('[Import] Import failed:', response);
      $('#importResult').style.display = 'block';
      $('#importResult').innerHTML = `<div class="import-error">❌ ${escapeHtml(response?.message || 'Import failed')}</div>`;
    }
  } catch (error) {
    console.error('[Import] Error:', error);
    $('#importProgress').style.display = 'none';
    $('#importResult').style.display = 'block';
    $('#importResult').innerHTML = `<div class="import-error">❌ ${escapeHtml(error.message)}</div>`;
  }
}

/**
 * Listen for initialization state changes from background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'initializationStateChanged') {
    console.log('[Popup] Initialization state changed:', message.state);
    updateLoadingUI(message.state, message.data);
  }
});

// ============= Event Listeners =============

document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');

  // Wait for initialization to complete
  const ready = await waitForInitialization();

  if (!ready) {
    console.error('[Popup] Extension not ready, some features may not work');
    // Still try to load UI, but with degraded functionality
  }

  // Load initial data
  await refreshSessions();
  await refreshLicenseStatus();
  await initializeColorSelection(); // Initialize color picker
  await updateAutoRestoreUI(); // Initialize auto-restore UI
  attachAutoRestoreListeners(); // Attach auto-restore event listeners

  // Update popup height after all content is loaded
  updatePopupHeight();

  // New Session button
  $('#newSessionBtn').addEventListener('click', async () => {
    await createNewSession();
  });

  // Import button
  $('#importSessionsBtn').addEventListener('click', async () => {
    await showImportModal();
  });

  // Bulk export button (will be shown/hidden based on tier)
  const bulkExportBtn = $('#exportAllSessionsBtn');
  if (bulkExportBtn) {
    bulkExportBtn.addEventListener('click', async () => {
      await handleBulkExport();
    });
  }

  // Refresh on tab activation (if popup is still open)
  chrome.tabs.onActivated.addListener(async () => {
    await refreshSessions();
    updatePopupHeight(); // Update height after refresh
  });

  // Refresh when tabs are updated
  chrome.tabs.onUpdated.addListener(async () => {
    await refreshSessions();
    updatePopupHeight(); // Update height after refresh
  });

  // Refresh when tabs are removed
  chrome.tabs.onRemoved.addListener(async () => {
    await refreshSessions();
    updatePopupHeight(); // Update height after refresh
  });
});

console.log('Popup script loaded');
