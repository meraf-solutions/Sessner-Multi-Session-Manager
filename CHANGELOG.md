# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [3.0.2] - 2025-10-21

### Fixed - License Validation API Integration

This update fixes critical issues with the Meraf Solutions licensing API integration to ensure proper license validation, error handling, and user experience.

#### Critical Fixes

1. **License Validation Endpoint Format** (CRITICAL)
   - **Fixed**: Corrected endpoint URL format to match API specification
   - **Before**: `{baseUrl}/validate` with POST body
   - **After**: `{baseUrl}/validate?t=Sessner&s={license_key}&d={device_name}` with query parameters
   - **Impact**: License validation now works correctly with the Meraf Solutions API
   - **Files**: `license-manager.js` (line 431)

2. **API Response Parsing** (CRITICAL)
   - **Fixed**: API returns JSON-encoded strings (`"1"`, `"0"`) but code expected plain strings
   - **Solution**: Added `JSON.parse()` to handle both JSON-encoded and plain text responses
   - **Impact**: Validation no longer fails with "unexpected response" errors
   - **Files**: `license-manager.js` (lines 444-453)
   - **Example**:
     ```javascript
     // API Response: "1" (JSON-encoded string with quotes)
     // Before: parsedResponse = "1" → comparison failed
     // After: parsedResponse = JSON.parse("1") → 1 → comparison succeeds
     ```

3. **Extension Popup Redirect** (UX Fix)
   - **Fixed**: Invalid license validation opened new browser window instead of redirecting extension popup
   - **Root Cause**: Code tried to redirect browser tabs, but validation runs from extension popup (not a tab)
   - **Solution**: Implemented message-based redirect using `chrome.runtime.sendMessage` with `redirectToPopup` action
   - **Impact**: Invalid license now properly redirects to popup.html within the extension popup window
   - **Files**: `license-manager.js` (lines 493-552), `license-details.js` (lines 317-330)

4. **Promise/Callback Error** (Runtime Error Fix)
   - **Fixed**: `TypeError: Cannot read properties of undefined (reading 'then')`
   - **Root Cause**: `chrome.runtime.sendMessage()` doesn't return Promise in all Chrome versions
   - **Solution**: Changed from `.then().catch()` pattern to callback pattern with `chrome.runtime.lastError` checking
   - **Impact**: No more runtime errors when sending messages
   - **Files**: `license-manager.js` (lines 493-552)

5. **Notification Icon Path** (Display Fix)
   - **Fixed**: "Unable to download all specified images" error in notifications
   - **Root Cause**: Used `iconUrl: 'icon.png'` which doesn't exist in extension structure
   - **Solution**: Changed to correct path `icons/icon128.png` with proper error handling
   - **Impact**: Notifications now display correctly with Sessner icon
   - **Files**: `license-manager.js` (lines 474-491)

6. **Null Reference Error** (Runtime Error Fix)
   - **Fixed**: `TypeError: Cannot set properties of null (setting 'lastAttempted')`
   - **Root Cause**: Catch block accessed `this.licenseData` after setting it to `null` during invalid license handling
   - **Solution**: Added null check before accessing licenseData properties
   - **Impact**: Error handling no longer crashes, provides better logging
   - **Files**: `license-manager.js` (lines 605-622)

### Technical Improvements

#### License Validation Flow
- **Enhanced Error Logging**: Separate logging for error name, message, and stack trace
- **User-Friendly Messages**: Clear notifications for validation errors vs invalid licenses
- **Graceful Degradation**: Proper fallback to free tier when validation fails
- **Data Cleanup**: License data correctly removed from storage on invalid response

#### Message-Based Architecture
- **New Message Type**: `redirectToPopup` for extension popup navigation
- **Proper Response Handling**: Callbacks instead of Promises for Manifest V2 compatibility
- **Error Resilience**: Handles missing listeners gracefully without throwing errors

### Documentation Updates

All documentation has been updated to reflect these changes:

1. **[docs/api.md](docs/api.md)**
   - Added `redirectToPopup` message action documentation
   - Included request/response examples
   - Cross-referenced with license validation flow

