# License System Installation Checklist

Use this checklist to verify your license system is correctly installed and working.

## Pre-Installation Verification

- [x] **license-manager.js** exists (1,000+ lines)
- [x] **license-integration.js** exists (300+ lines)
- [x] **license-utils.js** exists (400+ lines)
- [x] **popup-license.html** exists
- [x] **popup-license.js** exists
- [x] **background-integration-snippet.js** exists
- [x] **manifest.json** updated with license scripts
- [x] **manifest.json** has notifications permission
- [x] All documentation files present

## Installation Steps

### Step 1: Review Documentation
- [ ] Read `START_HERE.md`
- [ ] Read `DELIVERY_SUMMARY.md`
- [ ] Understand tier features
- [ ] Review API configuration

### Step 2: Code Integration
- [ ] Open `background.js`
- [ ] Locate `createNewSession` function (around line 711)
- [ ] Replace with version from `background-integration-snippet.js`
- [ ] Locate `chrome.runtime.onMessage.addListener` (around line 1214)
- [ ] Add `handleLicenseMessage` call as FIRST handler
- [ ] Save `background.js`

### Step 3: Reload Extension
- [ ] Go to `chrome://extensions`
- [ ] Enable "Developer mode"
- [ ] Find "Sessner" extension
- [ ] Click "Reload" button
- [ ] Check for errors in extension page

### Step 4: Verify Background Script
- [ ] Click "background page" link under Sessner
- [ ] Check console for errors
- [ ] Look for `[License Integration] Integration code loaded`
- [ ] Look for `[LicenseManager] Instance created`
- [ ] Look for `[LicenseManager] Initializing...`

### Step 5: Run Test Suite
In background console:
```javascript
testLicenseSystem()
```

Expected output:
- [ ] "License System Test Suite" group appears
- [ ] Test 1: Initialization - PASSED
- [ ] Test 2: Feature Queries - PASSED
- [ ] Test 3: License Info - PASSED
- [ ] Test 4: Session Creation Check - PASSED
- [ ] "All tests passed!" message

### Step 6: Check License Status
In background console:
```javascript
licenseStatus()
```

Expected output:
- [ ] Shows tier (should be "FREE" initially)
- [ ] Shows sessions count (e.g., "0/3")
- [ ] Shows "Active: false"
- [ ] No errors

### Step 7: Verify Tier Comparison
In background console:
```javascript
displayTierComparison()
```

Expected output:
- [ ] Table displays with 3 tiers
- [ ] Free tier shows 3 max sessions
- [ ] Premium tier shows ∞ max sessions
- [ ] Enterprise tier shows all features enabled

### Step 8: Test License Activation (Sandbox)
In background console:
```javascript
await activateTestLicense('YOUR-TEST-LICENSE-KEY', true)
```

Expected behavior:
- [ ] "Test License Activation" group appears
- [ ] Shows "Activating license: YOUR-TEST-LICENSE-KEY"
- [ ] Shows "Using sandbox: true"
- [ ] Shows "Success: true" or appropriate error
- [ ] Shows tier (premium/enterprise if valid key)
- [ ] Shows features unlocked

### Step 9: Verify Feature Detection
In background console:
```javascript
licenseManager.hasFeature('sessionNaming')
licenseManager.hasFeature('encryption')
```

Expected output:
- [ ] Returns false for free tier
- [ ] Returns true for premium+ (sessionNaming)
- [ ] Returns true for enterprise only (encryption)

### Step 10: Test Session Creation Limit
- [ ] Open extension popup
- [ ] Create 1st session (should succeed)
- [ ] Create 2nd session (should succeed)
- [ ] Create 3rd session (should succeed)
- [ ] Try 4th session (should fail with limit message)

### Step 11: Verify License Popup
- [ ] Right-click extension icon
- [ ] Click "Manage extensions"
- [ ] Find popup-license.html in extension files
- [ ] Or open via: `chrome-extension://{extension-id}/popup-license.html`
- [ ] Popup loads without errors
- [ ] Shows "Free Tier" badge
- [ ] Shows license activation form

### Step 12: Test License Deactivation
In background console:
```javascript
await deactivateTestLicense(true)
```

Expected output:
- [ ] "Test License Deactivation" group appears
- [ ] Shows "Success: true"
- [ ] Shows "Current Tier: free"
- [ ] License data cleared

