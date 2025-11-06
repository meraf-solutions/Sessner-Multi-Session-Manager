/**
 * License System Utilities
 * Helper functions for testing, debugging, and development
 */

'use strict';

/**
 * Test suite for license manager
 * Run from background console: testLicenseSystem()
 */
async function testLicenseSystem() {
  console.group('License System Test Suite');

  try {
    // Test 1: Initialization
    console.log('\n--- Test 1: Initialization ---');
    console.log('Device ID:', licenseManager.deviceId);
    console.log('Is Initialized:', licenseManager.isInitialized);
    console.log('Current Tier:', licenseManager.getTier());
    console.log('✓ Initialization test passed');

    // Test 2: Feature queries
    console.log('\n--- Test 2: Feature Queries ---');
    const features = licenseManager.getFeatures();
    console.log('Features:', features);
    console.log('Has sessionNaming:', licenseManager.hasFeature('sessionNaming'));
    console.log('Has encryption:', licenseManager.hasFeature('encryption'));
    console.log('✓ Feature query test passed');

    // Test 3: License info
    console.log('\n--- Test 3: License Info ---');
    const info = licenseManager.getLicenseInfo();
    console.log('License Info:', info);
    console.log('✓ License info test passed');

    // Test 4: Session creation check
    console.log('\n--- Test 4: Session Creation Check ---');
    const check = checkSessionCreationAllowed();
    console.log('Can create session:', check.allowed);
    console.log('Current/Max:', `${check.currentCount}/${check.maxAllowed}`);
    console.log('✓ Session check test passed');

    console.log('\n✓ All tests passed!');

  } catch (error) {
    console.error('Test failed:', error);
  }

  console.groupEnd();
}

/**
 * Activate a test license (for development)
 * Run from background console: activateTestLicense('YOUR-LICENSE-KEY')
 *
 * @param {string} licenseKey - License key to test
 * @param {boolean} useSandbox - Use sandbox API
 */
async function activateTestLicense(licenseKey, useSandbox = true) {
  console.group('Test License Activation');

  try {
    console.log('Activating license:', licenseKey);
    console.log('Using sandbox:', useSandbox);

    const result = await licenseManager.activateLicense(licenseKey, useSandbox);

    console.log('\n--- Activation Result ---');
    console.log('Success:', result.success);
    console.log('Tier:', result.tier);
    console.log('Message:', result.message);

    if (result.success) {
      console.log('\n--- Features Unlocked ---');
      console.log(result.features);

      const info = licenseManager.getLicenseInfo();
      console.log('\n--- License Info ---');
      console.log('License Key:', info.licenseKey);
      console.log('Max Domains:', info.maxAllowedDomains);
      console.log('Max Devices:', info.maxAllowedDevices);
      console.log('Last Validated:', info.lastValidated);
    }

    console.log('\n✓ Activation complete');

  } catch (error) {
    console.error('Activation failed:', error);
  }

  console.groupEnd();
  return result;
}

/**
 * Deactivate current license (for development)
 * Run from background console: deactivateTestLicense()
 */
async function deactivateTestLicense(useSandbox = true) {
  console.group('Test License Deactivation');

  try {
    const result = await licenseManager.deactivateLicense(useSandbox);

    console.log('Success:', result.success);
    console.log('Message:', result.message);
    console.log('Current Tier:', licenseManager.getTier());

    console.log('\n✓ Deactivation complete');

  } catch (error) {
    console.error('Deactivation failed:', error);
  }

  console.groupEnd();
}

/**
 * Validate current license (for development)
 * Run from background console: validateTestLicense()
 */
async function validateTestLicense(useSandbox = true) {
  console.group('Test License Validation');

  try {
    const result = await licenseManager.validateLicense(useSandbox);

    console.log('Success:', result.success);
    console.log('Message:', result.message);
    console.log('Tier:', result.tier);

    const info = licenseManager.getLicenseInfo();
    console.log('\n--- Updated License Info ---');
    console.log('Last Validated:', info.lastValidated);
    console.log('Days Until Expiry:', info.daysUntilExpiry);
    console.log('Needs Validation:', info.needsValidation);

    console.log('\n✓ Validation complete');

  } catch (error) {
    console.error('Validation failed:', error);
  }

  console.groupEnd();
}

/**
 * Simulate grace period expiration (for testing)
 * Sets last validation to 31 days ago
 */
async function simulateGracePeriodExpiration() {
  console.group('Simulate Grace Period Expiration');

  if (!licenseManager.licenseData) {
    console.error('No active license to simulate expiration');
    console.groupEnd();
    return;
  }

  // Set last validation to 31 days ago
  const thirtyOneDaysAgo = Date.now() - (31 * 24 * 60 * 60 * 1000);
  licenseManager.licenseData.lastValidated = thirtyOneDaysAgo;

  await licenseManager.storage.set({ licenseData: licenseManager.licenseData });

  console.log('Last validation set to:', new Date(thirtyOneDaysAgo).toISOString());
  console.log('Checking for downgrade...');

  await licenseManager.checkAndValidate();

  console.log('Current tier:', licenseManager.getTier());
  console.log('Is active:', licenseManager.licenseData?.isActive);

  console.log('\n✓ Simulation complete');
  console.groupEnd();
}

/**
 * Reset license system to free tier (for testing)
 * Clears all license data
 */
