# Subscription & Licensing API Documentation
## Sessner  Multi-Session Manager

**Last Updated:** 2025-10-21
**API Version:** 1.0
**Provider:** Meraf Solutions
**Product:** Sessner

---

## Table of Contents

1. [Overview](#overview)
2. [API Configuration](#api-configuration)
3. [Development License Keys](#development-license-keys)
4. [Authentication](#authentication)
5. [API Endpoints](#api-endpoints)
6. [Tier Detection](#tier-detection)
7. [Device ID Generation](#device-id-generation)
8. [License Activation Flow](#license-activation-flow)
9. [License Validation Flow](#license-validation-flow)
10. [Grace Period System](#grace-period-system)
11. [Error Handling](#error-handling)
12. [Feature Mapping](#feature-mapping)
13. [Testing & Debugging](#testing--debugging)

---

## Overview

Sessner uses Meraf Solutions' custom licensing API to validate Premium and Enterprise licenses while maintaining our **"100% Local, 100% Private"** architecture. The system is designed with privacy-first principles, offline capability, and fair enforcement.

### Core Principles

- **Default to Free**: No license = Free tier (3 sessions, 7-day persistence)
- **Local-First**: License data cached locally, validated periodically
- **Offline-Capable**: Works for 30 days without internet after validation
- **Privacy-Preserving**: Device ID is non-reversible browser fingerprint + salt
- **Fair Enforcement**: Downgrade to free tier on expiry, never lock out users

### API Endpoints Summary

| Endpoint | Purpose | Method | Authentication |
|----------|---------|--------|----------------|
| `/api/license/verify/{secret}/{key}` | Verify license validity | GET | Secret key |
| `/api/license/register/device/{device}/{secret}/{key}` | Register device | GET | Secret key |
| `/api/license/unregister/device/{device}/{secret}/{key}` | Unregister device | GET | Secret key |
| `/validate?t={product}&s={key}&d={device}` | Lightweight validation | GET | None |

---

## API Configuration

### Production Configuration

```javascript
const LICENSE_CONFIG = {
  // Production API
  API_BASE_URL: 'https://prod.merafsolutions.com',

  // Product Information
  PRODUCT_NAME: 'Sessner',
  PRODUCT_VARIATIONS: {
    PREMIUM: 'Sessner Premium',
    ENTERPRISE: 'Sessner Enterprise'
  },

  // Secret Keys (API Authentication)
  SECRET_KEYS: {
    RETRIEVE_LICENSE: 'X5UTwKJzY1gmhI3jTTB2',
    REGISTER_DEVICE: 'jYXqBGUDHk4x5d1YISDu',
    DEACTIVATE_DEVICE: 'jYXqBGUDHk4x5d1YISDu'
  },

  // Validation Settings
  VALIDATION_INTERVAL: 7,  // days - validate every 7 days
  GRACE_PERIOD: 30,        // days - work offline for 30 days
  RETRY_ATTEMPTS: 3,       // retry failed API calls
  RETRY_DELAYS: [1000, 3000, 10000], // ms - exponential backoff
  TIMEOUT: 10000           // ms - API request timeout
};
```

### Sandbox Configuration (Testing)

```javascript
const LICENSE_CONFIG_SANDBOX = {
  API_BASE_URL: 'https://sandbox.merafsolutions.com',
  // ... rest same as production
};
```

---

## Development vs Production Mode

### Switching Between Environments

The license manager uses a single constant to control which API environment is used:

**File**: `license-manager.js` (Line 54)

```javascript
this.IS_DEVELOPMENT = true;  // Set to false for production
```

### Configuration by Environment

| Environment | IS_DEVELOPMENT | API Base URL | Secret Keys |
|-------------|----------------|--------------|-------------|
| **Development** | `true` | `https://sandbox.merafsolutions.com` | Development keys (sandbox) |
| **Production** | `false` | `https://prod.merafsolutions.com` | Production keys (live) |

### Before Going Live

**CRITICAL**: Before deploying to production, you MUST change this value:

```javascript
// In license-manager.js, line 54:
this.IS_DEVELOPMENT = false;  // ← Change to false for production
```

This single change will:
- ✓ Switch API from sandbox to production
- ✓ Use production secret keys automatically
- ✓ Connect to live license validation system
- ✓ Enable real license key validation

### Testing Workflow

**Development (Testing)**:
```javascript
this.IS_DEVELOPMENT = true;
// Uses: https://sandbox.merafsolutions.com
// Test with development license keys
```

**Production (Live)**:
```javascript
this.IS_DEVELOPMENT = false;
// Uses: https://prod.merafsolutions.com
// Real user license keys validated
```

### Verification

After changing to production mode, verify:
1. Check console logs show prod.merafsolutions.com URLs
2. Test with a real (non-development) license key
3. Ensure validation endpoints return expected results
4. Monitor for any API errors in production

---

## Development License Keys

### Premium License (Development)

```
YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1
```

**Expected Behavior:**
- **Tier**: `premium`
- **Features**: Unlimited sessions, session naming, export/import, session templates, 12 colored badges
- **Device Limit**: 1 device
- **Persistence**: Unlimited
- **Max Allowed Domains**: 999
- **Max Allowed Devices**: 1

### Enterprise License (Development)

```
XC3CBDD2G8W0N5JFA5ZCPBW9N2P4W2W403P0B3HF
```

**Expected Behavior:**
- **Tier**: `enterprise`
- **Features**: All Premium features PLUS AES-256 encryption, portable sessions, local API server, multi-profile management
- **Device Limit**: 3 devices (enables portable sessions feature)
- **Persistence**: Unlimited
- **Max Allowed Domains**: 999
- **Max Allowed Devices**: 3

### Testing Workflow

```javascript
// 1. Test Premium Activation
await licenseManager.activateLicense('YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1');
// Expected: { success: true, tier: 'premium', message: '...' }

// 2. Test Enterprise Activation
await licenseManager.activateLicense('XC3CBDD2G8W0N5JFA5ZCPBW9N2P4W2W403P0B3HF');
// Expected: { success: true, tier: 'enterprise', message: '...' }

// 3. Test Feature Availability
const tier = await licenseManager.getTier();
console.log('Current tier:', tier); // 'premium' or 'enterprise'

const hasEncryption = await licenseManager.hasFeature('encryption');
console.log('Has encryption:', hasEncryption); // false for premium, true for enterprise
```

**Important:**
- These keys are for development/testing only
- Do not share these keys publicly
- Replace with production keys before release
- Test both online and offline scenarios
- Verify grace period behavior (disconnect internet after activation)

---

## Authentication

### Secret Keys

The API uses secret keys for authentication. These keys are hardcoded in the extension and provide access to specific endpoints.

**Security Model:**
- Secret keys are visible in extension source code (acceptable trade-off)
- API enforces rate limiting server-side
- Server validates all license operations
- Malicious actors cannot generate valid licenses (server-controlled)
- Device limits enforced server-side

**Available Secret Keys:**

| Operation | Secret Key | Purpose |
|-----------|-----------|---------|
| Retrieve License | `X5UTwKJzY1gmhI3jTTB2` | Verify license and get details |
| Register Device | `jYXqBGUDHk4x5d1YISDu` | Register device to license |
| Deactivate Device | `jYXqBGUDHk4x5d1YISDu` | Unregister device from license |

---

## API Endpoints

### 1. Verify License

**Purpose**: Retrieve full license details and verify validity

**Endpoint:**
```
GET /api/license/verify/{secret_key}/{license_key}
```

**Full URL:**
```
https://prod.merafsolutions.com/api/license/verify/X5UTwKJzY1gmhI3jTTB2/{license_key}
```

**Parameters:**
- `{secret_key}`: `X5UTwKJzY1gmhI3jTTB2`
- `{license_key}`: User's license key (e.g., `YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1`)

**Response (Success - 200 OK):**
```json
{
  "result": "success",
  "message": "License key is valid",
  "status": "active",
  "license_type": "regular",
  "item_reference": "Sessner",
  "license_key": "YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1",
  "max_allowed_domains": "999",
  "max_allowed_devices": "1",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "date_created": "2025-01-15 10:30:00",
  "date_expiry": null
}
```

**Response (Error - License Not Found):**
```json
{
  "result": "error",
  "message": "License key does not exist"
}
```

**Response (Error - Wrong Product):**
```json
{
  "result": "error",
  "message": "License key is not valid for this product"
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `result` | string | "success" or "error" |
| `message` | string | Human-readable message |
| `status` | string | "active", "expired", "blocked", "pending" |
| `license_type` | string | "regular", "lifetime" |
| `item_reference` | string | Product name (must be "Sessner") |
| `license_key` | string | The validated license key |
| `max_allowed_domains` | string | Maximum domains/sessions (999 = unlimited) |
| `max_allowed_devices` | string | Maximum devices allowed |
| `email` | string | Purchaser's email address |
| `first_name` | string | Purchaser's first name |
| `last_name` | string | Purchaser's last name |
| `date_created` | string | License creation date (MySQL format) |
| `date_expiry` | string\|null | Expiry date or null for lifetime |

**Code Example:**
```javascript
async function verifyLicense(licenseKey) {
  const url = `https://prod.merafsolutions.com/api/license/verify/X5UTwKJzY1gmhI3jTTB2/${licenseKey}`;

  try {
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();

    if (data.result === 'error') {
      throw new Error(data.message);
    }

    // Validate product
    if (data.item_reference !== 'Sessner') {
      throw new Error('License key is not valid for Sessner');
    }

    return {
      success: true,
      licenseData: data
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### 2. Register Device

**Purpose**: Register a device to a license key (activate on device)

**Endpoint:**
```
GET /api/license/register/device/{device_id}/{secret_key}/{license_key}
```

**Full URL:**
```
https://prod.merafsolutions.com/api/license/register/device/{device_id}/jYXqBGUDHk4x5d1YISDu/{license_key}
```

**Parameters:**
- `{device_id}`: Browser fingerprint + salt (e.g., `SESSNER_abc123def456_X7Y8Z9W0V1`)
- `{secret_key}`: `jYXqBGUDHk4x5d1YISDu`
- `{license_key}`: User's license key

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

**Response (Error - Invalid License):**
```json
{
  "result": "error",
  "message": "License key does not exist"
}
```

**Code Example:**
```javascript
async function registerDevice(deviceId, licenseKey) {
  const url = `https://prod.merafsolutions.com/api/license/register/device/${deviceId}/jYXqBGUDHk4x5d1YISDu/${licenseKey}`;

  try {
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();

    if (data.result === 'error') {
      throw new Error(data.message);
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### 3. Unregister Device

**Purpose**: Remove a device from a license key (deactivate on device)

**Endpoint:**
```
GET /api/license/unregister/device/{device_id}/{secret_key}/{license_key}
```

**Full URL:**
```
https://prod.merafsolutions.com/api/license/unregister/device/{device_id}/jYXqBGUDHk4x5d1YISDu/{license_key}
```

**Parameters:**
- `{device_id}`: Browser fingerprint + salt
- `{secret_key}`: `jYXqBGUDHk4x5d1YISDu`
- `{license_key}`: User's license key

**Response (Success):**
```json
{
  "result": "success",
  "message": "Device has been successfully removed from the license key"
}
```

**Response (Error - Not Registered):**
```json
{
  "result": "error",
  "message": "Device is not registered to this license key"
}
```

**Response (Error - Invalid License):**
```json
{
  "result": "error",
  "message": "License key does not exist"
}
```

**Code Example:**
```javascript
async function unregisterDevice(deviceId, licenseKey) {
  const url = `https://prod.merafsolutions.com/api/license/unregister/device/${deviceId}/jYXqBGUDHk4x5d1YISDu/${licenseKey}`;

  try {
    const response = await fetch(url, { timeout: 10000 });
    const data = await response.json();

    if (data.result === 'error') {
      throw new Error(data.message);
    }

    return {
      success: true,
      message: data.message
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

### 4. Lightweight Validation

**Purpose**: Quick validation check (used for periodic validation)

**Endpoint:**
```
GET /api/license/validate/{secret_key}/{license_key}
```

**Full URL:**
```
https://prod.merafsolutions.com/api/license/validate/{secret_key}/{license_key}
```

**Parameters:**
- `{secret_key}`: Validation secret key (e.g., `zVIlsYWUtU9LF5ESuLq`)
- `{license_key}`: User's license key

**Response:**
- `"1"` = Valid (license active, device registered) - **JSON-encoded string with quotes**
- `"0"` = Invalid (expired, revoked, or device not registered) - **JSON-encoded string with quotes**
- Other values = Error or invalid

**Response Type:** Plain text, but the value `"1"` or `"0"` is JSON-encoded (includes quotes)

**Important**: The API returns JSON-encoded strings, so you must use `JSON.parse()` to handle the quoted format:

```javascript
// Response body: "1" (with quotes)
const text = await response.text(); // text = '"1"'
const parsed = JSON.parse(text);     // parsed = '1' (plain string)
```

**Code Example:**
```javascript
async function quickValidation(licenseKey) {
  const secretKey = 'zVIlsYWUtU9LF5ESuLq'; // Validation secret
  const url = `https://prod.merafsolutions.com/api/license/validate/${secretKey}/${licenseKey}`;

  try {
    const response = await fetch(url, { timeout: 5000 });
    const text = await response.text();

    console.log('[Validation] Raw response:', text); // "1" or "0" (with quotes)

    // Parse JSON-encoded string
    let result;
    try {
      result = JSON.parse(text); // Handles quoted format
    } catch {
      result = text; // Fallback for unquoted format
    }

    console.log('[Validation] Parsed result:', result); // '1' or '0' (plain)

    return result === '1';
  } catch (error) {
    console.error('[Validation] Network error:', error);
    return false;
  }
}
```

**Response Parsing Details:**

| API Response | `response.text()` | After `JSON.parse()` | Check Result |
|--------------|-------------------|----------------------|--------------|
| `"1"` (quoted) | `'"1"'` | `'1'` | `=== '1'` → `true` |
| `"0"` (quoted) | `'"0"'` | `'0'` | `=== '1'` → `false` |
| `1` (unquoted) | `'1'` | Error (not JSON) | Fallback to text check |

**Usage:**
- Used every 7 days for periodic validation
- Lightweight alternative to full verify endpoint
- Faster response time
- Less data transfer

**Error Handling:**
```javascript
// Handle both quoted and unquoted responses
let result;
try {
  result = JSON.parse(responseText); // Try parsing as JSON
} catch (parseError) {
  result = responseText; // Fallback to plain text
}

const isValid = result === '1'; // Works for both formats
```

---

## Tier Detection

### Tier Detection Logic

Tier is determined based on `max_allowed_domains` and `max_allowed_devices` from the API response:

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

### Tier Detection Rules

| Tier | Criteria | max_allowed_domains | max_allowed_devices |
|------|----------|---------------------|---------------------|
| **Free** | No license key | N/A | N/A |
| **Premium** | Single device, unlimited sessions | > 3 (typically 999) | = 1 |
| **Enterprise** | Multiple devices, all features | > 3 (typically 999) | > 1 (typically 3) |

### Examples

**Premium License:**
```json
{
  "max_allowed_domains": "999",
  "max_allowed_devices": "1"
}
// -> Tier: premium
```

**Enterprise License:**
```json
{
  "max_allowed_domains": "999",
  "max_allowed_devices": "3"
}
// -> Tier: enterprise
```

---

## Device ID Generation

### Algorithm

Device ID is generated using privacy-preserving browser fingerprinting with SHA-256 hashing and random salt:

```javascript
/**
 * Generate unique device ID for this browser installation
 * Format: SESSNER_{fingerprint}_{salt}
 */
async function generateDeviceId() {
  // 1. Collect browser characteristics (non-invasive)
  const components = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    colorDepth: screen.colorDepth
  };

  // 2. Generate fingerprint hash (SHA-256)
  const fingerprint = JSON.stringify(components);
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  // 3. Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 4. Take first 12 characters of hash
  const fingerprintId = hashHex.substring(0, 12);

  // 5. Add random salt for uniqueness (10 characters)
  const salt = generateRandomString(10);

  // 6. Construct device ID
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

### Example Device ID

```
SESSNER_a1b2c3d4e5f6_X7Y8Z9W0V1
         ^^^^^^^^^^^^  ^^^^^^^^^^
         fingerprint      salt
```

### Privacy Guarantees

-  Device ID stored locally only
-  Not reversible to personal data
-  Unique per browser installation
-  No cross-site tracking
-  Used only for license validation
-  No canvas fingerprinting (privacy-invasive technique avoided)
-  No audio fingerprinting
-  No WebGL fingerprinting

---

## License Activation Flow

### Complete Activation Process

```
+--------------------------------------------------------------+
| 1. User enters license key in extension popup               |
|    Input: YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1          |
+--------------------------------------------------------------+
                            |
                            v
+--------------------------------------------------------------+
| 2. Extension generates device ID (if not exists)            |
|    Device ID: SESSNER_abc123def456_X7Y8Z9W0V1               |
|    Stored in: chrome.storage.local                          |
+--------------------------------------------------------------+
                            |
                            v
+--------------------------------------------------------------+
| 3. Call: /api/license/register/device/{device_id}/         |
|          {secret}/{license_key}                             |
|    Response: "Device added successfully"                    |
+--------------------------------------------------------------+
                            |
                            v
+--------------------------------------------------------------+
| 4. Call: /api/license/verify/{secret}/{license_key}         |
|    Returns: Full license details                            |
|    {                                                         |
|      status: "active",                                       |
|      max_allowed_domains: "999",                             |
|      max_allowed_devices: "1",                               |
|      email: "user@example.com",                              |
|      ...                                                     |
|    }                                                         |
+--------------------------------------------------------------+
                            |
                            v
+--------------------------------------------------------------+
| 5. Detect tier from response                                |
|    maxDevices=1, maxDomains=999 -> Tier: premium            |
+--------------------------------------------------------------+
                            |
                            v
+--------------------------------------------------------------+
| 6. Store license data locally (chrome.storage.local)        |
|    {                                                         |
|      key: "YEKE94W0E6...",                                   |
|      tier: "premium",                                        |
|      status: "active",                                       |
|      email: "user@example.com",                              |
|      dateActivated: "2025-10-21T12:00:00.000Z",              |
|      lastValidated: "2025-10-21T12:00:00.000Z",              |
|      deviceId: "SESSNER_abc123...",                          |
|      features: { /* cached features */ }                     |
|    }                                                         |
+--------------------------------------------------------------+
                            |
                            v
+--------------------------------------------------------------+
| 7. Features unlocked immediately                            |
|    Show notification: "Welcome to Sessner PREMIUM!"         |
+--------------------------------------------------------------+
```### Code Example

```javascript
async function activateLicense(licenseKey) {
  try {
    // Step 1: Generate or retrieve device ID
    let deviceId = await getDeviceId();
    if (!deviceId) {
      deviceId = await generateDeviceId();
      await saveDeviceId(deviceId);
    }

    // Step 2: Register device to license
    const registerResult = await registerDevice(deviceId, licenseKey);
    if (!registerResult.success) {
      throw new Error(registerResult.error);
    }

    // Step 3: Verify license and get details
    const verifyResult = await verifyLicense(licenseKey);
    if (!verifyResult.success) {
      throw new Error(verifyResult.error);
    }

    const licenseData = verifyResult.licenseData;

    // Step 4: Detect tier
    const tier = detectTier(licenseData);

    // Step 5: Store license locally
    const licenseInfo = {
      key: licenseKey,
      tier: tier,
      status: licenseData.status,
      email: licenseData.email,
      firstName: licenseData.first_name,
      lastName: licenseData.last_name,
      maxAllowedDomains: parseInt(licenseData.max_allowed_domains),
      maxAllowedDevices: parseInt(licenseData.max_allowed_devices),
      dateActivated: new Date().toISOString(),
      lastValidated: new Date().toISOString(),
      deviceId: deviceId,
      features: getFeaturesForTier(tier)
    };

    await saveLicense(licenseInfo);

    // Step 6: Return success
    return {
      success: true,
      tier: tier,
      message: `License activated successfully! Welcome to Sessner ${tier.toUpperCase()}.`
    };

  } catch (error) {
    return {
      success: false,
      tier: 'free',
      message: error.message || 'License activation failed'
    };
  }
}
```

---

## License Validation Flow

### Periodic Validation (Every 7 Days)

```javascript
/**
 * Perform periodic license validation
 * Called every hour when extension is active
 * Only validates if 7+ days since last validation
 */
async function performPeriodicValidation() {
  // 1. Load cached license
  const licenseCache = await loadCachedLicense();
  if (!licenseCache) return; // No license

  // 2. Check if validation is needed
  const daysSinceValidation = getDaysSince(licenseCache.lastValidated);
  if (daysSinceValidation < 7) return; // Too soon

  // 3. Attempt lightweight validation
  try {
    const isValid = await quickValidation(licenseCache.key);

    if (isValid) {
      // Valid - update timestamp
      licenseCache.lastValidated = new Date().toISOString();
      await saveLicense(licenseCache);
      console.log('[License] Validation successful');
    } else {
      // Invalid - mark as expired
      licenseCache.status = 'expired';
      await saveLicense(licenseCache);
      console.warn('[License] License expired or revoked');

      // Show notification with correct icon path
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png', // Correct path (NOT 'icon.png')
        title: 'License Expired',
        message: 'Your license has expired or been revoked. Returning to free tier.'
      });

      // Redirect to popup if user is on license details page
      chrome.runtime.sendMessage({ action: 'redirectToPopup' });
    }

  } catch (error) {
    // Network error - check grace period
    const gracePeriodDays = getDaysSince(licenseCache.lastValidated);

    if (gracePeriodDays <= 30) {
      // Within grace period - trust cache
      console.warn('[License] Validation failed, using cached license (grace period)');

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'License Validation Failed',
        message: `Couldn't validate license (offline). Please connect to internet within ${30 - gracePeriodDays} days.`
      });
    } else {
      // Grace period expired - downgrade
      console.error('[License] Grace period expired, downgrading to free');
      licenseCache.status = 'expired';
      await saveLicense(licenseCache);

      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'License Validation Failed',
        message: 'License validation failed. You\'ve been downgraded to the Free tier. Please reconnect and reactivate.'
      });
    }
  }
}

// Schedule validation check every hour
setInterval(performPeriodicValidation, 60 * 60 * 1000);
```

**Key Changes in Validation Flow**:

1. **Response Parsing**: API returns JSON-encoded strings (`"1"` not `1`), so we use `JSON.parse()`:
   ```javascript
   const text = await response.text();  // text = '"1"'
   const result = JSON.parse(text);      // result = '1'
   const isValid = result === '1';       // true
   ```

2. **Notification Icon Path**: Use `icons/icon128.png` (not `icon.png`):
   ```javascript
   chrome.notifications.create({
     iconUrl: 'icons/icon128.png' // Correct path
   });
   ```

3. **Message-Based Redirect**: Send `redirectToPopup` message to license-details.js:
   ```javascript
   chrome.runtime.sendMessage({ action: 'redirectToPopup' });
   ```

### Validation Timeline

```
Day 0:  License activated 
        lastValidated = 2025-10-21

Day 1-6: No validation needed
         Validation interval not reached

Day 7:  Validation triggered:
        Call /validate endpoint
        - Success -> Update lastValidated
        - Network error -> Start grace period

Day 8-30: Grace period active:
          Continue working offline
          Show reminder: "Please reconnect within X days"

Day 31: Grace period expired:
        Downgrade to free tier
        Show: "License validation failed"
        User must reconnect and reactivate
```

---

## Grace Period System

### Grace Period Configuration

```javascript
GRACE_PERIODS = {
  validationInterval: 7,  // Validate every 7 days when online
  offlineGrace: 30,       // Trust cached license for 30 days offline
  expiryWarning: 7        // Show expiry warning 7 days before
};
```

### Offline Behavior

**Days 0-7**: No validation needed
- License recently validated
- No API calls
- Full functionality

**Days 8-30**: Grace period active
- Validation failed (offline or network error)
- Continue working with cached license
- Show reminder notification
- Grace period countdown displayed

**Days 31+**: Grace period expired
- Downgrade to free tier
- Show expiry notification
- Prompt user to reconnect
- Allow manual reactivation

### Grace Period Check

```javascript
function isWithinGracePeriod(lastValidated) {
  if (!lastValidated) return false;

  const lastValidatedDate = new Date(lastValidated);
  const daysSince = (Date.now() - lastValidatedDate.getTime()) / (1000 * 60 * 60 * 24);

  return daysSince < 30;
}
```

---

## Error Handling

### Error Codes and Handling

| Error Message | Cause | User Action | Code Response |
|---------------|-------|-------------|---------------|
| "License key does not exist" | Invalid key | Check key | Show error, stay on free |
| "This license key has reached maximum number of devices" | Device limit | Deactivate another device | Show error with instructions |
| "Device already registered to this license key" | Re-activation | No action needed | Treat as success |
| "License key is not valid for this product" | Wrong product | Contact support | Show error |
| "License key is not valid for Sessner" | item_reference mismatch | Contact support | Show error |
| Network timeout | Network issue | Retry later | Use cache, grace period |
| "License expired or revoked" | Expired/blocked | Renew license | Downgrade to free |

### Retry Logic with Exponential Backoff

```javascript
async function retryApiCall(apiFunction, maxAttempts = 3) {
  const delays = [1000, 3000, 10000]; // 1s, 3s, 10s

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await apiFunction();
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw error; // Last attempt failed
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
      console.log(`[License] Retry attempt ${attempt + 1}/${maxAttempts}`);
    }
  }
}

// Usage
const result = await retryApiCall(() => verifyLicense(licenseKey));
```

### Error Response Examples

**Invalid License Key:**
```json
{
  "result": "error",
  "message": "License key does not exist"
}
```

**Device Limit Reached:**
```json
{
  "result": "error",
  "message": "This license key has reached maximum number of devices"
}
```

**Network Timeout:**
```javascript
try {
  await fetch(url, { timeout: 10000 });
} catch (error) {
  // error.name === 'AbortError' for timeout
  // Fall back to cached license
  // Check grace period
}
```

---

## Feature Mapping

### Feature Configuration by Tier

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

### Feature Gate Example

```javascript
async function hasFeature(featureName) {
  const tier = await getTier();
  const features = TIER_FEATURES[tier];
  return features[featureName] !== false && features[featureName] !== undefined;
}

// Usage
if (await hasFeature('encryption')) {
  // Enable encryption UI
  enableEncryptionFeature();
} else {
  // Show upgrade prompt
  showUpgradePrompt('encryption');
}
```

---

## Testing & Debugging

### Console Testing Utilities

```javascript
// Test license activation
await activateTestLicense('YEKE94W0E6QDICP7FBR5E7GAB9A6X3SFG3I7O6U1', true);

// Check license status
licenseStatus();

// Display tier comparison
displayTierComparison();

// Test validation
await validateTestLicense(true);

// Deactivate license
await deactivateTestLicense(true);

// Export diagnostics
exportLicenseDiagnostics();
```

### Manual Testing Checklist

- [ ] **Activation Flow**
  - [ ] Valid Premium license activates successfully
  - [ ] Valid Enterprise license activates successfully
  - [ ] Invalid license key shows error
  - [ ] Device limit enforcement works

- [ ] **Tier Detection**
  - [ ] Premium: maxDevices=1, maxDomains=999 -> tier=premium
  - [ ] Enterprise: maxDevices=3, maxDomains=999 -> tier=enterprise

- [ ] **Session Limits**
  - [ ] Free: Cannot create 4th session
  - [ ] Premium/Enterprise: Unlimited sessions

- [ ] **Validation**
  - [ ] Periodic validation (after 7 days) works
  - [ ] Offline grace period (30 days) works
  - [ ] Expiry warning shows correctly

- [ ] **Deactivation**
  - [ ] License deactivates successfully
  - [ ] Downgrade to free tier after deactivation

- [ ] **Error Handling**
  - [ ] Network errors handled gracefully
  - [ ] Invalid responses don't crash extension
  - [ ] User-friendly error messages displayed

### API Response Simulation

```javascript
// Simulate Premium license response
const premiumLicenseData = {
  result: "success",
  status: "active",
  license_type: "regular",
  item_reference: "Sessner",
  max_allowed_domains: "999",
  max_allowed_devices: "1",
  email: "premium@example.com",
  first_name: "John",
  last_name: "Doe",
  date_created: "2025-01-15 10:00:00",
  date_expiry: null
};

// Simulate Enterprise license response
const enterpriseLicenseData = {
  ...premiumLicenseData,
  max_allowed_devices: "3",
  email: "enterprise@example.com"
};

// Test tier detection
console.log(detectTier(premiumLicenseData));    // 'premium'
console.log(detectTier(enterpriseLicenseData)); // 'enterprise'
```

---

## Best Practices

### Activation

 **DO:**
- Validate product name (`item_reference === 'Sessner'`)
- Store device ID persistently
- Update lastValidated timestamp
- Show success notification
- Cache license data locally

L **DON'T:**
- Call API unnecessarily
- Store license key in plain text logs
- Block UI during activation
- Show technical error messages to users

### Validation

 **DO:**
- Use lightweight /validate endpoint for periodic checks
- Implement grace period for offline usage
- Retry with exponential backoff
- Trust cached license within grace period
- Log validation events for debugging

L **DON'T:**
- Validate on every extension start
- Block functionality during validation
- Show aggressive warnings
- Make constant API calls

### Error Handling

 **DO:**
- Handle all error cases gracefully
- Show user-friendly messages
- Fall back to cached license
- Allow offline usage with grace period
- Log errors for debugging

L **DON'T:**
- Brick the extension on API failure
- Show technical stack traces to users
- Lose license data on errors
- Require constant internet connection

---

## Related Documentation

- **Extension API**: See [docs/api.md](api.md)
- **System Architecture**: See [docs/architecture.md](architecture.md)
- **Technical Implementation**: See [docs/technical.md](technical.md)
- **License System Details**: See [docs/monetization_strategy/06_license_system.md](monetization_strategy/06_license_system.md)

---

**Status**: Production Ready
**API Provider**: Meraf Solutions
**API Base URL**: https://prod.merafsolutions.com/
**Support**: Contact Meraf Solutions for API issues
