/**
 * License Management Popup UI
 * Handles license activation, validation, and display
 *
 * Error Handling Features:
 * - User-friendly error messages with automatic conversion from API errors
 * - Error code mapping for specific API error codes (60-65)
 * - HTML escaping for security (XSS prevention)
 * - Multi-line error message support with proper word wrapping
 * - Dark mode compatible error styling
 * - Detailed console logging for debugging
 *
 * Testing Scenarios:
 *
 * 1. Invalid/Inactive License Key (Error Code 60):
 *    - Enter an invalid or inactive license key
 *    - Expected: "This license key is not active. Please check your license status or contact support."
 *
 * 2. Expired License (Error Code 61):
 *    - Enter an expired license key
 *    - Expected: "This license has expired. Please renew your license."
 *
 * 3. Device Limit Reached (Error Code 62):
 *    - Enter a license that has reached device limit
 *    - Expected: "Device limit reached for this license. Please deactivate a device or upgrade your plan."
 *
 * 4. Network Error:
 *    - Disconnect internet and try to activate
 *    - Expected: "Unable to connect to license server. Please check your internet connection and try again."
 *
 * 5. Empty License Key:
 *    - Click activate with empty input
 *    - Expected: "Please enter a license key"
 *
 * 6. Long Error Messages:
 *    - Verify error messages wrap correctly and don't break layout
 *    - Test in both light and dark modes
 *
 * 7. Validation Errors:
 *    - Test validation failures with same error handling
 *    - Expected: User-friendly messages with proper error codes logged to console
 *
 * 8. Deactivation Errors:
 *    - Test deactivation failures (network errors, API errors)
 *    - Expected: Clear error messages with fallback to generic message
 */

'use strict';

// UI Elements
const loading = document.getElementById('loading');
const licenseActive = document.getElementById('license-active');
const licenseInactive = document.getElementById('license-inactive');

// Active License Elements
const tierBadge = document.getElementById('tier-badge');
const statusMessage = document.getElementById('status-message');
const licenseKeyDisplay = document.getElementById('license-key');
const deviceIdDisplay = document.getElementById('device-id');
const lastValidatedDisplay = document.getElementById('last-validated');
const daysUntilExpiryDisplay = document.getElementById('days-until-expiry');
const featuresList = document.getElementById('features-list');
const validateButton = document.getElementById('validate-button');
const deactivateButton = document.getElementById('deactivate-button');

// Inactive License Elements
const activationMessage = document.getElementById('activation-message');
const licenseKeyInput = document.getElementById('license-key-input');
const activateButton = document.getElementById('activate-button');

/**
 * Helper function to promisify chrome.runtime.sendMessage
 * CRITICAL: Manifest V2 doesn't support Promise-based chrome APIs natively
 *
 * @param {Object} message - Message to send to background script
 * @returns {Promise<any>} - Promise that resolves with response
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        // Check for runtime errors
        if (chrome.runtime.lastError) {
          console.error('[Popup License] Runtime error:', chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    } catch (error) {
      console.error('[Popup License] sendMessage error:', error);
      reject(error);
    }
  });
}

/**
 * Initialize popup
 */
async function init() {
  console.log('[Popup License] Initializing...');

  try {
    // Get license info from background
    const response = await sendMessage({ action: 'getLicenseInfo' });

    if (response && response.success) {
      displayLicenseInfo(response);
    } else {
      // No license or free tier - show inactive view
      loading.classList.add('hidden');
      licenseActive.classList.add('hidden');
      licenseInactive.classList.remove('hidden');
    }
  } catch (error) {
    console.error('[Popup License] Initialization error:', error);
    // Show inactive view on error
    loading.classList.add('hidden');
    licenseActive.classList.add('hidden');
    licenseInactive.classList.remove('hidden');
  }

  // Setup event listeners
  setupEventListeners();
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Activate license button
  activateButton.addEventListener('click', async () => {
    await handleActivation();
  });

  // Validate license button
  validateButton.addEventListener('click', async () => {
    await handleValidation();
  });

  // Deactivate license button
  deactivateButton.addEventListener('click', async () => {
    await handleDeactivation();
  });

  // Enter key in license input
  licenseKeyInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleActivation();
    }
  });
}

/**
 * Display license information
 */
