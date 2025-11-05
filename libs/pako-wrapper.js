/**
 * Pako Wrapper - Service Worker Compatible pako.min.js Loader
 *
 * pako.min.js is a classic UMD library, not an ES6 module.
 * This wrapper loads it dynamically in service worker context
 * and exposes it as an ES6 module.
 *
 * Usage:
 *   import { getPako } from './libs/pako-wrapper.js';
 *   const pako = await getPako();
 *   const compressed = pako.deflate(data);
 *
 * @module PakoWrapper
 */

let pakoInstance = null;
let loadPromise = null;

/**
 * Load and return pako instance
 * Caches the instance for subsequent calls
 *
 * @returns {Promise<Object>} Pako library instance
 */
export async function getPako() {
  // Return cached instance if available
  if (pakoInstance) {
    console.log('[Pako Wrapper] ✓ Using cached pako instance');
    return pakoInstance;
  }

  // Return existing load promise if loading in progress
  if (loadPromise) {
    console.log('[Pako Wrapper] Load in progress, waiting...');
    return loadPromise;
  }

  // Start loading pako
  loadPromise = (async () => {
    try {
      console.log('[Pako Wrapper] Loading pako.min.js...');

      // Fetch pako.min.js as text
      const pakoUrl = chrome.runtime.getURL('libs/pako.min.js');
      console.log('[Pako Wrapper] Fetching:', pakoUrl);

      const response = await fetch(pakoUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch pako: ${response.status} ${response.statusText}`);
      }

      const pakoCode = await response.text();
      console.log('[Pako Wrapper] ✓ Pako code fetched (', pakoCode.length, 'bytes)');

      // Execute pako code in isolated scope and return pako object
      // pako.min.js creates a global `pako` variable or uses UMD pattern
      // We'll wrap it in a function to isolate it
      console.log('[Pako Wrapper] Executing pako code...');

      // Create isolated environment for pako
      const pakoGlobal = {};
      const pakoFunc = new Function('exports', 'module', pakoCode + '\n; return (typeof pako !== "undefined" ? pako : (typeof module !== "undefined" && module.exports ? module.exports : null));');

      // Execute pako code
      pakoInstance = pakoFunc(pakoGlobal, { exports: pakoGlobal });

      // Fallback: check if pako was assigned to pakoGlobal
      if (!pakoInstance && pakoGlobal.pako) {
        pakoInstance = pakoGlobal.pako;
      }

      // Fallback: check if pako exported via module.exports pattern
      if (!pakoInstance && pakoGlobal.default) {
        pakoInstance = pakoGlobal.default;
      }

      if (!pakoInstance) {
        throw new Error('Failed to initialize pako - no pako object found');
      }

      console.log('[Pako Wrapper] ✓ Pako loaded successfully');
      console.log('[Pako Wrapper] Available methods:', Object.keys(pakoInstance).join(', '));

      // Validate pako has required methods
      if (typeof pakoInstance.deflate !== 'function' || typeof pakoInstance.inflate !== 'function') {
        throw new Error('Pako loaded but missing required methods (deflate/inflate)');
      }

      console.log('[Pako Wrapper] ✓ Pako validation passed');

      loadPromise = null; // Clear promise for future loads
      return pakoInstance;

    } catch (error) {
      console.error('[Pako Wrapper] Failed to load pako:', error);
      console.error('[Pako Wrapper] Error stack:', error.stack);

      loadPromise = null; // Clear promise to allow retry
      pakoInstance = null; // Clear instance

      throw error;
    }
  })();

  return loadPromise;
}

/**
 * Test pako functionality
 * Compresses and decompresses test data to verify pako works
 *
 * @returns {Promise<boolean>} True if test passed
 */
export async function testPako() {
  try {
    console.log('[Pako Wrapper] Running pako test...');

    const pako = await getPako();

    // Test data
    const testData = 'Hello, Sessner! This is a test string for pako compression.';
    const testBytes = new TextEncoder().encode(testData);

    // Compress
    console.log('[Pako Wrapper] Test: Compressing', testBytes.length, 'bytes...');
    const compressed = pako.deflate(testBytes);
    console.log('[Pako Wrapper] Test: Compressed to', compressed.length, 'bytes');

    // Decompress
    console.log('[Pako Wrapper] Test: Decompressing...');
    const decompressed = pako.inflate(compressed);
    const decompressedText = new TextDecoder().decode(decompressed);
    console.log('[Pako Wrapper] Test: Decompressed to', decompressed.length, 'bytes');

    // Validate
    if (decompressedText !== testData) {
      throw new Error('Decompressed data does not match original');
    }

    console.log('[Pako Wrapper] ✓ Pako test passed');
    console.log('[Pako Wrapper] Compression ratio:', ((1 - compressed.length / testBytes.length) * 100).toFixed(1) + '%');

    return true;

  } catch (error) {
    console.error('[Pako Wrapper] ✗ Pako test failed:', error);
    return false;
  }
}

/**
 * Clear cached pako instance (for testing/debugging)
 */
export function clearPakoCache() {
  console.log('[Pako Wrapper] Clearing pako cache...');
  pakoInstance = null;
  loadPromise = null;
  console.log('[Pako Wrapper] ✓ Cache cleared');
}

// Default export
export default { getPako, testPako, clearPakoCache };

console.log('[Pako Wrapper] ✓ Pako wrapper loaded (ES6 module)');