### Step 13: Verify Message Handlers
In popup console:
```javascript
chrome.runtime.sendMessage({ action: 'getTier' }, console.log)
```

Expected response:
- [ ] `{success: true, tier: "free", features: {...}}`

```javascript
chrome.runtime.sendMessage({ action: 'hasFeature', featureName: 'sessionNaming' }, console.log)
```

Expected response:
- [ ] `{success: true, hasFeature: false, featureName: "sessionNaming"}`

### Step 14: Verify Storage
In background console:
```javascript
chrome.storage.local.get(null, console.log)
```

Expected output:
- [ ] Contains `deviceId` (format: SESSNER_...)
- [ ] May contain `licenseData` if license activated
- [ ] Contains existing session data

### Step 15: Test Error Handling
In background console:
```javascript
// Test with invalid license key
await activateTestLicense('INVALID-KEY', true)
```

Expected output:
- [ ] Shows error message
- [ ] Doesn't crash
- [ ] Returns `{success: false, tier: "free", message: "..."}`

## Post-Installation Testing

### Functional Tests

#### Test 1: Free Tier Limits
- [ ] Reset to free: `await resetLicenseSystem()`
- [ ] Create 3 sessions successfully
- [ ] 4th session fails with proper error
- [ ] Error message mentions upgrade

#### Test 2: Premium Tier
- [ ] Activate premium license
- [ ] Create 10+ sessions successfully
- [ ] Session naming feature available
- [ ] Export feature available
- [ ] Encryption NOT available

#### Test 3: Enterprise Tier
- [ ] Activate enterprise license
- [ ] Create unlimited sessions
- [ ] All premium features available
- [ ] Encryption feature available
- [ ] Local API feature available

#### Test 4: Validation
- [ ] Activate license
- [ ] Run `await validateTestLicense(true)`
- [ ] Validation succeeds
- [ ] Last validated timestamp updates

#### Test 5: Grace Period
- [ ] Simulate expiration: `await simulateGracePeriodExpiration()`
- [ ] License downgrades to free
- [ ] Session limit enforced
- [ ] Features disabled

### Integration Tests

#### Test 1: Session Creation Flow
- [ ] Free tier enforces 3 session limit
- [ ] Error message clear and helpful
- [ ] Premium tier allows unlimited
- [ ] Session creation works normally

#### Test 2: Persistence Enforcement
- [ ] Create sessions in free tier
- [ ] Wait for cleanup (or trigger manually)
- [ ] Old sessions (7+ days) removed if no tabs
- [ ] Premium sessions never removed

#### Test 3: Message Passing
- [ ] `getTier` works from popup
- [ ] `hasFeature` works from popup
- [ ] `getLicenseInfo` works from popup
- [ ] `activateLicense` works from popup

### UI Tests

#### Test 1: License Popup Display
- [ ] Free tier badge shows correctly
- [ ] Activation form visible
- [ ] Input field accepts text
- [ ] Activate button works
- [ ] Error messages display

#### Test 2: Active License Display
- [ ] Tier badge shows correct tier
- [ ] License key masked correctly
- [ ] Last validated date formatted
- [ ] Feature list shows correct features
- [ ] Validate button works
- [ ] Deactivate button works

#### Test 3: Responsive Design
- [ ] Popup width 400px
- [ ] Scrollable if content long
- [ ] Buttons full width
- [ ] Text readable
- [ ] Colors match tier

## Common Issues & Solutions

### Issue: "licenseManager is not defined"
**Solution**:
- Check manifest.json has license-manager.js BEFORE background.js
- Reload extension
- Check background console for load errors

### Issue: "handleLicenseMessage is not a function"
**Solution**:
- Check manifest.json has license-integration.js BEFORE background.js
- Verify integration code added correctly
- Reload extension