function displayLicenseInfo(info) {
  console.log('[Popup License] Displaying info:', info);

  loading.classList.add('hidden');

  if (info.isActive && info.tier !== 'free') {
    // Show active license view
    licenseActive.classList.remove('hidden');
    licenseInactive.classList.add('hidden');

    // Tier badge
    tierBadge.className = `tier-badge tier-${info.tier}`;
    tierBadge.textContent = `${info.tier} Tier`;

    // Status messages
    if (info.inGracePeriod) {
      showWarning(`License validation overdue. Please validate within ${info.daysUntilExpiry} days.`);
    } else if (info.needsValidation) {
      showInfo('License validation recommended. Click "Validate Now" to refresh.');
    } else {
      clearMessages();
    }

    // License details
    licenseKeyDisplay.textContent = info.licenseKey;
    deviceIdDisplay.textContent = info.deviceId;
    lastValidatedDisplay.textContent = formatDate(info.lastValidated);
    daysUntilExpiryDisplay.textContent = info.daysUntilExpiry;

    // Features list
    displayFeatures(info.features);

  } else {
    // Show inactive license view (free tier or no license)
    licenseActive.classList.add('hidden');
    licenseInactive.classList.remove('hidden');

    clearMessages();
  }
}

/**
 * Display features list
 */
function displayFeatures(features) {
  featuresList.innerHTML = '';

  const featureMap = {
    maxSessions: 'Max Sessions',
    sessionPersistenceDays: 'Session Persistence',
    sessionNaming: 'Session Naming',
    sessionExport: 'Export/Import',
    sessionTemplates: 'Session Templates',
    encryption: 'AES-256 Encryption',
    portableSessions: 'Portable Sessions',
    localAPI: 'Local API',
    multiProfile: 'Multi-Profile'
  };

  Object.entries(featureMap).forEach(([key, label]) => {
    const value = features[key];
    const li = document.createElement('li');

    const labelSpan = document.createElement('span');
    labelSpan.textContent = label;

    const valueSpan = document.createElement('span');

    if (value === true) {
      valueSpan.className = 'feature-enabled';
      valueSpan.textContent = '✓';
    } else if (value === false) {
      valueSpan.className = 'feature-disabled';
      valueSpan.textContent = '✗';
    } else if (value === Infinity) {
      valueSpan.className = 'feature-enabled';
      valueSpan.textContent = '∞';
    } else {
      valueSpan.textContent = value;
    }

    li.appendChild(labelSpan);
    li.appendChild(valueSpan);
    featuresList.appendChild(li);
  });
}

/**
 * Poll for license activation completion
 * Uses storage-based polling for reliable detection
 * Useful when direct response fails due to message timeout
 */
let pollInterval = null;

function startActivationPolling() {
  console.log('[Popup License] Starting activation polling...');

  // Clear any existing interval
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }

  // Poll every 500ms for up to 10 seconds
  let attempts = 0;
  const maxAttempts = 20; // 10 seconds / 500ms

  pollInterval = setInterval(async () => {
    attempts++;
    console.log(`[Popup License] Polling attempt ${attempts}/${maxAttempts}...`);

    try {
      // Check storage directly for more reliable detection
      const stored = await new Promise(resolve => {
        chrome.storage.local.get(['licenseData'], resolve);
      });

      console.log('[Popup License] Stored license data:', stored.licenseData);

      // Check if license is active
      if (stored.licenseData && stored.licenseData.isActive && stored.licenseData.tier !== 'free') {
        console.log('[Popup License] ✓ License activated detected in storage!');
        clearInterval(pollInterval);
        pollInterval = null;

        // Disable input and button to prevent re-activation
        licenseKeyInput.disabled = true;
        activateButton.disabled = true;
        activateButton.textContent = 'Activated!';

        // Show success and redirect
        const tier = stored.licenseData.tier.toUpperCase();
        showSuccess(`License activated successfully! (${tier} tier)`, 'activation');

        setTimeout(() => {
          window.location.href = 'popup.html';
        }, 1000);
        return;
      }

      // Log progress
      console.log('[Popup License] Checking activation:', {
        hasLicenseData: !!stored.licenseData,
        isActive: stored.licenseData?.isActive,
        tier: stored.licenseData?.tier
      });

    } catch (error) {
      console.error('[Popup License] Polling error:', error);
    }

    // Stop polling after max attempts
    if (attempts >= maxAttempts) {
      clearInterval(pollInterval);
      pollInterval = null;
      console.log('[Popup License] ⚠ Polling timeout after', maxAttempts, 'attempts');

      // Re-enable button
      activateButton.disabled = false;
      activateButton.textContent = 'Activate License';

      showError('Activation status unclear. Please refresh and check if license was activated.', 'activation');
    }
  }, 500);

  console.log('[Popup License] Polling interval started, ID:', pollInterval);
}

