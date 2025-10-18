# License Validation System
## Sessner – Multi-Session Manager

**Document Version:** 2.0
**Last Updated:** 2025-10-18
**License API:** https://sandbox.merafsolutions.com/

---

## 🔐 Overview

Sessner uses a **privacy-first, local-validated** license system integrated with Meraf Solutions' custom licensing API. The system validates Premium and Enterprise licenses while maintaining our "100% Local, 100% Private" architecture.

### Core Principles
1. **Default to Free**: No license = Free tier (3 sessions, 7-day persistence)
2. **Local-First**: License data cached locally, validated periodically
3. **Offline-Capable**: Works for 30 days without internet after validation
4. **Privacy-Preserving**: Device ID is browser fingerprint + salt (non-reversible)
5. **Fair Enforcement**: Downgrade to free tier on expiry, never lock out users

---

## 🌐 Licensing API Integration

### Base Configuration
```javascript
const LICENSE_CONFIG = {
  API_BASE_URL: 'https://sandbox.merafsolutions.com',
  PRODUCT_NAME: 'Sessner',
  SECRET_KEYS: {
    RETRIEVE_LICENSE: 'X5UTwKJzY1gmhI3jTTB2',
    REGISTER_DEVICE: 'jYXqBGUDHk4x5d1YISDu',
    DEACTIVATE_DEVICE: 'jYXqBGUDHk4x5d1YISDu'
  },
  VALIDATION_INTERVAL: 7, // days
  GRACE_PERIOD: 30 // days
};
```

---

## 📡 API Endpoints

### 1. **Retrieve License Data** (Verify License)

**Endpoint:**
```
GET /api/license/verify/{secret_key}/{license_key}
```

**URL:**
```
https://sandbox.merafsolutions.com/api/license/verify/X5UTwKJzY1gmhI3jTTB2/{license_key}
```

**Response (Success):**
```json
{
  "result": "success",
  "message": "License key is valid",
  "status": "active",
  "license_type": "regular",
  "item_reference": "Sessner",
  "license_key": "SESS-PREM-A1B2-C3D4-E5F6",
  "max_allowed_domains": "999",
  "max_allowed_devices": "1",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "date_created": "2025-10-18 10:30:00",
  "date_expiry": null
}
```

**Response (Error):**
```json
{
  "result": "error",
  "message": "License key does not exist"
}
```

**Tier Detection Logic:**
```javascript
function detectTier(licenseData) {
  const maxDomains = parseInt(licenseData.max_allowed_domains);
  const maxDevices = parseInt(licenseData.max_allowed_devices);

  // Enterprise: Multiple devices allowed (portable sessions feature)
  if (maxDevices > 1 && maxDomains > 3) {
    return 'enterprise';
  }

  // Premium: Unlimited sessions (high domain count), single device
  if (maxDomains > 3) {
    return 'premium';
  }

  // Free tier fallback
  return 'free';
}
```

---

### 2. **Register Device to License** (Activate on Device)

**Endpoint:**
```
GET /api/license/register/device/{device_id}/{secret_key}/{license_key}
```

**URL:**
```
https://sandbox.merafsolutions.com/api/license/register/device/{device_id}/jYXqBGUDHk4x5d1YISDu/{license_key}
```

**Parameters:**
- `{device_id}`: Browser fingerprint + salt (e.g., `SESSNER_abc123def456_x7y8z9`)
- `{secret_key}`: `jYXqBGUDHk4x5d1YISDu`
- `{license_key}`: User's license key (e.g., `SESS-PREM-A1B2-C3D4-E5F6`)

**Response (Success):**
```json
{
  "result": "success",
  "message": "Device has been successfully added to the license key"
}
```

**Response (Error - Limit Reached):**
```json
{
  "result": "error",
  "message": "This license key has reached maximum number of devices"
}
```

**Response (Error - Already Registered):**
```json
{
  "result": "error",
  "message": "Device already registered to this license key"
}
```

---

### 3. **Deactivate Device from License** (Remove Device)

**Endpoint:**
```
GET /api/license/unregister/device/{device_id}/{secret_key}/{license_key}
```

