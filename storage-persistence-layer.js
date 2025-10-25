/**
 * Storage Persistence Layer - Multi-Session Manager
 *
 * Provides multi-layered persistent storage to survive browser restarts
 * even when Edge/Chrome clears chrome.storage.local
 *
 * Strategy:
 * - Layer 1: chrome.storage.local (primary, fast)
 * - Layer 2: IndexedDB (backup, more persistent)
 * - Layer 3: chrome.storage.sync (emergency, critical data only)
 *
 * Features:
 * - Automatic dual-write to all layers
 * - Automatic recovery on load (tries all layers)
 * - Storage health monitoring
 * - Edge-specific workarounds
 *
 * Author: Claude (JavaScript Pro Agent)
 * Date: 2025-10-25
 */

// ============= Storage Configuration =============

const STORAGE_CONFIG = {
  // IndexedDB configuration
  IDB_NAME: 'SessnerStorage',
  IDB_VERSION: 1,
  IDB_STORE_SESSIONS: 'sessions',
  IDB_STORE_COOKIES: 'cookieStore',
  IDB_STORE_TABS: 'tabToSession',
  IDB_STORE_METADATA: 'metadata',

  // Storage health check
  HEALTH_CHECK_KEY: '__storage_health_check__',
  HEALTH_CHECK_INTERVAL: 60000, // 1 minute

  // Sync storage limits (for critical data)
  SYNC_MAX_SIZE: 102400, // 100KB (chrome.storage.sync limit)
  SYNC_CRITICAL_KEYS: ['licenseData', 'autoRestorePreference'],

  // Persistence verification
  VERIFY_PERSISTENCE: true,
  VERIFY_DELAY: 1000, // 1 second after write
};

// ============= Storage Persistence Manager =============

class StoragePersistenceManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.storageHealth = {
      local: true,
      indexedDB: true,
      sync: true
    };
    this.lastHealthCheck = 0;
    this.initPromise = null;
  }

  /**
   * Initialize storage persistence manager
   * @returns {Promise<void>}
   */
  async initialize() {
    // Prevent multiple initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      console.log('[Storage Persistence] Initializing multi-layer storage...');

      try {
        // Initialize IndexedDB
        await this.initIndexedDB();
        console.log('[Storage Persistence] ✓ IndexedDB initialized');

        // Run initial health check
        await this.checkStorageHealth();
        console.log('[Storage Persistence] ✓ Storage health check complete');

        // Start storage monitoring
        this.startStorageMonitoring();
        console.log('[Storage Persistence] ✓ Storage monitoring started');

        // Start periodic health checks
        this.startHealthCheckTimer();
        console.log('[Storage Persistence] ✓ Health check timer started');

        this.isInitialized = true;
        console.log('[Storage Persistence] ✓ Initialization complete');

      } catch (error) {
        console.error('[Storage Persistence] Initialization error:', error);
        // Don't throw - fallback to chrome.storage.local only
        this.storageHealth.indexedDB = false;
      }
    })();

    return this.initPromise;
  }

  /**
   * Initialize IndexedDB
   * @returns {Promise<IDBDatabase>}
   */
  initIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(STORAGE_CONFIG.IDB_NAME, STORAGE_CONFIG.IDB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDB] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const db = request.result;

        // CRITICAL FIX: Validate object stores exist
        // If database exists but stores are missing, recreate database
        const requiredStores = [
          STORAGE_CONFIG.IDB_STORE_SESSIONS,
          STORAGE_CONFIG.IDB_STORE_COOKIES,
          STORAGE_CONFIG.IDB_STORE_TABS,
          STORAGE_CONFIG.IDB_STORE_METADATA
        ];

        const missingStores = requiredStores.filter(store =>
          !db.objectStoreNames.contains(store)
        );

        if (missingStores.length > 0) {
          console.warn('[IndexedDB] ⚠️ Database missing object stores:', missingStores);
          console.log('[IndexedDB] This can happen if database was created but upgrade failed');
          console.log('[IndexedDB] Deleting and recreating database...');

          db.close();

          const deleteRequest = indexedDB.deleteDatabase(STORAGE_CONFIG.IDB_NAME);

          deleteRequest.onsuccess = () => {
            console.log('[IndexedDB] ✓ Corrupted database deleted, reopening...');
            // Reopen database - this will trigger onupgradeneeded
            this.initIndexedDB().then(resolve).catch(reject);
          };

          deleteRequest.onerror = () => {
            console.error('[IndexedDB] ✗ Failed to delete corrupted database:', deleteRequest.error);
            reject(new Error('Failed to delete corrupted database: ' + deleteRequest.error));
          };

          deleteRequest.onblocked = () => {
            console.error('[IndexedDB] ✗ Database deletion blocked (other connections open)');
            reject(new Error('Database deletion blocked - close other tabs and try again'));
          };

          return; // Don't resolve yet - wait for recreate
        }

        // All stores exist - database is healthy
        this.db = db;
        console.log('[IndexedDB] ✓ Database opened successfully');
        console.log('[IndexedDB] ✓ All object stores validated:', requiredStores);
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        console.log('[IndexedDB] Database upgrade needed (version', event.oldVersion, '->', event.newVersion, ')');
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORAGE_CONFIG.IDB_STORE_SESSIONS)) {
          const sessionsStore = db.createObjectStore(STORAGE_CONFIG.IDB_STORE_SESSIONS, { keyPath: 'id' });
          console.log('[IndexedDB] Created sessions object store');
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.IDB_STORE_COOKIES)) {
          const cookiesStore = db.createObjectStore(STORAGE_CONFIG.IDB_STORE_COOKIES, { keyPath: 'sessionId' });
          console.log('[IndexedDB] Created cookieStore object store');
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.IDB_STORE_TABS)) {
          const tabsStore = db.createObjectStore(STORAGE_CONFIG.IDB_STORE_TABS);
          console.log('[IndexedDB] Created tabToSession object store');
        }

        if (!db.objectStoreNames.contains(STORAGE_CONFIG.IDB_STORE_METADATA)) {
          const metadataStore = db.createObjectStore(STORAGE_CONFIG.IDB_STORE_METADATA);
          console.log('[IndexedDB] Created metadata object store');
        }
      };
    });
  }

  /**
   * Check storage health across all layers
   * @returns {Promise<Object>}
   */
  async checkStorageHealth() {
    console.log('[Storage Health] Running health check...');
    const testKey = STORAGE_CONFIG.HEALTH_CHECK_KEY;
    const testValue = Date.now().toString();

    // Test chrome.storage.local
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ [testKey]: testValue }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            chrome.storage.local.get([testKey], (data) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (data[testKey] === testValue) {
                resolve();
              } else {
                reject(new Error('Data mismatch'));
              }
            });
          }
        });
      });
      this.storageHealth.local = true;
      console.log('[Storage Health] ✓ chrome.storage.local is healthy');
    } catch (error) {
      console.error('[Storage Health] ✗ chrome.storage.local failed:', error);
      this.storageHealth.local = false;
    }

    // Test IndexedDB
    try {
      if (this.db) {
        // Use metadata store for health checks
        await this.setIndexedDBValue(STORAGE_CONFIG.IDB_STORE_METADATA, testKey, { value: testValue });
        const result = await this.getIndexedDBValue(STORAGE_CONFIG.IDB_STORE_METADATA, testKey);
        if (result && result.value === testValue) {
          this.storageHealth.indexedDB = true;
          console.log('[Storage Health] ✓ IndexedDB is healthy');
        } else {
          throw new Error('Data mismatch');
        }
      } else {
        throw new Error('Database not initialized');
      }
    } catch (error) {
      console.error('[Storage Health] ✗ IndexedDB failed:', error);
      this.storageHealth.indexedDB = false;
    }

    // Test chrome.storage.sync
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.sync.set({ [testKey]: testValue }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            chrome.storage.sync.get([testKey], (data) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else if (data[testKey] === testValue) {
                resolve();
              } else {
                reject(new Error('Data mismatch'));
              }
            });
          }
        });
      });
      this.storageHealth.sync = true;
      console.log('[Storage Health] ✓ chrome.storage.sync is healthy');
    } catch (error) {
      console.error('[Storage Health] ✗ chrome.storage.sync failed:', error);
      this.storageHealth.sync = false;
    }

    this.lastHealthCheck = Date.now();
    console.log('[Storage Health] Health check complete:', this.storageHealth);

    return this.storageHealth;
  }

  /**
   * Start storage monitoring (chrome.storage.onChanged)
   */
  startStorageMonitoring() {
    // Monitor chrome.storage.local changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        const keys = Object.keys(changes);
        console.log('[Storage Monitor] chrome.storage.local changed:', keys.length, 'keys');

        // Log important changes
        if (changes.sessions) {
          const oldCount = changes.sessions.oldValue ? Object.keys(changes.sessions.oldValue).length : 0;
          const newCount = changes.sessions.newValue ? Object.keys(changes.sessions.newValue).length : 0;
          console.log('[Storage Monitor] Sessions changed:', oldCount, '->', newCount);
        }

        if (changes.cookieStore) {
          const oldCount = changes.cookieStore.oldValue ? Object.keys(changes.cookieStore.oldValue).length : 0;
          const newCount = changes.cookieStore.newValue ? Object.keys(changes.cookieStore.newValue).length : 0;
          console.log('[Storage Monitor] CookieStore changed:', oldCount, '->', newCount);
        }

        if (changes.tabToSession) {
          const oldCount = changes.tabToSession.oldValue ? Object.keys(changes.tabToSession.oldValue).length : 0;
          const newCount = changes.tabToSession.newValue ? Object.keys(changes.tabToSession.newValue).length : 0;
          console.log('[Storage Monitor] TabToSession changed:', oldCount, '->', newCount);
        }

        // Detect unexpected clears (Edge bug)
        if (changes.sessions && !changes.sessions.newValue && changes.sessions.oldValue) {
          console.error('[Storage Monitor] ⚠️ CRITICAL: Sessions data was cleared unexpectedly!');
          console.error('[Storage Monitor] This is likely an Edge storage bug');
          // Don't auto-restore here - let loadData() handle it on next startup
        }
      }
    });

    console.log('[Storage Monitor] Monitoring chrome.storage.local changes');
  }

  /**
   * Start periodic health check timer
   */
  startHealthCheckTimer() {
    setInterval(async () => {
      await this.checkStorageHealth();
    }, STORAGE_CONFIG.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Save data to all storage layers
   * @param {Object} data - Data to save { sessions, cookieStore, tabToSession, tabMetadata }
   * @returns {Promise<Object>} Results from each layer
   */
  async saveData(data) {
    console.log('[Storage Persistence] Saving data to all layers...');
    const results = {
      local: false,
      indexedDB: false,
      sync: false,
      errors: []
    };

    // Layer 1: chrome.storage.local (primary)
    if (this.storageHealth.local) {
      try {
        await new Promise((resolve, reject) => {
          chrome.storage.local.set({
            sessions: data.sessions || {},
            cookieStore: data.cookieStore || {},
            tabToSession: data.tabToSession || {},
            tabMetadata: data.tabMetadata || {},  // NEW: Tab metadata for URL-based restoration
            _lastSaved: Date.now()
          }, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
        results.local = true;
        console.log('[Storage Persistence] ✓ Saved to chrome.storage.local');

        // Verify persistence (Edge debugging)
        if (STORAGE_CONFIG.VERIFY_PERSISTENCE) {
          setTimeout(async () => {
            await this.verifyPersistence(data);
          }, STORAGE_CONFIG.VERIFY_DELAY);
        }

      } catch (error) {
        console.error('[Storage Persistence] ✗ Failed to save to chrome.storage.local:', error);
        results.errors.push({ layer: 'local', error: error.message });
        this.storageHealth.local = false;
      }
    } else {
      console.warn('[Storage Persistence] Skipping chrome.storage.local (unhealthy)');
    }

    // Layer 2: IndexedDB (backup)
    if (this.storageHealth.indexedDB && this.db) {
      try {
        // Save sessions
        if (data.sessions) {
          for (const [sessionId, sessionData] of Object.entries(data.sessions)) {
            await this.setIndexedDBValue(STORAGE_CONFIG.IDB_STORE_SESSIONS, sessionId, sessionData);
          }
        }

        // Save cookieStore
        if (data.cookieStore) {
          for (const [sessionId, cookies] of Object.entries(data.cookieStore)) {
            await this.setIndexedDBValue(STORAGE_CONFIG.IDB_STORE_COOKIES, sessionId, {
              sessionId,
              cookies
            });
          }
        }

        // Save tabToSession
        if (data.tabToSession) {
          await this.setIndexedDBValue(STORAGE_CONFIG.IDB_STORE_TABS, 'mappings', data.tabToSession);
        }

        // Save tabMetadata (CRITICAL: URL-based tab restoration for Edge)
        if (data.tabMetadata) {
          await this.setIndexedDBValue(STORAGE_CONFIG.IDB_STORE_TABS, 'tabMetadata', data.tabMetadata);
          console.log('[Storage Persistence] ✓ Saved', Object.keys(data.tabMetadata).length, 'tab metadata entries to IndexedDB');
        }

        // Save metadata
        await this.setIndexedDBValue(STORAGE_CONFIG.IDB_STORE_METADATA, 'lastSaved', {
          timestamp: Date.now(),
          sessionCount: Object.keys(data.sessions || {}).length,
          tabCount: Object.keys(data.tabToSession || {}).length,
          tabMetadataCount: Object.keys(data.tabMetadata || {}).length  // Track metadata count
        });

        results.indexedDB = true;
        console.log('[Storage Persistence] ✓ Saved to IndexedDB');

        // CRITICAL FIX: Verify critical data was persisted to disk
        // This is especially important for Edge, which may close browser immediately
        if (data.tabMetadata && Object.keys(data.tabMetadata).length > 0) {
          const verified = await this.verifyIndexedDBWrite(STORAGE_CONFIG.IDB_STORE_TABS, 'tabMetadata');
          if (!verified) {
            console.error('[Storage Persistence] ⚠️ WARNING: tabMetadata verification failed!');
            console.error('[Storage Persistence] Data may not persist if browser closes immediately');
          }
        }

      } catch (error) {
        console.error('[Storage Persistence] ✗ Failed to save to IndexedDB:', error);
        results.errors.push({ layer: 'indexedDB', error: error.message });
        this.storageHealth.indexedDB = false;
      }
    } else {
      console.warn('[Storage Persistence] Skipping IndexedDB (unhealthy or not initialized)');
    }

    // Layer 3: chrome.storage.sync (critical data only)
    if (this.storageHealth.sync) {
      try {
        // Only save critical metadata (license, preferences)
        const criticalData = {};
        let totalSize = 0;

        // Calculate size and filter critical data
        for (const key of STORAGE_CONFIG.SYNC_CRITICAL_KEYS) {
          if (data[key]) {
            const serialized = JSON.stringify(data[key]);
            totalSize += serialized.length;
            if (totalSize < STORAGE_CONFIG.SYNC_MAX_SIZE) {
              criticalData[key] = data[key];
            }
          }
        }

        // Save session count (for recovery detection)
        criticalData._sessionCount = Object.keys(data.sessions || {}).length;
        criticalData._lastSaved = Date.now();

        await new Promise((resolve, reject) => {
          chrome.storage.sync.set(criticalData, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });

        results.sync = true;
        console.log('[Storage Persistence] ✓ Saved critical data to chrome.storage.sync');

      } catch (error) {
        console.error('[Storage Persistence] ✗ Failed to save to chrome.storage.sync:', error);
        results.errors.push({ layer: 'sync', error: error.message });
        this.storageHealth.sync = false;
      }
    } else {
      console.warn('[Storage Persistence] Skipping chrome.storage.sync (unhealthy)');
    }

    // Log results
    const successCount = [results.local, results.indexedDB, results.sync].filter(Boolean).length;
    console.log(`[Storage Persistence] Saved to ${successCount}/3 storage layers`);

    if (results.errors.length > 0) {
      console.error('[Storage Persistence] Errors:', results.errors);
    }

    return results;
  }

  /**
   * Load data from all storage layers (tries all, returns best)
   * @returns {Promise<Object>} { sessions, cookieStore, tabToSession, tabMetadata, source }
   */
  async loadData() {
    console.log('[Storage Persistence] Loading data from all layers...');

    // Try Layer 1: chrome.storage.local (fastest)
    let localData = null;
    if (this.storageHealth.local) {
      try {
        localData = await new Promise((resolve, reject) => {
          chrome.storage.local.get(['sessions', 'cookieStore', 'tabToSession', 'tabMetadata', '_lastSaved'], (data) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(data);
            }
          });
        });

        if (localData && localData.sessions && Object.keys(localData.sessions).length > 0) {
          console.log('[Storage Persistence] ✓ Loaded from chrome.storage.local:', Object.keys(localData.sessions).length, 'sessions');
          return {
            sessions: localData.sessions || {},
            cookieStore: localData.cookieStore || {},
            tabToSession: localData.tabToSession || {},
            tabMetadata: localData.tabMetadata || {},  // NEW: Tab metadata
            source: 'local',
            timestamp: localData._lastSaved
          };
        } else {
          console.warn('[Storage Persistence] chrome.storage.local is empty');
        }
      } catch (error) {
        console.error('[Storage Persistence] ✗ Failed to load from chrome.storage.local:', error);
        this.storageHealth.local = false;
      }
    }

    // Try Layer 2: IndexedDB (backup)
    let idbData = null;
    if (this.storageHealth.indexedDB && this.db) {
      try {
        const sessions = await this.getAllIndexedDBValues(STORAGE_CONFIG.IDB_STORE_SESSIONS);
        const cookieStoreData = await this.getAllIndexedDBValues(STORAGE_CONFIG.IDB_STORE_COOKIES);
        const tabMappings = await this.getIndexedDBValue(STORAGE_CONFIG.IDB_STORE_TABS, 'mappings');
        const tabMetadata = await this.getIndexedDBValue(STORAGE_CONFIG.IDB_STORE_TABS, 'tabMetadata');  // CRITICAL: Load tab URLs
        const metadata = await this.getIndexedDBValue(STORAGE_CONFIG.IDB_STORE_METADATA, 'lastSaved');

        if (sessions && sessions.length > 0) {
          // Reconstruct data structure
          idbData = {
            sessions: {},
            cookieStore: {},
            tabToSession: tabMappings || {},
            tabMetadata: tabMetadata || {},  // CRITICAL: Include tab metadata for URL-based restoration
            source: 'indexedDB',
            timestamp: metadata ? metadata.timestamp : null
          };

          // Convert sessions array to object
          for (const session of sessions) {
            idbData.sessions[session.id] = session;
          }

          // Convert cookieStore array to object
          for (const cookieData of cookieStoreData) {
            idbData.cookieStore[cookieData.sessionId] = cookieData.cookies;
          }

          console.log('[Storage Persistence] ✓ Loaded from IndexedDB:', Object.keys(idbData.sessions).length, 'sessions');
          console.log('[Storage Persistence] ✓ Loaded from IndexedDB:', Object.keys(idbData.tabMetadata).length, 'tab metadata entries');

          // If chrome.storage.local was empty but IndexedDB has data, restore it
          if (!localData || !localData.sessions || Object.keys(localData.sessions).length === 0) {
            console.log('[Storage Persistence] ⚠️ Restoring chrome.storage.local from IndexedDB backup');
            await this.saveData(idbData);
          }

          return idbData;
        } else {
          console.warn('[Storage Persistence] IndexedDB is empty');
        }
      } catch (error) {
        console.error('[Storage Persistence] ✗ Failed to load from IndexedDB:', error);
        this.storageHealth.indexedDB = false;
      }
    }

    // Try Layer 3: chrome.storage.sync (critical data only)
    if (this.storageHealth.sync) {
      try {
        const syncData = await new Promise((resolve, reject) => {
          chrome.storage.sync.get(['_sessionCount', '_lastSaved'], (data) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(data);
            }
          });
        });

        if (syncData && syncData._sessionCount) {
          console.log('[Storage Persistence] ⚠️ Found session metadata in chrome.storage.sync');
          console.log('[Storage Persistence] Expected', syncData._sessionCount, 'sessions but none found in primary storage');
          console.log('[Storage Persistence] This indicates Edge cleared chrome.storage.local');
        }
      } catch (error) {
        console.error('[Storage Persistence] ✗ Failed to load from chrome.storage.sync:', error);
      }
    }

    // No data found in any layer
    console.log('[Storage Persistence] No data found in any storage layer');
    return {
      sessions: {},
      cookieStore: {},
      tabToSession: {},
      tabMetadata: {},  // NEW: Empty metadata
      source: 'none',
      timestamp: null
    };
  }

  /**
   * Verify persistence (Edge debugging)
   * @param {Object} originalData - Data that was saved
   */
  async verifyPersistence(originalData) {
    console.log('[Storage Verify] Verifying data persistence...');

    try {
      const data = await new Promise((resolve, reject) => {
        chrome.storage.local.get(['sessions', 'cookieStore', 'tabToSession'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(result);
          }
        });
      });

      const originalSessionCount = Object.keys(originalData.sessions || {}).length;
      const currentSessionCount = Object.keys(data.sessions || {}).length;

      if (currentSessionCount !== originalSessionCount) {
        console.error('[Storage Verify] ⚠️ Data mismatch detected!');
        console.error('[Storage Verify] Expected', originalSessionCount, 'sessions, found', currentSessionCount);
        console.error('[Storage Verify] This indicates Edge is clearing storage asynchronously');
      } else {
        console.log('[Storage Verify] ✓ Data persistence verified (', currentSessionCount, 'sessions)');
      }

    } catch (error) {
      console.error('[Storage Verify] ✗ Verification failed:', error);
    }
  }

  /**
   * Set value in IndexedDB
   * @param {string} storeName - Object store name
   * @param {string} key - Key
   * @param {*} value - Value
   * @returns {Promise<void>}
   */
  setIndexedDBValue(storeName, key, value) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      let request;
      if (storeName === STORAGE_CONFIG.IDB_STORE_SESSIONS) {
        // Sessions use keyPath 'id'
        request = store.put(value);
      } else if (storeName === STORAGE_CONFIG.IDB_STORE_COOKIES) {
        // Cookies use keyPath 'sessionId'
        request = store.put(value);
      } else {
        // Other stores use manual key
        request = store.put(value, key);
      }

      // CRITICAL FIX: Wait for transaction to complete (commit to disk)
      // This ensures data is persisted before browser closes
      transaction.oncomplete = () => {
        console.log(`[IndexedDB Write] ✓ Transaction committed to disk: ${storeName}/${key}`);
        resolve();
      };

      transaction.onerror = () => {
        console.error(`[IndexedDB Write] ✗ Transaction error: ${storeName}/${key}`, transaction.error);
        reject(transaction.error);
      };

      transaction.onabort = () => {
        console.error(`[IndexedDB Write] ✗ Transaction aborted: ${storeName}/${key}`, transaction.error);
        reject(transaction.error || new Error('Transaction aborted'));
      };

      request.onerror = () => {
        console.error(`[IndexedDB Write] ✗ Request error: ${storeName}/${key}`, request.error);
        // Don't reject here - let transaction.onerror handle it
      };
    });
  }

  /**
   * Get value from IndexedDB
   * @param {string} storeName - Object store name
   * @param {string} key - Key
   * @returns {Promise<*>}
   */
  getIndexedDBValue(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all values from IndexedDB store
   * @param {string} storeName - Object store name
   * @returns {Promise<Array>}
   */
  getAllIndexedDBValues(storeName) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Verify IndexedDB write by reading back the value
   * @param {string} storeName - Object store name
   * @param {string} key - Key to verify
   * @param {*} expectedValue - Expected value (optional, for deep comparison)
   * @returns {Promise<boolean>}
   */
  async verifyIndexedDBWrite(storeName, key, expectedValue = null) {
    try {
      const actualValue = await this.getIndexedDBValue(storeName, key);

      if (!actualValue) {
        console.error(`[IndexedDB Verify] ✗ FAILED: ${storeName}/${key} not found after write!`);
        return false;
      }

      // If expectedValue provided, do deep comparison
      if (expectedValue !== null) {
        const actualStr = JSON.stringify(actualValue);
        const expectedStr = JSON.stringify(expectedValue);
        if (actualStr !== expectedStr) {
          console.error(`[IndexedDB Verify] ✗ FAILED: ${storeName}/${key} value mismatch!`);
          console.error(`[IndexedDB Verify] Expected:`, expectedValue);
          console.error(`[IndexedDB Verify] Actual:`, actualValue);
          return false;
        }
      }

      console.log(`[IndexedDB Verify] ✓ Confirmed: ${storeName}/${key} persisted to disk`);
      return true;

    } catch (error) {
      console.error(`[IndexedDB Verify] ✗ Error verifying ${storeName}/${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all data (for debugging)
   * @returns {Promise<void>}
   */
  async clearAllData() {
    console.log('[Storage Persistence] Clearing all data from all layers...');

    // Clear chrome.storage.local
    await new Promise(resolve => {
      chrome.storage.local.clear(() => {
        console.log('[Storage Persistence] Cleared chrome.storage.local');
        resolve();
      });
    });

    // Clear IndexedDB
    if (this.db) {
      const stores = [
        STORAGE_CONFIG.IDB_STORE_SESSIONS,
        STORAGE_CONFIG.IDB_STORE_COOKIES,
        STORAGE_CONFIG.IDB_STORE_TABS,
        STORAGE_CONFIG.IDB_STORE_METADATA
      ];

      for (const storeName of stores) {
        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
      console.log('[Storage Persistence] Cleared IndexedDB');
    }

    console.log('[Storage Persistence] ✓ All data cleared');
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>}
   */
  async getStorageStats() {
    const stats = {
      health: this.storageHealth,
      lastHealthCheck: this.lastHealthCheck,
      sources: {}
    };

    // Check chrome.storage.local
    try {
      const localData = await new Promise(resolve => {
        chrome.storage.local.get(['sessions', 'cookieStore', 'tabToSession'], resolve);
      });
      stats.sources.local = {
        available: true,
        sessions: Object.keys(localData.sessions || {}).length,
        tabs: Object.keys(localData.tabToSession || {}).length,
        cookieSessions: Object.keys(localData.cookieStore || {}).length
      };
    } catch (error) {
      stats.sources.local = { available: false, error: error.message };
    }

    // Check IndexedDB
    try {
      if (this.db) {
        const sessions = await this.getAllIndexedDBValues(STORAGE_CONFIG.IDB_STORE_SESSIONS);
        const metadata = await this.getIndexedDBValue(STORAGE_CONFIG.IDB_STORE_METADATA, 'lastSaved');
        stats.sources.indexedDB = {
          available: true,
          sessions: sessions.length,
          lastSaved: metadata ? metadata.timestamp : null
        };
      } else {
        stats.sources.indexedDB = { available: false, error: 'Not initialized' };
      }
    } catch (error) {
      stats.sources.indexedDB = { available: false, error: error.message };
    }

    return stats;
  }
}

// Export singleton instance
const storagePersistenceManager = new StoragePersistenceManager();

// Make available globally
if (typeof window !== 'undefined') {
  window.storagePersistenceManager = storagePersistenceManager;
}
