/**
 * Storage Diagnostics - JavaScript
 * Provides diagnostic interface for storage persistence layer
 */

let lastStats = null;
let chromeRuntimeAvailable = false;

/**
 * Check if Chrome Extension APIs are available
 * @returns {boolean} True if chrome.runtime is available
 */
function checkChromeRuntime() {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    return false;
  }
  return true;
}

/**
 * Show error banner if chrome.runtime is not available
 */
function showRuntimeError() {
  const container = document.querySelector('.container');
  const errorBanner = document.createElement('div');
  errorBanner.className = 'card error';
  errorBanner.style.marginBottom = '20px';
  errorBanner.innerHTML = `
    <h2 style="color: #f44336; border-bottom-color: #f44336;">⚠️ Extension Context Required</h2>
    <p style="margin-bottom: 12px;">
      <strong>This page must be opened from the extension context, not as a file:// URL.</strong>
    </p>
    <p style="margin-bottom: 12px;">
      <strong>How to access this page correctly:</strong>
    </p>
    <ol style="margin-left: 20px; margin-bottom: 12px; line-height: 1.8;">
      <li>Open your extension popup (click the extension icon in Chrome toolbar)</li>
      <li>Click the "Storage Diagnostics" link or button</li>
      <li>The page will open in the correct extension context</li>
    </ol>
    <p style="margin-bottom: 12px;">
      <strong>Alternative method:</strong>
    </p>
    <ol style="margin-left: 20px; line-height: 1.8;">
      <li>Go to <code>chrome://extensions/</code></li>
      <li>Find "Sessner – Multi-Session Manager"</li>
      <li>Click "Details"</li>
      <li>Find the Extension ID (e.g., "abcdefghijklmnop...")</li>
      <li>Open: <code>chrome-extension://[YOUR-EXTENSION-ID]/html/storage-diagnostics.html</code></li>
    </ol>
    <p style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #f44336; color: #666;">
      <strong>Current URL:</strong> ${window.location.href}
      <br>
      <strong>Protocol:</strong> ${window.location.protocol}
    </p>
  `;
  container.insertBefore(errorBanner, container.firstChild);

  // Disable all buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.disabled = true;
    button.style.cursor = 'not-allowed';
    button.style.opacity = '0.5';
  });

  // Update stats to show error state
  document.getElementById('currentSessions').textContent = 'N/A';
  document.getElementById('currentTabs').textContent = 'N/A';
  document.getElementById('currentCookies').textContent = 'N/A';
  document.getElementById('statsTimestamp').textContent = 'Extension context required';
  document.getElementById('storageLayers').innerHTML = '<div class="error">Chrome Extension APIs not available</div>';
}

/**
 * Safe wrapper for chrome.runtime.sendMessage with error handling
 * @param {Object} message - Message to send
 * @returns {Promise} Response from background script
 */
async function safeSendMessage(message) {
  if (!chromeRuntimeAvailable) {
    throw new Error('Chrome Extension APIs not available. Please open this page from the extension context.');
  }

  // MV2 requires callback pattern, not Promise
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      // Check for runtime errors first (MUST be inside callback)
      if (chrome.runtime.lastError) {
        const error = chrome.runtime.lastError.message;

        // Handle runtime errors (extension reload, etc.)
        if (error.includes('Extension context invalidated')) {
          showMessage('Extension was reloaded. Please refresh this page.', 'error');
          chromeRuntimeAvailable = false;
          reject(new Error('Extension context invalidated. Please refresh this page.'));
        } else {
          reject(new Error(error));
        }
        return;
      }

      // Resolve with the actual response
      resolve(response);
    });
  });
}