**URL:**
```
https://sandbox.merafsolutions.com/api/license/unregister/device/{device_id}/jYXqBGUDHk4x5d1YISDu/{license_key}
```

**Response (Success):**
```json
{
  "result": "success",
  "message": "Device has been successfully removed from the license key"
}
```

**Response (Error):**
```json
{
  "result": "error",
  "message": "Device is not registered to this license key"
}
```

---

### 4. **Lightweight Validation** (Periodic Check)

**Endpoint:**
```
GET /validate?t={product_name}&s={license_key}&d={device_id}
```

**URL:**
```
https://sandbox.merafsolutions.com/validate?t=Sessner&s={license_key}&d={device_id}
```

**Response:**
- `1` = Valid (license active, device registered)
- `0` = Invalid (expired, revoked, or device not registered)

**Usage:**
```javascript
async function quickValidation(licenseKey, deviceId) {
  const url = `https://sandbox.merafsolutions.com/validate?t=Sessner&s=${licenseKey}&d=${deviceId}`;
  const response = await fetch(url);
  const result = await response.text();
  return result === '1';
}
```

---

## 🔑 Device ID Generation

### Browser Fingerprinting (Privacy-Preserving)

```javascript
/**
 * Generate unique device ID for this browser installation
 * Format: SESSNER_{fingerprint}_{salt}
 */
async function generateDeviceId() {
  // 1. Collect browser characteristics
  const components = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    colorDepth: screen.colorDepth
  };

  // 2. Generate fingerprint hash
  const fingerprint = JSON.stringify(components);
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 3. Take first 12 characters of hash
  const fingerprintId = hashHex.substring(0, 12);

  // 4. Add random salt for uniqueness
  const salt = generateRandomString(10);

  // 5. Construct device ID
  const deviceId = `SESSNER_${fingerprintId}_${salt}`;

  return deviceId;
}

function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

**Example Device ID:**
```
SESSNER_a1b2c3d4e5f6_X7Y8Z9W0V1
```

**Privacy Notes:**
- ✅ Device ID stored locally only
- ✅ Not reversible to personal data
- ✅ Unique per browser installation
- ✅ No cross-site tracking
- ✅ Used only for license validation

---

## 🎯 License Tiers & Feature Mapping

### Tier Detection from API Response

Based on `max_allowed_devices` and `max_allowed_domains`:

```javascript
TIER_DETECTION_RULES = {
  free: {
    criteria: 'No license key',
    maxSessions: 3,
    maxDevices: 1,
    persistence: 7 // days
  },

  premium: {
    criteria: 'max_allowed_domains > 3 && max_allowed_devices === 1',
    maxSessions: Infinity,
    maxDevices: 1,
    persistence: Infinity
  },

  enterprise: {
    criteria: 'max_allowed_domains > 3 && max_allowed_devices > 1',
    maxSessions: Infinity,
    maxDevices: 3, // Portable sessions across devices
    persistence: Infinity
  }
};
```

### Feature Configuration

```javascript
const TIER_FEATURES = {
  free: {
    maxSessions: 3,
    sessionPersistence: 7, // days
    coloredBadges: 6,
    sessionNaming: false,
    exportImport: false,
    sessionTemplates: false,
    encryption: false,
    portableSessions: false,
    localAPI: false,
    multiProfile: false,
    analytics: false,
    support: 'community'
  },

  premium: {
    maxSessions: Infinity,
    sessionPersistence: Infinity,
    coloredBadges: 12,
    sessionNaming: true,
    exportImport: true,
    sessionTemplates: true,
    encryption: false,
    portableSessions: false,
    localAPI: false,
    multiProfile: false,
    analytics: 'basic',
    support: 'email'
  },

  enterprise: {
    maxSessions: Infinity,
    sessionPersistence: Infinity,
    coloredBadges: Infinity,
    sessionNaming: true,
    exportImport: true,
    sessionTemplates: true,
    encryption: 'AES-256',
    portableSessions: true, // Enabled by max_allowed_devices > 1
    localAPI: true,
    multiProfile: true,
    analytics: 'advanced',
    support: 'priority'
  }
};
```

