/**
 * License Manager for Sessner Multi-Session Manager
 * Integrates with Meraf Solutions licensing API
 *
 * @module LicenseManager
 * @version 1.0.0
 *
 * Privacy Guarantee: All license data stored locally only.
 * No analytics, no tracking, no data collection beyond license validation.
 *
 * ES6 Module - MV3 Compatible
 */

/**
 * @typedef {'free' | 'premium' | 'enterprise'} Tier
 */

/**
 * @typedef {Object} LicenseData
 * @property {string} licenseKey - The license key
 * @property {Tier} tier - The license tier
 * @property {string} deviceId - Unique device identifier
 * @property {number} lastValidated - Timestamp of last successful validation
 * @property {number} lastAttempted - Timestamp of last validation attempt
 * @property {boolean} isActive - Whether license is currently active
 * @property {Object} apiResponse - Last full API response (for debugging)
 * @property {number} maxAllowedDomains - Max domains from API
 * @property {number} maxAllowedDevices - Max devices from API
 * @property {number} validationFailures - Consecutive validation failures
 */

/**
 * @typedef {Object} FeatureConfig
 * @property {number} maxSessions - Maximum concurrent sessions (Infinity for unlimited)
 * @property {number} sessionPersistenceDays - How long sessions persist (Infinity for permanent)
 * @property {boolean} sessionNaming - Can name sessions
 * @property {boolean} sessionExport - Can export sessions
 * @property {boolean} sessionTemplates - Can create session templates
 * @property {boolean} encryption - AES-256 encryption for session data
 * @property {boolean} portableSessions - Cross-device session portability
 * @property {boolean} localAPI - Local HTTP API for automation
 * @property {boolean} multiProfile - Multiple profile management
 */

/**
 * License Manager Class
 * Handles all license validation, tier detection, and feature gating
 */
class LicenseManager {
  constructor() {
    // API Configuration
    // NOTE: Development keys work with SANDBOX API only
    // For production deployment, switch to prod.merafsolutions.com with production keys
    this.IS_DEVELOPMENT = true;
    this.API_BASE_URL = this.IS_DEVELOPMENT ? 'https://sandbox.merafsolutions.com' : 'https://prod.merafsolutions.com';
    this.PRODUCT_NAME = 'Sessner';

    // API Secret Keys (visible in source, but rate-limited by API)
    if (this.IS_DEVELOPMENT) {
      // These are DEVELOPMENT keys for SANDBOX API only
      this.SECRET_KEY_VALIDATION = 'zVIlsYWUtU9LF5ESuLq';
      this.SECRET_KEY_RETRIEVE = 'K6v3Sse5ULzL5tFp0U5e';
      this.SECRET_KEY_REGISTER = '5p9Qde20Bs507OGqPWV';
      this.SECRET_KEY_DEACTIVATE = '5p9Qde20Bs507OGqPWV';
    } else {
      // These are LIVE keys for PRODUCTION API only
      this.SECRET_KEY_VALIDATION = 'Aly1XiEivaoYhQsbdE';
      this.SECRET_KEY_RETRIEVE = 'X5UTwKJzY1gmhI3jTTB2';
      this.SECRET_KEY_REGISTER = 'jYXqBGUDHk4x5d1YISDu';
      this.SECRET_KEY_DEACTIVATE = 'jYXqBGUDHk4x5d1YISDu';
    }

    // Validation Configuration
    this.VALIDATION_INTERVAL_DAYS = 7; // Full validation every 7 days
    this.GRACE_PERIOD_DAYS = 30; // 30 days offline grace period
    this.WARNING_PERIOD_DAYS = 7; // Show warnings after 7 days
    this.MAX_VALIDATION_FAILURES = 5; // Max consecutive failures before downgrade
    this.CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour if validation needed

    // Retry Configuration
    this.MAX_RETRIES = 3;
    this.RETRY_DELAYS = [1000, 3000, 10000]; // Exponential backoff
    this.REQUEST_TIMEOUT_MS = 10000; // 10 second timeout

    // State
    this.deviceId = null;
    this.licenseData = null;
    this.isInitialized = false;
    this.validationTimer = null;

    // Feature Configurations
    this.TIER_FEATURES = {
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
        maxSessions: Infinity,
        sessionPersistenceDays: Infinity,
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
        encryption: true,
        portableSessions: true,
        localAPI: true,
        multiProfile: true
      }
    };