async function refreshStats() {
  try {
    const response = await safeSendMessage({ action: 'getStorageStats' });

    if (response && response.success) {
      lastStats = response.stats;

      // Update current state (with safe fallbacks)
      document.getElementById('currentSessions').textContent = response.stats?.currentState?.sessions ?? 0;
      document.getElementById('currentTabs').textContent = response.stats?.currentState?.tabs ?? 0;
      document.getElementById('currentCookies').textContent = response.stats?.currentState?.cookieSessions ?? 0;
      document.getElementById('currentOrphans').textContent = response.stats?.currentState?.orphans ?? 0;
      document.getElementById('statsTimestamp').textContent =
        'Last updated: ' + new Date(response.stats?.timestamp || Date.now()).toLocaleString();

      // Update storage layers (with validation)
      if (response.stats && response.stats.persistence) {
        updateStorageLayers(response.stats.persistence);
      } else {
        document.getElementById('storageLayers').innerHTML =
          '<div class="warning">Storage persistence manager not initialized</div>';
      }

      showMessage('Stats refreshed successfully', 'success');
    } else {
      showMessage('Failed to get stats: ' + (response?.error || 'Unknown error'), 'error');
    }
  } catch (error) {
    showMessage('Error: ' + error.message, 'error');
  }
}

function updateStorageLayers(persistence) {
  // Validate persistence object structure
  if (!persistence || !persistence.health || !persistence.sources) {
    console.error('[updateStorageLayers] Invalid persistence object:', persistence);
    document.getElementById('storageLayers').innerHTML =
      '<div class="warning">Storage persistence data not available</div>';
    return;
  }

  const health = persistence.health;
  const sources = persistence.sources;
  let html = '';

  // chrome.storage.local
  html += `
    <div class="storage-layer">
      <div class="storage-layer-header">
        <div class="storage-layer-name">
          <span class="status-indicator ${health.local ? 'status-healthy' : 'status-unhealthy'}"></span>
          chrome.storage.local
        </div>
      </div>
      <div class="storage-layer-details">
        ${sources.local && sources.local.available ? `
          <div>Sessions: ${sources.local.sessions}</div>
          <div>Tabs: ${sources.local.tabs}</div>
          <div>Cookie Sessions: ${sources.local.cookieSessions}</div>
        ` : `<div>Error: ${sources.local ? sources.local.error : 'Data not available'}</div>`}
      </div>
    </div>
  `;

  // IndexedDB
  html += `
    <div class="storage-layer">
      <div class="storage-layer-header">
        <div class="storage-layer-name">
          <span class="status-indicator ${health.indexedDB ? 'status-healthy' : 'status-unhealthy'}"></span>
          IndexedDB
        </div>
      </div>
      <div class="storage-layer-details">
        ${sources.indexedDB && sources.indexedDB.available ? `
          <div>Sessions: ${sources.indexedDB.sessions}</div>
          <div>Last Saved: ${sources.indexedDB.lastSaved ? new Date(sources.indexedDB.lastSaved).toLocaleString() : 'Never'}</div>
        ` : `<div>Error: ${sources.indexedDB ? sources.indexedDB.error : 'Data not available'}</div>`}
      </div>
    </div>
  `;

  // Last health check
  html += `
    <div class="timestamp">
      Last health check: ${persistence.lastHealthCheck ? new Date(persistence.lastHealthCheck).toLocaleString() : 'Never'}
    </div>
  `;

  document.getElementById('storageLayers').innerHTML = html;
}

