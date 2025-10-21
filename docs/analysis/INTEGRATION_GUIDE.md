# License System Integration Guide

This guide explains how to integrate the license system into your existing Sessner extension.

## Files Created

1. **license-manager.js** - Core license validation logic
2. **license-integration.js** - Integration helpers for background.js
3. **license-utils.js** - Testing and debugging utilities
4. **popup-license.html** - License management UI
5. **popup-license.js** - License popup functionality

## Quick Start

### 1. Manifest.json Updates

Already done! The manifest now includes:
- `license-manager.js` and `license-integration.js` in background scripts
- `notifications` permission for license activation/deactivation alerts

### 2. Modify background.js

Replace your existing `createNewSession` function with the license-enforced version:

```javascript
// OLD VERSION (replace this):
function createNewSession(url, callback) {
  const sessionId = generateSessionId();
  const color = sessionColors[Object.keys(sessionStore.sessions).length % sessionColors.length];
  // ... rest of function
}

// NEW VERSION (use this):
function createNewSession(url, callback) {
  // Use the license-enforced version from license-integration.js
  createNewSessionWithLicense(url, callback);
}
```

### 3. Add Message Handler to background.js

In your existing `chrome.runtime.onMessage.addListener`, add license message handling:

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // Try license message handler first
  const isLicenseMessage = handleLicenseMessage(request, sender, sendResponse);
  if (isLicenseMessage) {
    return true; // Async response
  }

  // Existing message handlers below...
  if (request.action === 'createNewSession') {
    createNewSession(request.url, (result) => {
      sendResponse(result);
    });
    return true;
  }

  if (request.action === 'getActiveSessions') {
    // ... existing code
  }

  // ... rest of your existing handlers
});
```

### 4. Add License Link to popup.html

Add a link to the license management popup in your main popup:

```html
<div class="header">
  <h1>Sessner</h1>
  <div style="text-align: right; margin-top: 10px;">
    <a href="popup-license.html" target="_blank" style="color: white; font-size: 12px;">
      Manage License
    </a>
  </div>
</div>
```

### 5. Optional: Add Tier Badge to Main Popup

Show current tier in your main popup UI:

```javascript
// In popup.js, add this to your refreshSessions() or init() function:
async function displayCurrentTier() {
  const response = await chrome.runtime.sendMessage({ action: 'getTier' });

  if (response.success) {
    const tierBadge = document.getElementById('tier-badge');
    tierBadge.textContent = response.tier.toUpperCase();
    tierBadge.className = `tier-badge tier-${response.tier}`;
  }
}
```

## Testing the License System

### Using the Console

Open background page console (chrome://extensions → Sessner → background page):

```javascript
// Run full test suite
testLicenseSystem();

// Display tier comparison table
displayTierComparison();

// Check current status
licenseStatus();

// Activate a test license (sandbox API)
await activateTestLicense('YOUR-LICENSE-KEY-HERE', true);

// Validate current license
await validateTestLicense(true);

// Deactivate license
await deactivateTestLicense(true);

// Reset to free tier
await resetLicenseSystem();

// Export diagnostics
exportLicenseDiagnostics();

// Monitor validation (logs every minute)
startValidationMonitor();
stopValidationMonitor();

// Simulate grace period expiration
await simulateGracePeriodExpiration();
```

### Testing Session Limits

1. **Free Tier (3 sessions max)**:
   ```javascript
   // Reset to free tier
   await resetLicenseSystem();

   // Try creating 4 sessions - 4th should fail
   // Use main popup to create sessions
   ```

2. **Premium Tier (unlimited sessions)**:
   ```javascript
   // Activate premium license
   await activateTestLicense('PREMIUM-LICENSE-KEY', true);

   // Create many sessions - all should succeed
   ```

3. **Session Persistence (Free: 7 days)**:
   ```javascript
   // Create a session, wait for enforcement
   // Or manually trigger: await enforceSessionPersistence();
   ```

## API Endpoints Reference

### Production API
- Base URL: `https://prod.merafsolutions.com`

### Sandbox API (for testing)
- Base URL: `https://sandbox.merafsolutions.com`

### Key Endpoints

1. **Activate License**:
   ```
   GET /api/license/register/device/{device_id}/{secret_key}/{license_key}
   ```

2. **Verify License** (full details):
   ```
   GET /api/license/verify/{secret_key}/{license_key}
   ```

3. **Lightweight Validation**:
   ```
   GET /validate?t=Sessner&s={license_key}&d={device_id}
   Returns: "1" (valid) or "0" (invalid)
   ```

4. **Deactivate License**:
   ```
   GET /api/license/unregister/device/{device_id}/{secret_key}/{license_key}
   ```

## Tier Detection Logic

From API response fields:

```javascript
const maxDevices = apiResponse.max_allowed_devices;
const maxDomains = apiResponse.max_allowed_domains;

if (maxDevices > 1 && maxDomains > 3) {
  tier = 'enterprise';
} else if (maxDomains > 3 && maxDevices === 1) {
  tier = 'premium';
} else {
  tier = 'free';
}
```

## Feature Configuration

### Free Tier
- Max sessions: 3
- Session persistence: 7 days
- Session naming: No
- Export/Import: No
- Templates: No
- Encryption: No
- Portable sessions: No
- Local API: No
- Multi-profile: No

