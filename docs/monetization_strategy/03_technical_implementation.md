# Technical Implementation Guide
## Sessner – Multi-Session Manager Monetization

**Document Version:** 1.0
**Last Updated:** 2025-10-15
**Status:** Draft for Review

---

## 📋 Overview

This document provides detailed technical specifications for implementing the freemium monetization system in Sessner – Multi-Session Manager.

---

## 🏗️ Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                    MONETIZATION LAYER                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │           License Manager (license-manager.js)      │  │
│  │  • License validation                               │  │
│  │  • Feature gating                                   │  │
│  │  • Tier management                                  │  │
│  │  • Usage tracking                                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                            ↕                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │        Background Script (background.js)            │  │
│  │  • Session creation gating                          │  │
│  │  • Feature availability checks                      │  │
│  │  • License state management                         │  │
│  └─────────────────────────────────────────────────────┘  │
│                            ↕                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Popup UI (popup.html/js)               │  │
│  │  • Upgrade prompts                                  │  │
│  │  • License activation                               │  │
│  │  • Tier indicators                                  │  │
│  │  • Usage stats display                              │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
                            ↕
┌───────────────────────────────────────────────────────────┐
│              PERSISTENT STORAGE (chrome.storage.local)     │
│  • License key                                            │
│  • License tier                                           │
│  • License expiry                                         │
│  • Usage statistics                                       │
│  • Feature flags                                          │
└───────────────────────────────────────────────────────────┘
                            ↕
┌───────────────────────────────────────────────────────────┐
│            OPTIONAL: LICENSE SERVER (Future)               │
│  • License validation API                                 │
│  • Purchase processing                                    │
│  • License management                                     │
└───────────────────────────────────────────────────────────┘
```

---

## 📁 New Files to Create

### 1. `license-manager.js` (Core License System)
**Location:** `/license-manager.js`
**Purpose:** Centralized license validation and feature gating

```javascript
/**
 * License Manager - Sessner Multi-Session Manager
 * Handles license validation, feature gating, and tier management
 */

// ============= Constants =============

const LICENSE_TIERS = {
  FREE: 'free',
  PREMIUM: 'premium',
  PREMIUM_PLUS: 'premium_plus'
};

const TIER_LIMITS = {
  [LICENSE_TIERS.FREE]: {
    maxSessions: 3,
    sessionPersistenceDays: 7,
    badgeColors: 6,
    features: {
      sessionNaming: false,
      sessionExport: false,
      sessionImport: false,
      sessionTemplates: false,
      sessionGroups: false,
      sessionSearch: false,
      keyboardShortcuts: false,
      advancedAnalytics: false,
      crossDeviceSync: false,
      teamFeatures: false,
      apiAccess: false,
      customColors: false,
      automation: false
    }
  },
  [LICENSE_TIERS.PREMIUM]: {
    maxSessions: Infinity,
    sessionPersistenceDays: Infinity,
    badgeColors: 12,
    features: {
      sessionNaming: true,
      sessionExport: true,
      sessionImport: true,
      sessionTemplates: true,
      sessionGroups: false,
      sessionSearch: true,
      keyboardShortcuts: true,
      advancedAnalytics: false,
      crossDeviceSync: false,
      teamFeatures: false,
      apiAccess: false,
      customColors: false,
      automation: false
    }
  },
  [LICENSE_TIERS.PREMIUM_PLUS]: {
    maxSessions: Infinity,
    sessionPersistenceDays: Infinity,
    badgeColors: Infinity,
    features: {
      sessionNaming: true,
      sessionExport: true,
      sessionImport: true,
      sessionTemplates: true,
      sessionGroups: true,
      sessionSearch: true,
      keyboardShortcuts: true,
      advancedAnalytics: true,
      crossDeviceSync: true,
      teamFeatures: true,
      apiAccess: true,
      customColors: true,
      automation: true
    }
  }
};

// ============= License State =============

let licenseState = {
  tier: LICENSE_TIERS.FREE,
  licenseKey: null,
  expiryDate: null,
  activatedAt: null,
  lastValidation: null,
  isValid: true,
  gracePeriodDays: 3
};