async function testPersistence() {
  try {
    showMessage('=== PERSISTENCE TEST: CREATE + DELETE ===', 'warning');

    // 1. Get initial state
    const before = await safeSendMessage({ action: 'getStorageStats' });
    if (!before.success) {
      showMessage('❌ Failed to get initial stats: ' + before.error, 'error');
      return;
    }
    const initialCount = before.stats.currentState.sessions;
    const initialIDB = before.stats.persistence?.sources?.indexedDB?.sessions || 0;

    console.log('[Test Persistence] Initial state:', {
      memory: initialCount,
      indexedDB: initialIDB
    });

    // 2. Create a test session
    showMessage('STEP 1: Creating test session...', 'warning');
    const createResponse = await safeSendMessage({
      action: 'createNewSession',
      url: 'about:blank'
    });

    if (!createResponse.success) {
      showMessage('❌ Failed to create test session: ' + (createResponse.error || 'Unknown error'), 'error');
      return;
    }

    const testTabId = createResponse.data.tabId;
    const testSessionId = createResponse.data.sessionId;

    console.log('[Test Persistence] Created session:', testSessionId, 'tab:', testTabId);
    showMessage('✓ Test session created (ID: ' + testSessionId.substring(0, 20) + '...)', 'success');

    // 3. Wait for debounced persistence (2 seconds to be safe)
    showMessage('STEP 2: Waiting for persistence to IndexedDB (2 seconds)...', 'warning');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Verify creation in all storage layers
    const afterCreate = await safeSendMessage({ action: 'getStorageStats' });
    if (!afterCreate.success) {
      showMessage('❌ Failed to get post-creation stats: ' + afterCreate.error, 'error');
      // Clean up test tab
      if (testTabId) {
        chrome.tabs.remove(testTabId, () => {
          if (chrome.runtime.lastError) {
            console.error('Failed to close test tab:', chrome.runtime.lastError);
          }
        });
      }
      return;
    }

    const memoryAfterCreate = afterCreate.stats.currentState.sessions;
    const localAfterCreate = afterCreate.stats.persistence?.sources?.local?.sessions || 0;
    const idbAfterCreate = afterCreate.stats.persistence?.sources?.indexedDB?.sessions || 0;

    console.log('[Test Persistence] After creation:', {
      memory: memoryAfterCreate,
      local: localAfterCreate,
      indexedDB: idbAfterCreate
    });

    // Verify creation
    let createMessage = 'STEP 2 RESULTS (Creation):\n\n';
    createMessage += 'Memory: ' + memoryAfterCreate + ' (expected: ' + (initialCount + 1) + ')\n';
    createMessage += 'chrome.storage.local: ' + localAfterCreate + '\n';
    createMessage += 'IndexedDB: ' + idbAfterCreate + '\n\n';

    if (memoryAfterCreate !== initialCount + 1) {
      showMessage(createMessage + '❌ Session not found in memory!', 'error');
      // Clean up and abort
      if (testTabId) chrome.tabs.remove(testTabId);
      return;
    }

    if (localAfterCreate === memoryAfterCreate && idbAfterCreate === memoryAfterCreate) {
      showMessage(createMessage + '✅ Creation persisted to all layers!', 'success');
    } else {
      showMessage(createMessage + '⚠️ Creation NOT synchronized across all layers!', 'error');
    }

    // 5. Now test DELETION
    showMessage('STEP 3: Closing test session tab to test deletion...', 'warning');

    // Close the tab and wait for cleanup + persistence
    if (testTabId && chrome.tabs && chrome.tabs.remove) {
      chrome.tabs.remove(testTabId, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to close test tab:', chrome.runtime.lastError);
        } else {
          console.log('[Test Persistence] Tab closed, session should be deleted');
        }
      });
    }

    // Wait for tab close + session cleanup + debounced persistence
    showMessage('Waiting for session deletion and persistence (2 seconds)...', 'warning');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 6. Verify deletion from all storage layers
    const afterDelete = await safeSendMessage({ action: 'getStorageStats' });
    if (!afterDelete.success) {
      showMessage('❌ Failed to get post-deletion stats: ' + afterDelete.error, 'error');
      return;
    }

    const memoryAfterDelete = afterDelete.stats.currentState.sessions;
    const localAfterDelete = afterDelete.stats.persistence?.sources?.local?.sessions || 0;
    const idbAfterDelete = afterDelete.stats.persistence?.sources?.indexedDB?.sessions || 0;

    console.log('[Test Persistence] After deletion:', {
      memory: memoryAfterDelete,
      local: localAfterDelete,
      indexedDB: idbAfterDelete
    });

    // Verify deletion
    let deleteMessage = 'STEP 3 RESULTS (Deletion):\n\n';
    deleteMessage += 'Memory: ' + memoryAfterDelete + ' (expected: ' + initialCount + ')\n';
    deleteMessage += 'chrome.storage.local: ' + localAfterDelete + '\n';
    deleteMessage += 'IndexedDB: ' + idbAfterDelete + '\n\n';

    if (memoryAfterDelete !== initialCount) {
      showMessage(deleteMessage + '⚠️ Session still in memory! Expected ' + initialCount + ', found ' + memoryAfterDelete, 'error');
    } else if (localAfterDelete === memoryAfterDelete && idbAfterDelete === memoryAfterDelete) {
      showMessage(deleteMessage + '✅ Deletion synced to all layers! Test PASSED.', 'success');
    } else {
      showMessage(deleteMessage + '❌ Deletion NOT synchronized!\n\n' +
                  'Memory has ' + memoryAfterDelete + ' but storage has ' + localAfterDelete + ' (local) and ' + idbAfterDelete + ' (IndexedDB)\n\n' +
                  'ORPHAN DETECTED: Session deleted from memory but still in IndexedDB!', 'error');
    }

    // 7. Final stats refresh
    await new Promise(resolve => setTimeout(resolve, 500));
    await refreshStats();

    showMessage('=== TEST COMPLETE ===', 'success');

  } catch (error) {
    console.error('[Test Persistence] Error:', error);
    showMessage('❌ Test failed with error: ' + error.message, 'error');
  }
}

