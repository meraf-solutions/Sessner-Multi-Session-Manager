# License System - Technical Documentation

## Architecture Overview

The license validation system is built with three core principles:
1. **100% Local Privacy** - All data stored locally, minimal API calls
2. **Graceful Degradation** - Network failures don't break functionality
3. **Fail-Safe Design** - Always falls back to free tier

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Background Script                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              LicenseManager Instance                  │  │
│  │                                                        │  │
│  │  State:                                               │  │
│  │  • deviceId: Unique device identifier                 │  │
│  │  • licenseData: Current license information           │  │
│  │  • validationTimer: Periodic check interval           │  │
│  │                                                        │  │
│  │  Core Methods:                                        │  │
│  │  • activateLicense()                                  │  │
│  │  • validateLicense()                                  │  │
│  │  • deactivateLicense()                                │  │
│  │  • getTier()                                          │  │
│  │  • getFeatures()                                      │  │
│  │  • hasFeature()                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                  │
│                  chrome.storage.local                        │
│                  (Persistence Layer)                         │
└─────────────────────────────────────────────────────────────┘
                            ↕
         ┌──────────────────┴──────────────────┐
         ↓                                      ↓
┌─────────────────────┐              ┌─────────────────────┐
│   Meraf Solutions   │              │   Message Handlers   │
│      API Calls      │              │   (Integration)      │
│                     │              │                      │
│  • Register Device  │              │  • Session Creation  │
│  • Verify License   │              │  • Feature Checks    │
│  • Validate (light) │              │  • Persistence       │
│  • Deactivate       │              │                      │
└─────────────────────┘              └─────────────────────┘
```

## Device ID Generation

### Privacy-Preserving Fingerprinting

The device ID uses stable browser characteristics without invasive tracking:

```javascript
// Components used for fingerprinting
const components = [
  navigator.userAgent,           // Browser version
  navigator.language,            // User language
  screen.width + 'x' + screen.height,  // Screen resolution
  screen.colorDepth,             // Color depth
  new Date().getTimezoneOffset(), // Timezone
  navigator.hardwareConcurrency, // CPU cores
  navigator.deviceMemory,        // RAM (if available)
  navigator.platform             // OS platform
];

// Hash with SHA-256
const fingerprint = await sha256(components.join('|'));

// Add random salt for uniqueness
const salt = crypto.getRandomValues(new Uint8Array(8));

// Final format: SESSNER_{fingerprint}_{salt}
const deviceId = `SESSNER_${fingerprint.substring(0, 16)}_${salt}`;
```

### Why This Approach?

- **Stable**: Same browser installation = same fingerprint
- **Privacy-Preserving**: No canvas/WebGL/audio fingerprinting
- **No PII**: Contains no personal information
- **Unique**: Random salt prevents collisions
- **Readable**: Clear format for debugging

### Device ID Storage

```javascript
// Stored in chrome.storage.local
{
  "deviceId": "SESSNER_a1b2c3d4e5f6g7h8_12ab34cd56ef78gh"
}
```

## License Activation Flow

### Full Activation Sequence

```
User enters license key
        ↓
  [Validation]
        ↓
  Format check (non-empty, trimmed)
        ↓
  [API Call 1: Register Device]
  POST device ID to API
        ↓
  Device registered? ──NO──→ Return error
        ↓ YES
  [API Call 2: Verify License]
  GET full license details
        ↓
  License valid? ──NO──→ Return error
        ↓ YES
  [Tier Detection]
  Analyze max_allowed_devices & max_allowed_domains
        ↓
  Calculate tier (free/premium/enterprise)
        ↓
  [Store Locally]
  Save to chrome.storage.local:
    • licenseKey
    • tier
    • deviceId
    • timestamps
    • API response
        ↓
  [Success]
  Return tier + features
        ↓
  [UI Update]
  Show notification
  Refresh popup
```

### API Response Structure

```json
{
  "success": true,
  "message": "License verified successfully",
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "product_name": "Sessner Premium",
  "status": "active",
  "max_allowed_domains": 10,
  "max_allowed_devices": 1,
  "registered_devices": 1,
  "created_at": "2025-01-15T10:30:00Z",
  "expires_at": "2026-01-15T10:30:00Z"
}
```

### Tier Detection Algorithm

```javascript
function detectTier(apiResponse) {
  const maxDevices = apiResponse.max_allowed_devices || 0;
  const maxDomains = apiResponse.max_allowed_domains || 0;

  // Enterprise: Multiple devices AND many domains
  if (maxDevices > 1 && maxDomains > 3) {
    return 'enterprise';
  }

  // Premium: Single device BUT many domains
  if (maxDomains > 3 && maxDevices === 1) {
    return 'premium';
  }

  // Free: Everything else
  return 'free';
}
```

### Error Handling

```javascript
try {
  const result = await activateLicense(key);
} catch (error) {
  // Network errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return { success: false, message: 'Network error. Check internet connection.' };
  }

  // Timeout errors
  if (error.message.includes('timeout')) {
    return { success: false, message: 'Request timeout. Try again.' };
  }

  // API errors
  if (error.message.includes('HTTP')) {
    return { success: false, message: 'License server error. Try again later.' };
  }

  // Generic error
  return { success: false, message: error.message };
}
```

## License Validation

### Validation Schedule

```
Hour 0: Check needed? NO
Hour 1: Check needed? NO
...
Day 7: Check needed? YES → Validate
Day 7 + 1 hour: Check needed? NO (just validated)
...
Day 14: Check needed? YES → Validate
```

### Lightweight Validation Endpoint

```javascript
// Instead of full /api/license/verify (heavy response)
// Use lightweight /validate endpoint