// ============= Core Functions =============

/**
 * Initialize license manager
 * Load stored license from chrome.storage.local
 */
async function initializeLicenseManager() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['licenseState'], (data) => {
      if (data.licenseState) {
        licenseState = { ...licenseState, ...data.licenseState };
        console.log('[License] Loaded license state:', licenseState.tier);
      } else {
        console.log('[License] No stored license, using FREE tier');
      }
      resolve(licenseState);
    });
  });
}

/**
 * Get current license tier
 * @returns {string} Current tier (free, premium, premium_plus)
 */
function getCurrentTier() {
  return licenseState.tier || LICENSE_TIERS.FREE;
}

/**
 * Get current tier limits
 * @returns {Object} Limits for current tier
 */
function getTierLimits() {
  const tier = getCurrentTier();
  return TIER_LIMITS[tier];
}

/**
 * Check if user can create a new session
 * @param {number} currentSessionCount - Number of active sessions
 * @returns {Object} { allowed: boolean, reason: string }
 */
function canCreateSession(currentSessionCount) {
  const limits = getTierLimits();

  if (currentSessionCount >= limits.maxSessions) {
    return {
      allowed: false,
      reason: `You've reached your session limit (${limits.maxSessions} for ${getCurrentTier().toUpperCase()} tier)`
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Check if a feature is available
 * @param {string} featureName - Feature to check
 * @returns {boolean} True if feature is available
 */
function hasFeature(featureName) {
  const limits = getTierLimits();
  return limits.features[featureName] === true;
}

/**
 * Validate license key format
 * @param {string} key - License key to validate
 * @returns {boolean} True if format is valid
 */
function validateLicenseKeyFormat(key) {
  // Format: SESS-XXXX-XXXX-XXXX-XXXX
  const pattern = /^SESS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(key);
}

/**
 * Activate a license key
 * @param {string} licenseKey - License key to activate
 * @returns {Promise<Object>} Result object with success status
 */
async function activateLicense(licenseKey) {
  // Validate format
  if (!validateLicenseKeyFormat(licenseKey)) {
    return {
      success: false,
      error: 'Invalid license key format'
    };
  }

  // TODO: Call license server for validation
  // For now, use offline validation with key parsing

  try {
    const tier = parseLicenseKeyTier(licenseKey);

    if (!tier) {
      return {
        success: false,
        error: 'Invalid license key'
      };
    }

    // Update license state
    licenseState = {
      tier: tier,
      licenseKey: licenseKey,
      expiryDate: null, // Lifetime for now
      activatedAt: Date.now(),
      lastValidation: Date.now(),
      isValid: true,
      gracePeriodDays: 3
    };

    // Persist to storage
    await saveLicenseState();

    console.log('[License] Activated:', tier);

    return {
      success: true,
      tier: tier,
      message: `License activated successfully! You now have ${tier.toUpperCase()} access.`
    };
  } catch (error) {
    console.error('[License] Activation error:', error);
    return {
      success: false,
      error: 'Failed to activate license'
    };
  }
}

/**
 * Parse license key to determine tier
 * @param {string} key - License key
 * @returns {string|null} Tier or null if invalid
 */
function parseLicenseKeyTier(key) {
  // Simple offline validation based on key prefix
  // Format: SESS-{TIER}-XXXX-XXXX-XXXX
  // TIER: PREM (Premium), PLUS (Premium+)

  if (!key || !validateLicenseKeyFormat(key)) {
    return null;
  }

  const parts = key.split('-');
  const tierCode = parts[1];

  if (tierCode.startsWith('PREM')) {
    return LICENSE_TIERS.PREMIUM;
  } else if (tierCode.startsWith('PLUS')) {
    return LICENSE_TIERS.PREMIUM_PLUS;
  }

  return null;
}

/**
 * Deactivate current license (downgrade to free)
 */
async function deactivateLicense() {
  licenseState = {
    tier: LICENSE_TIERS.FREE,
    licenseKey: null,
    expiryDate: null,
    activatedAt: null,
    lastValidation: null,
    isValid: true,
    gracePeriodDays: 3
  };

  await saveLicenseState();
  console.log('[License] Deactivated, returned to FREE tier');
}

/**
 * Save license state to storage
 */
async function saveLicenseState() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ licenseState: licenseState }, () => {
      if (chrome.runtime.lastError) {
        console.error('[License] Failed to save state:', chrome.runtime.lastError);
      } else {
        console.log('[License] State saved');
      }
      resolve();
    });
  });
}

