# License Validation System
## Sessner – Multi-Session Manager

**Document Version:** 1.0
**Last Updated:** 2025-10-15

---

## 🔐 License Key Format

### Structure
```
SESS-{TIER}-{RANDOM}-{RANDOM}-{CHECKSUM}

Examples:
SESS-PREM-A1B2-C3D4-E5F6  (Premium)
SESS-PLUS-G7H8-I9J0-K1L2  (Premium+)
```

### Components
1. **Prefix**: `SESS` - Identifies Sessner licenses
2. **Tier Code**: `PREM` (Premium) or `PLUS` (Premium+)
3. **Random Segments**: Two 4-character segments (A-Z, 0-9)
4. **Checksum**: 4-character validation code

---

## 🛠️ License Generation

### Server-Side Generator (Node.js Example)

```javascript
const crypto = require('crypto');

function generateLicenseKey(tier, userId, purchaseId) {
  // Tier prefix
  const tierPrefix = tier === 'premium' ? 'PREM' : 'PLUS';

  // Generate random segments
  const segment1 = generateRandomSegment();
  const segment2 = generateRandomSegment();

  // Generate checksum
  const data = `${tierPrefix}${segment1}${segment2}${userId}${purchaseId}`;
  const checksum = generateChecksum(data);

  // Construct license key
  const licenseKey = `SESS-${tierPrefix}-${segment1}-${segment2}-${checksum}`;

  // Store in database
  storeLicense({
    key: licenseKey,
    tier: tier,
    userId: userId,
    purchaseId: purchaseId,
    createdAt: new Date(),
    activatedAt: null,
    status: 'pending'
  });

  return licenseKey;
}

function generateRandomSegment() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateChecksum(data) {
  const hash = crypto.createHash('sha256').update(data).digest('hex');
  return hash.substring(0, 4).toUpperCase();
}
```

---

## ✅ Client-Side Validation

### Offline Validation (Phase 1)

```javascript
/**
 * Validate license key format and tier
 * @param {string} key - License key
 * @returns {Object|null} Validation result
 */
function validateLicenseKey(key) {
  // 1. Format validation
  const pattern = /^SESS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  if (!pattern.test(key)) {
    return { valid: false, error: 'Invalid format' };
  }

  // 2. Parse components
  const parts = key.split('-');
  const tierCode = parts[1];
  const segment1 = parts[2];
  const segment2 = parts[3];
  const checksum = parts[4];

  // 3. Validate tier code
  if (!['PREM', 'PLUS'].includes(tierCode)) {
    return { valid: false, error: 'Invalid tier code' };
  }

  // 4. Verify checksum (basic)
  const expectedChecksum = simpleChecksum(`${tierCode}${segment1}${segment2}`);
  if (checksum !== expectedChecksum) {
    return { valid: false, error: 'Invalid checksum' };
  }

  // 5. Determine tier
  const tier = tierCode === 'PREM' ? 'premium' : 'premium_plus';

  return {
    valid: true,
    tier: tier,
    key: key
  };
}

function simpleChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().substring(0, 4).padEnd(4, '0');
}
```

---

## 🌐 Online Validation (Phase 2 - Future)

### Server API Endpoint

```javascript
// POST /api/validate-license
app.post('/api/validate-license', async (req, res) => {
  const { licenseKey, machineId } = req.body;

  try {
    // 1. Look up license in database
    const license = await db.licenses.findOne({ key: licenseKey });

    if (!license) {
      return res.json({ valid: false, error: 'License not found' });
    }

    // 2. Check if license is active
    if (license.status !== 'active') {
      return res.json({ valid: false, error: 'License not active' });
    }

    // 3. Check activation limit (e.g., 3 machines max)
    if (license.activations.length >= 3) {
      if (!license.activations.includes(machineId)) {
        return res.json({ valid: false, error: 'Activation limit reached' });
      }
    }

    // 4. Check expiration (if applicable)
    if (license.expiresAt && new Date() > license.expiresAt) {
      return res.json({ valid: false, error: 'License expired' });
    }

    // 5. Record activation if new machine
    if (!license.activations.includes(machineId)) {
      await db.licenses.update(
        { key: licenseKey },
        { $push: { activations: machineId }, lastValidated: new Date() }
      );
    }

    // 6. Return success
    return res.json({
      valid: true,
      tier: license.tier,
      expiresAt: license.expiresAt,
      features: getTierFeatures(license.tier)
    });

  } catch (error) {
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});
```

### Client-Side Online Validation

```javascript
async function validateLicenseOnline(licenseKey) {
  const machineId = await getMachineId();

  try {
    const response = await fetch('https://api.sessner.com/validate-license', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, machineId })
    });

    const result = await response.json();

    if (result.valid) {
      // Store validation result
      await chrome.storage.local.set({
        licenseState: {
          tier: result.tier,
          licenseKey: licenseKey,
          expiresAt: result.expiresAt,
          lastValidation: Date.now(),
          isValid: true
        }
      });

      return { success: true, tier: result.tier };
    } else {
      return { success: false, error: result.error };
    }

  } catch (error) {
    // Offline fallback
    console.warn('Online validation failed, using offline validation');
    return validateLicenseOffline(licenseKey);
  }
}
```