---

## 🔄 License Activation Flow

### Complete Activation Process

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User enters license key in extension                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. Extension generates device ID (if not exists)            │
│    Device ID: SESSNER_abc123def456_X7Y8Z9                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Call: /api/license/register/device/{device_id}/{secret}/ │
│          {license_key}                                       │
│    Result: "Device added successfully"                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. Call: /api/license/verify/{secret}/{license_key}         │
│    Returns: Full license details (tier, expiry, user info)  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Detect tier from response:                               │
│    - max_allowed_devices > 1 → Enterprise                   │
│    - max_allowed_domains > 3 → Premium                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. Store license data locally:                              │
│    {                                                         │
│      key: "SESS-PREM-...",                                   │
│      tier: "premium",                                        │
│      status: "active",                                       │
│      email: "user@example.com",                              │
│      dateActivated: "2025-10-18",                            │
│      lastValidated: "2025-10-18",                            │
│      deviceId: "SESSNER_..."                                 │
│    }                                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. Features unlocked immediately                            │
│    Show: "Welcome to Sessner PREMIUM!"                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Periodic Validation Flow

### Every 7 Days (Automatic Background Validation)

```javascript
async function performPeriodicValidation() {
  // 1. Check if validation is needed
  const licenseCache = await loadCachedLicense();
  if (!licenseCache) return; // No license

  const daysSinceValidation = getDaysSince(licenseCache.lastValidated);
  if (daysSinceValidation < 7) return; // Too soon

  // 2. Attempt lightweight validation
  try {
    const url = `https://sandbox.merafsolutions.com/validate?t=Sessner&s=${licenseCache.key}&d=${licenseCache.deviceId}`;
    const response = await fetch(url, { timeout: 5000 });
    const result = await response.text();

    if (result === '1') {
      // Valid - update timestamp
      licenseCache.lastValidated = new Date().toISOString();
      await saveLicense(licenseCache);
      console.log('[License] Validation successful');
    } else {
      // Invalid - mark as expired
      licenseCache.status = 'expired';
      await saveLicense(licenseCache);
      console.warn('[License] License expired or revoked');
    }
  } catch (error) {
    // Network error - trust cache if within grace period
    const gracePeriodDays = getDaysSince(licenseCache.lastValidated);
    if (gracePeriodDays <= 30) {
      console.warn('[License] Validation failed, using cached license (grace period)');
    } else {
      console.error('[License] Grace period expired, downgrading to free');
      licenseCache.status = 'expired';
      await saveLicense(licenseCache);
    }
  }
}

