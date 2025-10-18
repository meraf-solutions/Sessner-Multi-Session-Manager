# UI/UX Design Specifications
## Sessner – Multi-Session Manager Monetization UI

**Document Version:** 1.0
**Last Updated:** 2025-10-15

---

## 🎨 UI Components Overview

This document provides visual specifications for all monetization-related UI components.

---

## 1️⃣ License Info Badge (popup.html)

### Free Tier Display
```
┌────────────────────────────────────────┐
│ 🆓 FREE                    0 / 3 sessions │
│ [Upgrade to Premium ⭐]                │
└────────────────────────────────────────┘
```

**Specifications:**
- Background: `#f9f9f9` (light gray)
- Badge: `FREE` in gray `#666`
- Usage counter: Shows current/max
- Upgrade button: Blue gradient, prominent

### Premium Tier Display
```
┌────────────────────────────────────────┐
│ ⭐ PREMIUM              12 sessions active │
└────────────────────────────────────────┘
```

**Specifications:**
- Background: Light gold `#fff9e6`
- Badge: `PREMIUM` in gold `#f39c12`
- No session limit shown (unlimited)
- No upgrade button

### Enterprise Tier Display
```
┌────────────────────────────────────────┐
│ ✨ ENTERPRISE          27 sessions active │
└────────────────────────────────────────┘
```

**Specifications:**
- Background: Purple tint `#f3e5f5`
- Badge: `ENTERPRISE` in purple `#9c27b0`
- Elite styling

---

## 2️⃣ Session Limit Warning

### When Creating 4th Session (Free Tier)
```
┌──────────────────────────────────────────────┐
│           🚫 Session Limit Reached           │
│                                              │
│  You've hit your 3-session limit on the     │
│  FREE plan.                                  │
│                                              │
│  Upgrade to PREMIUM for unlimited sessions,  │
│  session naming, export/import, and more.    │
│                                              │
│  💰 Just $4.99/month                         │
│  ⏱️ Save 10+ hours every month              │
│                                              │
│  [View Pricing & Upgrade]  [Maybe Later]    │
└──────────────────────────────────────────────┘
```

**Specifications:**
- Modal overlay: Dark semi-transparent `rgba(0,0,0,0.5)`
- Card: White background, rounded `12px`
- Title: Red/orange warning color `#ff6b6b`
- Body: Clear benefits list
- CTA button: Blue gradient, large
- Secondary button: Gray link-style

---

## 3️⃣ Feature-Locked Prompt

### When Trying to Use Premium Feature
```
┌──────────────────────────────────────────────┐
│        🔒 Session Naming is Premium          │
│                                              │
│  Organize your sessions with custom names   │
│  and labels - available in PREMIUM.          │
│                                              │
│  PREMIUM includes:                           │
│  ✅ Unlimited sessions                       │
│  ✅ Session naming & labels                  │
│  ✅ Export/import sessions                   │
│  ✅ Session templates                        │
│  ✅ 12+ badge colors                         │
│  ✅ Permanent storage                        │
│                                              │
│  💎 Upgrade for just $4.99/month            │
│                                              │
│  [Upgrade Now]  [Learn More]                │
└──────────────────────────────────────────────┘
```

**Specifications:**
- Show on feature attempt
- Highlight specific feature benefit
- Show complete Premium feature list
- Clear upgrade path

---

## 4️⃣ Upgrade Modal (upgrade-modal.html)

### Pricing Page Layout
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│            Unlock Unlimited Sessions                         │
│     Upgrade to Premium or Enterprise for powerful features    │
│                                                              │
│  ┌─────────────┐  ┌──────────────────┐  ┌─────────────┐   │
│  │    FREE     │  │ PREMIUM ⭐       │  │  ENTERPRISE   │   │
│  │             │  │ MOST POPULAR     │  │             │   │
│  │    $0       │  │    $4.99/mo      │  │  $9.99/mo   │   │
│  │  forever    │  │ or $29.99/year   │  │ or $59.99/yr│   │
│  │             │  │                  │  │             │   │
│  │ Features:   │  │ Features:        │  │ Features:   │   │
│  │ ✅ 3 sessions│  │ ✅ Unlimited      │  │ ✅ Everything│   │
│  │ ✅ Isolation │  │ ✅ Naming         │  │ ✅ Cross-sync│   │
│  │ ❌ Naming   │  │ ✅ Export/Import  │  │ ✅ Team       │   │
│  │ ❌ Export   │  │ ✅ Templates      │  │ ✅ API access│   │
│  │             │  │                  │  │             │   │
│  │ [Current]   │  │ [Upgrade Now]    │  │ [Upgrade]   │   │
│  └─────────────┘  └──────────────────┘  └─────────────┘   │
│                                                              │
│  Already have a license key?                                │
│  ┌──────────────────────────────────────┐                  │
│  │ SESS-XXXX-XXXX-XXXX-XXXX  [Activate] │                  │
│  └──────────────────────────────────────┘                  │
│                                                              │
│  💯 30-Day Money-Back Guarantee                            │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Specifications:**
- Three-column layout
- Premium card is emphasized (larger, highlighted)
- Clear feature comparison
- Annual discount prominently displayed
- License activation below pricing
- Trust signals (guarantee)

---

## 5️⃣ License Activation Flow

### Step 1: Activation Form
```
┌──────────────────────────────────────┐
│     Activate Your License            │
│                                      │
│  Enter your license key:             │
│  ┌─────────────────────────┐        │
│  │ SESS-XXXX-XXXX-XXXX-XXXX│        │
│  └─────────────────────────┘        │
│                                      │
│  [Activate License]                  │
└──────────────────────────────────────┘
```

