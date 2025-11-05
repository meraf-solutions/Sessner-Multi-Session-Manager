# 🌐 Sessner – Multi-Session Manager

**Version 3.2.4** - The simple way to manage multiple accounts on any website

---

## 📖 What Is This?

Sessner – Multi-Session Manager is a Chromium browser extension that lets you use multiple accounts on the same website at the same time - without the hassle of browser profiles or constantly logging in and out. Compatible with Microsoft Edge, Brave, Opera, and Vivaldi.

Think of it like having multiple browsers running at once, but all in one window. Each tab gets its own isolated session with completely separate cookies and storage. Log into Gmail with your work account in one tab, your personal account in another, and a client account in a third - all simultaneously!

### Why This Is Better Than Other Solutions

- **No switching required** - Sessions stay active as long as the tab is open
- **One-click simplicity** - Just click "New Session" and go
- **True isolation** - Each session has completely separate cookies and storage
- **Smart popup handling** - Popup windows inherit the parent session automatically
- **Visual indicators** - Color-coded badges show which tabs have active sessions
- **Persistent sessions** - Sessions survive browser restarts

---

## ✨ Key Features

### 🎯 True Session Isolation

Each session runs in complete isolation with:
- Separate cookies
- Separate localStorage
- Separate sessionStorage
- Separate IndexedDB
- No cross-session contamination

### 🎨 Visual Session Management

- **Color-coded badges** - Each session gets a unique color indicator
- **Dynamic favicon badges** - Session tabs show extension icon with colored badge for easy identification
- **At-a-glance identification** - Instantly see which tabs have sessions by both badge and favicon
- **Custom Session Names** (Premium/Enterprise) - Name your sessions for easy identification (e.g., "Work Gmail", "Personal Facebook")
- **Clean interface** - Simple, distraction-free design

### 🪟 Intelligent Popup Inheritance

When a website opens a popup window (for reports, OAuth login, payment processing, downloads, etc.), the popup automatically inherits the parent tab's session. This means:
- OAuth logins work correctly
- Payment windows maintain your session
- Report generation stays in context
- File downloads use the right account
- No session confusion or errors

### 💾 Persistent Sessions (Updated 2025-10-28)

**Session Data Persistence (All Tiers):**
- Session cookies and storage saved locally
- **Free tier:** 7-day retention (sessions auto-deleted after 7 days of inactivity)
- **Premium/Enterprise:** Permanent retention (sessions never auto-deleted)

**Auto-Restore on Browser Restart (Enterprise Only - v3.0.3):**
- Automatic tab restoration using URL-based matching
- Sessions reconnect within 2-4 seconds of browser startup
- Session badges and colors automatically restored
- Intelligent retry logic handles slow system startups
- Automatic preference disabling on tier downgrade with notification
- **Free/Premium users:** Sessions saved but tab mappings cleared on restart (manual session recreation required)

**Dormant Session Management (All Tiers - v3.2.4):**
- Sessions without active tabs become "dormant" (preserve URLs and cookies)
- Manually delete unwanted dormant sessions via X icon in UI
- Reopen dormant sessions to restore exact URLs and cookies
- No limit on number of dormant sessions (only retention period applies)
- Confirmation dialog prevents accidental deletion

### 🚀 Simple Workflow

1. Click extension icon
2. Click "New Session" button
3. Use the website normally
4. Done!

---

## 📦 Installation

### Method 1: Install .CRX Package (Recommended)

1. Download the latest `.CRX` file from the releases page
2. Open your browser's extension page:
   - **Edge:** Navigate to `edge://extensions/`
   - **Brave:** Navigate to `brave://extensions/`
   - **Opera:** Navigate to `opera://extensions/`
   - **Vivaldi:** Navigate to `vivaldi://extensions/`
3. Drag and drop the `.CRX` file onto the extensions page
4. Click "Add extension" when prompted
5. The extension icon will appear in your toolbar

**Important:** Chrome does not support Manifest V2 extensions. This extension is compatible with Edge, Brave, Opera, and Vivaldi only.

### Method 2: Load Unpacked (For Developers)

1. Download or clone this extension to your computer
2. Open your Chromium browser (Edge/Brave/Opera/Vivaldi) and navigate to the extensions page
3. Enable **"Developer mode"** (toggle in the top right or bottom left)
4. Click **"Load unpacked"**
5. Select the extension folder
6. The extension icon will appear in your toolbar