2. **[docs/architecture.md](docs/architecture.md)**
   - Updated periodic validation flow diagram
   - Added message-based redirect pattern
   - Documented invalid license handling

3. **[docs/subscription_api.md](docs/subscription_api.md)**
   - Fixed validation endpoint format with correct query parameters
   - Added JSON response parsing documentation
   - Updated all code examples to match implementation

4. **[docs/technical.md](docs/technical.md)**
   - Added comprehensive section "2025-01-22: License Validation API Response Parsing"
   - Documented all 6 fixes with before/after code comparisons
   - Included testing recommendations and debugging steps

5. **[CLAUDE.md](CLAUDE.md)**
   - Added "Critical Notes for License Validation" section
   - Emphasized JSON response parsing requirement
   - Documented message-based redirect pattern for future development

### Files Modified

- `license-manager.js` - Core validation logic fixes (6 changes across 5 sections)
- `license-details.js` - Message listener for popup redirect
- `docs/api.md` - API documentation update
- `docs/architecture.md` - Architecture flow update
- `docs/subscription_api.md` - Subscription API documentation fix
- `docs/technical.md` - Technical implementation details
- `CLAUDE.md` - Development guide updates

### Testing

All fixes have been tested and verified:
- ✅ Valid license validation returns "1" and activates Premium/Enterprise tier
- ✅ Invalid license validation returns "0", shows notification, clears data, redirects to popup
- ✅ Extension popup properly redirects (no new windows)
- ✅ Notifications display with correct Sessner icon
- ✅ No runtime errors in Promise handling
- ✅ Error handling works correctly with proper logging

### Compatibility

- ✅ Fully backward compatible with v3.0.1 and v3.0.0
- ✅ No breaking changes to core session management
- ✅ License data migration handled automatically
- ✅ Works with Meraf Solutions licensing API

### Upgrade Notes

**Automatic upgrade** - No action required:
- Extension will automatically use corrected validation endpoint
- Existing licenses will be re-validated on next check
- Invalid licenses will trigger proper cleanup and notification
- All users will benefit from improved error handling

---

## [3.0.1] - 2025-10-16

### Performance - Simplified Favicon Badge System

This update simplifies the dynamic favicon feature to prevent infinite loops and reduce resource consumption while maintaining clear session identification.

### Changed

#### Favicon Badge Simplification
- **Simplified favicon badge to use extension icon only**: Removed complex site favicon overlay logic that was causing infinite loops
- **Eliminated MutationObserver**: Removed dynamic favicon change detection that was re-triggering badge application repeatedly
- **Removed CORS detection**: Eliminated unnecessary canvas compatibility testing for site favicons
- **One-time application**: Favicon badge now applies once per page load instead of continuously monitoring for changes

#### Architecture Improvements
- **Reduced code complexity**: Removed ~200 lines of complex favicon loading, CORS handling, and fallback logic
- **Single favicon strategy**: Session tabs now consistently show extension icon + colored badge
- **Non-session tabs unchanged**: Tabs without sessions keep their original site favicons

### Fixed

#### Critical Performance Issue
1. **Infinite Loop Prevention** (CRITICAL):
   - Fixed infinite loop caused by MutationObserver detecting its own favicon changes
   - Eliminated resource consumption from continuous favicon re-application
   - Prevented potential browser slowdown from excessive DOM manipulation
   - Console log spam eliminated (was logging on every favicon detection cycle)

#### User Experience
- **Consistent visual indicators**: Extension icon + colored badge now matches browser badge indicator
- **No CORS compatibility issues**: Eliminated cross-origin image loading problems
- **Predictable behavior**: Favicon appearance is now deterministic and reliable

### Removed

- **Site favicon overlay logic**: No longer attempts to overlay badges on original site favicons
- **Three-tier fallback system**: Removed site favicon → extension icon → colored circle hierarchy
- **MutationObserver for favicon changes**: Removed dynamic favicon change detection
- **CORS detection and testing**: Removed canvas compatibility testing
- **`originalFaviconUrl` variable**: Cleaned up unused code