### Step 2: Success Message
```
┌──────────────────────────────────────┐
│     ✅ License Activated!            │
│                                      │
│  You now have PREMIUM access with:   │
│  • Unlimited sessions                │
│  • Session naming                    │
│  • Export/import                     │
│  • And more!                         │
│                                      │
│  [Get Started]                       │
└──────────────────────────────────────┘
```

### Step 3: Error Message
```
┌──────────────────────────────────────┐
│     ❌ Activation Failed             │
│                                      │
│  Invalid license key format.         │
│  Please check and try again.         │
│                                      │
│  Need help? support@example.com      │
│                                      │
│  [Try Again]                         │
└──────────────────────────────────────┘
```

---

## 6️⃣ Usage Statistics Display

### Free Tier Stats
```
┌────────────────────────────────────┐
│  Your Usage (FREE)                 │
│                                    │
│  Sessions: 3 / 3 (at limit)       │
│  Total created: 47                 │
│  Most used: gmail.com              │
│                                    │
│  💡 Upgrade for unlimited sessions │
│  [View Pricing]                    │
└────────────────────────────────────┘
```

### Premium Tier Stats
```
┌────────────────────────────────────┐
│  Your Usage (PREMIUM ⭐)           │
│                                    │
│  Active sessions: 12               │
│  Total created: 247                │
│  Time saved: ~15 hours this month  │
│  Most productive: Weekdays 10am    │
│                                    │
│  📊 Advanced analytics available   │
│  in Enterprise                       │
└────────────────────────────────────┘
```

---

## 7️⃣ Upgrade CTA Variations

### Inline CTA (Subtle)
```
💎 Need more sessions? [Upgrade to Premium]
```

### Banner CTA (Prominent)
```
┌────────────────────────────────────────────┐
│ 🚀 Unlock Unlimited Sessions for $4.99/mo │
│ [Get Premium Now] [Learn More]            │
└────────────────────────────────────────────┘
```

### Dropdown CTA
```
┌─────────────────────────┐
│ ⚡ Quick Actions        │
│ • New Session           │
│ • Export Sessions       │
│ • Import Sessions       │
│ ─────────────────────   │
│ 💎 Upgrade to Premium   │
└─────────────────────────┘
```

---

## 8️⃣ Session Context Menu (Right-Click)

### Free Tier Menu
```
┌──────────────────────┐
│ Rename Session 🔒    │ ← Locked
│ Duplicate Session    │
│ Close Session        │
│ ──────────────────   │
│ Export Session 🔒    │ ← Locked
│ ──────────────────   │
│ Upgrade to Premium   │
└──────────────────────┘
```

### Premium Tier Menu
```
┌──────────────────────┐
│ Rename Session ✅    │ ← Unlocked
│ Duplicate Session    │
│ Close Session        │
│ ──────────────────   │
│ Export Session ✅    │ ← Unlocked
│ Create Template      │
│ ──────────────────   │
│ Session Settings     │
└──────────────────────┘
```

---

## 🎨 Color Palette

### Tier Colors
- **Free**: Gray `#666666`
- **Premium**: Gold `#f39c12`
- **Enterprise**: Purple `#9c27b0`

### UI Colors
- **Primary**: Blue `#1ea7e8`
- **Success**: Green `#28a745`
- **Warning**: Orange `#ff9800`
- **Error**: Red `#dc3545`
- **Background**: Light gray `#f5f5f5`

### Gradients
- **Primary**: `linear-gradient(135deg, #1ea7e8 0%, #0066cc 100%)`
- **Premium**: `linear-gradient(135deg, #f39c12 0%, #e67e22 100%)`
- **Enterprise**: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)`

---

## 📱 Responsive Considerations

### Mobile View (< 600px)
- Stack pricing cards vertically
- Full-width buttons
- Larger touch targets (44px min)
- Simplified animations

### Tablet View (600-900px)
- Two-column pricing layout
- Maintain readability
- Responsive typography

### Desktop View (> 900px)
- Three-column pricing layout
- Hover effects and animations
- Optimal spacing

---

## ♿ Accessibility

### Requirements
- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ Color contrast ratio > 4.5:1
- ✅ Focus indicators visible
- ✅ Alt text for all images
- ✅ ARIA labels where needed

### Example
```html
<button
  class="upgrade-btn"
  aria-label="Upgrade to Premium plan for unlimited sessions"
  role="button"
  tabindex="0"
>
  Upgrade to Premium
</button>
```

---

## 🔔 Notification Styles

### Success Notification
```
┌────────────────────────────────────┐
│ ✅ License activated successfully! │
└────────────────────────────────────┘
```

### Error Notification
```
┌────────────────────────────────────┐
│ ❌ Failed to create session         │
└────────────────────────────────────┘
```

### Info Notification
```
┌────────────────────────────────────┐
│ ℹ️ Session will expire in 2 days   │
└────────────────────────────────────┘
```

---

## 🎯 UI Implementation Checklist

- [ ] License badge component in popup
- [ ] Session limit warning modal
- [ ] Feature-locked prompts
- [ ] Full upgrade/pricing page
- [ ] License activation form
- [ ] Success/error states
- [ ] Usage statistics display
- [ ] Inline upgrade CTAs
- [ ] Context menu lock indicators
- [ ] Notification system
- [ ] Responsive design
- [ ] Accessibility compliance

---

**Status:** Ready for Implementation
**Previous:** [04_pricing_strategy.md](04_pricing_strategy.md) | **Next:** [06_license_system.md](06_license_system.md)