**Important:** This method only works on Edge, Brave, Opera, and Vivaldi. Chrome does not support loading unpacked Manifest V2 extensions.

### Step 3: Pin the Extension (Recommended)

1. Click the puzzle icon in your browser toolbar
2. Find "Sessner – Multi-Session Manager"
3. Click the pin icon to keep it visible

That's it! You're ready to go.

---

## 🎓 How to Use

### Creating Your First Isolated Session

1. **Click the extension icon** in your toolbar
2. **(Optional)** Enter a URL in the input field (e.g., `https://gmail.com`)
3. **Click "New Session"**
4. A new tab opens with a fresh isolated session
5. Log into your account as normal

The session badge will appear on the browser action icon, and the tab's favicon will change to the extension icon with a color-coded indicator matching the session color.

### Creating Multiple Sessions

Repeat the process for each account:

1. Click extension icon
2. Click "New Session" again
3. New tab opens with a different isolated session
4. Log into your second account

Each tab is completely isolated from the others. You can have as many sessions as you need!

### Using Sessions

Once you've created a session and logged in:
- **The session stays active** as long as the tab is open
- **No switching needed** - just switch between tabs
- **Popups work automatically** - they inherit the parent session
- **Sessions persist** if you close and reopen the browser

### Closing Sessions

Simply close the tab! The session is automatically cleaned up.

---

## 💡 Common Use Cases

### 📧 Multiple Email Accounts

**Scenario:** You have work email, personal email, and a side business email.

**Solution:** Open three sessions:
- Tab 1: Work Gmail (work@company.com)
- Tab 2: Personal Gmail (yourname@gmail.com)
- Tab 3: Business Gmail (contact@mybusiness.com)

Check all three accounts simultaneously without logging in and out.

### 📱 Social Media Management

**Scenario:** Managing personal and business social media accounts.

**Solution:** Open separate sessions for each account:
- Personal Facebook, Twitter, Instagram
- Business Facebook, Twitter, Instagram
- Client accounts

Post, reply, and manage all accounts in parallel.

### 🛒 E-Commerce & Marketplace Testing

**Scenario:** You sell products online and need to test the buyer experience.

**Solution:**
- Tab 1: Seller account (manage inventory, process orders)
- Tab 2: Buyer account (test checkout, view as customer)
- Tab 3: Different buyer account (test different scenarios)

Switch between perspectives instantly.

### 👨‍💻 Development & QA Testing

**Scenario:** Testing web applications with different user roles.

**Solution:**
- Tab 1: Admin account (full permissions)
- Tab 2: Regular user account (limited permissions)
- Tab 3: Guest account (read-only)
- Tab 4: Test account (specific scenario)

Test all user roles simultaneously without re-logging.

### 🏢 Work & Personal Separation

**Scenario:** Keep work and personal accounts completely separate.

**Solution:**
- Work tabs: All work-related accounts in isolated sessions
- Personal tabs: All personal accounts in isolated sessions

Never accidentally post from the wrong account again!

### 🌍 Multi-Region Testing

**Scenario:** Testing how websites behave with different accounts or regions.

**Solution:**
- Multiple accounts with different settings
- Test localization
- Test region-specific features

### 💼 Client Account Management

**Scenario:** Managing multiple client accounts (for agencies, freelancers, consultants).

**Solution:**
- One session per client
- Keep client data completely separate
- No risk of cross-contamination

---

## 🔍 Understanding Key Features

### What Is Session Isolation?

**Session isolation** means each tab has its own completely separate environment:

- **Separate Cookies:** Each session has its own set of cookies
- **Separate Storage:** localStorage, sessionStorage, and IndexedDB are isolated
- **No Interference:** Actions in one session don't affect others
- **True Independence:** It's like running completely separate browsers

### Why Popup Inheritance Matters

Many websites use popup windows for critical features:

- **OAuth Login:** Google, Facebook, Twitter login often use popups
- **Payment Processing:** PayPal, Stripe, credit card forms
- **Report Generation:** Business apps generate reports in popups
- **File Downloads:** Some sites use popups for download dialogs
- **Third-Party Services:** Integration with external services

**The Problem Without Inheritance:**
If popups don't inherit the session, they open in a "default" session, causing:
- Login failures (OAuth sees wrong session)
- Payment errors (wrong account context)
- Report generation failures (no access to data)
- Downloads from wrong account

