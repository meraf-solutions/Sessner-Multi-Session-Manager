# MV3 Migration Quick Start Guide

## 🚀 Loading the MV3 Extension

### Step 1: Open Chrome/Edge Extensions Page

1. Navigate to: `chrome://extensions/` (or `edge://extensions/`)
2. Enable **Developer mode** (toggle in top-right corner)

### Step 2: Load Unpacked Extension

1. Click **"Load unpacked"** button
2. Select the Sessner project directory: `d:\Sessner – Multi-Session Manager`
3. Extension should load successfully

### Step 3: Verify Service Worker Activation

1. Find "Sessner – Multi-Session Manager" in extension list
2. Check version: Should show **4.0.0**
3. Look for **"service worker"** label (not "background page")
4. Click **"service worker"** link to open DevTools

### Step 4: Check Console Logs

Service worker console should show:
```
[Service Worker] Loading Sessner MV3 Service Worker...
[Service Worker] ✓ All scripts loaded
[Service Worker] ✓ State manager, alarm manager, and compatibility layer exported to global scope
[Service Worker] Install event triggered
[Service Worker] Restoring state from persistence...
[Service Worker] ✓ State restored successfully
[Service Worker] Activate event triggered
[Service Worker] ✓ Claimed all clients
[Service Worker] ✓ Alarms configured
[INIT] Starting extension initialization...
[INIT] ✓ Initialization complete - extension ready
[Service Worker] ✓ Activation complete - service worker ready
[Keep-Alive] Starting keep-alive mechanism
```

**If you see these logs → Migration successful! ✅**

---

## 🧪 Basic Functionality Tests

### Test 1: Create New Session

1. Click extension icon in toolbar
2. Click **"New Session"** button
3. Verify: New tab opens with colored badge (●)
4. Check service worker console for:
   ```
   [Session Creation] Creating new session...
   [State Manager] Saved to session storage
   [State Manager] Saved to local storage
   ```

### Test 2: Cookie Isolation

1. Create 2 sessions (Session A, Session B)
2. In Session A tab, navigate to: `https://httpbin.org/cookies/set?testA=valueA`
3. In Session B tab, navigate to: `https://httpbin.org/cookies/set?testB=valueB`
4. In Session A, navigate to: `https://httpbin.org/cookies`
5. Verify: Shows only `{"testA": "valueA"}`
6. In Session B, navigate to: `https://httpbin.org/cookies`
7. Verify: Shows only `{"testB": "valueB"}`

**Result:** Cookies are isolated ✅

### Test 3: Storage Isolation

1. Create 2 sessions
2. In Session A tab, open DevTools Console (F12)
3. Execute: `localStorage.setItem('test', 'sessionA')`
4. Execute: `localStorage.getItem('test')`
5. Verify: Returns `"sessionA"`
6. In Session B tab, open DevTools Console
7. Execute: `localStorage.setItem('test', 'sessionB')`
8. Execute: `localStorage.getItem('test')`
9. Verify: Returns `"sessionB"`
10. Back in Session A, execute: `localStorage.getItem('test')`
11. Verify: Still returns `"sessionA"` (not affected by Session B)

**Result:** Storage is isolated ✅

### Test 4: Alarms Configured

1. Open service worker DevTools
2. Execute in console:
   ```javascript
   chrome.alarms.getAll().then(alarms => {
     console.table(alarms);
   });
   ```
3. Verify output shows 4 alarms:
   - `cookieCleaner` (every 2 minutes)
   - `licenseValidation` (every 1440 minutes / 24 hours)
   - `sessionCleanup` (every 60 minutes)
   - `keepAlive` (every 1 minute)

**Result:** Alarms are configured ✅

### Test 5: State Persistence

1. Create a new session
2. Navigate to any website (e.g., google.com)
3. Check service worker console for:
   ```
   [State Manager] Debounced persist triggered
   [State Manager] Saved to session storage
   [State Manager] Saved to local storage
   ```
4. Open popup, note the session ID and tab count
5. Close and reopen the popup
6. Verify: Same session is still shown

**Result:** State is persisting ✅

### Test 6: Service Worker Keep-Alive

1. Wait 20 seconds with extension idle
2. Check service worker console
3. Verify: Keep-alive pings appear:
   ```
   [Keep-Alive] Ping - Sessions: X, Tabs: Y, Last persist: Zms ago
   ```
4. Service worker should NOT terminate

**Result:** Keep-alive is working ✅

---

## 🐛 Troubleshooting

### Problem: Extension won't load

**Symptoms:**
- "Manifest file is invalid" error
- Extension card shows error

**Solutions:**
1. Check manifest.json syntax (JSON validator)
2. Verify all file paths exist (background_sw.js, modules/, etc.)
3. Check Chrome/Edge version (need 93+)

### Problem: Service worker crashes immediately

**Symptoms:**
- Service worker shows "inactive" or "stopped"
- No console logs appear

**Solutions:**
1. Click "service worker" link to reactivate
2. Check for JavaScript errors in console
3. Verify ES6 module imports (correct file paths)
4. Check background.js for syntax errors