### Issue: "testLicenseSystem is not defined"
**Solution**:
- Check manifest.json includes license-utils.js
- Or, license-utils.js not loaded (it's optional for production)
- Functions should be available in background console

### Issue: Sessions not limited
**Solution**:
- Verify `createNewSession` calls `createNewSessionWithLicense`
- Check console for license check logs
- Run `checkSessionCreationAllowed()` manually
- Verify tier is "free"

### Issue: License popup won't open
**Solution**:
- Check popup-license.html exists
- Check popup-license.js exists
- Open extension files and verify no 404 errors
- Check console for JavaScript errors

### Issue: Network errors during activation
**Solution**:
- Check internet connection
- Verify API URL is correct
- Try sandbox API with `useSandbox: true`
- Check console for specific error
- Run `exportLicenseDiagnostics()`

## Production Deployment Checklist

Before deploying to users:

### Code Quality
- [ ] All console.logs reviewed (keep or remove)
- [ ] Error messages user-friendly
- [ ] No debug code left in
- [ ] License keys correct for production

### Testing
- [ ] All three tiers tested thoroughly
- [ ] Session limits work correctly
- [ ] Validation works with production API
- [ ] Error messages tested
- [ ] Grace period tested
- [ ] Offline behavior tested

### Documentation
- [ ] User-facing docs updated
- [ ] Support email/contact added
- [ ] License activation instructions clear
- [ ] Troubleshooting guide available

### UI/UX
- [ ] License link added to main popup
- [ ] Tier badge added to main popup (optional)
- [ ] Error messages clear and actionable
- [ ] Success messages celebratory
- [ ] Upgrade prompts persuasive

### Security
- [ ] HTTPS-only communication verified
- [ ] Input validation in place
- [ ] No sensitive data logged
- [ ] API keys rate-limited

### Monitoring
- [ ] Plan for monitoring activation rates
- [ ] Plan for monitoring validation errors
- [ ] Plan for user support workflow
- [ ] Plan for API usage tracking

## Success Criteria

Installation successful when:

✅ **All tests pass**
- testLicenseSystem() passes all 4 tests
- licenseStatus() shows correct info
- displayTierComparison() displays table

✅ **Session limits enforced**
- Free tier limited to 3 sessions
- Premium tier unlimited
- Enterprise tier unlimited

✅ **Features gated correctly**
- Free tier: basic features only
- Premium tier: premium features available
- Enterprise tier: all features available

✅ **License flow works**
- Activation succeeds with valid key
- Validation works online
- Deactivation clears license
- Grace period enforced

✅ **UI functional**
- License popup loads
- Activation form works
- Error messages display
- Success messages display

✅ **No errors in console**
- Background console clean
- Popup console clean
- No runtime errors

## Final Verification

Run this complete test in background console:

```javascript
// Complete verification script
(async function() {
  console.group('COMPLETE VERIFICATION');

  // Test 1: System initialized
  console.log('1. System initialized:', licenseManager.isInitialized);

  // Test 2: Device ID exists
  console.log('2. Device ID:', licenseManager.deviceId);

  // Test 3: Current tier
  console.log('3. Current tier:', licenseManager.getTier());

  // Test 4: Features available
  console.log('4. Features:', licenseManager.getFeatures());

  // Test 5: Session creation check
  const check = checkSessionCreationAllowed();
  console.log('5. Can create session:', check.allowed, `(${check.currentCount}/${check.maxAllowed})`);

  // Test 6: Message handlers
  const tierResponse = await chrome.runtime.sendMessage({ action: 'getTier' });
  console.log('6. Message handler works:', tierResponse.success);

  // Test 7: Storage
  const storage = await chrome.storage.local.get(null);
  console.log('7. Storage has deviceId:', !!storage.deviceId);

  console.log('\n✅ ALL CHECKS COMPLETE');
  console.log('If all true/defined, installation successful!');

  console.groupEnd();
})();
```

Expected output:
- [ ] All items show valid values
- [ ] No "undefined" or "null" for critical items
- [ ] Message handler works (true)
- [ ] "ALL CHECKS COMPLETE" message
- [ ] "installation successful!" message

## Support

If any check fails:
1. Review error message
2. Check console for details
3. Run `exportLicenseDiagnostics()`
4. Review integration code
5. Consult `INTEGRATION_GUIDE.md`
6. Check `LICENSE_QUICK_REFERENCE.md`

## Congratulations! 🎉

If all checks pass, your license system is successfully installed and ready for use!

Next steps:
1. Add license link to main popup UI
2. Test with real licenses
3. Implement premium features
4. Deploy to production

---

Installation complete! Ready to build premium features! 🚀