**Our Solution:**
Popups automatically inherit the parent tab's session, so everything works seamlessly.

### How Color Badges Work

Each session is assigned a unique color from a palette of 12 distinct colors:

- **#FF6B6B** (Red) - Coral Red
- **#4ECDC4** (Teal) - Turquoise
- **#45B7D1** (Blue) - Sky Blue
- **#FFA07A** (Orange) - Light Salmon
- **#98D8C8** (Mint) - Mint Green
- **#F7DC6F** (Yellow) - Pastel Yellow
- **#BB8FCE** (Purple) - Lavender
- **#85C1E2** (Blue) - Powder Blue
- **#F06292** (Pink) - Rose Pink
- **#64B5F6** (Blue) - Cornflower Blue
- **#81C784** (Green) - Sage Green
- **#FFD54F** (Gold) - Amber
- *Colors cycle if more than 12 sessions exist*

**Visual Indicators:**
- **Browser Badge**: A colored dot (●) appears on the extension icon for session tabs
- **Tab Favicon**: Session tabs show the extension icon with a small colored badge overlay matching the session color
- **Consistent Colors**: Each session maintains the same color across both indicators

---

## 🛠️ Troubleshooting

### Issue: Extension Icon Not Showing

**Solution:**
1. Go to your browser's extensions page (e.g., `edge://extensions/` for Edge)
2. Verify the extension is enabled
3. Click the puzzle icon in toolbar and pin the extension

### Issue: Sessions Not Working After Browser Restart

**Update (2025-10-28)**: Auto-restore feature is **Enterprise tier only** (v3.0.3).

**Enterprise Tier - Automatic Restoration:**
- Extension waits 2-4 seconds for Edge to restore tabs
- Uses URL-based matching to reconnect sessions to tabs automatically
- Session badges and colors automatically reappear
- All session data (cookies, storage) fully restored
- Preference automatically disabled on tier downgrade with notification

**Free/Premium Tier - Manual Session Recreation:**
- Session data is saved for 7 days (Free) or permanently (Premium)
- After browser restart, tab mappings are cleared (no auto-restore)
- Must manually create new sessions to log in again
- This is expected and intentional behavior for non-Enterprise tiers
- Edge restore detection shows "Upgrade to Enterprise" notification (Free/Premium only)

**For Enterprise Users - If Auto-Restore Doesn't Work:**
1. Verify auto-restore is enabled in License Details page
2. Ensure "On startup" in Edge is set to **"Open tabs from previous session"**
3. Wait 10-15 seconds after browser restart for full restoration
4. Check background console for restoration logs:
   - Open `edge://extensions/` → Developer mode ON
   - Find "Sessner" → Click "background page"
   - Look for `[Session Restore] URL-based matching: X tabs restored`

**Possible Causes of Restoration Failure (Enterprise):**
- Auto-restore preference disabled in settings (check License Details page)
- Edge "Clear browsing data on close" is enabled (deletes extension storage)
- Extension was disabled at `edge://extensions/`
- Tabs closed manually before browser restart (expected behavior)
- License downgraded to Free/Premium (auto-restore auto-disabled with notification)
- License not activated or expired (auto-restore disabled)

**Solution:**
1. **Enterprise users:** Check auto-restore toggle in License Details page
2. Verify Edge settings: Ensure "Clear browsing data on close" is OFF
3. Verify extension is enabled at `edge://extensions/`
4. Check that tabs were open when browser was closed
5. **Enterprise users:** Verify license tier is Enterprise in extension popup

### Issue: Can't Create New Session

**Solution:**
1. Check if extension has permissions
2. Try reloading the extension at `edge://extensions/`
3. Close and reopen the browser

### Issue: Logged Out When Switching Tabs

**This is expected!** Each session is isolated. When you switch tabs, you're switching to a different session with different credentials.

If you want the same account in multiple tabs, just use regular tabs without creating new sessions.

### Issue: Popup Window Shows Wrong Account

**Check:**
- Was the popup opened from a session tab?
- Does the popup URL match the parent domain?

If issues persist, the website might be using unusual popup mechanisms. Try using the session in a regular tab instead.

### Issue: Website Behaving Strangely

Some websites use advanced tracking or fingerprinting:

