# Testing the Dynamic Favicon Feature

## Step 1: Reload the Extension

Since we made changes to the code, you need to reload the extension:

1. Go to `edge://extensions/`
2. Find "Sessner – Multi-Session Manager"
3. Click the **Reload** button (circular arrow icon)

## Step 2: Create Test Sessions

1. Click the extension icon in the toolbar
2. Click "New Session" button
3. In the new tab, navigate to a website (e.g., https://www.google.com)
4. Repeat: Create another session and navigate to a different site

## Step 3: Check Console Logs

**IMPORTANT**: You need to check the **page console** (not background console):

1. Go to one of your session tabs
2. Press `F12` to open DevTools
3. Go to the **Console** tab
4. You should see logs like:
   ```
   [Favicon] Script loaded
   [Favicon] Starting initialization...
   [Favicon] Init attempt 1 of 6
   [Favicon] Requesting session ID from background...
   [Favicon] Session ID response: {success: true, sessionId: "session_..."}
   [Favicon] Got session ID: session_...
   [Favicon] Session color response: {success: true, color: "#FF6B6B"}
   [Favicon] ✓ Got session color: #FF6B6B
   [Favicon] Session found, initializing...
   [Favicon] Initializing dynamic favicon overlay...
   [Favicon] Original favicon URL: https://...
   [Favicon] Original favicon loaded, creating badged version
   [Favicon] ✓ Badged favicon applied
   ```

## Step 4: Check the Favicon

Look at the **browser tab** (at the top):
- You should see the site's favicon with a small colored circle in the bottom-right corner
- The circle color should match the extension badge indicator (●)

## Troubleshooting

### If you don't see any `[Favicon]` logs:

1. **Check manifest.json**: Make sure `content-script-favicon.js` is listed
2. **Reload extension**: Go to `edge://extensions/` and click Reload
3. **Close and reopen tabs**: Close the session tabs and create new sessions
4. **Check for errors**: Look for red error messages in the console

### If you see logs but no badge on favicon:

1. **Check for errors**: Look for any error messages after the `[Favicon]` logs
2. **Check the color**: Make sure the session color is valid (should be hex like `#FF6B6B`)
3. **Try different sites**: Some sites may have CORS restrictions
4. **Look for fallback**: If CORS blocked, you should see a solid colored circle as the favicon

### Common Issues:

**Issue**: `[Favicon] Script loaded` doesn't appear
- **Solution**: Extension not reloaded. Go to `edge://extensions/` and click Reload

**Issue**: `[Favicon] Tab has no session, skipping`
- **Solution**: Tab was not created via "New Session" button. Create a proper session.

**Issue**: `[Favicon] Failed to get session color`
- **Solution**: Background script issue. Check background console for errors.

**Issue**: Favicon loads but error occurs
- **Solution**: Check the specific error message in console for details

## Expected Result

✅ **Success**: Each session tab shows the site's favicon with a colored badge matching the session color

❌ **Failure**: No badge appears, or errors in console

## Share Results

Please share:
1. Screenshot of the browser tabs showing (or not showing) the badged favicons
2. Console logs from the page (especially any errors)
3. Let me know which websites you tested with

This will help me identify and fix any issues!