### Technical Details

#### Files Modified
- **content-script-favicon.js**: Simplified from 388 lines to ~220 lines (-168 lines, -43%)
  - Removed `findFaviconLink()`, `getFaviconUrl()` functions
  - Removed complex CORS detection in `applyBadgedFavicon()`
  - Removed MutationObserver setup in `initialize()`
  - Renamed `createBadgedFavicon()` to `createBadgedIcon()` for clarity
  - Simplified `applyBadgedFavicon()` to single extension icon loading path

- **CLAUDE.md**: Updated key capabilities description
  - Changed from "overlay on site favicons" to "extension icon with session color"

#### Performance Impact

**Before** (v3.0.0):
- Continuous MutationObserver monitoring (CPU usage)
- Repeated favicon loading and canvas manipulation (memory churn)
- CORS detection tests on every change (network/canvas overhead)
- Infinite loop potential causing browser slowdown

**After** (v3.0.1):
- One-time favicon application per page load (minimal CPU)
- Single extension icon load per session tab (minimal memory)
- No CORS testing required (no overhead)
- Zero infinite loops (stable performance)

### Design Decision

**User Request**: "I have decided to just use the extension's icon plus the colored badge if has session. No need complicate the logic and process."

**Rationale**:
- Session tabs need clear visual identification matching the browser badge
- Site favicon overlays add complexity without significant UX benefit
- Performance and reliability are more important than preserving site favicons
- Simpler code is more maintainable and less error-prone

### Upgrade Notes

**Automatic upgrade** - No action required:
- Extension will automatically apply simplified favicon logic on next page load
- Existing sessions continue to work without any changes
- Users will see extension icon + colored badge instead of overlayed site favicons

### Compatibility

- ✅ Fully backward compatible with v3.0.0 sessions
- ✅ No data migration required
- ✅ No breaking changes to core functionality

---

## [3.0.0] - 2025-10-14

### COMPLETE REWRITE - SessionBox-Style Architecture

**This is a complete rewrite of the extension from the ground up.** The extension has been transformed from a manual cookie save/apply system into an automatic SessionBox-style session isolation system. This version is NOT backward compatible with v2.0 or v1.0.

### Breaking Changes

- **Complete Architecture Change**: Switched from manual cookie management (save/apply/delete) to automatic session isolation
- **No Migration Path**: Old sessions from v1.0/v2.0 cannot be imported or migrated
- **Different Workflow**: Sessions are now automatic and isolated, not manually saved snapshots
- **Manifest V2 Required**: Switched from Manifest V3 to Manifest V2 for webRequestBlocking support
- **Data Structure Incompatible**: Complete redesign of internal data storage (see Technical Changes below)
- **Background Service Worker Removed**: Now uses persistent background page for continuous operation

### Added

#### Core Session Isolation Features

- **HTTP-level Cookie Interception**: Complete cookie isolation at the network layer
  - `webRequest.onBeforeSendHeaders`: Automatically injects session-specific cookies into outgoing requests
  - `webRequest.onHeadersReceived`: Captures `Set-Cookie` headers from server responses
  - `extraHeaders` flag support for modern secure cookies (SameSite, HttpOnly, Secure)
  - Prevents cookie leakage between sessions at the network level

- **JavaScript Cookie Capture**: Real-time capture of cookies set via `document.cookie`
  - `chrome.cookies.onChanged` listener for immediate cookie capture
  - Automatic removal of cookies from browser's native cookie store
  - Periodic cookie cleaner (runs every 2 seconds) to catch any leaked cookies
  - Prevents cross-session cookie contamination

- **LocalStorage/sessionStorage Isolation**: Complete storage isolation per session
  - ES6 Proxy-based interception of Storage APIs
  - Session ID prefixing (`__SID_${sessionId}__`) for key namespacing
  - Transparent to page scripts - no code changes needed
  - Exponential backoff retry logic (5 attempts) for race conditions
  - Automatic cleanup of old session data

- **Document.cookie Isolation**: Override native cookie API in page context
  - Two-part architecture: page context script + extension context bridge
  - `window.postMessage` communication bridge between contexts
  - Optimistic caching for synchronous cookie getter
  - Complete isolation from browser's native cookie store

