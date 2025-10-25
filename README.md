# 🌐 Sessner – Multi-Session Manager

**Version 3.0.2** - The simple way to manage multiple accounts on any website

---

## 📖 What Is This?

Sessner – Multi-Session Manager is a Microsoft Edge extension that lets you use multiple accounts on the same website at the same time - without the hassle of browser profiles or constantly logging in and out.

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
- **Clean interface** - Simple, distraction-free design

### 🪟 Intelligent Popup Inheritance

When a website opens a popup window (for reports, OAuth login, payment processing, downloads, etc.), the popup automatically inherits the parent tab's session. This means:
- OAuth logins work correctly
- Payment windows maintain your session
- Report generation stays in context
- File downloads use the right account
- No session confusion or errors

### 💾 Persistent Sessions (Updated 2025-10-25)

- **Sessions survive browser restarts** (now with improved reliability!)
- Automatic tab restoration using URL-based matching
- Sessions reconnect within 2-4 seconds of browser startup
- Session badges and colors automatically restored
- Intelligent retry logic handles slow system startups
- No need to recreate sessions every time
- Automatic cleanup when tabs close

### 🚀 Simple Workflow

1. Click extension icon
2. Click "New Session" button
3. Use the website normally
4. Done!

---

## 📦 Installation

### Step 1: Get the Extension Files

Download or clone this extension to your computer.

### Step 2: Load Into Microsoft Edge

1. Open Microsoft Edge
2. Navigate to `edge://extensions/`
3. Enable **"Developer mode"** (toggle in the bottom left corner)
4. Click **"Load unpacked"**
5. Select the extension folder
6. The extension icon will appear in your toolbar

### Step 3: Pin the Extension (Recommended)

1. Click the puzzle icon in your Edge toolbar
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
1. Go to `edge://extensions/`
2. Verify the extension is enabled
3. Click the puzzle icon in toolbar and pin the extension

### Issue: Sessions Not Working After Browser Restart

**Update (2025-10-25)**: This issue has been fixed! Sessions now automatically restore after browser restart.

**How It Works:**
- Extension waits 2-4 seconds for Edge to restore tabs
- Uses URL-based matching to reconnect sessions to tabs
- Session badges and colors automatically reappear

**If Sessions Still Don't Restore:**
1. Ensure "On startup" in Edge is set to **"Open tabs from previous session"**
2. Wait 10-15 seconds after browser restart for full restoration
3. Check background console for restoration logs:
   - Open `edge://extensions/` → Developer mode ON
   - Find "Sessner" → Click "background page"
   - Look for `[Session Restore] URL-based matching: X tabs restored`

**Possible Causes of Restoration Failure:**
- Edge "Clear browsing data on close" is enabled (deletes extension storage)
- Extension was disabled at `edge://extensions/`
- Tabs closed manually before browser restart (expected behavior)

**Solution:**
1. Verify Edge settings: Ensure "Clear browsing data on close" is OFF
2. Verify extension is enabled at `edge://extensions/`
3. Check that tabs were open when browser was closed

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

**A:** Currently designed for Microsoft Edge, but the code could be adapted for Chrome with minimal changes. Firefox uses different APIs and would require significant modifications.

### Q: Does this work on mobile?

**A:** No, this is a desktop browser extension only. Mobile browsers don't support extensions in the same way.

### Q: Can I backup my sessions?

**A:** Session mappings are stored locally. Currently, there's no export/import feature, but sessions persist as long as the extension is installed.

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

**A:** Version 3.0 focuses on simplicity without manual session management. Each session is automatically managed per tab.

---

## 🎯 Quick Start Checklist

- [ ] Install extension in Microsoft Edge
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

### Version 3.0.2 (Current - 2025-10-25)
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

- **Microsoft Edge:** Chromium-based Edge (version 88+)
- **Chrome:** Compatible with minor modifications
- **Firefox:** Requires significant API changes

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

Sessner – Multi-Session Manager is inspired by SessionBox and similar multi-account management tools, built to provide simple, effective session isolation for Microsoft Edge users.

---

## 📄 License

This extension is provided as-is for personal and educational use. Please review and comply with all applicable website terms of service when using multiple accounts.

---

## 🎉 Enjoy Multi-Session Browsing!

You're all set! Start creating isolated sessions and enjoy the freedom of managing multiple accounts effortlessly.

**Remember:** With great power comes great responsibility - use this tool ethically and in compliance with website policies.

---

**Sessner – Multi-Session Manager v3.0.2**
**Made for Microsoft Edge**
**100% Local, 100% Private**