const url = `${baseUrl}/validate?t=Sessner&s=${licenseKey}&d=${deviceId}`;
const response = await fetch(url);
const text = await response.text();

if (text.trim() === '1') {
  // Valid
  updateLastValidated();
} else {
  // Invalid
  incrementFailureCount();
}
```

### Validation Failure Handling

```javascript
// Track consecutive failures
licenseData.validationFailures++;

// Downgrade after 5 consecutive failures
if (licenseData.validationFailures >= 5) {
  downgradeLicense('Too many validation failures');
}

// But don't downgrade immediately (might be offline)
// Give grace period
```

### Grace Period Logic

```
Day 0: Activate license
Day 7: Validation due → Fails (offline)
Day 8-14: Warning period (still have features)
Day 15-30: Grace period (still have features but warning)
Day 31: Grace period expired → Downgrade to free
```

### Grace Period Implementation

```javascript
async function checkAndValidate() {
  const now = Date.now();
  const daysSince = (now - licenseData.lastValidated) / (1000 * 60 * 60 * 24);

  // Check validation interval (7 days)
  if (daysSince >= VALIDATION_INTERVAL_DAYS) {
    await validateLicense(); // Try to validate
  }

  // Warning period (7-30 days)
  if (daysSince >= WARNING_PERIOD_DAYS) {
    const daysRemaining = GRACE_PERIOD_DAYS - daysSince;
    console.warn(`Grace period: ${Math.floor(daysRemaining)} days remaining`);
  }

  // Grace period expired (30+ days)
  if (daysSince >= GRACE_PERIOD_DAYS) {
    await downgradeLicense('Grace period exceeded');
  }
}
```

## Feature Gating

### Feature Configuration

```javascript
const TIER_FEATURES = {
  free: {
    maxSessions: 3,
    sessionPersistenceDays: 7,
    sessionNaming: false,
    sessionExport: false,
    sessionTemplates: false,
    encryption: false,
    portableSessions: false,
    localAPI: false,
    multiProfile: false
  },
  premium: {
    maxSessions: Infinity,           // Unlimited
    sessionPersistenceDays: Infinity, // Permanent
    sessionNaming: true,
    sessionExport: true,
    sessionTemplates: true,
    encryption: false,
    portableSessions: false,
    localAPI: false,
    multiProfile: false
  },
  enterprise: {
    maxSessions: Infinity,
    sessionPersistenceDays: Infinity,
    sessionNaming: true,
    sessionExport: true,
    sessionTemplates: true,
    encryption: true,               // AES-256
    portableSessions: true,         // Cross-device
    localAPI: true,                 // HTTP API
    multiProfile: true              // Multi-profile
  }
};
```

### Session Creation Enforcement

```javascript
function createNewSession(url, callback) {
  // Check license tier
  const features = licenseManager.getFeatures();
  const currentCount = Object.keys(sessionStore.sessions).length;

  // Unlimited for premium/enterprise
  if (features.maxSessions === Infinity) {
    // Proceed with creation
    proceedWithSessionCreation(url, callback);
    return;
  }

  // Check limit for free tier
  if (currentCount >= features.maxSessions) {
    callback({
      success: false,
      error: `Session limit reached (${features.maxSessions} for FREE tier)`,
      upgradeRequired: true
    });
    return;
  }

  // Under limit, proceed
  proceedWithSessionCreation(url, callback);
}
```

### Session Persistence Enforcement

```javascript
async function enforceSessionPersistence() {
  const features = licenseManager.getFeatures();

  // Permanent for premium/enterprise
  if (features.sessionPersistenceDays === Infinity) {
    return; // No cleanup needed
  }

  const now = Date.now();
  const maxAge = features.sessionPersistenceDays * 24 * 60 * 60 * 1000;

  // Find expired sessions
  Object.values(sessionStore.sessions).forEach(session => {
    const age = now - session.createdAt;

    // Only remove if no active tabs AND expired
    if (age > maxAge && session.tabs.length === 0) {
      cleanupSession(session.id);
      console.log(`Removed expired session: ${session.id} (age: ${age}ms)`);
    }
  });
}