    // Storage helpers (promisified)
    this.storage = {
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

    console.log('[LicenseManager] Instance created');
  }

  /**
   * Initialize the license manager
   * Loads cached license data and sets up periodic validation
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('[LicenseManager] Already initialized');
      return;
    }

    console.log('[LicenseManager] Initializing...');

    try {
      // Generate or load device ID
      this.deviceId = await this.getOrCreateDeviceId();
      console.log('[LicenseManager] Device ID:', this.deviceId);

      // Load cached license data
      await this.loadCachedLicense();

      // Start periodic validation check
      this.startValidationTimer();

      this.isInitialized = true;
      console.log('[LicenseManager] ✓ Initialization complete');
      console.log('[LicenseManager] Current tier:', this.getTier());

    } catch (error) {
      console.error('[LicenseManager] Initialization error:', error);
      // Fail gracefully to free tier
      this.licenseData = null;
      this.isInitialized = true;
    }
  }

  /**
   * Generate or retrieve device ID
   * Format: SESSNER_{fingerprint}_{salt}
   *
   * Privacy-preserving fingerprint using stable browser characteristics
   *
   * @returns {Promise<string>}
   */
  async getOrCreateDeviceId() {
    // Check if we already have a device ID
    const stored = await this.storage.get('deviceId');
    if (stored.deviceId) {
      return stored.deviceId;
    }

    // Generate new device ID
    const fingerprint = await this.generateFingerprint();
    const salt = this.generateRandomSalt();
    const deviceId = `SESSNER_${fingerprint}_${salt}`;

    // Store for future use
    await this.storage.set({ deviceId });

    console.log('[LicenseManager] Generated new device ID');
    return deviceId;
  }

  /**
   * Generate browser fingerprint
   * Uses stable, privacy-preserving characteristics
   *
   * FIXED (MV3): Service workers don't have access to window/screen APIs.
   * Now uses service worker-compatible APIs only.
   *
   * @returns {Promise<string>}
   */
  async generateFingerprint() {
    try {
      // Service worker-compatible components only
      const components = [];

      // 1. Platform info (service worker-compatible)
      try {
        const platformInfo = await chrome.runtime.getPlatformInfo();
        components.push(platformInfo.os || 'unknown');         // "win", "mac", "linux"
        components.push(platformInfo.arch || 'unknown');       // "x86-64", "arm"
      } catch (error) {
        console.warn('[Fingerprint] getPlatformInfo failed:', error);
        components.push('unknown', 'unknown');
      }

      // 2. Extension version (stable identifier)
      try {
        const manifest = chrome.runtime.getManifest();
        components.push(manifest.version || 'unknown');
      } catch (error) {
        console.warn('[Fingerprint] getManifest failed:', error);
        components.push('unknown');
      }

      // 3. Timezone offset (stable for user's location)
      components.push(String(new Date().getTimezoneOffset()));

      // 4. Language (if available via navigator in service worker)
      if (typeof navigator !== 'undefined' && navigator.language) {
        components.push(navigator.language);
      } else {
        components.push('unknown');
      }

      // 5. Random salt for additional uniqueness (stored in storage)
      // This ensures device ID is unique even if all other components match
      const stored = await this.storage.get('fingerprintSalt');
      let salt = stored.fingerprintSalt;

      if (!salt) {
        salt = this.generateRandomSalt();
        await this.storage.set({ fingerprintSalt: salt });
        console.log('[Fingerprint] Generated new fingerprint salt');
      }

      components.push(salt);

      const fingerprintString = components.join('|');
      console.log('[Fingerprint] Components:', fingerprintString);

      // Hash using SHA-256 via Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(fingerprintString);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Return first 16 characters for brevity
      return hashHex.substring(0, 16);

    } catch (error) {
      console.error('[Fingerprint] Error generating fingerprint:', error);

      // Fallback: Generate simple random ID and store it
      const fallbackId = 'device_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
      console.warn('[Fingerprint] Using fallback ID:', fallbackId);
      return fallbackId;
    }
  }