**Solution:**
1. Clear the session (close tab and create new session)
2. Try opening in a regular tab first to see if it's extension-related
3. Some websites may detect multiple accounts from same IP

### Issue: Session Badge Not Showing

**Solution:**
1. The tab might not have an active session
2. Try creating a new session for that tab
3. Check if extension is enabled

### Issue: Tab Favicon Not Changing

**What to expect:** Session tabs should show the extension icon with a colored badge instead of the website's original favicon.

**Solution:**
1. Refresh the tab (F5) to trigger favicon update
2. Non-session tabs keep their original favicons (this is correct behavior)
3. Check browser console (F12) for any favicon-related errors
4. Verify `content-script-favicon.js` is enabled in `edge://extensions/`

---

## 🔐 Privacy & Security

### Local Storage Only

- All session data is stored **locally on your device**
- **No cloud sync** - data never leaves your computer
- **No external connections** - extension works completely offline
- **No data collection** - we don't track, log, or collect anything

### Security Considerations

**What This Extension Does:**
- Creates isolated cookie and storage containers per tab
- Manages cookie partitioning automatically with domain validation
- Ensures sessions don't interfere with each other
- Validates cookie domains to prevent cross-domain injection
- Enforces cookie expiration to prevent stale authentication
- Isolates iframes to prevent third-party tracking leakage

**What This Extension Does NOT Do:**
- Does not hide your IP address (use a VPN for that)
- Does not prevent browser fingerprinting
- Does not encrypt your data (it's stored in Edge's standard storage)
- Does not bypass website security measures

### Best Practices

1. **Use Strong Passwords:** Extension doesn't manage passwords, use a password manager
2. **Enable Two-Factor Authentication:** For important accounts
3. **Be Careful With Cookies:** Don't share your computer while sessions are active
4. **Log Out When Done:** Close tabs to end sessions
5. **Regular Security Updates:** Keep Edge and the extension updated

### Permissions Explained

The extension requires these permissions:

- **cookies** - To create isolated cookie containers
- **storage** - To save session mappings
- **tabs** - To manage tab-session relationships
- **webNavigation** - To track popup inheritance
- **<all_urls>** - To work on all websites

These permissions are used solely for session isolation functionality.

---

## 💡 Tips & Best Practices

### 1. Plan Your Sessions

Before creating sessions, think about:
- Which accounts do you need active simultaneously?
- How will you organize tabs?
- Do you need sessions to persist across restarts?

### 2. Use Descriptive URLs

When creating sessions, entering the target URL:
- Saves you time (tab opens at the right page)
- Helps organize your workflow
- Reduces clicking around

### 3. Keep It Simple

Don't over-complicate:
- Only create sessions when you need isolation
- Use regular tabs for same-account browsing
- Close sessions when done to keep things clean

### 4. Test Before Important Tasks

Before using sessions for critical work:
- Test with less important accounts first
- Verify popups work as expected
- Ensure the website behaves correctly

### 5. Combine With Other Tools

Sessner works great with:
- Password managers (LastPass, 1Password, Bitwarden)
- Tab management extensions
- Productivity tools

### 6. Understand Limitations

Session isolation is not:
- Anonymous browsing (websites see your IP)
- A VPN replacement
- Protection from tracking across sessions (same IP, same device fingerprint)

---

## ❓ Frequently Asked Questions

### Q: How is this different from browser profiles?

**A:** Browser profiles are heavy - they duplicate your entire browser environment. Sessner is lightweight and tab-focused:
- **Profiles:** Separate browser windows, bookmarks, history, extensions
- **Sessner:** Same browser, just isolated sessions per tab

### Q: How is this different from Incognito/Private mode?

**A:** Incognito mode:
- Doesn't save history or cookies after closing
- All incognito tabs share the same session
- Limited to incognito-enabled extensions

Sessner:
- Each tab has its own isolated session
- Sessions persist across browser restarts
- Works with all your regular extensions

### Q: Can I use this with Chrome or Firefox?

**A:** This extension uses **Manifest V2** which Chrome no longer supports for unpacked extensions.

**Compatible browsers:**
- ✅ **Microsoft Edge** (Chromium-based, version 88+)
- ✅ **Brave** (Version 1.0+)
- ✅ **Opera** (Version 60+)
- ✅ **Vivaldi** (Version 2.0+)