/**
 * Get usage statistics
 * @returns {Object} Usage stats for current tier
 */
function getUsageStats() {
  return {
    tier: getCurrentTier(),
    maxSessions: getTierLimits().maxSessions,
    currentSessions: 0, // Will be populated by background.js
    features: getTierLimits().features,
    licenseKey: licenseState.licenseKey ? '****-****-****-' + licenseState.licenseKey.slice(-4) : null,
    activatedAt: licenseState.activatedAt,
    expiryDate: licenseState.expiryDate
  };
}

// ============= Exports =============

// Make available globally for background.js
window.LicenseManager = {
  LICENSE_TIERS,
  initialize: initializeLicenseManager,
  getCurrentTier,
  getTierLimits,
  canCreateSession,
  hasFeature,
  activateLicense,
  deactivateLicense,
  getUsageStats,
  validateLicenseKeyFormat
};
```

---

### 2. `upgrade-modal.html` (Upgrade UI)
**Location:** `/upgrade-modal.html`
**Purpose:** Pricing page and license activation modal

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Upgrade to Premium - Sessner</title>
  <link rel="stylesheet" href="upgrade-modal.css">
</head>
<body>
  <div class="upgrade-container">
    <!-- Header -->
    <div class="upgrade-header">
      <h1>Unlock Unlimited Sessions</h1>
      <p class="subtitle">Upgrade to Premium or Premium+ for powerful features</p>
    </div>

    <!-- Pricing Cards -->
    <div class="pricing-cards">
      <!-- Free Tier -->
      <div class="pricing-card free-card">
        <div class="card-header">
          <h2>Free</h2>
          <div class="price">$0</div>
          <div class="period">forever</div>
        </div>
        <div class="card-body">
          <ul class="features">
            <li>✅ 3 concurrent sessions</li>
            <li>✅ 7-day persistence</li>
            <li>✅ 6 badge colors</li>
            <li>✅ Session isolation</li>
            <li>❌ Session naming</li>
            <li>❌ Export/import</li>
            <li>❌ Unlimited sessions</li>
          </ul>
        </div>
        <div class="card-footer">
          <button class="btn btn-free" disabled>Current Plan</button>
        </div>
      </div>

      <!-- Premium Tier -->
      <div class="pricing-card premium-card popular">
        <div class="popular-badge">MOST POPULAR</div>
        <div class="card-header">
          <h2>Premium</h2>
          <div class="price">$4.99</div>
          <div class="period">per month</div>
          <div class="annual-deal">or $29.99/year (save 50%)</div>
        </div>
        <div class="card-body">
          <ul class="features">
            <li>✅ <strong>Unlimited sessions</strong></li>
            <li>✅ <strong>Permanent storage</strong></li>
            <li>✅ 12+ badge colors</li>
            <li>✅ Session naming</li>
            <li>✅ Export/import</li>
            <li>✅ Session templates</li>
            <li>✅ Keyboard shortcuts</li>
            <li>✅ Priority support</li>
          </ul>
        </div>
        <div class="card-footer">
          <button class="btn btn-premium" id="upgradePremiumBtn">
            Upgrade to Premium
          </button>
        </div>
      </div>

      <!-- Premium+ Tier -->
      <div class="pricing-card premium-plus-card">
        <div class="card-header">
          <h2>Premium+</h2>
          <div class="price">$9.99</div>
          <div class="period">per month</div>
          <div class="annual-deal">or $59.99/year (save 50%)</div>
        </div>
        <div class="card-body">
          <ul class="features">
            <li>✅ <strong>Everything in Premium</strong></li>
            <li>✅ <strong>Cross-device sync</strong></li>
            <li>✅ Team collaboration</li>
            <li>✅ Session automation</li>
            <li>✅ Advanced analytics</li>
            <li>✅ API access</li>
            <li>✅ Custom themes</li>
            <li>✅ Elite support</li>
          </ul>
        </div>
        <div class="card-footer">
          <button class="btn btn-premium-plus" id="upgradePremiumPlusBtn">
            Upgrade to Premium+
          </button>
        </div>
      </div>
    </div>

    <!-- License Activation Section -->
    <div class="license-activation">
      <h3>Already have a license key?</h3>
      <div class="activation-form">
        <input type="text" id="licenseKeyInput" placeholder="SESS-XXXX-XXXX-XXXX-XXXX"
               pattern="SESS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}"
               maxlength="24">
        <button id="activateLicenseBtn" class="btn btn-activate">Activate</button>
      </div>
      <div id="activationMessage" class="activation-message"></div>
    </div>

    <!-- Money-Back Guarantee -->
    <div class="guarantee">
      <p>💯 <strong>30-Day Money-Back Guarantee</strong></p>
      <p>Not satisfied? Get a full refund within 30 days, no questions asked.</p>
    </div>

    <!-- Footer -->
    <div class="upgrade-footer">
      <button id="closeBt" class="btn-link">Maybe later</button>
    </div>
  </div>

  <script src="upgrade-modal.js"></script>
</body>
</html>
```