function stopActivationPolling() {
  console.log('[Popup License] stopActivationPolling called');
  if (pollInterval) {
    console.log('[Popup License] Clearing poll interval:', pollInterval);
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[Popup License] Polling stopped');
  } else {
    console.log('[Popup License] No poll interval to clear');
  }

  // Re-enable button if it was disabled
  if (activateButton.disabled) {
    activateButton.disabled = false;
    activateButton.textContent = 'Activate License';
  }
}

/**
 * Handle license activation
 */
async function handleActivation() {
  const licenseKey = licenseKeyInput.value.trim();

  if (!licenseKey) {
    showError('Please enter a license key', 'activation');
    return;
  }

  // Disable button and show loading
  activateButton.disabled = true;
  activateButton.textContent = 'Activating...';
  clearMessages('activation');

  try {
    console.log('[Popup License] Sending activation request...');

    const response = await sendMessage({
      action: 'activateLicense',
      licenseKey: licenseKey,
    });

    console.log('[Popup License] Activation response received:', response);

    // Check if we got a valid response
    if (!response) {
      console.error('[Popup License] No response received from background');
      showError('No response from license manager. Please try again.', 'activation');
      activateButton.disabled = false;
      activateButton.textContent = 'Activate License';
      return;
    }

    // Handle success case
    if (response.success) {
      console.log('[Popup License] ✓ License activated successfully');

      // Disable input and button to prevent re-activation
      licenseKeyInput.disabled = true;
      activateButton.disabled = true;
      activateButton.textContent = 'Activated!';

      showSuccess(`License activated successfully! (${response.tier.toUpperCase()} tier)`, 'activation');

      // Redirect to main popup
      setTimeout(() => {
        window.location.href = 'popup.html';
      }, 1500);

    } else {
      // Handle error case - display user-friendly message
      const errorMessage = getUserFriendlyErrorMessage(response.message, response.error_code);

      // Detailed console logging for debugging
      console.group('[Popup License] Activation Failed');
      console.error('API Error Message:', response.message);
      if (response.error_code) {
        console.error('Error Code:', response.error_code);
      }
      console.log('User-Friendly Message:', errorMessage);
      console.log('Full Response:', response);
      console.groupEnd();

      // Display error to user
      showError(errorMessage, 'activation');

      // Re-enable button for retry
      activateButton.disabled = false;
      activateButton.textContent = 'Activate License';
    }

  } catch (error) {
    console.error('[Popup License] Activation error:', error);
    showError('Failed to activate license. Please check your connection and try again.', 'activation');
    activateButton.disabled = false;
    activateButton.textContent = 'Activate License';
  }
}

/**
 * Handle license validation
 */
async function handleValidation() {
  validateButton.disabled = true;
  validateButton.textContent = 'Validating...';
  clearMessages();

  try {
    const response = await sendMessage({
      action: 'validateLicense',
    });

    if (response.success) {
      showSuccess('License validated successfully!');

      // Reload license info
      setTimeout(async () => {
        const info = await sendMessage({ action: 'getLicenseInfo' });
        displayLicenseInfo(info);
      }, 1500);

    } else {
      // Enhanced error handling with user-friendly messages
      const errorMessage = getUserFriendlyErrorMessage(response.message, response.error_code);
      showError(errorMessage);

      // Detailed console logging for debugging
      console.group('[Popup License] Validation Failed');
      console.error('API Error Message:', response.message);
      if (response.error_code) {
        console.error('Error Code:', response.error_code);
      }
      console.log('User-Friendly Message:', errorMessage);
      console.log('Full Response:', response);
      console.groupEnd();
    }

  } catch (error) {
    console.error('[Popup License] Validation error:', error);
    const errorMessage = getUserFriendlyErrorMessage('Validation failed: ' + error.message);
    showError(errorMessage);
  } finally {
    validateButton.disabled = false;
    validateButton.textContent = 'Validate Now';
  }
}

/**
 * Handle license deactivation
 */