**Not compatible:**
- ❌ **Chrome** - Chrome deprecated Manifest V2 support and does not allow loading MV2 extensions
- ❌ **Firefox** - Requires significant API changes (uses WebExtensions API instead of Chrome Extension API)

**Why Manifest V2?**
- Chrome's Manifest V3 removed the `webRequestBlocking` API which is essential for complete cookie isolation
- Without blocking mode, sessions can leak cookies between each other, breaking the core functionality
- Manifest V2 provides the necessary APIs for industrial-grade session isolation

### Q: Does this work on mobile?

**A:** No, this is a desktop browser extension only. Mobile browsers don't support extensions in the same way.

### Q: Can I backup my sessions?

**A:** Yes! Version 3.2.0 adds session export/import functionality:
- **Premium tier:** Export/import individual sessions to JSON files
- **Enterprise tier:** Bulk export all sessions + AES-256 encryption for sensitive data
- **Free tier:** Feature not available (upgrade to Premium or Enterprise)

Sessions are also stored locally and persist across browser restarts.

### Q: Will this slow down my browser?

**A:** No significant performance impact. Version 3.0.1 includes performance optimizations:
- Each session adds minimal memory overhead (~10-20KB)
- Content scripts are lightweight (~50-100KB per tab)
- One-time favicon processing (no continuous monitoring)
- Debounced persistence reduces storage writes
- Overall impact is negligible on modern systems

### Q: Can websites detect I'm using multiple sessions?

**A:** Websites might notice multiple accounts from the same IP address, but they won't detect the extension itself. Use responsibly and follow website terms of service.

### Q: Is this legal?

**A:** Yes, managing multiple browser sessions is legal. However, always follow website terms of service - some sites prohibit multiple accounts.

### Q: What happens if I disable the extension?

**A:** Active sessions will end, and you'll return to Edge's default session. Your logged-in accounts won't be affected, but the isolation will be gone.

### Q: Can I rename sessions or add labels?

**A:** Yes! Version 3.1.0 adds session naming/labeling for Premium and Enterprise tiers:
- **Premium/Enterprise:** Custom session names (e.g., "Work Gmail", "Personal Facebook")
- **Inline editing:** Double-click session name to edit
- **Full validation:** Max 50 chars, emoji support, duplicate detection
- **Free tier:** Feature not available (upgrade for session naming)

### Q: What is a dormant session and when does a session become dormant?

**A:** A dormant session is a session without any active tabs, but with all its data (cookies and URLs) preserved for later use.

**A session becomes dormant when:**
- **You close all tabs in that session** - The session automatically converts to dormant state
- **Browser restart (Free/Premium tiers)** - Tab mappings are cleared, sessions become dormant
- **Browser restart (Enterprise with auto-restore disabled)** - Sessions convert to dormant

**What happens to dormant sessions:**
- **Data preserved:** All cookies and tab URLs are saved
- **Reopenable:** Click "Open Session" button to restore the session with exact URLs and cookies
- **Retention period:** Free tier (7 days), Premium/Enterprise (permanent)
- **No quantity limit:** You can have unlimited dormant sessions (only time retention applies)
- **Manual deletion:** Use the X icon to delete unwanted dormant sessions (v3.2.4)

**Enterprise tier exception:** Enterprise users with auto-restore ENABLED do not create dormant sessions - sessions are completely deleted when all tabs close (will auto-restore on next browser startup).

### Q: Can I delete dormant sessions?

**A:** Yes! Version 3.2.4 adds dormant session deletion for all tiers:
- **All tiers:** X icon on dormant session cards for manual deletion
- **Confirmation dialog:** Prevents accidental deletion
- **Multi-layer deletion:** Removes from all storage layers (in-memory, IndexedDB, chrome.storage.local)
- **No limit:** Keep as many dormant sessions as you want (only retention period applies)

---

## 🎯 Quick Start Checklist

- [ ] Install extension in your Chromium browser (Edge/Brave/Opera/Vivaldi)
- [ ] Pin extension icon to toolbar
- [ ] Click extension icon
- [ ] Click "New Session" to create your first isolated session
- [ ] Log into first account
- [ ] Create second session for second account
- [ ] Switch between tabs to see isolation in action
- [ ] Test popup window (if needed for your use case)
- [ ] Enjoy seamless multi-session browsing!

---

## 📸 Screenshots Guide

