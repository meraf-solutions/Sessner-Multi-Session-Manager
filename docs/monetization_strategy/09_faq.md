# Frequently Asked Questions
## Sessner – Multi-Session Manager Monetization Strategy

**Document Version:** 1.0
**Last Updated:** 2025-10-15

---

## 🤔 Business Model Questions

### Q: Why freemium instead of paid-only?
**A:** Freemium allows users to try before buying, building trust and a user base. Most successful extensions use this model. A generous free tier (3 sessions) lets users validate the value before paying, leading to higher conversion rates than pay-walls.

---

### Q: Is 3 sessions generous enough for free tier?
**A:** Yes. Research shows:
- **Personal use**: 2-3 accounts (work + personal + other) = sufficient
- **Professional use**: 5-20 accounts = requires upgrade
- **Psychology**: 3 feels generous but limited (sweet spot)
- **Competitor**: SessionBox offers 5 free, but we provide better UX

**Recommendation**: Start with 3, monitor feedback, adjust if needed

---

### Q: Why $4.99 instead of $5.99 or $3.99?
**A:** Pricing psychology:
- **$4.99**: Under $5 = "impulse buy" threshold
- **vs. $5.99**: Small difference, but $4.99 feels significantly cheaper
- **vs. $3.99**: Too cheap = may seem low quality
- **vs. $7.99** (SessionBox): Clear competitive advantage
- **Coffee Test**: $4.99/month < 1 coffee/month = easy to justify

**Alternative**: A/B test $4.99 vs $5.99 after launch

---

### Q: Should we offer lifetime licenses?
**A:** **Phase 1 (Launch)**: Yes, limited to first 100 customers at $99-$149
- ✅ Creates urgency and FOMO
- ✅ Immediate cash injection
- ✅ Builds loyal early adopter base
- ✅ Generates testimonials

**Phase 2 (Long-term)**: Transition to subscription-only
- ✅ Recurring revenue more predictable
- ✅ Better for long-term sustainability
- ✅ Easier to forecast growth

**Recommendation**: Launch with lifetime, phase out after 100 sales

---

### Q: What if users share license keys?
**A:** Multi-layered prevention:
1. **Machine limit**: 3 activations per license
2. **Fingerprinting**: Track which machines use license
3. **Online validation**: Regular checks (every 7 days)
4. **Revocation**: Admin can deactivate suspicious licenses
5. **Fair policy**: Don't be overly aggressive, focus on value

**Philosophy**: Make it easier to buy than to pirate

---

### Q: How do we handle refunds?
**A:** **30-Day Money-Back Guarantee**
- No questions asked within 30 days
- Process via payment provider (Stripe/Gumroad)
- Revoke license after refund
- Track refund rate (target: <5%)
- Collect feedback from refunds

**Process**:
1. User requests refund via email
2. Issue refund within 24 hours
3. Revoke license key
4. Ask for feedback (optional)
5. Analyze patterns to improve product

---

## 💰 Pricing Questions

### Q: Should we offer monthly or annual plans?
**A:** **Both**, with strong incentive for annual:
- **Monthly**: $4.99/month ($59.88/year)
- **Annual**: $29.99/year (**50% discount**)

**Why both?**
- Monthly = Lower barrier to entry
- Annual = Better cash flow, higher LTV, lower churn
- 50% discount = Strong incentive to commit

**Expected split**: 30% monthly, 70% annual (after initial months)

---

### Q: What about Premium+ pricing - is $9.99 too expensive?
**A:** **No, it's justified** for target audience:
- **Agencies**: Can expense $10/month easily
- **Teams**: Split cost across users
- **Power users**: Managing 20+ accounts, worth $10/month
- **Developers**: API access alone worth $10/month

**Value justification**:
- Cross-device sync (competitors charge $5+ for this alone)
- Team features (competitors charge $20+/user)
- API access (developers will pay for this)

**Alternative**: Test $7.99 if $9.99 shows low conversion

---

### Q: Should we offer team/bulk licenses?
**A:** **Yes, but Phase 2** (Month 3+):
- Volume discounts (5+ users)
- Centralized billing
- Admin dashboard
- Team analytics

**Pricing example**:
- 5 users: $40/month ($8/user, 20% discount)
- 10 users: $70/month ($7/user, 30% discount)
- 25+ users: Custom pricing

**Wait until**: 100+ Premium users before building team features

---

### Q: What about student/educational discounts?
**A:** **Not initially**. Reasons:
- Free tier (3 sessions) sufficient for students
- Verification overhead not worth it initially
- Students unlikely to need unlimited sessions
- Focus on revenue-generating segments first

**Future**: After reaching $5K MRR, offer 50% student discount

---

## 🛠️ Technical Implementation Questions

### Q: Offline-only or online validation?
**A:** **Start offline, add online later**:

**Phase 1 (Week 1-4)**: Offline only
- Simple format validation
- Basic checksum
- No server required
- Quick to implement
- ✅ **Start here**

**Phase 2 (Month 2+)**: Add online validation
- License server API
- Activation tracking
- Revocation capability
- Usage analytics