---

### 3. `upgrade-modal.css` (Upgrade UI Styling)
**Location:** `/upgrade-modal.css`

```css
/* Upgrade Modal Styling */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
  min-height: 100vh;
}

.upgrade-container {
  max-width: 1100px;
  margin: 0 auto;
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.upgrade-header {
  text-align: center;
  margin-bottom: 40px;
}

.upgrade-header h1 {
  font-size: 36px;
  color: #333;
  margin-bottom: 10px;
}

.upgrade-header .subtitle {
  font-size: 18px;
  color: #666;
}

.pricing-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 40px;
}

.pricing-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 30px 20px;
  position: relative;
  transition: transform 0.3s, box-shadow 0.3s;
}

.pricing-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.pricing-card.popular {
  border-color: #1ea7e8;
  border-width: 3px;
}

.popular-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: linear-gradient(135deg, #1ea7e8 0%, #0066cc 100%);
  color: white;
  padding: 4px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
}

.card-header {
  text-align: center;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 2px solid #f0f0f0;
}

.card-header h2 {
  font-size: 24px;
  color: #333;
  margin-bottom: 10px;
}

.price {
  font-size: 48px;
  font-weight: 700;
  color: #1ea7e8;
}

.period {
  font-size: 14px;
  color: #999;
  margin-bottom: 8px;
}

.annual-deal {
  font-size: 12px;
  color: #28a745;
  font-weight: 600;
}

.card-body {
  margin-bottom: 20px;
}

.features {
  list-style: none;
  padding: 0;
}

.features li {
  padding: 10px 0;
  font-size: 14px;
  color: #666;
  border-bottom: 1px solid #f5f5f5;
}

.features li:last-child {
  border-bottom: none;
}

.card-footer {
  text-align: center;
}

.btn {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-free {
  background: #e0e0e0;
  color: #999;
  cursor: not-allowed;
}

.btn-premium {
  background: linear-gradient(135deg, #1ea7e8 0%, #0066cc 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(30, 167, 232, 0.4);
}

.btn-premium:hover {
  box-shadow: 0 6px 20px rgba(30, 167, 232, 0.6);
  transform: translateY(-2px);
}

.btn-premium-plus {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
}

.btn-premium-plus:hover {
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
  transform: translateY(-2px);
}

.license-activation {
  background: #f9f9f9;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 30px;
  text-align: center;
}

.license-activation h3 {
  font-size: 20px;
  color: #333;
  margin-bottom: 20px;
}

.activation-form {
  display: flex;
  gap: 10px;
  max-width: 500px;
  margin: 0 auto 15px;
}

.activation-form input {
  flex: 1;
  padding: 12px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  text-transform: uppercase;
}

.btn-activate {
  padding: 12px 24px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.btn-activate:hover {
  background: #218838;
}

.activation-message {
  min-height: 20px;
  font-size: 14px;
  margin-top: 10px;
}

.activation-message.success {
  color: #28a745;
}

.activation-message.error {
  color: #dc3545;
}

.guarantee {
  text-align: center;
  padding: 20px;
  background: #fff3cd;
  border-radius: 12px;
  margin-bottom: 20px;
}

.guarantee p {
  margin: 5px 0;
  color: #856404;
}

.upgrade-footer {
  text-align: center;
}

.btn-link {
  background: none;
  border: none;
  color: #666;
  text-decoration: underline;
  cursor: pointer;
  font-size: 14px;
}

.btn-link:hover {
  color: #333;
}

/* Responsive Design */
@media (max-width: 900px) {
  .pricing-cards {
    grid-template-columns: 1fr;
  }
}
```