*(Placeholder descriptions - actual screenshots to be added)*

### Screenshot 1: Extension Popup
**What you'll see:** Clean interface with "New Session" button and optional URL input field

### Screenshot 2: Multiple Sessions in Action
**What you'll see:** Multiple tabs with different color badges, showing active sessions

### Screenshot 3: Session Badge & Favicon
**What you'll see:** Browser tab with color-coded badge on extension icon and tab favicon showing extension icon with colored badge overlay

### Screenshot 4: Popup Inheritance
**What you'll see:** Parent tab and popup window, both with same session badge

---

## 🆘 Need Help?

### Getting Support

1. **Check this README** - Most questions are answered here
2. **Review Troubleshooting section** - Common issues and solutions
3. **Check browser console** - Open DevTools (F12) to see any error messages
4. **Test without extension** - Disable extension to rule out conflicts

### Reporting Issues

If you encounter bugs:
1. Note exact steps to reproduce
2. Check browser console for errors
3. Note which website you were using
4. Note your Edge version

### Understanding the Code

This extension is open source! The code is documented and structured for readability:
- `manifest.json` - Extension configuration
- `background.js` - Main session isolation logic
- `popup.html` / `popup.js` - User interface
- `content-script-*.js` - Session isolation implementation

---

## 🚀 Version History

### Version 3.2.4 (Current - 2025-11-03)
- **Feature**: Dormant Session Deletion (All Tiers)
  - X icon on dormant session cards for manual deletion
  - Confirmation dialog with warning message
  - Multi-layer deletion (in-memory + IndexedDB + chrome.storage.local)
  - Theme-aware UI (light/dark mode support)
- **Critical Fix**: Enterprise Tier Session Persistence Bug
  - Fixed: Enterprise sessions with auto-restore disabled now convert to DORMANT (preserve URLs/cookies)
  - Previously: Sessions were incorrectly deleted, causing data loss
  - Behavior: Enterprise + auto-restore disabled now same as Free/Premium (DORMANT preservation)
- **Code Quality**: 4 improvements (removed duplicate handlers, fixed logging bugs, added cache cleanup, DRY principle)
- **Testing**: 2 scenarios tested and passed (Enterprise DORMANT conversion + dormant deletion)

### Version 3.2.3 (2025-11-02)
- **Fix**: Race condition in dormant session persistence with in-memory cache
- **Improvement**: Tab metadata cache for immediate URL capture
- **Performance**: Eliminates debounce race condition during tab closure

### Version 3.2.2 (2025-11-01)
- **Fix**: Auto-restore preference validation race condition
- **Improvement**: Enhanced error handling for tier detection

### Version 3.2.1 (2025-11-01)
- **Fix**: Auto-restore race condition on browser startup
- **Fix**: Dormant session URL restoration bug
- **Improvement**: Enhanced logging for tab restoration debugging

### Version 3.2.0 (2025-10-31)
- **Feature**: Session Export/Import (Premium/Enterprise exclusive)
  - Export sessions to JSON files (per-session or bulk)
  - Import sessions with automatic conflict resolution
  - AES-256-GCM encryption for sensitive exports (Enterprise-only)
  - Automatic gzip compression for files >100KB
  - File size limit: 50MB maximum
  - Drag & drop import modal with progress indicators
- **Tier Restrictions**: Free tier completely blocked, Premium per-session only, Enterprise has bulk export + encryption
- **Security**: Client-side encryption (no server), XSS prevention, password validation (8-128 chars)
- **UX**: Theme-aware UI (light/dark modes), upgrade prompts for Free tier
- **Performance**: Transparent compression/decompression, no impact on existing sessions
- **Testing**: 50+ test scenarios documented and validated

### Version 3.1.0 (2025-10-29)
- **Feature**: Session Naming/Labeling (Premium/Enterprise exclusive)
  - Custom names for sessions (max 50 chars, emoji support)
  - Inline editing via double-click
  - Enterprise settings modal integration
  - Full theme support (light/dark modes)
  - Case-insensitive duplicate detection
  - Comprehensive validation and error handling
- **UX**: PRO badge for Free tier users with upgrade prompts
- **Performance**: No impact on session operations
- **Testing**: 30+ test scenarios documented and validated