**Why staged?**: Ship faster, validate market first, add complexity later

---

### Q: How do we prevent license key sharing?
**A:** Multi-layered approach:

**Technical**:
1. Machine limit (3 devices per license)
2. Browser fingerprinting
3. Online validation every 7 days
4. Detect suspicious patterns

**Policy**:
1. Clear terms of service
2. Fair enforcement (don't be evil)
3. Grace periods for legitimate use
4. Revoke only obvious abuse cases

**Balance**: Don't annoy legitimate users to stop 5% of pirates

---

### Q: What if the license server goes down?
**A:** **Grace period strategy**:
- Last validated: <7 days = No validation needed
- Last validated: 7-30 days = Grace period, show warning
- Last validated: 30+ days = Downgrade to free tier (don't lock out)

**Philosophy**: Failures should degrade gracefully, not break extension

---

### Q: How do we store license keys securely?
**A:** Use `chrome.storage.local` with considerations:
- ✅ Encrypted by Chrome automatically
- ✅ Per-extension isolation
- ✅ Survives browser restarts
- ❌ Not cloud-synced (that's okay)
- ❌ Can be accessed if machine compromised (acceptable risk)

**No need to** over-engineer encryption - Chrome's built-in is sufficient

---

## 🎯 User Experience Questions

### Q: When should we show upgrade prompts?
**A:** **Balance is key**:

**✅ Show prompts when**:
- User hits session limit (blocked action)
- User tries premium feature (contextual)
- User has 3 sessions for 7+ days (power user signal)

**❌ Don't show prompts**:
- On every extension open (annoying)
- More than once per day (pushy)
- During critical workflows (frustrating)

**Best practice**: Show value, not annoyance

---

### Q: Should free users see ads?
**A:** **No.**
- Ads hurt UX significantly
- Extension users hate ads
- Conversion from ads likely minimal
- Focus on freemium conversion instead

**Exception**: Subtle, non-intrusive upgrade CTAs are okay

---

### Q: What if users have more than 3 sessions when we launch limits?
**A:** **Grandfather existing users**:
- Existing sessions are never forcibly closed
- Block creation of NEW sessions beyond limit
- Show friendly message: "You have 5 sessions (limit is 3). Upgrade for unlimited."

**Why**: Never punish existing users for updates

---

### Q: How do we handle downgraded users (expired license)?
**A:** **Graceful degradation**:
1. Premium features become read-only (can't create, can edit existing)
2. Excess sessions remain (can't create new beyond 3)
3. Show "License expired" message with renewal link
4. After 30 days, premium-only sessions become view-only

**Philosophy**: Don't destroy user data, encourage renewal instead

---

## 📊 Business Metrics Questions

### Q: What's a realistic conversion rate?
**A:** **Industry benchmarks**:
- Productivity tools: 2-5%
- Browser extensions: 1-3%
- Freemium SaaS: 2-7%

**Our target**: 2-5% (conservative to optimistic)

**Factors affecting conversion**:
- ✅ Strong free tier value
- ✅ Clear paid tier benefits
- ✅ Low price ($4.99)
- ✅ Good onboarding
- ❌ Niche market (smaller audience)

**Realistic**: Start at 1-2%, optimize to 3-5% over time

---

### Q: What's an acceptable churn rate?
**A:** **Industry benchmarks**:
- SaaS average: 5-7% monthly (50-60% annual)
- Good SaaS: 3-5% monthly (30-40% annual)
- Excellent SaaS: <3% monthly (<30% annual)

**Our target**: 80%+ annual retention (20% churn)

**Why achievable**:
- ✅ Sticky use case (daily workflow)
- ✅ Low price (easy to justify)
- ✅ Hard to switch (data lock-in)
- ✅ Regular feature updates

---

### Q: How long until profitability?
**A:** **Depends on goals**:

**Ramen Profitable** ($2K MRR):
- 400 Premium users
- Timeline: 12-18 months
- Covers basic living expenses

**Full-time Viable** ($5K MRR):
- 1,000 Premium users
- Timeline: 18-24 months
- Can work on this exclusively

**Sustainable Business** ($10K+ MRR):
- 2,000+ Premium users
- Timeline: 24-36 months
- Can hire team, scale

**Assumptions**: 2-3% conversion rate, 20% annual churn

---

## 🚀 Launch & Marketing Questions

### Q: Should we do a Product Hunt launch?
**A:** **Absolutely yes.**
- ✅ High-quality audience (tech-savvy early adopters)
- ✅ Significant traffic boost
- ✅ Social proof (upvotes, comments)
- ✅ Press coverage potential
- ✅ Backlinks for SEO

**Best practices**:
- Launch Tuesday-Thursday (highest traffic)
- Prepare demo video and screenshots
- Recruit 5-10 supporters to upvote early
- Engage actively in comments
- Offer launch discount (25% off)

**Expected**: 100-500 installs from PH launch

---

### Q: How do we get initial reviews on Edge Add-ons Store?
**A:** **Ethical strategies**:
1. **Beta testers**: Ask for honest reviews
2. **Early users**: Email asking for feedback (if positive, request review)
3. **Social proof**: Screenshot good reviews, share
4. **Incentive**: Premium trial for leaving review (controversial, check policy)

**Don't**: Buy fake reviews (will get caught)

---

### Q: Should we build a website or just use store listing?
**A:** **Phase 1**: Store listing is enough
- Edge Add-ons Store is the funnel
- Website adds complexity
- Focus on product first

**Phase 2** (Month 3+): Add simple landing page
- Better for SEO
- More professional
- Explain features in depth
- Capture email signups

**Keep it simple**: 1-page site with Pricing, Features, FAQ

---

## 🤝 Support & Community Questions

### Q: How do we handle support for free users?
**A:** **Community-first approach**:
- Documentation & FAQ (self-service)
- Community forum or Discord (peer support)
- Email support (best-effort, 3-5 day response)

**Premium users**:
- Priority email support (24-48 hour response)
- Dedicated support channel
- Feature request priority

**Don't**: Ignore free users (they're potential customers), but prioritize paying customers

---

### Q: Should we build a community (Discord, Forum)?
**A:** **Not initially.**
- Focus on product first
- Community requires active moderation
- Wait until 1,000+ users

**Phase 2** (Month 6+): Launch community when:
- Enough users to sustain discussion
- Time to moderate actively
- Clear community value (support, feedback, features)

---

### Q: How do we collect feedback?
**A:** **Multiple channels**:
1. **In-app**: Feedback button in popup
2. **Email**: surveys to active users
3. **Social**: Monitor Twitter, Reddit mentions
4. **Store**: Read Edge Add-ons Store reviews
5. **Support**: Track common questions

**Use feedback to**: Prioritize features, fix issues, improve UX

---

## ⚖️ Legal & Compliance Questions

### Q: Do we need terms of service and privacy policy?
**A:** **Yes, absolutely.**
- Required by Edge Add-ons Store
- Protects from legal issues
- Builds user trust

**Minimum required**:
1. Privacy Policy (data collection, usage, storage)
2. Terms of Service (usage rules, liability)
3. Refund Policy (30-day guarantee)

**Resources**: Use generator (TermsFeed) or hire lawyer

---

### Q: What about GDPR compliance?
**A:** **Good news**: Extension is local-only
- No data sent to servers (initially)
- No tracking or analytics
- No personal data collected
- GDPR compliance is simple

**If adding server (Phase 2)**:
- Collect only necessary data
- Store in EU if targeting EU
- Provide data export/deletion
- Update privacy policy

---

### Q: Can we use testimonials from beta testers?
**A:** **Yes, with permission**:
- Ask explicitly for permission
- Get written consent
- Allow review before publishing
- Offer to make anonymous if preferred

**Best practice**: "Can we use your feedback as a testimonial? You can review before we publish."

---

## 📝 Decision-Making Framework

### When Uncertain, Ask:
1. **Does this increase value for users?** → Priority 1
2. **Does this generate revenue?** → Priority 2
3. **Is this technically simple?** → Do it sooner
4. **Is this legally risky?** → Consult lawyer
5. **Does data support this?** → Test and measure

### Guiding Principles:
- ✅ User value first, revenue second
- ✅ Ship fast, iterate quickly
- ✅ Simple > complex
- ✅ Transparent > opaque
- ✅ Fair > aggressive

---

## ✅ Final Checklist Before Launch

**Product:**
- [ ] Free tier limits work correctly
- [ ] Premium features unlock properly
- [ ] License activation tested
- [ ] All edge cases handled
- [ ] Performance is good

**Legal:**
- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Refund policy clear
- [ ] Compliance checked

**Marketing:**
- [ ] Store listing optimized
- [ ] Screenshots ready
- [ ] Demo video created
- [ ] Product Hunt prepared
- [ ] Social accounts set up

**Payment:**
- [ ] Payment provider configured
- [ ] Pricing finalized
- [ ] License delivery automated
- [ ] Refund process tested

**Support:**
- [ ] Documentation complete
- [ ] FAQ published
- [ ] Support email set up
- [ ] Response templates ready

---

**Status:** Ready to Answer Questions
**Previous:** [08_marketing_strategy.md](08_marketing_strategy.md) | **Back to:** [01_overview.md](01_overview.md)

---

## 📚 Full Documentation Index

1. [Overview](01_overview.md) - Business model and strategy
2. [Tier Comparison](02_tier_comparison.md) - Feature matrix
3. [Technical Implementation](03_technical_implementation.md) - Code and architecture
4. [Pricing Strategy](04_pricing_strategy.md) - Pricing and projections
5. [UI Mockups](05_ui_mockups.md) - Design specifications
6. [License System](06_license_system.md) - Validation and security
7. [Timeline](07_timeline.md) - 8-week implementation plan
8. [Marketing Strategy](08_marketing_strategy.md) - Go-to-market plan
9. **[FAQ](09_faq.md)** - Questions and answers ← You are here

---

**Ready to build? Start with:** [07_timeline.md](07_timeline.md) for implementation plan

**Have questions? Review:** This FAQ or ask in discussions

**Need clarity? Read:** [01_overview.md](01_overview.md) for big picture