### Problem: "Cannot access chrome.runtime" error

**Symptoms:**
- Service worker console shows errors about chrome API

**Solutions:**
1. Reload extension (click "Reload" button)
2. Restart Chrome/Edge
3. Verify manifest.json has correct permissions

### Problem: State not persisting

**Symptoms:**
- Sessions disappear after closing popup
- State restoration logs show errors

**Solutions:**
1. Check chrome.storage.local quota (10MB limit)
2. Open service worker console, look for persistence errors
3. Manually trigger save:
   ```javascript
   stateManager.persistState(true);
   ```

### Problem: Alarms not firing

**Symptoms:**
- No alarm logs in console
- Cookie cleaner not running

**Solutions:**
1. Check alarm configuration:
   ```javascript
   chrome.alarms.getAll().then(console.log);
   ```
2. Manually trigger alarm:
   ```javascript
   chrome.alarms.create('cookieCleaner', { delayInMinutes: 0.1 });
   ```
3. Reload extension to recreate alarms

### Problem: chrome.action API not working

**Symptoms:**
- No badge icons on tabs
- "chrome.action is undefined" error

**Solutions:**
1. Verify manifest.json has "action" (not "browser_action")
2. Check Chrome/Edge version (need 93+)
3. Reload extension

---

## 🔍 Debugging Tips

### View Service Worker Logs

1. Go to `chrome://extensions/`
2. Find Sessner extension
3. Click **"service worker"** link
4. DevTools opens with console logs

### View State Manager State

In service worker console:
```javascript
// Get current state
stateManager.getState();

// Get state stats
stateManager.getStateStats();

// Validate state integrity
stateManager.validateState();

// Force immediate persistence
stateManager.persistState(true);
```

### View sessionStore (compatibility layer)

In service worker console:
```javascript
// View all sessions
sessionStore.sessions;

// View tab mappings
sessionStore.tabToSession;

// View cookie store
sessionStore.cookieStore;
```

### View Alarm Status

In service worker console:
```javascript
// Get all alarms
chrome.alarms.getAll().then(alarms => {
  console.table(alarms.map(a => ({
    name: a.name,
    scheduledTime: new Date(a.scheduledTime).toISOString(),
    periodInMinutes: a.periodInMinutes
  })));
});

// Get alarm manager status
alarmManager.getAlarmStatus().then(console.log);
```

### Monitor Keep-Alive

In service worker console:
```javascript
// Check if keep-alive is active
keepAlive.isActive();

// Manually start keep-alive
keepAlive.start();

// Stop keep-alive (for testing)
keepAlive.stop();
```

### Force State Restoration

In service worker console:
```javascript
// Restore state from persistence
await stateManager.restoreState();

// Check restoration status
stateManager.getStateStats();
```

---

## 📊 Performance Monitoring

### State Restoration Time

Look for this log on startup:
```
[State Manager] Restoration complete in 45ms (session storage)
```

**Target:** < 100ms
**Typical:** 20-80ms

### Alarm Reliability

Wait 2 minutes after loading extension, then check for:
```
[Alarm] Triggered: cookieCleaner at 2025-11-04T10:02:00.000Z
[Cookie Cleaner] Starting periodic cookie cleanup...
```

**If alarms fire on schedule → Working correctly ✅**

### Memory Usage

1. Open Task Manager (Shift+Esc in Chrome)
2. Find "Extension: Sessner" process
3. Check memory usage

**Expected:**
- Idle: 10-30 MB
- Active (5 sessions): 30-60 MB

---

## ✅ Migration Validation Checklist

Quick checklist to verify migration success:

- [ ] Extension loads without errors
- [ ] Service worker activates (shows "service worker" not "background page")
- [ ] Version shows 4.0.0
- [ ] Console shows initialization complete
- [ ] New session creation works
- [ ] Cookie isolation works (httpbin test)
- [ ] Storage isolation works (localStorage test)
- [ ] 4 alarms are configured (chrome.alarms.getAll)
- [ ] Keep-alive pings appear every 20 seconds
- [ ] State persists (close/reopen popup)
- [ ] Badges appear on session tabs
- [ ] Popup inheritance works (window.open)

**If all checked → Migration successful! 🎉**

---

## 🔄 Rollback to MV2 (If Needed)

If critical issues are found:

1. Open terminal in project directory
2. Run:
   ```bash
   cp manifest_v2_backup.json manifest.json
   ```
3. Go to `chrome://extensions/`
4. Click **"Reload"** on Sessner extension
5. Extension reverts to MV2 immediately

**Note:** No data loss - all sessions remain intact.

---

## 📞 Getting Help

- **Migration Plan:** See `docs/mv3_migration_plan.md`
- **Test Guide:** See `docs/mv3_migration_test_guide.md`
- **Migration Summary:** See `docs/MV3_MIGRATION_SUMMARY.md`
- **Architecture:** See `docs/architecture.md`
- **API Reference:** See `docs/api.md`

---

**Happy testing! 🚀**
