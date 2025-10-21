# License System - Quick Reference

## At a Glance

| Tier | Max Sessions | Persistence | Key Features |
|------|-------------|-------------|--------------|
| **Free** | 3 | 7 days | Basic multi-session |
| **Premium** | Unlimited | Permanent | + Naming, Export, Templates |
| **Enterprise** | Unlimited | Permanent | + Encryption, API, Multi-profile |

## Common Tasks

### Check Current Tier

```javascript
// In background script
const tier = licenseManager.getTier(); // 'free', 'premium', or 'enterprise'

// From popup/content script
chrome.runtime.sendMessage({ action: 'getTier' }, (response) => {
  console.log(response.tier);
});
```

### Check Feature Availability

```javascript
// In background script
const canExport = licenseManager.hasFeature('sessionExport'); // boolean

// From popup/content script
chrome.runtime.sendMessage({
  action: 'hasFeature',
  featureName: 'sessionExport'
}, (response) => {
  if (response.hasFeature) {
    // Enable feature
  }
});
```

### Get All Features

```javascript
// In background script
const features = licenseManager.getFeatures();
console.log(features.maxSessions); // 3, Infinity
console.log(features.encryption); // true, false

// From popup/content script
chrome.runtime.sendMessage({ action: 'getTier' }, (response) => {
  console.log(response.features);
});
```

### Check Session Creation

```javascript
// Before creating a session
const check = checkSessionCreationAllowed();

if (!check.allowed) {
  alert(check.reason); // "Session limit reached..."
  return;
}

// Proceed with creation
createNewSessionWithLicense(url, callback);
```

### Activate License

```javascript
// From popup UI
chrome.runtime.sendMessage({
  action: 'activateLicense',
  licenseKey: 'XXXX-XXXX-XXXX-XXXX',
  useSandbox: false
}, (response) => {
  if (response.success) {
    console.log('Activated:', response.tier);
  } else {
    console.error('Failed:', response.message);
  }
});
```

### Validate License

```javascript
chrome.runtime.sendMessage({
  action: 'validateLicense',
  useSandbox: false
}, (response) => {
  console.log('Valid:', response.success);
});
```

### Deactivate License

```javascript
chrome.runtime.sendMessage({
  action: 'deactivateLicense',
  useSandbox: false
}, (response) => {
  console.log('Deactivated:', response.success);
});
```

### Get License Info

```javascript
chrome.runtime.sendMessage({ action: 'getLicenseInfo' }, (response) => {
  console.log('Tier:', response.tier);
  console.log('Active:', response.isActive);
  console.log('Days until expiry:', response.daysUntilExpiry);
  console.log('Features:', response.features);
});
```

## Feature Gates

### Pattern 1: Direct Check

```javascript
async function enableFeature() {
  if (!licenseManager.hasFeature('sessionNaming')) {
    showUpgradeDialog('premium');
    return;
  }

  // Feature enabled
  proceedWithFeature();
}
```

### Pattern 2: Message Handler

```javascript
// In background.js message handler
if (request.action === 'nameSession') {
  if (!licenseManager.hasFeature('sessionNaming')) {
    sendResponse({
      success: false,
      error: 'Requires Premium tier',
      upgradeRequired: true
    });
    return;
  }

  // Proceed
  nameSession(request.sessionId, request.name);
  sendResponse({ success: true });
}
```

### Pattern 3: Feature Wrapper

```javascript
function withFeatureCheck(featureName, requiredTier) {
  return function(fn) {
    return function(...args) {
      if (!licenseManager.hasFeature(featureName)) {
        showUpgradePrompt(requiredTier);
        return;
      }
      return fn(...args);
    };
  };
}

// Usage
const exportSession = withFeatureCheck('sessionExport', 'premium')(
  function(sessionId) {
    // Export logic
  }
);
```

## Console Commands (Background Page)

```javascript
// Full test suite
testLicenseSystem();

// Current status one-liner
licenseStatus();

// Tier comparison table
displayTierComparison();

// Activate test license (sandbox)
await activateTestLicense('YOUR-KEY', true);

// Validate
await validateTestLicense(true);

// Deactivate
await deactivateTestLicense(true);

// Reset to free
await resetLicenseSystem();

// Export diagnostics
exportLicenseDiagnostics();

// Monitor validation (logs every minute)
startValidationMonitor();
stopValidationMonitor();

// Simulate grace period expiration
await simulateGracePeriodExpiration();
```

## API Endpoints

### Production
```
Base: https://prod.merafsolutions.com

Activate:   GET /api/license/register/device/{device_id}/{secret}/{key}
Verify:     GET /api/license/verify/{secret}/{key}
Validate:   GET /validate?t=Sessner&s={key}&d={device}
Deactivate: GET /api/license/unregister/device/{device_id}/{secret}/{key}
```

### Sandbox (Testing)
```
Base: https://sandbox.merafsolutions.com
(Same endpoints as production)
```

## Feature Reference