- **Popup Window Session Inheritance** (CRITICAL FIX):
  - `webNavigation.onCreatedNavigationTarget` for `window.open()` popups
  - `tabs.onCreated` with `openerTabId` for `target="_blank"` links
  - Ensures reports, downloads, OAuth flows, payment windows work correctly
  - Child windows automatically inherit parent tab's session
  - Fixes broken workflows in multi-window applications

#### User Interface

- **Simplified Session Creation**: Single "New Session" button with optional URL input
- **Active Sessions List**: Real-time list of all sessions with grouped tabs
- **Color-Coded Sessions**: 12 vibrant gradient colors for visual session identification
- **Tab Switcher**: "Go" button to quickly switch to specific tabs within a session
- **Real-time Updates**: Session list updates automatically when tabs open/close
- **Clean Minimal Design**: Removed clutter from old save/apply interface

#### Permissions

- `webRequest`: For intercepting HTTP requests/responses
- `webRequestBlocking`: For synchronous request/response modification
- `webNavigation`: For detecting popup window creation and inheritance
- `<all_urls>`: For cookie interception across all domains

### Changed

#### Architecture

- **Manifest V3 → Manifest V2**: Required for `webRequestBlocking` API (cookie interception)
- **Service Worker → Background Page**: Persistent background page for continuous cookie monitoring
- **Manual → Automatic**: Sessions are now automatic containers, not manual snapshots
- **Storage Structure**: Complete redesign of internal data model (see below)

#### Data Structure

**OLD (v1.0-2.0):**
```javascript
{
  "sessions": {
    "Work Gmail": {
      "cookies": [...],
      "domain": "example.com",
      "url": "https://example.com",
      "title": "Page Title",
      "capturedAt": 1234567890,
      "lastUsed": 1234567890
    }
  },
  "tabMap": {
    "123": "Work Gmail"
  }
}
```

**NEW (v3.0):**
```javascript
{
  "sessions": {
    "session_xyz": {
      "id": "session_xyz",
      "color": "#FF6B6B",
      "createdAt": 1234567890,
      "tabs": [123, 456]
    }
  },
  "cookieStore": {
    "session_xyz": {
      "domain.com": {
        "/path": {
          "cookieName": {
            "name": "cookieName",
            "value": "cookieValue",
            "domain": "domain.com",
            "path": "/path",
            "secure": true,
            "httpOnly": false,
            "sameSite": "lax",
            "expirationDate": 1234567890
          }
        }
      }
    }
  },
  "tabToSession": {
    "123": "session_xyz"
  }
}
```

#### Performance Optimizations

- **Debounced Persistence**: Storage writes debounced to 1 second for performance
- **Immediate Critical Persistence**: Session creation/deletion persists immediately
- **In-Memory Cookie Store**: Three-tier structure (domain → path → name) for fast lookups
- **Exponential Backoff**: Content scripts retry with backoff (5 attempts) for race conditions
- **Reduced Console Noise**: Debug logs use `console.log`, errors use `console.warn`

### Removed

- **Save Session Button**: No longer needed - sessions are automatic
- **Apply Session Button**: No longer needed - sessions are always active
- **Delete Session Button**: Sessions delete automatically when all tabs close
- **Rename Session Feature**: Sessions identified by color, not names
- **Capture Workflow**: All capture happens automatically in real-time
- **Session Snapshots**: No concept of saved snapshots - sessions are live
- **Scripting Permission**: No longer needed with new architecture
- **ActiveTab Permission**: Replaced by `<all_urls>` for broader access

### Fixed

#### Critical Bugs

1. **Manifest V2 API Compatibility**: Fixed async/await usage with callback-based APIs
   - `chrome.tabs.get()` and similar APIs require callbacks in Manifest V2
   - Converted all async/await to callback-based patterns where needed

2. **Session ID Initialization Race Conditions**:
   - Content scripts now retry with exponential backoff (5 attempts)
   - Prevents "Session ID not initialized" errors on fast page loads
   - Ensures reliable session assignment before page scripts execute