---

## 🔑 Machine ID Generation

### Browser Fingerprinting
```javascript
async function getMachineId() {
  // Generate a stable machine ID based on browser/system characteristics
  const components = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory || 'unknown',
    screenResolution: `${screen.width}x${screen.height}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    canvas: await getCanvasFingerprint(),
    webgl: await getWebGLFingerprint()
  };

  const fingerprint = JSON.stringify(components);
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprint)
  );

  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .substring(0, 32);
}

async function getCanvasFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.fillText('Sessner', 2, 2);
  return canvas.toDataURL();
}

async function getWebGLFingerprint() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  if (!gl) return 'no-webgl';

  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugInfo) return 'no-debug-info';

  return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
}
```

---

## 🛡️ Anti-Piracy Measures

### 1. License Activation Limit
- Maximum 3 machines per license
- Deactivation available (manual or automatic)
- Grace period for machine changes

### 2. Regular Validation
- Validate every 7 days when online
- Grace period: 30 days offline
- After grace period: Downgrade to free tier (don't lock out)

### 3. License Revocation
- Admin can revoke license
- Refund requests trigger revocation
- Abuse detection (sharing publicly)

### 4. Machine Fingerprinting
- Track which machines use license
- Detect suspicious activation patterns
- Alert on unusual activity

### 5. Fair Enforcement
- ✅ Don't be overly aggressive
- ✅ Allow offline usage with grace period
- ✅ Don't brick the extension
- ✅ Downgrade to free tier, don't block
- ✅ Provide clear error messages

---

## 🔄 Validation Flow

### Initial Activation
```
1. User enters license key
2. Client validates format
3. Client sends to server (if online)
4. Server validates + records activation
5. Client stores license state
6. Features unlocked immediately
```

### Periodic Validation
```
1. Extension checks last validation timestamp
2. If > 7 days, attempt online validation
3. If online: Refresh validation
4. If offline: Continue in grace period
5. If grace period expired: Downgrade to free
```

### Offline Grace Period
```
Days 0-7:   Full access, no validation needed
Days 8-30:  Grace period, show warning
Days 31+:   Downgrade to free tier
```

---

## 💾 Storage Structure

### chrome.storage.local Schema
```javascript
{
  licenseState: {
    tier: 'premium',              // or 'free', 'premium_plus'
    licenseKey: 'SESS-PREM-...',
    activatedAt: 1704067200000,   // Timestamp
    lastValidation: 1704153600000, // Timestamp
    expiresAt: null,              // null = lifetime
    isValid: true,
    machineId: 'abc123...',
    gracePeriodDays: 30,
    features: {
      sessionNaming: true,
      sessionExport: true,
      // ... other features
    }
  },

  usageStats: {
    sessionsCreated: 247,
    sessionsTotal: 12,
    lastUsed: 1704153600000,
    installDate: 1704067200000
  }
}
```

---

## 🔧 License Management API

### Endpoints

**1. Validate License**
```
POST /api/validate-license
Body: { licenseKey, machineId }
Response: { valid, tier, expiresAt, features }
```

**2. Activate License**
```
POST /api/activate-license
Body: { licenseKey, machineId, userAgent }
Response: { success, message }
```

**3. Deactivate Machine**
```
POST /api/deactivate-machine
Body: { licenseKey, machineId }
Response: { success, message }
```

**4. Get License Info**
```
GET /api/license-info?key={licenseKey}
Response: { tier, activations, expiresAt, status }
```

---

## 🎯 Implementation Phases

### Phase 1: Offline Only (Week 1-2)
- ✅ Format validation
- ✅ Simple checksum
- ✅ Tier parsing
- ✅ Local storage
- ✅ No server required

### Phase 2: Online Validation (Week 3-4)
- ✅ Build license server API
- ✅ Implement online validation
- ✅ Add activation tracking
- ✅ Machine fingerprinting

### Phase 3: Advanced Features (Month 2+)
- ✅ Activation limit enforcement
- ✅ License management dashboard
- ✅ Usage analytics
- ✅ Automated notifications

---

## 🧪 Testing Scenarios

### Test Cases
1. ✅ Valid Premium license activates correctly
2. ✅ Valid Premium+ license activates correctly
3. ✅ Invalid format rejected
4. ✅ Wrong checksum rejected
5. ✅ Expired license downgraded
6. ✅ Activation limit enforced
7. ✅ Grace period works offline
8. ✅ Periodic validation works
9. ✅ Deactivation works
10. ✅ Error messages are clear

---

## 📝 Customer Self-Service Portal

### Features
- View license status
- See active machines
- Deactivate machines remotely
- Download invoices
- Request support
- Upgrade/downgrade tier

### URL Structure
```
https://portal.sessner.com/
  /license/{licenseKey}
  /account
  /billing
  /support
```

---

**Status:** Ready for Implementation
**Previous:** [05_ui_mockups.md](05_ui_mockups.md) | **Next:** [07_timeline.md](07_timeline.md)
