/**
 * Content Script: Storage Isolation
 *
 * This script provides transparent localStorage and sessionStorage isolation
 * using ES6 Proxy. It intercepts all storage operations and prefixes keys
 * with the session ID to maintain complete isolation between sessions.
 *
 * @file content-script-storage.js
 * @requires ES6 Proxy support
 * @injects document_start (must run before page scripts)
 */

(function() {
  'use strict';

  // Skip execution on extension pages and local HTML files
  const isExtensionProtocol = window.location.protocol === 'chrome-extension:' ||
                              window.location.protocol === 'edge-extension:';
  const isFileProtocol = window.location.protocol === 'file:';
  const isExtensionHTML = window.location.href.includes('storage-diagnostics.html') ||
                          window.location.href.includes('popup-license.html') ||
                          window.location.href.includes('license-details.html');
  const isPopup = window.location.href.includes('/popup.html');

  if ((isExtensionProtocol && !isPopup) || isFileProtocol || (isExtensionHTML && !isPopup)) {
    console.log('[Storage Isolation] Skipping execution on extension/local page');
    return;
  }

  // Prevent multiple injections
  if (window.__STORAGE_ISOLATION_INJECTED__) {
    console.warn('[Storage Isolation] Already injected, skipping');
    return;
  }
  window.__STORAGE_ISOLATION_INJECTED__ = true;

  console.log('[Storage Isolation] Initializing storage isolation...');

  /**
   * Current session ID, fetched from background script
   * @type {string|null}
   */
  let currentSessionId = null;

  /**
   * Flag indicating if session ID has been loaded
   * @type {boolean}
   */
  let sessionIdReady = false;

  /**
   * Queue of storage operations pending session ID
   * @type {Array<Function>}
   */
  const pendingOperations = [];

  /**
   * Creates a prefixed key with session ID
   * SECURITY FIX: Throws error instead of falling back to unprefixed key
   * @param {string} key - The original key
   * @returns {string} The prefixed key
   * @throws {Error} If session ID is not available
   */
  function getPrefixedKey(key) {
    if (!currentSessionId) {
      // SECURITY: Explicitly fail instead of using unprefixed key
      throw new Error('[Storage Isolation] SECURITY: Cannot access storage without session ID');
    }
    return `__SID_${currentSessionId}__${key}`;
  }

  /**
   * Removes the session prefix from a key
   * @param {string} prefixedKey - The prefixed key
   * @returns {string} The original key
   */
  function removePrefixFromKey(prefixedKey) {
    if (!currentSessionId) return prefixedKey;
    const prefix = `__SID_${currentSessionId}__`;
    if (prefixedKey.startsWith(prefix)) {
      return prefixedKey.substring(prefix.length);
    }
    return prefixedKey;
  }

  /**
   * Gets all keys belonging to the current session
   * @param {Storage} storage - The storage object (localStorage or sessionStorage)
   * @returns {Array<string>} Array of unprefixed keys
   */
  function getSessionKeys(storage) {
    if (!currentSessionId) return [];
    const prefix = `__SID_${currentSessionId}__`;
    const keys = [];

    try {
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(prefix)) {
          keys.push(removePrefixFromKey(key));
        }
      }
    } catch (error) {
      console.error('[Storage Isolation] Error getting session keys:', error);
    }

    return keys;
  }

  /**
   * Creates a Proxy wrapper for Storage objects
   * @param {Storage} storage - The original storage object (localStorage or sessionStorage)
   * @param {string} storageName - Name for logging ('localStorage' or 'sessionStorage')
   * @returns {Proxy} Proxied storage object
   */
  function createStorageProxy(storage, storageName) {
    // Store reference to original storage
    const originalStorage = storage;

    // Create a proxy handler
    const handler = {
      /**
       * Intercepts property gets
       */
      get(target, prop, receiver) {
        // Handle length property
        if (prop === 'length') {
          if (!sessionIdReady) return 0;
          return getSessionKeys(originalStorage).length;
        }

        // Handle key() method
        if (prop === 'key') {
          return function(index) {
            if (!sessionIdReady) return null;
            const keys = getSessionKeys(originalStorage);
            return keys[index] || null;
          };
        }

        // Handle getItem() method
        if (prop === 'getItem') {
          return function(key) {
            if (!sessionIdReady) {
              console.warn(`[Storage Isolation] ${storageName}.getItem called before session ready`);
              return null;
            }
            try {
              const prefixedKey = getPrefixedKey(key);
              const value = originalStorage.getItem(prefixedKey);
              console.log(`[Storage Isolation] ${storageName}.getItem('${key}') => '${value}'`);
              return value;
            } catch (error) {
              console.error(`[Storage Isolation] Error in ${storageName}.getItem:`, error);
              return null;
            }
          };
        }

        // Handle setItem() method
        if (prop === 'setItem') {
          return function(key, value) {
            if (!sessionIdReady) {
              console.warn(`[Storage Isolation] ${storageName}.setItem called before session ready, queueing`);
              pendingOperations.push(() => {
                const prefixedKey = getPrefixedKey(key);
                originalStorage.setItem(prefixedKey, value);
              });
              return;
            }
            try {
              const prefixedKey = getPrefixedKey(key);
              originalStorage.setItem(prefixedKey, value);
              console.log(`[Storage Isolation] ${storageName}.setItem('${key}', '${value}')`);
            } catch (error) {
              console.error(`[Storage Isolation] Error in ${storageName}.setItem:`, error);
              throw error; // Re-throw to maintain API compatibility
            }
          };
        }

        // Handle removeItem() method
        if (prop === 'removeItem') {
          return function(key) {
            if (!sessionIdReady) {
              console.warn(`[Storage Isolation] ${storageName}.removeItem called before session ready`);
              return;
            }
            try {
              const prefixedKey = getPrefixedKey(key);
              originalStorage.removeItem(prefixedKey);
              console.log(`[Storage Isolation] ${storageName}.removeItem('${key}')`);
            } catch (error) {
              console.error(`[Storage Isolation] Error in ${storageName}.removeItem:`, error);
            }
          };
        }

        // Handle clear() method
        if (prop === 'clear') {
          return function() {
            if (!sessionIdReady) {
              console.warn(`[Storage Isolation] ${storageName}.clear called before session ready`);
              return;
            }
            try {
              const keys = getSessionKeys(originalStorage);
              keys.forEach(key => {
                const prefixedKey = getPrefixedKey(key);
                originalStorage.removeItem(prefixedKey);
              });
              console.log(`[Storage Isolation] ${storageName}.clear() - removed ${keys.length} items`);
            } catch (error) {
              console.error(`[Storage Isolation] Error in ${storageName}.clear:`, error);
            }
          };
        }

        // Handle direct property access (e.g., localStorage.foo)
        if (typeof prop === 'string' && !prop.startsWith('__')) {
          if (!sessionIdReady) {
            console.warn(`[Storage Isolation] ${storageName}.${prop} accessed before session ready`);
            return undefined;
          }
          try {
            const prefixedKey = getPrefixedKey(prop);
            const value = originalStorage.getItem(prefixedKey);
            console.log(`[Storage Isolation] ${storageName}.${prop} (get) => '${value}'`);
            return value;
          } catch (error) {
            console.error(`[Storage Isolation] Error getting ${storageName}.${prop}:`, error);
            return undefined;
          }
        }

        // Handle Symbol.toStringTag for proper type identification
        if (prop === Symbol.toStringTag) {
          return 'Storage';
        }

        // Handle other properties (like toString, valueOf, etc.)
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },

      /**
       * Intercepts property sets
       */
      set(target, prop, value, receiver) {
        // Handle direct property assignment (e.g., localStorage.foo = 'bar')
        if (typeof prop === 'string' && !prop.startsWith('__')) {
          if (!sessionIdReady) {
            console.warn(`[Storage Isolation] ${storageName}.${prop} = '${value}' called before session ready, queueing`);
            pendingOperations.push(() => {
              const prefixedKey = getPrefixedKey(prop);
              originalStorage.setItem(prefixedKey, String(value));
            });
            return true;
          }
          try {
            const prefixedKey = getPrefixedKey(prop);
            originalStorage.setItem(prefixedKey, String(value));
            console.log(`[Storage Isolation] ${storageName}.${prop} = '${value}'`);
            return true;
          } catch (error) {
            console.error(`[Storage Isolation] Error setting ${storageName}.${prop}:`, error);
            return false;
          }
        }

        // Handle other property sets
        return Reflect.set(target, prop, value, receiver);
      },

      /**
       * Intercepts property deletion
       */
      deleteProperty(target, prop) {
        // Handle delete operation (e.g., delete localStorage.foo)
        if (typeof prop === 'string' && !prop.startsWith('__')) {
          if (!sessionIdReady) {
            console.warn(`[Storage Isolation] delete ${storageName}.${prop} called before session ready`);
            return true;
          }
          try {
            const prefixedKey = getPrefixedKey(prop);
            originalStorage.removeItem(prefixedKey);
            console.log(`[Storage Isolation] delete ${storageName}.${prop}`);
            return true;
          } catch (error) {
            console.error(`[Storage Isolation] Error deleting ${storageName}.${prop}:`, error);
            return false;
          }
        }

        return Reflect.deleteProperty(target, prop);
      },

      /**
       * Intercepts 'in' operator
       */
      has(target, prop) {
        if (typeof prop === 'string' && !prop.startsWith('__')) {
          if (!sessionIdReady) return false;
          try {
            const prefixedKey = getPrefixedKey(prop);
            return originalStorage.getItem(prefixedKey) !== null;
          } catch (error) {
            console.error(`[Storage Isolation] Error checking ${storageName} has ${prop}:`, error);
            return false;
          }
        }
        return Reflect.has(target, prop);
      },

      /**
       * Intercepts Object.keys(), Object.getOwnPropertyNames()
       */
      ownKeys(target) {
        if (!sessionIdReady) return [];
        try {
          return getSessionKeys(originalStorage);
        } catch (error) {
          console.error(`[Storage Isolation] Error getting ${storageName} keys:`, error);
          return [];
        }
      },

      /**
       * Intercepts Object.getOwnPropertyDescriptor()
       */
      getOwnPropertyDescriptor(target, prop) {
        if (typeof prop === 'string' && !prop.startsWith('__')) {
          if (!sessionIdReady) return undefined;
          try {
            const prefixedKey = getPrefixedKey(prop);
            const value = originalStorage.getItem(prefixedKey);
            if (value !== null) {
              return {
                value: value,
                writable: true,
                enumerable: true,
                configurable: true
              };
            }
          } catch (error) {
            console.error(`[Storage Isolation] Error getting descriptor for ${storageName}.${prop}:`, error);
          }
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
    };

    // Create and return the proxy
    return new Proxy(originalStorage, handler);
  }

  /**
   * Executes pending storage operations after session ID is loaded
   */
  function executePendingOperations() {
    console.log(`[Storage Isolation] Executing ${pendingOperations.length} pending operations`);
    while (pendingOperations.length > 0) {
      const operation = pendingOperations.shift();
      try {
        operation();
      } catch (error) {
        console.error('[Storage Isolation] Error executing pending operation:', error);
      }
    }
  }

  /**
   * Fetches the current session ID from the background script with retry logic
   * SECURITY FIX: Removed 'default' fallback - fail explicitly instead
   * @returns {Promise<boolean>}
   */
  async function fetchSessionId() {
    let attempts = 0;
    const maxAttempts = 5;
    const delays = [100, 500, 1000, 2000, 3000]; // Increasing delays in milliseconds

    while (attempts < maxAttempts) {
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'getSessionId' }, (response) => {
            resolve(response);
          });
        });

        if (response && response.success && response.sessionId) {
          currentSessionId = response.sessionId;
          sessionIdReady = true;
          console.log('%c[Storage Isolation] ✓ Session ready:', 'color: green; font-weight: bold', currentSessionId);

          // Visual indicator disabled to prevent interference with website functionality
          // (some websites read all DOM elements, causing the indicator to appear in error dialogs)

          // Process queued operations
          executePendingOperations();
          return true;
        }
      } catch (error) {
        // Silent retry
      }

      attempts++;
      if (attempts < maxAttempts) {
        const delay = delays[attempts - 1];
        console.debug(`[Storage Isolation] Retry ${attempts}/${maxAttempts} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // SECURITY FIX: Do NOT use fallback - fail explicitly
    // Storage operations should not work in non-session tabs to prevent data leakage
    console.error('%c[Storage Isolation] ✗ FAILED to get session ID', 'color: red; font-weight: bold');
    console.error('[Storage Isolation] Storage operations will be BLOCKED for security');
    currentSessionId = null;
    sessionIdReady = true; // Mark as ready to unblock code flow
    // DO NOT execute pending operations - let them fail
    return false;
  }

  // Visual indicator function removed to prevent interference with website functionality
  // Console logging (line 377) is sufficient for debugging session initialization

  /**
   * Installs the storage proxies
   */
  function installStorageProxies() {
    try {
      // Store original storage objects
      const originalLocalStorage = window.localStorage;
      const originalSessionStorage = window.sessionStorage;

      // Create proxied versions
      const proxiedLocalStorage = createStorageProxy(originalLocalStorage, 'localStorage');
      const proxiedSessionStorage = createStorageProxy(originalSessionStorage, 'sessionStorage');

      // Replace window.localStorage and window.sessionStorage
      Object.defineProperty(window, 'localStorage', {
        get() {
          return proxiedLocalStorage;
        },
        set() {
          console.warn('[Storage Isolation] Attempt to override localStorage blocked');
        },
        configurable: false
      });

      Object.defineProperty(window, 'sessionStorage', {
        get() {
          return proxiedSessionStorage;
        },
        set() {
          console.warn('[Storage Isolation] Attempt to override sessionStorage blocked');
        },
        configurable: false
      });

      console.log('[Storage Isolation] Storage proxies installed successfully');
    } catch (error) {
      console.error('[Storage Isolation] Failed to install storage proxies:', error);
    }
  }

  // Initialize: Install proxies and fetch session ID
  installStorageProxies();
  fetchSessionId();

  console.log('[Storage Isolation] Initialization complete');
})();