3. **Cookie Capture from JavaScript**:
   - Added `chrome.cookies.onChanged` listener for `document.cookie` assignments
   - Periodic cookie cleaner (every 2 seconds) catches any leaked cookies
   - Prevents cookies from persisting in browser's native store

4. **Console Noise**:
   - Separated debug logs (`console.log`) from errors (`console.warn`)
   - Reduced excessive logging during normal operation
   - Made debugging easier without cluttering console

5. **Popup Window Inheritance** (CRITICAL):
   - Fixed OAuth flows failing due to popup windows not inheriting sessions
   - Fixed download/report generation windows opening in wrong session
   - Fixed payment processing popups losing authentication
   - Added `webNavigation.onCreatedNavigationTarget` for `window.open()`
   - Added `tabs.onCreated` handling for `target="_blank"` links

6. **Cookie Isolation Leakage**:
   - Periodic cleaner removes any cookies that leak into browser's store
   - Prevents cross-contamination between sessions
   - Ensures complete isolation even with aggressive cookie setting

#### Tab Lifecycle Management

- **Proper Session Cleanup**: Sessions automatically delete when last tab closes
- **Tab Reassignment Prevention**: Tabs cannot switch sessions after creation
- **Orphaned Tab Handling**: Tabs without sessions are properly tracked and cleaned up
- **Memory Leaks**: Fixed session data not being garbage collected

### Technical Improvements

#### Cookie Interception Pipeline

1. **Request Pipeline** (`onBeforeSendHeaders`):
   - Remove all native browser cookies from request
   - Inject session-specific cookies from in-memory store
   - Match cookies by domain, path, secure flag, SameSite policy
   - Serialize cookies into proper `Cookie:` header format

2. **Response Pipeline** (`onHeadersReceived`):
   - Parse all `Set-Cookie` headers from server responses
   - Extract cookie attributes (domain, path, secure, httpOnly, sameSite, expires)
   - Store cookies in session-specific in-memory store
   - Remove `Set-Cookie` headers to prevent browser storage

3. **JavaScript Pipeline** (`chrome.cookies.onChanged`):
   - Detect cookies set via `document.cookie`
   - Immediately capture cookie and store in session store
   - Remove cookie from browser's native store
   - Periodic cleanup catches any missed cookies

#### Storage Isolation System

- **Proxy-based Interception**: ES6 Proxy wraps `localStorage` and `sessionStorage`
- **Key Prefixing**: All keys prefixed with `__SID_${sessionId}__`
- **Transparent Access**: Page scripts see unprefixed keys (proxy handles translation)
- **Automatic Cleanup**: Old session prefixes removed when sessions close
- **Retry Logic**: Handles race conditions during page load

#### Content Script Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Page Context (Isolated World)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Injected Script (page-context.js)              │   │
│  │  - Overrides document.cookie                    │   │
│  │  - Overrides localStorage/sessionStorage        │   │
│  │  - Sends cookie requests via postMessage        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           ↕ window.postMessage
┌─────────────────────────────────────────────────────────┐
│  Extension Context (Content Script)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Content Script (content.js)                    │   │
│  │  - Receives cookie requests                     │   │
│  │  - Communicates with background page            │   │
│  │  - Returns cookie data to page context          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           ↕ chrome.runtime.sendMessage
┌─────────────────────────────────────────────────────────┐
│  Background Page                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  - In-memory cookie store                       │   │
│  │  - HTTP request/response interception           │   │
│  │  - Session lifecycle management                 │   │
│  │  - Storage persistence                          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Migration Notes

#### From v2.0 to v3.0

**There is NO migration path.** v3.0 is a complete rewrite with incompatible architecture and data structures.