async function detectAndCleanOrphans() {
  try {
    showMessage('=== ORPHAN DETECTION & CLEANUP ===', 'warning');

    // 1. Detect orphans
    showMessage('STEP 1: Detecting orphan sessions in IndexedDB...', 'warning');
    const detectResponse = await safeSendMessage({ action: 'getOrphanCount' });

    if (!detectResponse.success) {
      showMessage('❌ Failed to detect orphans: ' + detectResponse.error, 'error');
      return;
    }

    const orphanCount = detectResponse.orphanCount;
    console.log('[Detect Orphans] Found ' + orphanCount + ' orphan sessions');

    if (orphanCount === 0) {
      showMessage('✅ No orphan sessions found! IndexedDB is clean.', 'success');
      await refreshStats();
      return;
    }

    // 2. Show orphan count
    showMessage('⚠️ Found ' + orphanCount + ' orphan session(s) in IndexedDB!\n\n' +
                'These sessions exist in IndexedDB but not in memory.\n' +
                'They should have been deleted but weren\'t.', 'warning');

    // 3. Confirm cleanup
    if (!confirm('Found ' + orphanCount + ' orphan session(s) in IndexedDB.\n\n' +
                 'Do you want to clean them up now?\n\n' +
                 'This will permanently delete these orphaned sessions from IndexedDB.')) {
      showMessage('Cleanup cancelled by user', 'warning');
      return;
    }

    // 4. Clean up orphans
    showMessage('STEP 2: Cleaning up ' + orphanCount + ' orphan session(s)...', 'warning');
    const cleanupResponse = await safeSendMessage({ action: 'cleanupOrphans' });

    if (!cleanupResponse.success) {
      showMessage('❌ Failed to clean up orphans: ' + cleanupResponse.error, 'error');
      return;
    }

    // 5. Show results
    const deletedCount = cleanupResponse.deletedCount || 0;
    const remainingCount = cleanupResponse.remainingOrphans || 0;

    console.log('[Cleanup Orphans] Results:', {
      deleted: deletedCount,
      remaining: remainingCount
    });

    let resultMessage = 'CLEANUP RESULTS:\n\n';
    resultMessage += 'Orphans found: ' + orphanCount + '\n';
    resultMessage += 'Orphans deleted: ' + deletedCount + '\n';
    resultMessage += 'Remaining orphans: ' + remainingCount + '\n\n';

    if (remainingCount === 0) {
      showMessage(resultMessage + '✅ All orphans cleaned up successfully!', 'success');
    } else {
      showMessage(resultMessage + '⚠️ Some orphans remain. Try refreshing and running cleanup again.', 'warning');
    }

    // 6. Refresh stats
    await new Promise(resolve => setTimeout(resolve, 500));
    await refreshStats();

  } catch (error) {
    console.error('[Detect & Clean Orphans] Error:', error);
    showMessage('❌ Orphan cleanup failed: ' + error.message, 'error');
  }
}