// Run validation check every hour (when extension is active)
setInterval(performPeriodicValidation, 60 * 60 * 1000);
```

---

## 💾 Local Storage Structure

### chrome.storage.local Schema

```javascript
{
  // Device identification (persistent)
  sessner_device_id: "SESSNER_a1b2c3d4e5f6_X7Y8Z9W0V1",

  // License information
  sessner_license: {
    // From API response
    key: "SESS-PREM-A1B2-C3D4-E5F6",
    tier: "premium", // Detected from max_allowed_devices/domains
    status: "active", // active, expired, blocked
    type: "regular", // regular, lifetime
    email: "user@example.com",
    firstName: "John",
    lastName: "Doe",

    // License limits (from API)
    maxAllowedDomains: 999,
    maxAllowedDevices: 1,

    // Dates
    dateCreated: "2025-10-18 10:30:00",
    dateExpiry: null, // null = lifetime
    dateActivated: "2025-10-18T12:00:00.000Z", // When activated on this device
    lastValidated: "2025-10-18T12:00:00.000Z", // Last successful validation

    // Device association
    deviceId: "SESSNER_a1b2c3d4e5f6_X7Y8Z9W0V1",

    // Feature cache (for offline use)
    features: {
      maxSessions: Infinity,
      sessionPersistence: Infinity,
      sessionNaming: true,
      exportImport: true,
      // ... other features
    }
  },

  // Session store (existing)
  sessionStore: {
    sessions: { /* ... */ },
    tabToSession: { /* ... */ },
    cookieStore: { /* ... */ }
  }
}
```

---

## 🛡️ Anti-Piracy & Fair Enforcement

### Device Activation Limits

```javascript
// Based on max_allowed_devices from API
ACTIVATION_LIMITS = {
  premium: 1,      // Single device only
  enterprise: 3    // Up to 3 devices (portable sessions)
};
```

**Enforcement Flow:**
1. User tries to activate on 4th device (Enterprise)
2. API returns: `"This license key has reached maximum number of devices"`
3. Extension shows: "You've reached the device limit (3/3). Please deactivate an existing device to activate here."
4. User can deactivate via license management UI

### Grace Period System

```javascript
GRACE_PERIODS = {
  validationInterval: 7,  // Validate every 7 days when online
  offlineGrace: 30,       // Trust cached license for 30 days offline
  expiryWarning: 7        // Show expiry warning 7 days before
};
```

**Offline Behavior:**
- **Days 0-7**: No validation needed
- **Days 8-30**: Grace period active, show reminder: "Couldn't validate license (offline). Please connect to internet within X days."
- **Days 31+**: Downgrade to free tier, show: "License validation failed. You've been downgraded to the Free tier. Please reconnect and reactivate."

### Fair Enforcement Principles

✅ **DO:**
- Allow offline usage with grace period
- Downgrade to free tier (don't lock out)
- Show clear, helpful error messages
- Allow manual reactivation
- Provide self-service deactivation

❌ **DON'T:**
- Brick the extension completely
- Show aggressive warnings
- Track user behavior beyond license validation
- Require constant internet connection
- Make deactivation difficult

---

## 🧪 Implementation Code Examples

### License Manager Class (Core Implementation)

```javascript
class LicenseManager {
  constructor() {
    this.API_BASE_URL = 'https://sandbox.merafsolutions.com';
    this.SECRET_KEYS = {
      RETRIEVE: 'X5UTwKJzY1gmhI3jTTB2',
      REGISTER: 'jYXqBGUDHk4x5d1YISDu',
      DEACTIVATE: 'jYXqBGUDHk4x5d1YISDu'
    };
    this.PRODUCT_NAME = 'Sessner';
    this.deviceId = null;
    this.licenseCache = null;
  }

  /**
   * Activate license on this device
   */
  async activateLicense(licenseKey) {
    try {
      // Step 1: Ensure device ID exists
      if (!this.deviceId) {
        this.deviceId = await this.getOrCreateDeviceId();
      }

      // Step 2: Register device to license
      const registerUrl = `${this.API_BASE_URL}/api/license/register/device/${this.deviceId}/${this.SECRET_KEYS.REGISTER}/${licenseKey}`;
      const registerResponse = await fetch(registerUrl);
      const registerResult = await registerResponse.json();

      if (registerResult.result === 'error') {
        throw new Error(registerResult.message);
      }

      // Step 3: Retrieve full license details
      const verifyUrl = `${this.API_BASE_URL}/api/license/verify/${this.SECRET_KEYS.RETRIEVE}/${licenseKey}`;
      const verifyResponse = await fetch(verifyUrl);
      const licenseData = await verifyResponse.json();

      if (licenseData.result === 'error') {
        throw new Error(licenseData.message);
      }

      // Step 4: Validate product
      if (licenseData.item_reference !== this.PRODUCT_NAME) {
        throw new Error('License key is not valid for Sessner');
      }

      // Step 5: Detect tier
      const tier = this.detectTier(licenseData);

      // Step 6: Store license locally
      const licenseInfo = {
        key: licenseKey,
        tier: tier,
        status: licenseData.status,
        type: licenseData.license_type,
        email: licenseData.email,
        firstName: licenseData.first_name,
        lastName: licenseData.last_name,
        maxAllowedDomains: parseInt(licenseData.max_allowed_domains),
        maxAllowedDevices: parseInt(licenseData.max_allowed_devices),
        dateCreated: licenseData.date_created,
        dateExpiry: licenseData.date_expiry,
        dateActivated: new Date().toISOString(),
        lastValidated: new Date().toISOString(),
        deviceId: this.deviceId,
        features: this.getFeaturesForTier(tier)
      };

      await this.saveLicense(licenseInfo);
      this.licenseCache = licenseInfo;

      return {
        success: true,
        tier: tier,
        message: `License activated successfully! Welcome to Sessner ${tier.toUpperCase()}.`
      };

    } catch (error) {
      console.error('[License Manager] Activation failed:', error);
      return {
        success: false,
        tier: 'free',
        message: error.message || 'License activation failed'
      };
    }
  }

