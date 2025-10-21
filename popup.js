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

    // Update session count
    const count = sessions.length;
    $('#sessionCount').textContent = count === 1 ? '1 session' : `${count} sessions`;

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
      displayFreeTier();
      return;
    }

    const license = response.licenseData;

    if (!license || license.tier === 'free') {
      displayFreeTier();
    } else if (license.tier === 'premium') {
      displayPremiumTier(license);
    } else if (license.tier === 'enterprise') {
      displayEnterpriseTier(license);
    }
  } catch (error) {
    console.error('Error refreshing license status:', error);
    displayFreeTier();
  }
}

/**
 * Display Free tier badge
 */
function displayFreeTier() {
  const badge = $('#licenseTierBadge');
  const details = $('#licenseDetails');

  badge.className = 'license-tier-badge free';
  badge.textContent = 'Free Version';
  badge.href = 'popup-license.html';
  badge.title = 'Activate license';

  details.innerHTML = `
    <div class="license-details-item">
      <span class="license-details-label">Status:</span>
      <span>Limited to 3 sessions</span>
    </div>
  `;
}

/**
 * Display Premium tier badge
 * @param {Object} license
 */
function displayPremiumTier(license) {
  const badge = $('#licenseTierBadge');
  const details = $('#licenseDetails');

  badge.className = 'license-tier-badge premium';
  badge.textContent = 'Premium Version';
  badge.href = 'license-details.html';
  badge.title = 'View license details';

  const registeredName = `${license.first_name || ''} ${license.last_name || ''}`.trim() || license.email || 'Unknown';
  const dateSubscribed = license.date_created ? `${license.date_created} UTC` : 'N/A';
  const dateRenewed = license.date_renewed ? `${license.date_renewed} UTC` : 'Never';
  const expiryDate = license.date_expiry ? `${license.date_expiry} UTC` : 'N/A';

  details.innerHTML = `
    <div class="license-details-item">
      <span class="license-details-label">Registered:</span>
      <span>${escapeHtml(registeredName)}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Date Subscribed:</span>
      <span>${dateSubscribed}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Date Renewed:</span>
      <span>${dateRenewed}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Expiry Date:</span>
      <span>${expiryDate}</span>
    </div>
  `;
}

/**
 * Display Enterprise tier badge
 * @param {Object} license
 */
function displayEnterpriseTier(license) {
  const badge = $('#licenseTierBadge');
  const details = $('#licenseDetails');

  badge.className = 'license-tier-badge enterprise';
  badge.textContent = 'Enterprise Version';
  badge.href = 'license-details.html';
  badge.title = 'View license details';

  const registeredName = `${license.first_name || ''} ${license.last_name || ''}`.trim() || license.email || 'Unknown';
  const dateSubscribed = license.date_created ? `${license.date_created} UTC` : 'N/A';
  const dateRenewed = license.date_renewed ? `${license.date_renewed} UTC` : 'Never';
  const expiryDate = license.date_expiry ? `${license.date_expiry} UTC` : 'N/A';

  details.innerHTML = `
    <div class="license-details-item">
      <span class="license-details-label">Registered:</span>
      <span>${escapeHtml(registeredName)}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Date Subscribed:</span>
      <span>${dateSubscribed}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Date Renewed:</span>
      <span>${dateRenewed}</span>
    </div>
    <div class="license-details-item">
      <span class="license-details-label">Expiry Date:</span>
      <span>${expiryDate}</span>
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
