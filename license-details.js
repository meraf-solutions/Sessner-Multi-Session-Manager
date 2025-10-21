/**
 * License Details Page Script
 * Displays complete license information and provides deactivation functionality
 */

'use strict';

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
 * Format date for display
 * @param {string} dateString - Date string from API
 * @returns {string}
 */
function formatDate(dateString) {
  if (!dateString || dateString === 'null') return 'Never';

  try {
    // API returns dates in format "2025-10-21 07:33:33"
    // Add " UTC" suffix if not present
    const dateWithUTC = dateString.includes('UTC') ? dateString : `${dateString} UTC`;
    return dateWithUTC;
  } catch (error) {
    return dateString;
  }
}

/**
 * Show message in UI
 * @param {string} message
 * @param {string} type - 'success', 'error', 'warning'
 */
function showMessage(message, type = 'success') {
  const container = $('#message-container');
  const div = document.createElement('div');
  div.className = type;
  div.textContent = message;
  container.innerHTML = '';
  container.appendChild(div);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    div.remove();
  }, 5000);
}

// ============= Main Functions =============

/**
 * Initialize the page
 */
async function init() {
  console.log('[License Details] Initializing...');

  try {
    // Load license information
    const response = await sendMessage({ action: 'getLicenseInfo' });

    console.log('[License Details] License info response:', response);

    if (!response || !response.success) {
      console.error('[License Details] Failed to get license info:', response);
      showMessage('Failed to load license information', 'error');
      $('#loading').classList.add('hidden');
      return;
    }

    // Display license details
    displayLicenseDetails(response);

    // Hide loading, show details
    $('#loading').classList.add('hidden');
    $('#license-details').classList.remove('hidden');

  } catch (error) {
    console.error('[License Details] Initialization error:', error);
    showMessage('Error loading license details: ' + error.message, 'error');
    $('#loading').classList.add('hidden');
  }
}

/**
 * Display license details in UI
 * @param {Object} info - License information from getLicenseInfo
 */
function displayLicenseDetails(info) {
  console.log('[License Details] Displaying license info:', info);

  // Set tier badge
  const tierBadge = $('#tier-badge');
  tierBadge.textContent = `${info.tier ? info.tier.toUpperCase() : 'FREE'} Version`;
  tierBadge.className = 'tier-badge';

  if (info.tier === 'premium') {
    tierBadge.classList.add('tier-premium');
  } else if (info.tier === 'enterprise') {
    tierBadge.classList.add('tier-enterprise');
  } else {
    tierBadge.classList.add('tier-free');
  }

  // License Status
  const status = info.isActive ? 'Active' : 'Inactive';
  $('#status').innerHTML = `<span class="status-${info.isActive ? 'active' : 'inactive'}">${status}</span>`;
  $('#tier').textContent = info.product_ref || info.tier || 'Free';
  $('#license-key').textContent = info.license_key || info.licenseKey || 'N/A';
  $('#subscription-id').textContent = info.subscr_id || 'N/A';

  // Account Information
  const fullName = `${info.first_name || ''} ${info.last_name || ''}`.trim() || 'N/A';
  $('#account-name').textContent = fullName;
  $('#company-name').textContent = info.company_name || 'N/A';
  $('#email').textContent = info.email || 'N/A';

  // License Configuration
  $('#license-type').textContent = info.license_type || 'N/A';
  $('#max-domains').textContent = info.max_allowed_domains || '0';
  $('#max-devices').textContent = info.max_allowed_devices || '0';

  // Important Dates
  $('#date-created').textContent = formatDate(info.date_created);
  $('#date-renewed').textContent = formatDate(info.date_renewed);
  $('#date-expiry').textContent = formatDate(info.date_expiry);

  // Registered Devices
  displayDevices(info.registered_devices);

  // Show/hide buttons based on activation status
  const validateButton = $('#validate-button');
  const deactivateButton = $('#deactivate-button');

  if (!info.isActive || info.tier === 'free') {
    // Hide buttons for free tier
    validateButton.style.display = 'none';
    deactivateButton.style.display = 'none';
  } else {
    validateButton.style.display = 'block';
    deactivateButton.style.display = 'block';
  }
}

/**
 * Display registered devices
 * @param {Array|string} devices - Array of device objects or JSON string
 */