**Before upgrading:**
1. Export your old sessions if needed for reference (they won't work in v3.0)
2. Take note of which accounts you had sessions for
3. Understand the workflow change: automatic isolation vs. manual save/apply

**After upgrading:**
1. All old session data will be ignored/deleted
2. Create new sessions by clicking "New Session" button
3. Navigate to your desired websites - cookies are captured automatically
4. Sessions persist automatically - no need to save
5. Close all tabs in a session to delete the session

#### Workflow Comparison

**OLD Workflow (v1.0-2.0):**
1. Browse to website and log in
2. Click "Save Session" button
3. Give session a name
4. To switch: Click "Apply Session" button
5. Cookies are copied to browser
6. Manually delete sessions when done

**NEW Workflow (v3.0):**
1. Click "New Session" button
2. Browse to website and log in
3. Cookies are captured automatically
4. To switch: Click "Go" button next to desired tab
5. Sessions are always isolated
6. Sessions delete automatically when tabs close

### Known Limitations

- **Manifest V2 Only**: Cannot publish to Chrome Web Store (Manifest V3 required), Firefox only
- **Performance Impact**: HTTP interception adds small latency to requests (~1-5ms)
- **Memory Usage**: All cookies stored in memory (acceptable for typical usage)
- **No Import/Export**: Cannot export sessions for backup or transfer
- **Popup Inheritance**: Only works for same-domain popups (cross-domain OAuth may have issues)

### Dependencies

- Chrome/Firefox Extension APIs (Manifest V2)
- No external libraries or frameworks
- Pure vanilla JavaScript

---

## [2.0.0] - 2024-XX-XX

### Enhanced Cookie Management System

This version improved the original cookie save/apply system with better UI and additional features.

### Added

- **Enhanced UI**: Improved visual design with better session list display
- **Session Metadata**: Track domain, URL, page title, capture time, last used time
- **Session Sorting**: Sort sessions by name or last used
- **Better Error Handling**: More informative error messages
- **Session Statistics**: Show number of cookies and capture date

### Changed

- **Improved Session List**: Better visual hierarchy and information density
- **Storage Optimization**: More efficient storage of cookie data
- **Performance**: Faster session application and switching

### Fixed

- Cookie expiration handling
- Domain matching for cookies
- Path matching for cookies
- Session naming conflicts

---

## [1.0.0] - 2024-XX-XX

### Initial Release - Manual Cookie Management

Basic cookie save/apply system for managing multiple browser sessions.

### Added

- **Save Session**: Capture all cookies from current domain
- **Apply Session**: Restore cookies from saved session
- **Delete Session**: Remove saved session
- **Session List**: View all saved sessions
- **Tab Tracking**: Associate tabs with sessions

### Features

- Manual cookie capture and restoration
- Session naming
- Multiple sessions per domain
- Simple popup interface
- Local storage persistence

### Known Issues

- No automatic session isolation
- Manual switching required
- Cookies can leak between sessions
- No popup window support
- Limited to cookie-only isolation

---

## Version Comparison Summary

| Feature | v1.0 | v2.0 | v3.0 |
|---------|------|------|------|
| Architecture | Manual Save/Apply | Manual Save/Apply | Automatic Isolation |
| Manifest | V3 | V3 | V2 |
| Cookie Isolation | Manual | Manual | Automatic (HTTP-level) |
| Storage Isolation | None | None | Automatic (Proxy-based) |
| Popup Inheritance | No | No | Yes |
| Real-time Capture | No | No | Yes |
| Session Cleanup | Manual | Manual | Automatic |
| Workflow | Save → Apply | Save → Apply | Automatic |
| Data Compatibility | v1 → v2 | v2 ↔ v1 | NOT compatible |

---

## Upgrade Guide

### Upgrading from v2.0 to v3.0

1. **Backup**: Export or note down your existing sessions (optional)
2. **Understand**: Read the "Breaking Changes" section above
3. **Install**: Install v3.0 (will clear all old data)
4. **Recreate**: Create new sessions and log into your accounts again
5. **Learn**: The workflow is now automatic - no save/apply needed

### Upgrading from v1.0 to v2.0

1. **Automatic**: v2.0 can read v1.0 data
2. **Compatible**: All features work the same way
3. **Enhanced**: You'll see additional metadata and better UI

---

## Support

For issues, questions, or feature requests, please open an issue on the GitHub repository.

## License

See LICENSE file for details.