  /**
   * Generate random salt
   *
   * @returns {string}
   */
  generateRandomSalt() {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Load cached license data from storage
   *
   * @returns {Promise<void>}
   */
  async loadCachedLicense() {
    const stored = await this.storage.get('licenseData');

    if (stored.licenseData) {
      this.licenseData = stored.licenseData;
      console.log('[LicenseManager] Loaded cached license:', {
        tier: this.licenseData.tier,
        lastValidated: new Date(this.licenseData.lastValidated).toISOString(),
        isActive: this.licenseData.isActive
      });

      // Check if validation needed
      await this.checkAndValidate();
    } else {
      console.log('[LicenseManager] No cached license (Free tier)');
      this.licenseData = null;
    }
  }

  /**
   * Start periodic validation timer
   * Checks every hour if validation is needed
   *
   * @returns {void}
   */
  startValidationTimer() {
    /**
     * MV3: License validation now handled by chrome.alarms API
     * See modules/alarm_handlers.js LICENSE_VALIDATION alarm (runs every 24 hours)
     * The alarm calls licenseManager.validateLicenseOnline() directly
     */
    console.log('[LicenseManager] Validation timer (MV3: handled by chrome.alarms.LICENSE_VALIDATION)');
    // REMOVED for MV3: setInterval for validation (now handled by chrome.alarms)
  }

  /**
   * Check if validation is needed and perform if necessary
   *
   * @returns {Promise<void>}
   */
  async checkAndValidate() {
    if (!this.licenseData || !this.licenseData.isActive) {
      return; // No license to validate
    }

    const now = Date.now();
    const daysSinceValidation = (now - this.licenseData.lastValidated) / (1000 * 60 * 60 * 24);

    // Check if validation interval has passed
    if (daysSinceValidation >= this.VALIDATION_INTERVAL_DAYS) {
      console.log('[LicenseManager] Validation interval reached, validating...');
      await this.validateLicense();
    }

    // Check if in grace period warning zone
    if (daysSinceValidation >= this.WARNING_PERIOD_DAYS) {
      const daysRemaining = this.GRACE_PERIOD_DAYS - daysSinceValidation;
      if (daysRemaining > 0) {
        console.warn(`[LicenseManager] Grace period warning: ${Math.floor(daysRemaining)} days remaining`);
        // Could emit event for UI warning here
      }
    }

    // Check if grace period exceeded
    if (daysSinceValidation >= this.GRACE_PERIOD_DAYS) {
      console.error('[LicenseManager] Grace period exceeded, downgrading to free tier');
      await this.downgradeLicense('Grace period exceeded');
    }
  }

  /**
   * Activate a new license
   * Full flow: Register device → Verify license → Detect tier → Store
   *
   * @param {string} licenseKey - The license key to activate
   * @returns {Promise<{success: boolean, tier: Tier, message: string, features?: FeatureConfig}>}
   */
  async activateLicense(licenseKey) {
    console.log('[LicenseManager] Activating license...');

    if (!licenseKey || typeof licenseKey !== 'string' || licenseKey.trim().length === 0) {
      return {
        success: false,
        tier: 'free',
        message: 'Invalid license key format'
      };
    }

    const key = licenseKey.trim();
    const baseUrl = this.API_BASE_URL;

    try {
      // Step 1: Register device
      console.log('[LicenseManager] Step 1: Registering device...');
      const registerUrl = `${baseUrl}/api/license/register/device/${this.deviceId}/${this.SECRET_KEY_REGISTER}/${key}`;
      const registerResponse = await this.fetchWithRetry(registerUrl);

      if (!registerResponse.success) {
        return {
          success: false,
          tier: 'free',
          message: registerResponse.message || 'Device registration failed',
          error_code: registerResponse.error_code
        };
      }

      console.log('[LicenseManager] ✓ Device registered');

      // Step 2: Verify license (full response)
      console.log('[LicenseManager] Step 2: Verifying license...');
      const verifyUrl = `${baseUrl}/api/license/verify/${this.SECRET_KEY_VALIDATION}/${key}`;
      const verifyResponse = await this.fetchWithRetry(verifyUrl);

      if (!verifyResponse.success) {
        return {
          success: false,
          tier: 'free',
          message: verifyResponse.message || 'License verification failed',
          error_code: verifyResponse.error_code
        };
      }

      console.log('[LicenseManager] ✓ License verified');

      // Step 3: Detect tier from API response
      const tier = this.detectTier(verifyResponse);
      console.log('[LicenseManager] ✓ Tier detected:', tier);

      // Step 4: Store license data
      this.licenseData = {
        licenseKey: key,
        tier: tier,
        deviceId: this.deviceId,
        lastValidated: Date.now(),
        lastAttempted: Date.now(),
        isActive: true,
        apiResponse: verifyResponse,
        maxAllowedDomains: verifyResponse.max_allowed_domains || 0,
        maxAllowedDevices: verifyResponse.max_allowed_devices || 0,
        validationFailures: 0
      };

      await this.storage.set({ licenseData: this.licenseData });
      console.log('[LicenseManager] ✓ License data stored');

      return {
        success: true,
        tier: tier,
        message: `License activated successfully (${tier.toUpperCase()} tier)`,
        features: this.getFeatures()
      };

    } catch (error) {
      console.error('[LicenseManager] Activation error:', error);
      return {
        success: false,
        tier: 'free',
        message: `Activation failed: ${error.message}`
      };
    }
  }

  /**
   * Validate existing license
   * Lightweight validation using /validate endpoint
   *
   * @returns {Promise<{success: boolean, message: string, tier?: Tier}>}
   */
  async validateLicense() {
    if (!this.licenseData || !this.licenseData.licenseKey) {
      console.log('[LicenseManager] No license to validate');
      return { success: false, message: 'No active license' };
    }

    console.log('[LicenseManager] Validating license...');
    const baseUrl = this.API_BASE_URL;

    try {
      const key = this.licenseData.licenseKey;

      // Use Routine Validation endpoint: /validate?t={product}&s={license_key}&d={device}
      const url = `${baseUrl}/validate?t=${encodeURIComponent(this.PRODUCT_NAME)}&s=${encodeURIComponent(key)}&d=${encodeURIComponent(this.deviceId)}`;

      console.log('[LicenseManager] Validation URL:', url);
      console.log('[LicenseManager] Product:', this.PRODUCT_NAME);
      console.log('[LicenseManager] License key:', key);
      console.log('[LicenseManager] Device ID:', this.deviceId);

      const response = await this.fetchWithTimeout(url, this.REQUEST_TIMEOUT_MS);
      console.log('[LicenseManager] Validation response status:', response.status);

      const text = await response.text();
      console.log('[LicenseManager] Validation response text:', text);

      // Parse the response to remove JSON quotes if present
      let parsedResponse = text.trim();
      try {
        // Try to parse as JSON to remove quotes
        const parsed = JSON.parse(parsedResponse);
        parsedResponse = parsed;
      } catch (e) {
        // If not valid JSON, use trimmed response as-is
      }
      console.log('[LicenseManager] Parsed response:', parsedResponse);

      // Check if response is "1" or 1 (valid)
      if (parsedResponse === '1' || parsedResponse === 1) {
        // Update last validated timestamp
        this.licenseData.lastValidated = Date.now();
        this.licenseData.lastAttempted = Date.now();
        this.licenseData.validationFailures = 0;

        await this.storage.set({ licenseData: this.licenseData });
        console.log('[LicenseManager] ✓ License validated successfully');

        return {
          success: true,
          message: 'License is valid and active',
          tier: this.licenseData.tier
        };
      } else if (parsedResponse === '0' || parsedResponse === 0) {
        // Validation failed - license is invalid
        console.error('[LicenseManager] License validation failed: Invalid license (response: 0)');

        // Store old tier before clearing license data
        const oldTier = (this.licenseData && this.licenseData.tier) ? this.licenseData.tier : 'free';

        // Show notification to user
        try {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'License Invalid',
            message: 'Your license key is invalid or has been revoked. Reverting to Free tier.',
            priority: 2
          }, (notificationId) => {
            if (chrome.runtime.lastError) {
              console.warn('[LicenseManager] Notification error:', chrome.runtime.lastError.message);
            } else {
              console.log('[LicenseManager] ✓ Notification shown:', notificationId);
            }
          });
        } catch (notificationError) {
          console.error('[LicenseManager] Failed to show notification:', notificationError);
        }

        // Clear all license data from storage
        await this.storage.remove('licenseData');
        this.licenseData = null;

        console.log('[LicenseManager] ✓ All license data cleared, reverted to Free tier');

        // Notify background script of tier change (invalid license)
        const newTier = 'free';
        console.log('[LicenseManager] Tier changed:', oldTier, '->', newTier, '(license invalid)');

        try {
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'tierChanged',
              oldTier: oldTier,
              newTier: newTier,
              reason: 'license_invalid'
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('[LicenseManager] Error notifying background of tier change:', chrome.runtime.lastError);
              } else {
                console.log('[LicenseManager] ✓ Background script notified of tier change');
              }
            });
          }
        } catch (error) {
          console.error('[LicenseManager] Error sending tier change message:', error);
        }

        // Redirect to popup.html (free version) - hybrid approach for tabs and extension popups
        // NOTE: This is async and happens in background, don't block return
        console.log('[LicenseManager] Initiating redirect logic...');

        // First, send message to any open license pages (works for extension popups)
        // Note: chrome.runtime.sendMessage doesn't return a Promise in all Chrome versions
        try {
          chrome.runtime.sendMessage({
            action: 'redirectToPopup',
            reason: 'invalidLicense'
          }, () => {
            if (chrome.runtime.lastError) {
              // No listeners - this is expected if no extension pages are open
              console.log('[LicenseManager] No extension pages listening:', chrome.runtime.lastError.message);
            } else {
              console.log('[LicenseManager] ✓ Redirect message sent to extension pages');
            }
          });
        } catch (err) {
          console.error('[LicenseManager] Message sending error:', err);
        }

        // Also check for license tabs and redirect them (works for browser tabs)
        chrome.tabs.query({}, (allTabs) => {
          if (chrome.runtime.lastError) {
            console.error('[LicenseManager] Tab query error:', chrome.runtime.lastError);
            return;
          }

          console.log('[LicenseManager] Total tabs found:', allTabs ? allTabs.length : 0);

          // Find license-related tabs
          const licenseTabs = allTabs.filter(tab => {
            const url = tab.url || '';
            return url.includes('license-details.html') ||
                   url.includes('popup-license.html') ||
                   url.includes('license.html');
          });

          console.log('[LicenseManager] License tabs found:', licenseTabs.length);

          if (licenseTabs.length > 0) {
            // Redirect all license tabs to popup.html
            licenseTabs.forEach(tab => {
              console.log('[LicenseManager] Redirecting license tab:', tab.id, tab.url);

              // Clear badge
              chrome.action.setBadgeText({ text: '', tabId: tab.id }, () => {
                if (chrome.runtime.lastError) {
                  console.warn('[LicenseManager] Badge clear error:', chrome.runtime.lastError);
                }
              });

              // Redirect to popup.html
              chrome.tabs.update(tab.id, {
                url: chrome.runtime.getURL('popup.html')
              }, () => {
                if (chrome.runtime.lastError) {
                  console.error('[LicenseManager] Tab update error:', chrome.runtime.lastError);
                } else {
                  console.log('[LicenseManager] ✓ Tab redirected successfully:', tab.id);
                }
              });
            });
          } else {
            console.log('[LicenseManager] No license tabs found');
          }
        });

        return {
          success: false,
          message: 'License validation failed: Invalid license key. Reverted to Free tier.',
          tier: 'free'
        };
      } else {
        // Unexpected response - increment failure count but don't immediately clear
        this.licenseData.lastAttempted = Date.now();
        this.licenseData.validationFailures = (this.licenseData.validationFailures || 0) + 1;

        await this.storage.set({ licenseData: this.licenseData });

        console.warn('[LicenseManager] License validation failed with unexpected response', {
          failures: this.licenseData.validationFailures,
          maxFailures: this.MAX_VALIDATION_FAILURES,
          responseText: text,
          parsedResponse: parsedResponse
        });

        // Check if max failures reached
        if (this.licenseData.validationFailures >= this.MAX_VALIDATION_FAILURES) {
          console.error('[LicenseManager] Max validation failures reached - downgrading license');
          await this.downgradeLicense('Maximum validation failures reached');

          return {
            success: false,
            message: 'License validation failed multiple times. Downgraded to Free tier.',
            tier: 'free'
          };
        }

        return {
          success: false,
          message: `License validation failed (unexpected response: ${parsedResponse})`,
          tier: this.licenseData.tier
        };
      }

    } catch (error) {
      console.error('[LicenseManager] Validation error:', error);

      // Track failed attempt only if licenseData exists
      // (it may have been cleared if license was invalid)
      if (this.licenseData) {
        this.licenseData.lastAttempted = Date.now();
        this.licenseData.validationFailures = (this.licenseData.validationFailures || 0) + 1;
        await this.storage.set({ licenseData: this.licenseData });

        return {
          success: false,
          message: `Validation error: ${error.message}`,
          tier: this.licenseData.tier
        };
      } else {
        // License was cleared during validation (invalid license)
        return {
          success: false,
          message: `Validation error: ${error.message}`,
          tier: 'free'
        };
      }
    }
  }

  /**
   * Deactivate current license
   * Unregisters device from API and clears local data
   *
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deactivateLicense() {
    if (!this.licenseData || !this.licenseData.licenseKey) {
      console.log('[LicenseManager] No license to deactivate');
      return { success: false, message: 'No active license' };
    }

    console.log('[LicenseManager] Deactivating license...');
    const baseUrl = this.API_BASE_URL;

    try {
      // Deregister device from API
      const deactivateUrl = `${baseUrl}/api/license/unregister/device/${this.deviceId}/${this.SECRET_KEY_DEACTIVATE}/${this.licenseData.licenseKey}`;
      const response = await this.fetchWithRetry(deactivateUrl);

      if (!response.success) {
        console.warn('[LicenseManager] API deactivation failed, clearing local data anyway');
      } else {
        console.log('[LicenseManager] ✓ Device unregistered from API');
      }

    } catch (error) {
      console.error('[LicenseManager] Deactivation API error:', error);
      // Continue to clear local data even if API fails
    }

    // Clear local license data
    this.licenseData = null;
    await this.storage.remove('licenseData');
    console.log('[LicenseManager] ✓ Local license data cleared');

    return {
      success: true,
      message: 'License deactivated successfully'
    };
  }

  /**
   * Downgrade license to free tier
   * Called when validation fails or grace period exceeded
   *
   * @param {string} reason - Reason for downgrade
   * @returns {Promise<void>}
   */
  async downgradeLicense(reason) {
    console.warn(`[LicenseManager] Downgrading license: ${reason}`);

    if (this.licenseData) {
      // Store old tier for comparison
      const oldTier = this.licenseData.tier || 'free';

      this.licenseData.isActive = false;
      this.licenseData.tier = 'free';
      await this.storage.set({ licenseData: this.licenseData });

      // Notify background script of tier change
      // This will disable auto-restore if downgrading from Enterprise
      const newTier = 'free';
      console.log('[LicenseManager] Tier changed:', oldTier, '->', newTier);

      // Call handleTierChange() in background script
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({
            action: 'tierChanged',
            oldTier: oldTier,
            newTier: newTier,
            reason: reason
          }, (response) => {
            if (chrome.runtime.lastError) {
              console.error('[LicenseManager] Error notifying background of tier change:', chrome.runtime.lastError);
            } else {
              console.log('[LicenseManager] ✓ Background script notified of tier change');
            }
          });
        }
      } catch (error) {
        console.error('[LicenseManager] Error sending tier change message:', error);
      }
    }

    // Could emit event for UI notification here
    // this.emit('licenseDowngraded', { reason });
  }

  /**
   * Detect tier from API response
   *
   * Enterprise: max_allowed_devices > 1 && max_allowed_domains > 3
   * Premium: max_allowed_domains > 3 && max_allowed_devices === 1
   * Free: Otherwise
   *
   * @param {Object} apiResponse - API response object
   * @returns {Tier}
   */
  detectTier(apiResponse) {
    // First try to detect from product_ref (most reliable)
    if (apiResponse.product_ref) {
      const productRef = apiResponse.product_ref.toLowerCase();
      if (productRef.includes('enterprise')) {
        console.log('[LicenseManager] Tier detected from product_ref: enterprise');
        return 'enterprise';
      } else if (productRef.includes('premium')) {
        console.log('[LicenseManager] Tier detected from product_ref: premium');
        return 'premium';
      }
    }

    // Fallback to numeric detection (parse strings to integers)
    const maxDevices = parseInt(apiResponse.max_allowed_devices) || 0;
    const maxDomains = parseInt(apiResponse.max_allowed_domains) || 0;

    console.log('[LicenseManager] Numeric tier detection:', { maxDevices, maxDomains });

    if (maxDevices > 1 && maxDomains > 3) {
      return 'enterprise';
    } else if (maxDomains > 3 && maxDevices === 1) {
      return 'premium';
    } else {
      return 'free';
    }
  }

  /**
   * Get current tier
   *
   * @returns {Tier}
   */
  getTier() {
    if (!this.licenseData || !this.licenseData.isActive) {
      return 'free';
    }
    return this.licenseData.tier;
  }

  /**
   * Get feature configuration for current tier
   *
   * @returns {FeatureConfig}
   */
  getFeatures() {
    const tier = this.getTier();
    return { ...this.TIER_FEATURES[tier] };
  }

  /**
   * Check if a specific feature is available
   *
   * @param {string} featureName - Name of the feature
   * @returns {boolean}
   */
  hasFeature(featureName) {
    const features = this.getFeatures();
    return features[featureName] === true || features[featureName] === Infinity;
  }

  /**
   * Get license info for UI display
   *
   * @returns {Object}
   */
  getLicenseInfo() {
    const tier = this.getTier();
    const features = this.getFeatures();

    if (!this.licenseData || !this.licenseData.isActive) {
      return {
        tier: 'free',
        isActive: false,
        features: features,
        message: 'No active license (Free tier)'
      };
    }

    const daysSinceValidation = (Date.now() - this.licenseData.lastValidated) / (1000 * 60 * 60 * 24);
    const daysUntilExpiry = this.GRACE_PERIOD_DAYS - daysSinceValidation;

    return {
      tier: tier,
      isActive: this.licenseData.isActive,
      licenseKey: this.maskLicenseKey(this.licenseData.licenseKey),
      deviceId: this.deviceId,
      lastValidated: new Date(this.licenseData.lastValidated).toISOString(),
      daysUntilExpiry: Math.max(0, Math.floor(daysUntilExpiry)),
      needsValidation: daysSinceValidation >= this.VALIDATION_INTERVAL_DAYS,
      inGracePeriod: daysSinceValidation >= this.WARNING_PERIOD_DAYS,
      features: features,
      maxAllowedDomains: this.licenseData.maxAllowedDomains,
      maxAllowedDevices: this.licenseData.maxAllowedDevices,

      // Include full API response for detailed display
      ...this.licenseData.apiResponse
    };
  }

  /**
   * Mask license key for display
   * Shows first 4 and last 4 characters
   *
   * @param {string} key - License key
   * @returns {string}
   */
  maskLicenseKey(key) {
    if (!key || key.length < 8) {
      return '****-****';
    }
    return `${key.substring(0, 4)}-****-${key.substring(key.length - 4)}`;
  }

  /**
   * Fetch with retry logic (exponential backoff)
   *
   * @param {string} url - URL to fetch
   * @param {number} attempt - Current attempt number
   * @returns {Promise<Object>}
   */
  async fetchWithRetry(url, attempt = 0) {
    try {
      console.log(`[LicenseManager] Fetching: ${url}`);
      const response = await this.fetchWithTimeout(url, this.REQUEST_TIMEOUT_MS);

      if (!response.ok) {
        console.error(`[LicenseManager] HTTP Error: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const text = await response.text();
      console.log(`[LicenseManager] Raw response: ${text}`);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        console.error(`[LicenseManager] JSON parse error:`, parseError);
        console.error(`[LicenseManager] Response text:`, text);
        throw new Error(`Invalid JSON response: ${text.substring(0, 100)}`);
      }

      console.log(`[LicenseManager] Parsed data:`, data);

      // Normalize API response format
      // API returns { result: 'success'/'error' } but we expect { success: true/false }
      if (data.result === 'success') {
        data.success = true;
      } else if (data.result === 'error') {
        data.success = false;
      }

      return data;

    } catch (error) {
      console.error(`[LicenseManager] Fetch error (attempt ${attempt + 1}):`, error);

      // Retry if attempts remaining
      if (attempt < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAYS[attempt];
        console.log(`[LicenseManager] Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${this.MAX_RETRIES})`);

        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(url, attempt + 1);
      }

      // All retries exhausted
      throw new Error(`Request failed after ${this.MAX_RETRIES} retries: ${error.message}`);
    }
  }

  /**
   * Fetch with timeout
   *
   * @param {string} url - URL to fetch
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>}
   */
  async fetchWithTimeout(url, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
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

  /**
   * Open popup.html in a new window
   * Helper method to avoid code duplication
   *
   * @returns {void}
   */
  openPopupWindow() {
    chrome.windows.create({
      url: chrome.runtime.getURL('popup.html'),
      type: 'popup',
      width: 400,
      height: 600
    }, (window) => {
      if (chrome.runtime.lastError) {
        console.error('[LicenseManager] Window creation error:', chrome.runtime.lastError);
      } else {
        console.log('[LicenseManager] ✓ Popup window created:', window ? window.id : 'unknown');
      }
    });
  }

  /**
   * Clean up resources
   * Called when extension is disabled/unloaded
   *
   * @returns {void}
   */
  cleanup() {
    if (this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = null;
    }
    console.log('[LicenseManager] Cleanup complete');
  }
}

// Create singleton instance
const licenseManager = new LicenseManager();

// Export ES6 module
export { LicenseManager, licenseManager };
export default licenseManager;

console.log('[LicenseManager] ✓ License manager loaded (ES6 module)');