// Run daily
setInterval(enforceSessionPersistence, 24 * 60 * 60 * 1000);
```

### Feature Check Pattern

```javascript
// In your feature implementation code:

async function enableSessionNaming() {
  // Check if feature is available
  const response = await chrome.runtime.sendMessage({
    action: 'hasFeature',
    featureName: 'sessionNaming'
  });

  if (!response.hasFeature) {
    // Show upgrade prompt
    showUpgradePrompt('Session Naming', 'premium');
    return;
  }

  // Feature available, proceed
  showSessionNamingUI();
}

async function enableEncryption() {
  const response = await chrome.runtime.sendMessage({
    action: 'hasFeature',
    featureName: 'encryption'
  });

  if (!response.hasFeature) {
    showUpgradePrompt('AES-256 Encryption', 'enterprise');
    return;
  }

  // Enable encryption
  initializeEncryption();
}
```

## Storage and Persistence

### Storage Schema

```javascript
// chrome.storage.local structure
{
  // Device identification
  "deviceId": "SESSNER_a1b2c3d4e5f6g7h8_12ab34cd56ef78gh",

  // License data
  "licenseData": {
    "licenseKey": "XXXX-XXXX-XXXX-XXXX",
    "tier": "premium",
    "deviceId": "SESSNER_...",
    "lastValidated": 1705315200000,    // Unix timestamp
    "lastAttempted": 1705315200000,    // Unix timestamp
    "isActive": true,
    "validationFailures": 0,
    "maxAllowedDomains": 10,
    "maxAllowedDevices": 1,
    "apiResponse": {
      // Full API response cached for debugging
      "success": true,
      "product_name": "Sessner Premium",
      // ... rest of response
    }
  }
}
```

### Promisified Storage API

```javascript
// Original chrome.storage.local API is callback-based
chrome.storage.local.get(['key'], (result) => {
  console.log(result.key);
});

// Promisified version for async/await
const storage = {
  get: (keys) => new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  }),
  set: (data) => new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  }),
  remove: (keys) => new Promise((resolve) => {
    chrome.storage.local.remove(keys, resolve);
  })
};

// Usage with async/await
async function example() {
  const data = await storage.get('licenseData');
  console.log(data.licenseData);

  await storage.set({ licenseData: newData });
  await storage.remove('licenseData');
}
```

## Network Layer

### Fetch with Timeout

```javascript
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });

    clearTimeout(timeoutId);
    return response;

  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}
```

### Exponential Backoff Retry

```javascript
async function fetchWithRetry(url, attempt = 0) {
  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [1000, 3000, 10000]; // 1s, 3s, 10s

  try {
    const response = await fetchWithTimeout(url, 10000);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    // Retry if attempts remaining
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAYS[attempt];
      console.log(`Retry in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);

      await new Promise(resolve => setTimeout(resolve, delay));
      return fetchWithRetry(url, attempt + 1);
    }

    // All retries exhausted
    throw new Error(`Failed after ${MAX_RETRIES} retries: ${error.message}`);
  }
}
```

### Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor() {
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.threshold = 5;
    this.timeout = 60000; // 1 minute
  }

  async execute(fn) {
    if (this.state === 'OPEN') {
      // Check if timeout expired
      if (Date.now() - this.openedAt > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();

      // Success - reset
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
      }
      this.failureCount = 0;

      return result;

    } catch (error) {
      this.failureCount++;

      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN';
        this.openedAt = Date.now();
      }

      throw error;
    }
  }
}
```

## Best Practices

### 1. Always Check License Before Features

```javascript
// GOOD
async function exportSession(sessionId) {
  if (!licenseManager.hasFeature('sessionExport')) {
    showUpgradeDialog();
    return;
  }

  // Proceed with export
  performExport(sessionId);
}

// BAD
async function exportSession(sessionId) {
  // No license check - feature available to all users
  performExport(sessionId);
}
```

### 2. Graceful Degradation

```javascript
// GOOD
async function createSession() {
  const check = checkSessionCreationAllowed();

  if (!check.allowed) {
    // Show informative error
    showError(check.reason);
    return;
  }

  // Proceed
  createNewSession();
}

// BAD
async function createSession() {
  // Hard fail without explanation
  if (sessionCount >= 3) {
    throw new Error('Limit reached');
  }
}
```

### 3. Use Message Handlers

```javascript
// GOOD - Centralized in background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'hasFeature') {
    const hasFeature = licenseManager.hasFeature(request.featureName);
    sendResponse({ success: true, hasFeature });
  }
});

