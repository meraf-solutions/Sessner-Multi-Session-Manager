/**
 * License Management Popup UI
 * Handles license activation, validation, and display
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
 * Initialize popup
 */
async function init() {
  console.log('[Popup License] Initializing...');

  try {
    // Get license info from background
    const response = await chrome.runtime.sendMessage({ action: 'getLicenseInfo' });

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
    // Start polling as fallback
    startActivationPolling();

    const response = await chrome.runtime.sendMessage({
      action: 'activateLicense',
      licenseKey: licenseKey,
    });

    // Only stop polling if we got a valid response
    if (!response) {
      console.log('[Popup License] No immediate response, relying on polling...');
      // Don't stop polling! Don't re-enable button! Let polling handle it.
      return;
    }

    // We got a response - stop polling
    stopActivationPolling();

    if (response.success) {
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
      showError(response.message || 'Activation failed', 'activation');
      // Re-enable button on error (polling already stopped)
      activateButton.disabled = false;
      activateButton.textContent = 'Activate License';
    }

  } catch (error) {
    console.error('[Popup License] Activation error:', error);
    // Don't stop polling - it might still succeed in background
    console.log('[Popup License] Error in response, relying on polling...');
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
    const response = await chrome.runtime.sendMessage({
      action: 'validateLicense',
    });

    if (response.success) {
      showSuccess('License validated successfully!');

      // Reload license info
      setTimeout(async () => {
        const info = await chrome.runtime.sendMessage({ action: 'getLicenseInfo' });
        displayLicenseInfo(info);
      }, 1500);

    } else {
      showError(response.message || 'Validation failed');
    }

  } catch (error) {
    console.error('[Popup License] Validation error:', error);
    showError('Validation failed: ' + error.message);
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
    const response = await chrome.runtime.sendMessage({
      action: 'deactivateLicense',
    });

    if (response.success) {
      showSuccess('License deactivated successfully');

      // Wait a moment then reload UI
      setTimeout(async () => {
        const info = await chrome.runtime.sendMessage({ action: 'getLicenseInfo' });
        displayLicenseInfo(info);
      }, 1500);

    } else {
      showError(response.message || 'Deactivation failed');
    }

  } catch (error) {
    console.error('[Popup License] Deactivation error:', error);
    showError('Deactivation failed: ' + error.message);
  } finally {
    deactivateButton.disabled = false;
    deactivateButton.textContent = 'Deactivate License';
  }
}

/**
 * Show error message
 */
function showError(message, context = '') {
  const targetElement = context === 'activation' ? activationMessage : statusMessage;
  targetElement.innerHTML = `<div class="error">${message}</div>`;
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