async function testImmediateDeletion() {
  try {
    showMessage('=== IMMEDIATE DELETION TEST ===', 'warning');

    // 1. Get initial state
    const before = await safeSendMessage({ action: 'getStorageStats' });
    if (!before.success) {
      showMessage('❌ Failed to get initial stats: ' + before.error, 'error');
      return;
    }
    const initialCount = before.stats.currentState.sessions;
    const initialIDB = before.stats.persistence?.sources?.indexedDB?.sessions || 0;

    console.log('[Test Immediate Deletion] Initial state:', {
      memory: initialCount,
      indexedDB: initialIDB
    });

    // 2. Create a test session
    showMessage('STEP 1: Creating test session...', 'warning');
    const createResponse = await safeSendMessage({
      action: 'createNewSession',
      url: 'about:blank'
    });

    if (!createResponse.success) {
      showMessage('❌ Failed to create test session: ' + (createResponse.error || 'Unknown error'), 'error');
      return;
    }

    const testTabId = createResponse.data.tabId;
    const testSessionId = createResponse.data.sessionId;

    console.log('[Test Immediate Deletion] Created session:', testSessionId, 'tab:', testTabId);
    showMessage('✓ Test session created (ID: ' + testSessionId.substring(0, 20) + '...)', 'success');

    // 3. Wait for debounced persistence (2 seconds to be safe)
    showMessage('STEP 2: Waiting for persistence to IndexedDB (2 seconds)...', 'warning');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Verify creation in IndexedDB
    const afterCreate = await safeSendMessage({ action: 'getStorageStats' });
    if (!afterCreate.success) {
      showMessage('❌ Failed to get post-creation stats: ' + afterCreate.error, 'error');
      // Clean up test tab
      if (testTabId) chrome.tabs.remove(testTabId);
      return;
    }

    const idbAfterCreate = afterCreate.stats.persistence?.sources?.indexedDB?.sessions || 0;
    console.log('[Test Immediate Deletion] After creation - IndexedDB:', idbAfterCreate);

    if (idbAfterCreate !== initialIDB + 1) {
      showMessage('⚠️ Session not persisted to IndexedDB! Expected ' + (initialIDB + 1) + ', found ' + idbAfterCreate, 'error');
      // Clean up and abort
      if (testTabId) chrome.tabs.remove(testTabId);
      return;
    }

    showMessage('✓ Session persisted to IndexedDB (' + idbAfterCreate + ' sessions)', 'success');

    // 5. Close tab IMMEDIATELY (before debounced delete can trigger)
    showMessage('STEP 3: Closing tab to trigger IMMEDIATE deletion...', 'warning');

    if (testTabId && chrome.tabs && chrome.tabs.remove) {
      chrome.tabs.remove(testTabId, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to close test tab:', chrome.runtime.lastError);
        } else {
          console.log('[Test Immediate Deletion] Tab closed, session should be deleted');
        }
      });
    }

    // 6. Wait ONLY 100ms (immediate deletion should happen in < 100ms)
    showMessage('Waiting 100ms for immediate deletion...', 'warning');
    await new Promise(resolve => setTimeout(resolve, 100));

    // 7. Check if deleted from IndexedDB immediately
    const afterDelete100ms = await safeSendMessage({ action: 'getStorageStats' });
    if (!afterDelete100ms.success) {
      showMessage('❌ Failed to get stats after 100ms: ' + afterDelete100ms.error, 'error');
      return;
    }

    const idbAfter100ms = afterDelete100ms.stats.persistence?.sources?.indexedDB?.sessions || 0;
    console.log('[Test Immediate Deletion] After 100ms - IndexedDB:', idbAfter100ms);

    let result100ms = 'IMMEDIATE DELETION TEST (100ms):\n\n';
    result100ms += 'Initial IndexedDB: ' + initialIDB + '\n';
    result100ms += 'After creation: ' + idbAfterCreate + '\n';
    result100ms += 'After 100ms: ' + idbAfter100ms + '\n\n';

    if (idbAfter100ms === initialIDB) {
      showMessage(result100ms + '✅ IMMEDIATE deletion worked! Session deleted in < 100ms.', 'success');
    } else {
      showMessage(result100ms + '❌ IMMEDIATE deletion FAILED!\n\n' +
                  'Session still in IndexedDB after 100ms.\n' +
                  'Expected: ' + initialIDB + ', Found: ' + idbAfter100ms, 'error');
    }

    // 8. Wait another 1.9 seconds (total 2 seconds for debounced delete)
    showMessage('Waiting another 1.9 seconds (total 2s) to verify...', 'warning');
    await new Promise(resolve => setTimeout(resolve, 1900));

    // 9. Final verification
    const afterDelete2s = await safeSendMessage({ action: 'getStorageStats' });
    if (!afterDelete2s.success) {
      showMessage('❌ Failed to get stats after 2s: ' + afterDelete2s.error, 'error');
      return;
    }

    const idbAfter2s = afterDelete2s.stats.persistence?.sources?.indexedDB?.sessions || 0;
    console.log('[Test Immediate Deletion] After 2s - IndexedDB:', idbAfter2s);

    let result2s = 'VERIFICATION (2 seconds total):\n\n';
    result2s += 'IndexedDB after 2s: ' + idbAfter2s + '\n\n';

    if (idbAfter2s === initialIDB) {
      showMessage(result2s + '✅ Session confirmed deleted from IndexedDB.', 'success');
    } else {
      showMessage(result2s + '❌ Session STILL in IndexedDB after 2s!\n\n' +
                  'ORPHAN DETECTED: Session should have been deleted.', 'error');
    }

    // 10. Refresh stats
    await new Promise(resolve => setTimeout(resolve, 500));
    await refreshStats();

    showMessage('=== TEST COMPLETE ===', 'success');

  } catch (error) {
    console.error('[Test Immediate Deletion] Error:', error);
    showMessage('❌ Test failed with error: ' + error.message, 'error');
  }
}