---

## 🔧 Files to Modify

### 1. `background.js` Modifications

**Add at the top:**
```javascript
// Load license manager
const script = document.createElement('script');
script.src = 'license-manager.js';
document.head.appendChild(script);

// Wait for license manager to load
setTimeout(async () => {
  await window.LicenseManager.initialize();
  console.log('[Background] License manager initialized');
}, 100);
```

**Modify `createNewSession` function:**
```javascript
function createNewSession(url, callback) {
  // CHECK LICENSE BEFORE CREATING SESSION
  const currentSessionCount = Object.keys(sessionStore.sessions).length;
  const permission = window.LicenseManager.canCreateSession(currentSessionCount);

  if (!permission.allowed) {
    console.log('[Session] Creation blocked:', permission.reason);
    callback({
      success: false,
      error: permission.reason,
      showUpgrade: true,
      currentTier: window.LicenseManager.getCurrentTier()
    });
    return;
  }

  // ... rest of existing createNewSession code ...
}
```

**Add new message handlers:**
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing handlers ...

  if (message.action === 'getLicenseInfo') {
    const stats = window.LicenseManager.getUsageStats();
    stats.currentSessions = Object.keys(sessionStore.sessions).length;
    sendResponse({ success: true, licenseInfo: stats });
    return false;
  }

  if (message.action === 'activateLicense') {
    window.LicenseManager.activateLicense(message.licenseKey).then(result => {
      sendResponse(result);
    });
    return true; // Keep channel open
  }

  if (message.action === 'checkFeatureAvailability') {
    const hasFeature = window.LicenseManager.hasFeature(message.feature);
    sendResponse({ success: true, available: hasFeature });
    return false;
  }

  // ... rest of handlers ...
});
```

---

### 2. `popup.html` Modifications

**Add after new-session-section:**
```html
<!-- License Info Section -->
<div class="license-section">
  <div class="license-info">
    <span class="license-tier" id="licenseTier">FREE</span>
    <span class="license-usage" id="licenseUsage">0 / 3 sessions</span>
  </div>
  <button id="upgradeBtn" class="upgrade-link">Upgrade to Premium ⭐</button>