### Version 3.0.3 (2025-10-28)
- **Feature**: Enterprise-exclusive auto-restore with comprehensive tier enforcement
- **Feature**: Automatic preference disabling on tier downgrade with notification system
- **Feature**: Edge browser restore detection with upgrade notifications (Free/Premium)
- **Fix**: Stale session cleanup race condition (Free/Premium immediate cleanup)
- **Fix**: Favicon badge persistence after session deletion
- **Fix**: Duplicate Edge restore detection on browser startup (singleton pattern)
- **Fix**: Edge restore detection timing (2s delay + 3 retry attempts)
- **Improvement**: Memory leak prevention with singleton notification listeners
- **Improvement**: Debouncing (5-second) for tier change handling
- **Testing**: Free/Premium tiers fully tested (Tests 1.1, 1.2, 2.1 passed)

### Version 3.0.2 (2025-10-25)
- **Critical Fix**: Resolved browser restart session deletion bug
- **Reliability**: Implemented 2-second delay + retry logic for tab restoration
- **Improvement**: URL-based tab matching (domain + path) instead of tab IDs
- **Improvement**: Intelligent startup grace period prevents premature session cleanup
- **Performance**: Delayed validation (10 seconds) for truly orphaned sessions
- **UX**: Sessions now reliably restore within 2-4 seconds of browser startup
- **Testing**: Confirmed working on Microsoft Edge with "Open tabs from previous session"

### Version 3.0.1 (2025-10-16)
- **Performance**: Simplified favicon badge system to prevent infinite loops
- **Performance**: Eliminated continuous MutationObserver monitoring
- **Performance**: Reduced code complexity by 43% (removed ~170 lines)
- **UX**: Session tabs now consistently show extension icon with colored badge
- **Fix**: Resolved browser slowdown from repeated favicon re-application
- **Fix**: Eliminated console log spam from favicon detection cycles

### Version 3.0.0 (2025-10-14)
- Complete rewrite to SessionBox-style architecture
- True session isolation per tab
- Automatic popup window inheritance
- Simplified one-button interface
- Color-coded session badges
- Dynamic favicon badges with session colors
- Persistent sessions across restarts
- Security hardening with comprehensive TLD support (400+ TLDs)
- Cookie domain validation and expiration enforcement
- Iframe isolation for third-party tracking prevention
- No manual session management needed

### Version 2.0
- Manual cookie save/apply system
- Session naming and management
- Import/export functionality

### Version 1.0
- Initial prototype
- Basic cookie capture

---

## 📋 Technical Information

### Browser Compatibility

This extension uses **Manifest V2** for complete cookie isolation via `webRequestBlocking` API.

**Supported Browsers:**
- ✅ **Microsoft Edge:** Chromium-based Edge (version 88+)
- ✅ **Brave:** Version 1.0+
- ✅ **Opera:** Version 60+
- ✅ **Vivaldi:** Version 2.0+

**Not Supported:**
- ❌ **Chrome:** Does not support Manifest V2 (deprecated by Google)
- ❌ **Firefox:** Requires significant API changes (WebExtensions API)

**Why MV2?**
- Chrome MV3 removed `webRequestBlocking` which is essential for session isolation
- Without blocking mode, cookies leak between sessions (security issue)
- MV2 provides industrial-grade isolation guarantee

### Required Permissions

- `cookies` - Cookie isolation
- `storage` - Session persistence
- `tabs` - Tab management
- `webNavigation` - Popup tracking
- `<all_urls>` - Universal site support

### Storage

- Uses Chrome Storage API (`chrome.storage.local`)
- Session data stored locally only
- No size limits for practical use

---

## 🙏 Acknowledgments

Sessner – Multi-Session Manager is inspired by SessionBox and similar multi-account management tools, built to provide simple, effective session isolation for Chromium browser users (Edge, Brave, Opera, Vivaldi).

---

## 📄 License

This extension is provided as-is for personal and educational use. Please review and comply with all applicable website terms of service when using multiple accounts.

---

## 🎉 Enjoy Multi-Session Browsing!

You're all set! Start creating isolated sessions and enjoy the freedom of managing multiple accounts effortlessly.

**Remember:** With great power comes great responsibility - use this tool ethically and in compliance with website policies.

---

**Sessner – Multi-Session Manager v3.2.4**
**Made for Chromium Browsers (Edge, Brave, Opera, Vivaldi)**
**100% Local, 100% Private**
**Not compatible with Chrome (Manifest V2)**