async function viewRawData() {
  if (lastStats) {
    document.getElementById('rawData').textContent = JSON.stringify(lastStats, null, 2);
    showMessage('Raw data displayed below', 'success');
  } else {
    showMessage('No stats available, click Refresh Stats first', 'warning');
  }
}

async function clearAllStorage() {
  if (!confirm('⚠️ WARNING: This will DELETE ALL sessions, cookies, and storage data!\n\nThis action cannot be undone.\n\nAre you absolutely sure?')) {
    return;
  }

  try {
    showMessage('=== CLEARING ALL STORAGE ===', 'warning');

    // 1. Get all session IDs BEFORE clearing
    showMessage('STEP 1: Getting list of all sessions...', 'warning');
    const statsResponse = await safeSendMessage({ action: 'getStorageStats' });

    if (!statsResponse.success) {
      showMessage('⚠️ Could not get session list: ' + statsResponse.error, 'warning');
    }

    const allSessions = statsResponse.stats?.currentState?.sessionList || [];
    const sessionCount = allSessions.length;

    console.log('[Clear All Storage] Found', sessionCount, 'sessions to delete:', allSessions);
    showMessage('Found ' + sessionCount + ' session(s) to delete', 'warning');

    // 2. Delete each session individually (proper cleanup via deleteSession())
    if (sessionCount > 0) {
      showMessage('STEP 2: Deleting sessions individually from all layers...', 'warning');

      let deletedCount = 0;
      let failedCount = 0;

      for (const sessionId of allSessions) {
        try {
          console.log('[Clear All Storage] Deleting session:', sessionId);
          const deleteResponse = await safeSendMessage({
            action: 'deleteSessionById',
            sessionId: sessionId
          });

          if (deleteResponse.success) {
            deletedCount++;
            showMessage('✓ Deleted session ' + (deletedCount) + '/' + sessionCount + ': ' + sessionId.substring(0, 20) + '...', 'success');
          } else {
            failedCount++;
            console.error('[Clear All Storage] Failed to delete session:', sessionId, deleteResponse.error);
            showMessage('✗ Failed to delete session: ' + sessionId.substring(0, 20) + '...', 'error');
          }
        } catch (error) {
          failedCount++;
          console.error('[Clear All Storage] Error deleting session:', sessionId, error);
          showMessage('✗ Error deleting session: ' + error.message, 'error');
        }
      }

      showMessage('Session deletion complete: ' + deletedCount + ' deleted, ' + failedCount + ' failed',
                  failedCount === 0 ? 'success' : 'warning');
    }

    // 3. Clear in-memory state via background script (cleanup any remaining state)
    showMessage('STEP 3: Clearing remaining in-memory state...', 'warning');
    const clearMemoryResponse = await safeSendMessage({ action: 'clearAllSessions' });

    if (clearMemoryResponse.success) {
      showMessage('✓ In-memory state cleared (' + clearMemoryResponse.tabsClosed + ' tabs closed)', 'success');
    } else {
      showMessage('⚠️ Failed to clear in-memory state: ' + clearMemoryResponse.error, 'warning');
    }

    // 4. Clear chrome.storage.local (backup cleanup)
    showMessage('STEP 4: Clearing chrome.storage.local...', 'warning');
    try {
      await new Promise((resolve, reject) => {
        if (!chrome.storage || !chrome.storage.local) {
          reject(new Error('chrome.storage.local not available'));
          return;
        }
        chrome.storage.local.clear(() => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
      showMessage('✓ chrome.storage.local cleared', 'success');
    } catch (e) {
      console.error('Failed to clear chrome.storage.local:', e);
      showMessage('⚠️ Failed to clear chrome.storage.local: ' + e.message, 'warning');
    }

    // 5. Force close IndexedDB database before deletion
    showMessage('STEP 5: Closing IndexedDB connections...', 'warning');
    try {
      // Send message to background to close its database connection
      const closeDBResponse = await safeSendMessage({ action: 'closeIndexedDB' });
      if (closeDBResponse.success) {
        showMessage('✓ IndexedDB connections closed', 'success');
      } else {
        showMessage('⚠️ Could not close IndexedDB connections: ' + closeDBResponse.error, 'warning');
      }
    } catch (e) {
      console.warn('Failed to close IndexedDB connections:', e);
      showMessage('⚠️ Could not close IndexedDB connections', 'warning');
    }

    // 6. Clear IndexedDB (now that connections are closed)
    showMessage('STEP 6: Deleting IndexedDB database...', 'warning');
    try {
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase('SessnerStorage');

        request.onsuccess = () => {
          console.log('[Clear All Storage] IndexedDB deleted successfully');
          resolve();
        };

        request.onerror = () => {
          console.error('[Clear All Storage] IndexedDB deletion error:', request.error);
          reject(request.error);
        };

        request.onblocked = () => {
          console.warn('[Clear All Storage] IndexedDB deletion blocked (other connections still open)');
          // Don't resolve immediately - wait for unblock
          showMessage('⚠️ IndexedDB deletion blocked. Waiting for connections to close...', 'warning');

          // Set a timeout to force resolve after 5 seconds
          setTimeout(() => {
            console.warn('[Clear All Storage] IndexedDB deletion still blocked after 5s, continuing anyway');
            resolve();
          }, 5000);
        };
      });
      showMessage('✓ IndexedDB database deleted', 'success');
    } catch (e) {
      console.error('Failed to delete IndexedDB:', e);
      showMessage('⚠️ IndexedDB deletion failed: ' + e.message, 'warning');
    }

    // 7. Reinitialize storage persistence manager
    showMessage('STEP 7: Reinitializing storage persistence manager...', 'warning');
    let reinitSuccess = false;
    try {
      console.log('[Clear All Storage] Sending reinitializeStorage message...');
      const reinitResponse = await safeSendMessage({ action: 'reinitializeStorage' });
      console.log('[Clear All Storage] reinitializeStorage response:', reinitResponse);

      if (reinitResponse.success) {
        showMessage('✓ Storage persistence manager reinitialized', 'success');
        console.log('[Clear All Storage] ✓ Reinitialization successful');
        reinitSuccess = true;
      } else {
        showMessage('⚠️ Could not reinitialize storage: ' + reinitResponse.error, 'warning');
        console.error('[Clear All Storage] ✗ Reinitialization failed:', reinitResponse.error);
      }
    } catch (e) {
      console.error('[Clear All Storage] Failed to reinitialize storage:', e);
      showMessage('⚠️ Could not reinitialize storage', 'warning');
    }

    // 8. Wait for reinitialization to fully complete
    // CRITICAL: IndexedDB reinitialization needs time to:
    //   1. Open database connection (async)
    //   2. Create object stores if needed (async)
    //   3. Run health checks (async)
    //   4. Start monitoring (async)
    // If we verify too early, we'll see "not initialized" error
    const waitTime = reinitSuccess ? 3000 : 1500; // Wait longer if reinit succeeded
    showMessage(`Waiting ${waitTime/1000}s for reinitialization to complete...`, 'warning');
    console.log(`[Clear All Storage] Waiting ${waitTime}ms for reinitialization to complete...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));

    // 9. Verify all storage is empty
    showMessage('STEP 8: Verifying deletion...', 'warning');
    const verifyResponse = await safeSendMessage({ action: 'getStorageStats' });

    if (verifyResponse.success) {
      const finalSessions = verifyResponse.stats.currentState.sessions;
      const finalLocal = verifyResponse.stats.persistence?.sources?.local?.sessions || 0;
      const finalIDB = verifyResponse.stats.persistence?.sources?.indexedDB?.sessions || 0;

      let verifyMessage = 'VERIFICATION RESULTS:\n\n';
      verifyMessage += 'Memory sessions: ' + finalSessions + ' (expected: 0)\n';
      verifyMessage += 'chrome.storage.local: ' + finalLocal + ' (expected: 0)\n';
      verifyMessage += 'IndexedDB: ' + finalIDB + ' (expected: 0)\n\n';

      if (finalSessions === 0 && finalLocal === 0 && finalIDB === 0) {
        showMessage(verifyMessage + '✅ ALL STORAGE CLEARED SUCCESSFULLY!\n\nAll layers verified empty.', 'success');
      } else {
        showMessage(verifyMessage + '⚠️ Some data remains!\n\nYou may need to reload the extension or close all tabs.', 'warning');
      }
    }

    // 10. Refresh stats to show final state
    await refreshStats();

    showMessage('=== CLEAR ALL STORAGE COMPLETE ===', 'success');

  } catch (error) {
    console.error('[Clear All Storage] Error:', error);
    showMessage('❌ Failed to clear storage: ' + error.message, 'error');
  }
}

function showMessage(text, type = 'success') {
  const messagesDiv = document.getElementById('messages');
  const messageDiv = document.createElement('div');
  messageDiv.className = type;
  messageDiv.textContent = text;
  messagesDiv.appendChild(messageDiv);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    messageDiv.remove();
  }, 5000);
}

/**
 * Initialize the diagnostics page
 * Checks for chrome.runtime availability and sets up auto-refresh
 */
function initializePage() {
  // Check if chrome.runtime is available
  chromeRuntimeAvailable = checkChromeRuntime();

  if (!chromeRuntimeAvailable) {
    console.error('Chrome Extension APIs not available. Current protocol:', window.location.protocol);
    showRuntimeError();
    return;
  }

  console.log('Chrome Extension APIs available. Initializing diagnostics...');

  // Attach event listeners to buttons
  const refreshStatsBtn = document.getElementById('refreshStatsBtn');
  const testPersistenceBtn = document.getElementById('testPersistenceBtn');
  const detectOrphansBtn = document.getElementById('detectOrphansBtn');
  const testImmediateDeletionBtn = document.getElementById('testImmediateDeletionBtn');
  const viewRawDataBtn = document.getElementById('viewRawDataBtn');
  const clearAllStorageBtn = document.getElementById('clearAllStorageBtn');

  if (refreshStatsBtn) {
    refreshStatsBtn.addEventListener('click', refreshStats);
  }

  if (testPersistenceBtn) {
    testPersistenceBtn.addEventListener('click', testPersistence);
  }

  if (detectOrphansBtn) {
    detectOrphansBtn.addEventListener('click', detectAndCleanOrphans);
  }

  if (testImmediateDeletionBtn) {
    testImmediateDeletionBtn.addEventListener('click', testImmediateDeletion);
  }

  if (viewRawDataBtn) {
    viewRawDataBtn.addEventListener('click', viewRawData);
  }

  if (clearAllStorageBtn) {
    clearAllStorageBtn.addEventListener('click', clearAllStorage);
  }

  // Auto-refresh on load
  refreshStats();

  // Auto-refresh every 5 seconds
  setInterval(() => {
    // Re-check chrome.runtime before each refresh (in case extension was reloaded)
    if (checkChromeRuntime()) {
      refreshStats().catch(error => {
        console.error('Auto-refresh failed:', error);
        // Don't show error message for auto-refresh failures to avoid spam
      });
    } else {
      console.warn('Chrome runtime no longer available. Extension may have been reloaded.');
    }
  }, 5000);
}

// Initialize page when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}