function displayDevices(devices) {
  const container = $('#devices-list');

  if (!devices) {
    container.innerHTML = '<p style="color: #888; font-size: 13px;">No device information available</p>';
    return;
  }

  // Parse if string
  let deviceList;
  if (typeof devices === 'string') {
    try {
      deviceList = JSON.parse(devices);
    } catch (error) {
      console.error('[License Details] Failed to parse devices:', error);
      container.innerHTML = '<p style="color: #888; font-size: 13px;">Error parsing device data</p>';
      return;
    }
  } else if (Array.isArray(devices)) {
    deviceList = devices;
  } else {
    container.innerHTML = '<p style="color: #888; font-size: 13px;">Invalid device data format</p>';
    return;
  }

  if (!deviceList || deviceList.length === 0) {
    container.innerHTML = '<p style="color: #888; font-size: 13px;">No devices registered</p>';
    return;
  }

  // Build device list HTML
  let html = '';
  deviceList.forEach((device, index) => {
    const deviceName = device.name || device.device_name || `Device ${index + 1}`;
    const deviceId = device.id || device.device_id || 'Unknown';

    html += `
      <div class="device-item">
        <div class="device-name">${escapeHtml(deviceName)}</div>
        <div class="device-id">${escapeHtml(deviceId)}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/**
 * Handle license validation
 */
async function handleValidation() {
  console.log('[License Details] Validating license...');

  const button = $('#validate-button');
  button.disabled = true;
  button.textContent = 'Validating...';

  try {
    // Determine if using sandbox (check if stored license was activated with sandbox)
    const useSandbox = true; // TODO: Get from stored license data

    const response = await sendMessage({
      action: 'validateLicense',
      useSandbox: useSandbox
    });

    console.log('[License Details] Validation response:', response);

    if (response && response.success) {
      showMessage('License validated successfully!', 'success');

      // Refresh the display
      setTimeout(() => {
        init();
      }, 1000);
    } else {
      showMessage(`Validation failed: ${response.message || 'Unknown error'}`, 'error');
    }
  } catch (error) {
    console.error('[License Details] Validation error:', error);
    showMessage('Validation error: ' + error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Validate License Now';
  }
}

/**
 * Handle license deactivation
 */
async function handleDeactivation() {
  console.log('[License Details] Deactivation requested...');

  // Confirm with user
  const confirmed = confirm(
    'Are you sure you want to deactivate this license?\n\n' +
    'This will:\n' +
    '• Remove the license from this device\n' +
    '• Revert to Free tier (3 sessions limit)\n' +
    '• Allow you to activate on another device\n\n' +
    'This action cannot be undone.'
  );

  if (!confirmed) {
    console.log('[License Details] Deactivation cancelled by user');
    return;
  }

  const button = $('#deactivate-button');
  button.disabled = true;
  button.textContent = 'Deactivating...';

  try {
    // Determine if using sandbox
    const useSandbox = true; // TODO: Get from stored license data

    const response = await sendMessage({
      action: 'deactivateLicense',
      useSandbox: useSandbox
    });

    console.log('[License Details] Deactivation response:', response);

    if (response && response.success) {
      showMessage('License deactivated successfully! Redirecting...', 'success');

      // Redirect to popup-license.html after 2 seconds
      setTimeout(() => {
        window.location.href = 'popup-license.html';
      }, 2000);
    } else {
      showMessage(`Deactivation failed: ${response.message || 'Unknown error'}`, 'error');
      button.disabled = false;
      button.textContent = 'Deactivate License';
    }
  } catch (error) {
    console.error('[License Details] Deactivation error:', error);
    showMessage('Deactivation error: ' + error.message, 'error');
    button.disabled = false;
    button.textContent = 'Deactivate License';
  }
}

// ============= Event Listeners =============

// Listen for redirect messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[License Details] Message received:', message);

  if (message.action === 'redirectToPopup') {
    console.log('[License Details] Redirecting to popup.html due to:', message.reason);

    // Redirect to popup.html (free version)
    window.location.href = 'popup.html';

    sendResponse({ success: true });
    return true;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  console.log('[License Details] Page loaded');

  // Initialize
  init();

  // Validate button
  $('#validate-button').addEventListener('click', handleValidation);

  // Deactivate button
  $('#deactivate-button').addEventListener('click', handleDeactivation);
});

console.log('[License Details] Script loaded');