```javascript
{
  maxSessions: 3 | Infinity,
  sessionPersistenceDays: 7 | Infinity,
  sessionNaming: boolean,        // Name sessions
  sessionExport: boolean,        // Export/import
  sessionTemplates: boolean,     // Session templates
  encryption: boolean,           // AES-256
  portableSessions: boolean,     // Cross-device
  localAPI: boolean,             // HTTP API
  multiProfile: boolean          // Multi-profile
}
```

## Validation Schedule

| Event | Interval |
|-------|----------|
| Check if validation needed | Every 1 hour |
| Full validation required | Every 7 days |
| Warning period starts | After 7 days offline |
| Grace period expires | After 30 days offline |
| Downgrade to free | After grace period |
| Max validation failures | 5 consecutive |

## Error Messages

```javascript
// Activation errors
"Invalid license key format"
"Device registration failed"
"License verification failed"
"Network error. Check internet connection."
"Request timeout. Try again."

// Validation errors
"No active license"
"License validation failed"
"Too many validation failures"
"Grace period exceeded"

// Feature gate errors
"Session limit reached (3 for FREE tier). Upgrade to Premium for unlimited sessions."
"Requires Premium tier"
"Requires Enterprise tier"
```

## Storage Structure

```javascript
// chrome.storage.local
{
  deviceId: "SESSNER_a1b2c3d4e5f6g7h8_12ab34cd56ef78gh",
  licenseData: {
    licenseKey: "XXXX-XXXX-XXXX-XXXX",
    tier: "premium",
    deviceId: "SESSNER_...",
    lastValidated: 1705315200000,
    lastAttempted: 1705315200000,
    isActive: true,
    validationFailures: 0,
    maxAllowedDomains: 10,
    maxAllowedDevices: 1,
    apiResponse: { /* full response */ }
  }
}
```

## Tier Detection

```javascript
// From API response
const maxDevices = response.max_allowed_devices;
const maxDomains = response.max_allowed_domains;

if (maxDevices > 1 && maxDomains > 3) → 'enterprise'
else if (maxDomains > 3 && maxDevices === 1) → 'premium'
else → 'free'
```

## Integration Checklist

- [ ] Add license-manager.js to manifest background scripts
- [ ] Add license-integration.js to manifest background scripts
- [ ] Add notifications permission to manifest
- [ ] Replace createNewSession with createNewSessionWithLicense
- [ ] Add handleLicenseMessage to message listener
- [ ] Add license link to popup UI
- [ ] Test activation flow
- [ ] Test session limits
- [ ] Test validation
- [ ] Test deactivation

## Troubleshooting

### Issue: License won't activate
```javascript
// 1. Check console for errors
// 2. Verify internet connection
// 3. Test with sandbox API
await activateTestLicense('YOUR-KEY', true);

// 4. Check API response
exportLicenseDiagnostics();
```

### Issue: Features not unlocking
```javascript
// 1. Verify tier
licenseStatus();

// 2. Check features
console.log(licenseManager.getFeatures());

// 3. Verify integration
chrome.runtime.sendMessage({ action: 'getTier' }, console.log);
```

### Issue: Validation failing
```javascript
// 1. Check validation status
licenseManager.getLicenseInfo();

// 2. Manual validation
await validateTestLicense(false);

// 3. Check network
fetch('https://prod.merafsolutions.com/validate?t=Sessner&s=test&d=test')
  .then(r => r.text())
  .then(console.log);
```

## Best Practices

1. **Always check features before use**
   ```javascript
   if (!hasFeature('encryption')) return;
   ```

2. **Handle errors gracefully**
   ```javascript
   try {
     await activateLicense(key);
   } catch (error) {
     showError(error.message);
   }
   ```

3. **Cache tier info in UI**
   ```javascript
   let cachedTier = null;
   async function getTier() {
     if (!cachedTier) {
       const response = await chrome.runtime.sendMessage({ action: 'getTier' });
       cachedTier = response.tier;
     }
     return cachedTier;
   }
   ```

4. **Use message handlers for communication**
   ```javascript
   // From popup/content script
   chrome.runtime.sendMessage({ action: 'hasFeature', featureName: 'export' }, callback);
   ```

5. **Test with sandbox API first**
   ```javascript
   await activateTestLicense('TEST-KEY', true); // useSandbox = true
   ```

## Quick Start

1. **Load extension**: chrome://extensions → Load unpacked
2. **Open background console**: Extensions → Sessner → background page
3. **Run tests**: `testLicenseSystem()`
4. **Activate test license**: `await activateTestLicense('YOUR-KEY', true)`
5. **Check status**: `licenseStatus()`
6. **Open popup**: Click extension icon → "Manage License"

## Support

- API Issues: Meraf Solutions support
- Integration Issues: Check console logs, run `exportLicenseDiagnostics()`
- Feature Requests: Document in roadmap

## Version

License System v1.0.0 - Integrated with Sessner 3.0.1
