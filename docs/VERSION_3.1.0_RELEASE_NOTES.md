# Version 3.1.0 Release Notes

**Release Date:** 2025-10-29
**Type:** Feature Release
**Tier:** Premium/Enterprise

## New Feature: Session Naming/Labeling

Give your sessions custom names for easier identification instead of cryptic session IDs.

### What's New

✅ **Custom Session Names**
- Name sessions like "Work Gmail", "Personal Facebook", "Client A"
- Max 50 characters with emoji support 🎨
- Case-insensitive duplicate prevention
- Automatic validation and sanitization

✅ **Inline Editing (Premium)**
- Double-click session name to edit
- Real-time character counter
- Enter to save, Escape to cancel
- Instant validation feedback

✅ **Enterprise Settings Modal**
- Unified modal for session name + color
- Edit both settings in one place
- Clean, organized interface

✅ **Full Theme Support**
- Automatic light/dark mode adaptation
- Consistent styling across all themes
- Proper contrast and readability

### Tier Access

| Tier | Access |
|------|--------|
| Free | ❌ PRO badge shown, upgrade prompt on edit |
| Premium | ✅ Inline editing (double-click) |
| Enterprise | ✅ Inline editing + Settings modal |

### Technical Details

**Backend:**
- 7 new core functions for session naming
- 3 new API endpoints (setSessionName, getSessionName, clearSessionName)
- Comprehensive validation (max 50 chars, no duplicates, XSS prevention)
- Migration support for existing sessions

**Frontend:**
- Inline editing UI with real-time validation
- Enterprise modal integration
- Character counter with color coding
- Theme-aware styling

**Documentation:**
- Complete API documentation
- Comprehensive testing guide (30+ test scenarios)
- Implementation details
- User experience flows

### Files Modified

- `background.js`: ~350 lines added (backend API)
- `popup.js`: ~530 lines added (UI implementation)
- `popup.html`: ~130 lines added (CSS styling)
- `manifest.json`: Version bump to 3.1.0

### Validation Rules

- ✅ Max 50 characters (emoji-aware)
- ✅ Emojis allowed (e.g., "🎨 Work Gmail")
- ✅ No duplicates (case-insensitive)
- ❌ HTML characters blocked: `< > " ' \``
- ✅ Whitespace trimmed and collapsed
- ✅ Premium/Enterprise tier required

### For Developers

**Complete Documentation:**
- [Session Naming Implementation Guide](features_implementation/06_session_naming.md)
- [API Reference](api.md#session-naming-premiumenterprise---v310)
- [Technical Details](technical.md#session-naming-feature-v310)

**Testing:**
- 30+ test scenarios documented
- Coverage: Backend validation, UI, themes, edge cases
- Status: All tests passed

### Upgrade Path

Free tier users will see:
- PRO badge next to session names
- Upgrade prompt on double-click
- Link to license page for upgrade

Premium/Enterprise users get immediate access to all features.

---

**Previous Version:** 3.0.3
**Current Version:** 3.1.0
**Next Planned:** TBD