</div>
```

**Add styling:**
```css
.license-section {
  background: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.license-tier {
  font-weight: 700;
  color: #1ea7e8;
  font-size: 14px;
}

.license-usage {
  font-size: 12px;
  color: #666;
  margin-left: 10px;
}

.upgrade-link {
  background: linear-gradient(135deg, #1ea7e8 0%, #0066cc 100%);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
```

---

### 3. `popup.js` Modifications

**Add at DOMContentLoaded:**
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // ... existing code ...

  // Load license info
  await updateLicenseInfo();

  // Upgrade button
  $('#upgradeBtn')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('upgrade-modal.html') });
  });
});

async function updateLicenseInfo() {
  const response = await sendMessage({ action: 'getLicenseInfo' });

  if (response && response.success) {
    const info = response.licenseInfo;
    $('#licenseTier').textContent = info.tier.toUpperCase();

    if (info.maxSessions === Infinity) {
      $('#licenseUsage').textContent = `${info.currentSessions} sessions`;
    } else {
      $('#licenseUsage').textContent = `${info.currentSessions} / ${info.maxSessions} sessions`;
    }

    // Hide upgrade button if already premium+
    if (info.tier === 'premium_plus') {
      $('#upgradeBtn').style.display = 'none';
    }
  }
}
```

---

### 4. `manifest.json` Modifications

**Add to web_accessible_resources (if using MV2):**
```json
{
  "web_accessible_resources": [
    "upgrade-modal.html",
    "upgrade-modal.css",
    "upgrade-modal.js",
    "license-manager.js"
  ]
}
```

---

## 🔐 License Key Generation

### Format
```
SESS-{TIER}-{RANDOM}-{CHECKSUM}
SESS-PREM-A1B2-C3D4
SESS-PLUS-E5F6-G7H8
```

### Simple Generator (for testing)
```javascript
function generateLicenseKey(tier) {
  const tierPrefix = tier === 'premium' ? 'PREM' : 'PLUS';
  const random1 = generateRandomSegment();
  const random2 = generateRandomSegment();
  const checksum = generateChecksum(tierPrefix + random1 + random2);

  return `SESS-${tierPrefix}-${random1}-${random2}-${checksum}`;
}

function generateRandomSegment() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().slice(0, 4).padEnd(4, '0');
}
```

---

## 🎯 Feature Gating Examples

### Example 1: Session Naming
```javascript
// In session UI code
async function enableSessionNaming(sessionId) {
  const response = await chrome.runtime.sendMessage({
    action: 'checkFeatureAvailability',
    feature: 'sessionNaming'
  });

  if (!response.available) {
    showUpgradePrompt('Session naming requires Premium. Upgrade now?');
    return;
  }

  // Show naming UI
  showNamingDialog(sessionId);
}
```

### Example 2: Export Feature
```javascript
async function exportSessions() {
  if (!await hasFeature('sessionExport')) {
    showUpgradeModal();
    return;
  }

  // Export logic...
}
```

---

## 📊 Usage Analytics (Privacy-Friendly)

**Add to license-manager.js:**
```javascript
const usageStats = {
  sessionsCreated: 0,
  sessionsTotal: 0,
  lastUsed: null,
  installDate: null
};

function trackUsage(event) {
  // Only track counts, no personal data
  switch(event) {
    case 'session_created':
      usageStats.sessionsCreated++;
      break;
    case 'session_closed':
      usageStats.sessionsTotal--;
      break;
  }

  usageStats.lastUsed = Date.now();
  saveUsageStats();
}
```

---

## 🚀 Implementation Priority

### Week 1: Core Infrastructure
1. ✅ Create `license-manager.js`
2. ✅ Implement tier limits
3. ✅ Add session count enforcement
4. ✅ Test free tier limits

### Week 2: UI Implementation
5. ✅ Create `upgrade-modal.html/css/js`
6. ✅ Modify `popup.html` for license info
7. ✅ Add upgrade prompts
8. ✅ Test upgrade flow

### Week 3: License Activation
9. ✅ Implement license key validation
10. ✅ Add activation UI
11. ✅ Test activation flow
12. ✅ Handle edge cases

### Week 4: Premium Features
13. ✅ Implement session naming
14. ✅ Implement export/import
15. ✅ Test feature gating
16. ✅ Polish UI/UX

---

## 🧪 Testing Checklist

- [ ] Free tier: Can create up to 3 sessions
- [ ] Free tier: Blocked at 4th session
- [ ] Upgrade prompt shown when limit reached
- [ ] License key validation works
- [ ] License activation persists across restarts
- [ ] Premium tier: Unlimited sessions
- [ ] Premium features only available with license
- [ ] Downgrade to free maintains existing sessions (grandfather)
- [ ] UI shows correct tier and usage
- [ ] All edge cases handled gracefully

---

**Status:** Ready for Implementation
**Previous:** [02_tier_comparison.md](02_tier_comparison.md) | **Next:** [04_pricing_strategy.md](04_pricing_strategy.md)