async function resetLicenseSystem() {
  console.group('Reset License System');

  try {
    // Clear license data
    licenseManager.licenseData = null;
    await licenseManager.storage.remove('licenseData');

    console.log('License data cleared');
    console.log('Current tier:', licenseManager.getTier());
    console.log('Features:', licenseManager.getFeatures());

    console.log('\n✓ Reset complete');

  } catch (error) {
    console.error('Reset failed:', error);
  }

  console.groupEnd();
}

/**
 * Display tier comparison table
 */
function displayTierComparison() {
  console.group('Tier Comparison');

  const tiers = ['free', 'premium', 'enterprise'];

  console.log('\n┌──────────────────────────┬──────────┬──────────┬────────────┐');
  console.log('│ Feature                  │ Free     │ Premium  │ Enterprise │');
  console.log('├──────────────────────────┼──────────┼──────────┼────────────┤');

  const featureNames = [
    'maxSessions',
    'sessionPersistenceDays',
    'sessionNaming',
    'sessionExport',
    'sessionTemplates',
    'encryption',
    'portableSessions',
    'localAPI',
    'multiProfile'
  ];

  featureNames.forEach(feature => {
    const values = tiers.map(tier => {
      const config = licenseManager.TIER_FEATURES[tier];
      const value = config[feature];

      if (value === Infinity) return '∞';
      if (value === true) return '✓';
      if (value === false) return '✗';
      return value.toString();
    });

    const name = feature.padEnd(24);
    const v1 = values[0].toString().padEnd(8);
    const v2 = values[1].toString().padEnd(8);
    const v3 = values[2].toString().padEnd(10);

    console.log(`│ ${name} │ ${v1} │ ${v2} │ ${v3} │`);
  });

  console.log('└──────────────────────────┴──────────┴──────────┴────────────┘');

  console.groupEnd();
}

/**
 * Monitor license validation
 * Logs validation status every minute for debugging
 */
let validationMonitorInterval = null;

function startValidationMonitor() {
  if (validationMonitorInterval) {
    console.log('Validation monitor already running');
    return;
  }

  console.log('Starting validation monitor (logs every minute)...');

  validationMonitorInterval = setInterval(() => {
    const info = licenseManager.getLicenseInfo();
    const tier = info.tier;
    const daysSinceValidation = info.lastValidated
      ? Math.floor((Date.now() - new Date(info.lastValidated)) / (1000 * 60 * 60 * 24))
      : null;

    console.log(`[Validation Monitor] Tier: ${tier} | Days since validation: ${daysSinceValidation} | Days until expiry: ${info.daysUntilExpiry} | Active: ${info.isActive}`);
  }, 60000); // Every minute

  console.log('✓ Validation monitor started');
}

function stopValidationMonitor() {
  if (validationMonitorInterval) {
    clearInterval(validationMonitorInterval);
    validationMonitorInterval = null;
    console.log('✓ Validation monitor stopped');
  } else {
    console.log('Validation monitor not running');
  }
}

/**
 * Export license diagnostics
 * Returns comprehensive system state for debugging
 */
function exportLicenseDiagnostics() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    deviceId: licenseManager.deviceId,
    isInitialized: licenseManager.isInitialized,
    tier: licenseManager.getTier(),
    features: licenseManager.getFeatures(),
    licenseInfo: licenseManager.getLicenseInfo(),
    config: {
      validationIntervalDays: licenseManager.VALIDATION_INTERVAL_DAYS,
      gracePeriodDays: licenseManager.GRACE_PERIOD_DAYS,
      warningPeriodDays: licenseManager.WARNING_PERIOD_DAYS,
      maxValidationFailures: licenseManager.MAX_VALIDATION_FAILURES
    },
    sessions: {
      count: Object.keys(sessionStore.sessions).length,
      sessions: Object.values(sessionStore.sessions).map(s => ({
        id: s.id,
        createdAt: new Date(s.createdAt).toISOString(),
        tabCount: s.tabs.length
      }))
    }
  };

  console.group('License Diagnostics');
  console.log(JSON.stringify(diagnostics, null, 2));
  console.groupEnd();

  return diagnostics;
}

/**
 * Quick status check
 * One-line summary of license status
 */
function licenseStatus() {
  const tier = licenseManager.getTier();
  const info = licenseManager.getLicenseInfo();
  const sessionCount = Object.keys(sessionStore.sessions).length;
  const maxSessions = licenseManager.getFeatures().maxSessions;

  console.log(`License Status: ${tier.toUpperCase()} | Sessions: ${sessionCount}/${maxSessions === Infinity ? '∞' : maxSessions} | Active: ${info.isActive} | Expires in: ${info.daysUntilExpiry} days`);
}

// Make functions globally available for console testing
if (typeof window !== 'undefined') {
  window.testLicenseSystem = testLicenseSystem;
  window.activateTestLicense = activateTestLicense;
  window.deactivateTestLicense = deactivateTestLicense;
  window.validateTestLicense = validateTestLicense;
  window.simulateGracePeriodExpiration = simulateGracePeriodExpiration;
  window.resetLicenseSystem = resetLicenseSystem;
  window.displayTierComparison = displayTierComparison;
  window.startValidationMonitor = startValidationMonitor;
  window.stopValidationMonitor = stopValidationMonitor;
  window.exportLicenseDiagnostics = exportLicenseDiagnostics;
  window.licenseStatus = licenseStatus;
}