async function handleDeactivation() {
  if (!confirm('Are you sure you want to deactivate your license? You will revert to Free tier.')) {
    return;
  }

  deactivateButton.disabled = true;
  deactivateButton.textContent = 'Deactivating...';
  clearMessages();

  try {
    const response = await sendMessage({
      action: 'deactivateLicense',
    });

    if (response.success) {
      showSuccess('License deactivated successfully');

      // Wait a moment then reload UI
      setTimeout(async () => {
        const info = await sendMessage({ action: 'getLicenseInfo' });
        displayLicenseInfo(info);
      }, 1500);

    } else {
      // Enhanced error handling with user-friendly messages
      const errorMessage = getUserFriendlyErrorMessage(response.message, response.error_code);
      showError(errorMessage);

      // Detailed console logging for debugging
      console.group('[Popup License] Deactivation Failed');
      console.error('API Error Message:', response.message);
      if (response.error_code) {
        console.error('Error Code:', response.error_code);
      }
      console.log('User-Friendly Message:', errorMessage);
      console.log('Full Response:', response);
      console.groupEnd();
    }

  } catch (error) {
    console.error('[Popup License] Deactivation error:', error);
    const errorMessage = getUserFriendlyErrorMessage('Deactivation failed: ' + error.message);
    showError(errorMessage);
  } finally {
    deactivateButton.disabled = false;
    deactivateButton.textContent = 'Deactivate License';
  }
}

/**
 * Convert API error messages to user-friendly format
 *
 * @param {string} apiMessage - The error message from the API
 * @param {number} errorCode - The error code from the API (optional)
 * @returns {string} User-friendly error message
 */
function getUserFriendlyErrorMessage(apiMessage, errorCode) {
  // If no message provided, return generic error
  if (!apiMessage) {
    return 'License activation failed. Please try again.';
  }

  // Common error code mappings
  const errorCodeMessages = {
    60: 'This license key is not active. Please check your license status or contact support.',
    61: 'This license has expired. Please renew your license.',
    62: 'Device limit reached for this license. Please deactivate a device or upgrade your plan.',
    63: 'This license key is not valid. Please check the key and try again.',
    64: 'License validation failed. Please check your internet connection and try again.',
    65: 'Maximum domains reached for this license. Please remove a domain or upgrade your plan.',
  };

  // Check if we have a specific message for this error code
  if (errorCode && errorCodeMessages[errorCode]) {
    return errorCodeMessages[errorCode];
  }

  // Convert common technical messages to user-friendly ones
  const messageMappings = {
    'Unable to process request as the license status is not active':
      'This license key is not active. Please check your license status or contact support.',
    'License verification failed':
      'Unable to verify your license. Please check your license key and internet connection.',
    'Device registration failed':
      'Unable to register this device. You may have reached the device limit for this license.',
    'Invalid license key format':
      'The license key format is invalid. Please check the key and try again.',
    'Activation failed':
      'License activation failed. Please check your license key and try again.',
    'Request timeout':
      'Connection timeout. Please check your internet connection and try again.',
    'Request failed after':
      'Unable to connect to license server. Please check your internet connection and try again.',
  };

  // Check for partial matches in the API message
  for (const [technical, friendly] of Object.entries(messageMappings)) {
    if (apiMessage.includes(technical)) {
      return friendly;
    }
  }

  // If no mapping found, return the original message
  // (it might already be user-friendly)
  return apiMessage;
}

/**
 * Show error message
 */
function showError(message, context = '') {
  const targetElement = context === 'activation' ? activationMessage : statusMessage;
  targetElement.innerHTML = `<div class="error">${escapeHtml(message)}</div>`;
}

/**
 * Escape HTML to prevent XSS
 *
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show success message
 */
function showSuccess(message, context = '') {
  const targetElement = context === 'activation' ? activationMessage : statusMessage;
  targetElement.innerHTML = `<div class="success">${message}</div>`;
}

/**
 * Show warning message
 */
function showWarning(message, context = '') {
  const targetElement = context === 'activation' ? activationMessage : statusMessage;
  targetElement.innerHTML = `<div class="warning">${message}</div>`;
}

/**
 * Show info message
 */
function showInfo(message, context = '') {
  const targetElement = context === 'activation' ? activationMessage : statusMessage;
  targetElement.innerHTML = `<div class="success">${message}</div>`;
}

/**
 * Clear messages
 */
function clearMessages(context = '') {
  const targetElement = context === 'activation' ? activationMessage : statusMessage;
  targetElement.innerHTML = '';
}

/**
 * Format date for display
 */
function formatDate(isoString) {
  if (!isoString) return '-';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