### Premium Tier
- Max sessions: Unlimited (Infinity)
- Session persistence: Permanent (Infinity)
- Session naming: Yes
- Export/Import: Yes
- Templates: Yes
- Encryption: No
- Portable sessions: No
- Local API: No
- Multi-profile: No

### Enterprise Tier
- Max sessions: Unlimited (Infinity)
- Session persistence: Permanent (Infinity)
- Session naming: Yes
- Export/Import: Yes
- Templates: Yes
- Encryption: Yes (AES-256)
- Portable sessions: Yes
- Local API: Yes
- Multi-profile: Yes

## Validation Schedule

- **Full Validation**: Every 7 days
- **Check Interval**: Every hour (checks if validation needed)
- **Warning Period**: After 7 days offline
- **Grace Period**: 30 days total
- **Auto-Downgrade**: After grace period expires or 5 consecutive validation failures

## Error Handling

### Network Failures
- Automatic retry with exponential backoff (1s, 3s, 10s)
- Graceful degradation to cached license state
- Grace period prevents immediate downgrade

### Invalid License
- Clear error messages
- Revert to free tier
- User can retry activation

### API Errors
- Timeout after 10 seconds
- Retry up to 3 times
- Log detailed error for debugging

## Privacy Guarantees

1. **No Analytics**: Zero tracking or telemetry
2. **Local Storage**: All license data in chrome.storage.local
3. **Minimal Fingerprinting**: Device ID uses stable browser characteristics only
4. **No PII**: Device ID contains no personal information
5. **API Calls Only**: Only calls Meraf Solutions API for validation
6. **No Background Requests**: Only validates when needed (7-day interval)

## Security Considerations

### API Secret Keys
- Keys are visible in extension source code
- This is acceptable: API rate-limits prevent abuse
- Keys only validate licenses, don't grant access to sensitive data

### Device ID Generation
- Uses SHA-256 hash of browser characteristics
- Stable across sessions but privacy-preserving
- Random salt prevents reverse engineering

### License Storage
- Stored in chrome.storage.local (encrypted by browser)
- Not synced across devices
- Cleared when extension uninstalled

## Troubleshooting

### License Won't Activate
1. Check internet connection
2. Verify license key is correct (no spaces)
3. Check console for API errors
4. Try sandbox API with test license
5. Check if device limit exceeded

### Validation Keeps Failing
1. Check internet connection
2. Verify license is still active in Meraf dashboard
3. Check if grace period expired
4. Try manual validation from popup
5. Check console for specific error

### Sessions Still Limited After Activation
1. Verify activation succeeded (check popup)
2. Check current tier: `licenseManager.getTier()`
3. Restart extension (chrome://extensions → reload)
4. Check console for integration errors

### Features Not Unlocking
1. Verify tier is correct: `licenseManager.getTier()`
2. Check feature flags: `licenseManager.getFeatures()`
3. Verify integration code is calling `hasFeature()`
4. Check console for license info: `licenseManager.getLicenseInfo()`

## Development Workflow

### 1. Initial Setup
```javascript
// In background console
testLicenseSystem(); // Verify installation
displayTierComparison(); // See tier features
```

### 2. Test Activation
```javascript
// Use sandbox API for testing
await activateTestLicense('TEST-LICENSE-KEY', true);
licenseStatus(); // Verify tier
```

### 3. Test Session Limits
```javascript
// Check if creation allowed
chrome.runtime.sendMessage({ action: 'checkSessionCreationAllowed' }, console.log);
```

### 4. Test Validation
```javascript
// Manual validation
await validateTestLicense(true);

// Monitor validation
startValidationMonitor();
// ... wait ...
stopValidationMonitor();
```

### 5. Test Deactivation
```javascript
await deactivateTestLicense(true);
licenseStatus(); // Should show free tier
```

## Production Deployment

### Before Release
1. Test all tier transitions (free → premium → enterprise → free)
2. Test validation with real licenses (production API)
3. Test grace period warning messages
4. Test session limit enforcement
5. Test popup UI on different screen sizes
6. Test error messages for all failure scenarios

### After Release
1. Monitor console for validation errors
2. Collect user feedback on activation UX
3. Monitor API usage/limits
4. Track conversion from free to paid tiers

## Support

For issues with:
- **License API**: Contact Meraf Solutions support
- **Extension Integration**: Check console logs and diagnostics
- **Feature Requests**: Document in extension roadmap

## Next Steps

After integration, consider implementing:
1. Session naming UI (premium/enterprise feature)
2. Export/import functionality (premium/enterprise feature)
3. Session templates (premium/enterprise feature)
4. AES-256 encryption (enterprise feature)
5. Local API server (enterprise feature)
6. Multi-profile management (enterprise feature)

Each feature should check license tier before enabling:

```javascript
async function enableFeature(featureName) {
  const response = await chrome.runtime.sendMessage({
    action: 'hasFeature',
    featureName: featureName
  });

  if (response.hasFeature) {
    // Enable feature
  } else {
    // Show upgrade prompt
    const tier = await chrome.runtime.sendMessage({ action: 'getTier' });
    alert(`${featureName} requires ${tier === 'free' ? 'Premium' : 'Enterprise'} tier`);
  }
}
```