// BAD - Direct access from content script (not possible)
const hasFeature = licenseManager.hasFeature('encryption'); // Error!
```

### 4. Cache License Info in UI

```javascript
// GOOD - Cache for session
let cachedTier = null;

async function getTier() {
  if (!cachedTier) {
    const response = await chrome.runtime.sendMessage({ action: 'getTier' });
    cachedTier = response.tier;
  }
  return cachedTier;
}

// BAD - Fetch every time
async function getTier() {
  const response = await chrome.runtime.sendMessage({ action: 'getTier' });
  return response.tier;
}
```

### 5. Handle Errors Properly

```javascript
// GOOD
try {
  const result = await licenseManager.activateLicense(key);

  if (result.success) {
    showSuccess(`Activated ${result.tier} tier`);
  } else {
    showError(result.message); // Specific error
  }
} catch (error) {
  showError(`Activation failed: ${error.message}`);
  console.error('Activation error:', error);
}

// BAD
const result = await licenseManager.activateLicense(key);
// No error handling - will crash on network error
```

## Security Considerations

### API Key Exposure

**Issue**: API secret keys are visible in extension source code

**Mitigation**:
- API keys only validate licenses, don't grant admin access
- Meraf Solutions API has rate limiting
- Keys can be rotated if compromised
- This is standard practice for client-side validation

### Device ID Privacy

**Issue**: Device ID could be used for tracking

**Mitigation**:
- ID never leaves device except to Meraf API
- No cross-domain tracking
- Random salt prevents correlation
- User can reset by reinstalling extension

### License Key Security

**Issue**: License keys stored in plaintext

**Mitigation**:
- chrome.storage.local is encrypted by browser
- Only accessible by extension
- Cleared on uninstall
- User can deactivate anytime

## Performance Optimization

### 1. Debounced Validation Checks

```javascript
// Don't check every minute
// Check every hour if validation DUE

setInterval(() => {
  const daysSince = (Date.now() - lastValidated) / (1000 * 60 * 60 * 24);

  if (daysSince >= 7) {
    // Only validate if needed
    validateLicense();
  }
}, 60 * 60 * 1000); // Every hour
```

### 2. Lightweight Validation Endpoint

```javascript
// Instead of full verify (large response):
GET /api/license/verify/{secret}/{key}
// Returns: { success: true, license_key: ..., status: ..., ... }

// Use lightweight validate:
GET /validate?t=Sessner&s={key}&d={device}
// Returns: "1" or "0"
```

### 3. Cached Feature Checks

```javascript
// Cache features for 1 minute
let featureCache = null;
let cacheTime = 0;

function getFeatures() {
  const now = Date.now();

  if (!featureCache || (now - cacheTime) > 60000) {
    featureCache = licenseManager.getFeatures();
    cacheTime = now;
  }

  return featureCache;
}
```

## Testing Strategy

### Unit Tests

```javascript
// Test tier detection
describe('detectTier', () => {
  it('should detect enterprise tier', () => {
    const response = { max_allowed_devices: 5, max_allowed_domains: 10 };
    expect(detectTier(response)).toBe('enterprise');
  });

  it('should detect premium tier', () => {
    const response = { max_allowed_devices: 1, max_allowed_domains: 10 };
    expect(detectTier(response)).toBe('premium');
  });

  it('should default to free tier', () => {
    const response = { max_allowed_devices: 1, max_allowed_domains: 1 };
    expect(detectTier(response)).toBe('free');
  });
});
```

### Integration Tests

```javascript
// Test activation flow
describe('License Activation', () => {
  it('should activate valid license', async () => {
    const result = await licenseManager.activateLicense('TEST-KEY', true);
    expect(result.success).toBe(true);
    expect(result.tier).toBe('premium');
  });

  it('should reject invalid license', async () => {
    const result = await licenseManager.activateLicense('INVALID', true);
    expect(result.success).toBe(false);
  });
});
```

### Manual Testing Checklist

- [ ] Activate free tier license
- [ ] Activate premium tier license
- [ ] Activate enterprise tier license
- [ ] Validate active license
- [ ] Deactivate license
- [ ] Test session creation limits (free tier)
- [ ] Test unlimited sessions (premium tier)
- [ ] Test grace period warning
- [ ] Test grace period expiration
- [ ] Test network failure during activation
- [ ] Test network failure during validation
- [ ] Test popup UI display
- [ ] Test tier badge display
- [ ] Test feature list display

## Conclusion

This license system provides:
- ✓ Secure, privacy-preserving validation
- ✓ Graceful handling of network failures
- ✓ Clear tier-based feature gating
- ✓ Comprehensive error handling
- ✓ Production-ready code quality
- ✓ Full integration with Meraf Solutions API
- ✓ Maintains "100% Local, 100% Private" architecture

All while being maintainable, testable, and user-friendly.