  /**
   * Detect tier from API response
   */
  detectTier(licenseData) {
    const maxDomains = parseInt(licenseData.max_allowed_domains);
    const maxDevices = parseInt(licenseData.max_allowed_devices);

    // Enterprise: Multiple devices (portable sessions)
    if (maxDevices > 1 && maxDomains > 3) {
      return 'enterprise';
    }

    // Premium: Unlimited sessions, single device
    if (maxDomains > 3) {
      return 'premium';
    }

    // Free tier
    return 'free';
  }

  /**
   * Validate license (lightweight check)
   */
  async validateLicense() {
    if (!this.licenseCache) return false;

    try {
      const url = `${this.API_BASE_URL}/validate?t=${this.PRODUCT_NAME}&s=${this.licenseCache.key}&d=${this.deviceId}`;
      const response = await fetch(url, { timeout: 5000 });
      const result = await response.text();

      if (result === '1') {
        this.licenseCache.lastValidated = new Date().toISOString();
        await this.saveLicense(this.licenseCache);
        return true;
      } else {
        this.licenseCache.status = 'expired';
        await this.saveLicense(this.licenseCache);
        return false;
      }
    } catch (error) {
      // Network error - check grace period
      return this.isWithinGracePeriod();
    }
  }

  /**
   * Deactivate license on this device
   */
  async deactivateLicense() {
    if (!this.licenseCache) {
      return { success: false, message: 'No active license' };
    }

    try {
      const url = `${this.API_BASE_URL}/api/license/unregister/device/${this.deviceId}/${this.SECRET_KEYS.DEACTIVATE}/${this.licenseCache.key}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.result === 'success') {
        await this.clearLicense();
        this.licenseCache = null;
        return { success: true, message: 'License deactivated successfully' };
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  /**
   * Get current tier
   */
  async getTier() {
    if (!this.licenseCache) return 'free';

    if (this.licenseCache.status !== 'active') return 'free';

    if (this.licenseCache.dateExpiry) {
      const expiry = new Date(this.licenseCache.dateExpiry);
      if (expiry < new Date()) return 'free';
    }

    return this.licenseCache.tier;
  }

  /**
   * Check if within grace period
   */
  isWithinGracePeriod() {
    if (!this.licenseCache || !this.licenseCache.lastValidated) return false;

    const lastValidated = new Date(this.licenseCache.lastValidated);
    const daysSince = (Date.now() - lastValidated.getTime()) / (1000 * 60 * 60 * 24);

    return daysSince < 30;
  }

  // ... storage methods (getOrCreateDeviceId, saveLicense, loadLicense, etc.)
}
```

---

## 🧪 Testing Scenarios

### Test Cases

1. **✅ Valid Premium License Activation**
   - Input: Valid PREM license key
   - Expected: Tier = premium, unlimited sessions unlocked

2. **✅ Valid Enterprise License Activation**
   - Input: Valid PLUS license key (max_allowed_devices > 1)
   - Expected: Tier = enterprise, all features unlocked

3. **✅ Invalid License Key**
   - Input: Non-existent key
   - Expected: Error "License key does not exist"

4. **✅ Device Limit Reached**
   - Input: Valid key on 4th device (Enterprise, limit 3)
   - Expected: Error "Maximum number of devices reached"

5. **✅ Offline Grace Period**
   - Scenario: No internet for 20 days
   - Expected: License still valid, grace period message shown

6. **✅ Expired License**
   - Scenario: License with date_expiry in past
   - Expected: Downgrade to free tier

7. **✅ Periodic Validation (Online)**
   - Scenario: After 7 days, extension validates
   - Expected: /validate returns "1", lastValidated updated

8. **✅ Periodic Validation (Offline)**
   - Scenario: After 7 days, no internet
   - Expected: Grace period continues, warning shown

9. **✅ Deactivation**
   - Action: User deactivates device
   - Expected: License removed, tier = free, API confirms removal

10. **✅ Wrong Product**
    - Input: License for different product
    - Expected: Error "License key is not valid for Sessner"

---

## 📊 Implementation Timeline

### Phase 1: Core License Module (Week 1)
- ✅ Build `license-manager.js`
- ✅ Implement device ID generation
- ✅ Implement activation flow
- ✅ Integrate with Meraf Solutions API
- ✅ Add local storage persistence

### Phase 2: Feature Gating (Week 2)
- ✅ Add session limit checks (maxSessions)
- ✅ Implement tier-based feature flags
- ✅ Update background.js with license checks
- ✅ Add upgrade prompts when limits hit

### Phase 3: License UI (Week 3)
- ✅ Create license activation page
- ✅ Build license management interface
- ✅ Add tier indicator to popup
- ✅ Show feature availability

### Phase 4: Validation & Polish (Week 4)
- ✅ Implement periodic validation
- ✅ Add grace period logic
- ✅ Handle offline scenarios
- ✅ Test all edge cases
- ✅ Polish error messages

---

## 🔐 Security Considerations

### API Key Security

**✅ Safe Practices:**
- Secret keys hardcoded in extension (acceptable for read-only operations)
- HTTPS-only communication
- Keys are not reversible to sensitive data
- Keys only grant specific API access (register/verify/deactivate)

**⚠️ Trade-offs:**
- Secret keys visible in extension source code
- Acceptable because: API enforces rate limiting, device limits, and license validation server-side
- Malicious actors can't generate valid licenses (server-controlled)

### Privacy Protection

**Device ID:**
- ✅ Non-reversible browser fingerprint
- ✅ Includes random salt (unique per installation)
- ✅ Not tied to personal information
- ✅ Only used for license validation
- ✅ Stored locally only

**License Data:**
- ✅ Stored in chrome.storage.local (private to extension)
- ✅ Never shared with third parties
- ✅ Only communicated with Meraf Solutions API
- ✅ User email visible only in license UI (user's own data)

---

## 📝 Customer Self-Service

### License Management Portal

**Features Available:**
- View license status and tier
- See active devices (via API)
- Deactivate devices remotely
- Upgrade/downgrade tier
- View expiration date

**Portal URL Structure:**
```
https://portal.merafsolutions.com/
  /licenses/{license_key}
  /devices
  /billing
  /support
```

### In-Extension License Management

**User Actions:**
1. **Activate**: Enter license key → Activate
2. **View Status**: See tier, expiry, registered email
3. **Deactivate**: Remove license from current device
4. **Upgrade**: Link to purchase page

---

## ✅ Checklist for Launch

### Backend (Meraf Solutions API)
- [x] License generation system configured
- [x] API endpoints tested and verified
- [x] Device limit enforcement working
- [x] Validation endpoint (/validate) functional
- [x] Rate limiting configured

### Extension Implementation
- [ ] `license-manager.js` created
- [ ] Device ID generation implemented
- [ ] Activation flow integrated
- [ ] Periodic validation scheduled
- [ ] Grace period logic implemented
- [ ] Feature gating added to background.js
- [ ] License UI created (activation page)
- [ ] Tier indicators added to popup
- [ ] Error handling for all edge cases
- [ ] Offline mode tested

### Testing
- [ ] All 10 test scenarios passed
- [ ] Edge cases handled gracefully
- [ ] Error messages clear and helpful
- [ ] Performance acceptable (<100ms license checks)
- [ ] Privacy audit completed

### Documentation
- [x] API integration documented
- [x] Security considerations reviewed
- [x] Privacy policy updated (if needed)
- [ ] User guide created
- [ ] Support documentation prepared

---

**Status:** Ready for Implementation
**API Provider:** Meraf Solutions
**API Base URL:** https://sandbox.merafsolutions.com/
**Previous:** [05_ui_mockups.md](05_ui_mockups.md) | **Next:** [07_timeline.md](07_timeline.md)
