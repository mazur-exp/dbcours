# User Journey Documentation

## Journey Overview

This document maps the complete user experience from first landing on the site through becoming a paying customer and engaged community member.

---

## Journey Stage 1: Discovery & Landing

### Entry Points

**Organic Search:**
- Keywords: "Bali delivery optimization," "GoFood tips," "GrabFood Bali guide"
- Landing: Home page or specific blog posts
- Intent: Problem-aware, seeking solutions

**Social Media:**
- Sources: Instagram, Facebook groups (Bali F&B owners), LinkedIn
- Content: Free lesson previews, case study snippets, platform update posts
- Landing: Home page with campaign tracking parameters

**Direct Referral:**
- Source: Existing students, Bali F&B community word-of-mouth
- Landing: Home page or /freecontent (if referrer shared direct link)
- Intent: High trust, pre-qualified

**Paid Advertising:**
- Channels: Facebook/Instagram ads to Bali business owners
- Creative: Pain point messaging ("Losing money on delivery?")
- Landing: Home page with specific campaign tracking

### Home Page Experience (Non-Authenticated User)

**Visual First Impression:**
- Hero section: Gradient background (green-blue-purple), professional food delivery imagery
- Headline: "Master Bali Food Delivery: Save $3,000 in First-Year Mistakes"
- Subheadline: "Comprehensive GoFood & GrabFood optimization course for foreign F&B owners"

**Above-the-Fold Elements:**
- Primary CTA: "Start Free Mini-Course" (green button, prominent)
- Secondary CTA: "View Pricing" (link to pricing section lower on page)
- Trust indicators: "12 Free Lessons • Lifetime Access • 14-Day Money-Back Guarantee"
- Auth button: Green "Авторизация" in top-right nav (not emphasized yet)

**Scrolling Experience:**

**Section 1: Pain Points (Problem Agitation)**
- "Struggling with these delivery challenges?"
  - ❌ Wasting $500+/month on ineffective ads
  - ❌ Confused by 20-36% commission structures
  - ❌ Can't figure out why competitors rank higher
  - ❌ Low ratings and cancellations hurting visibility
  - ❌ No idea if delivery is actually profitable

**Section 2: Solution Preview**
- "What you'll learn in the free mini-course:"
  - ✓ Bali delivery market dynamics and opportunities
  - ✓ Account setup secrets and life hacks
  - ✓ Menu SEO and photo optimization
  - ✓ Pricing strategies that work with algorithms
  - ✓ Advertising basics and ROI fundamentals
- CTA: "Get Free Access Now"

**Section 3: Social Proof**
- Student testimonials with photos/names/restaurant names
- "Increased delivery revenue by 40% in 2 months" - Carlo, Seminyak
- "Finally understand how to price profitably" - Marina, Canggu
- Star ratings, logos of well-known Bali restaurants

**Section 4: Free vs. Paid Preview**
- Side-by-side comparison:
  - Free Mini-Course: 12 lessons, templates, community
  - Paid Full Course: 5 modules (8 hours), workshops, support, calculators
- CTA: "Start with Free Course" (emphasizes no-risk entry)

**Section 5: Instructor Credibility**
- Bio with photo
- Credentials: Years on Bali, restaurants operated, delivery revenue optimized
- "I made all the expensive mistakes so you don't have to"

**Section 6: Final CTA**
- "Ready to stop wasting money on delivery?"
- CTA Button: "Access Free Mini-Course"
- Fine print: "No credit card required. Telegram auth only."

**User Psychology:**
- Risk reversal: Free entry point removes purchase friction
- Curiosity: "What are the secrets I'm missing?"
- FOMO: "Competitors are already doing this"
- Urgency: "Every day without optimization is money lost"

**Exit Intent Behavior:**
- Popup (if user moves to close tab): "Wait! Get the first 3 lessons free"
- Email capture for abandoned visitors (optional, not currently implemented)

---

## Journey Stage 2: Free Course Exploration (Pre-Authentication)

### Landing on /freecontent

**Page Elements:**
- Breadcrumb: Home > Free Content
- Headline: "Free Mini-Course: 12 Lessons on Bali Delivery Mastery"
- Subheadline: "Build foundation knowledge before diving into the full course"
- Auth status: Top nav shows green "Авторизация" button (user NOT logged in)

**Lesson List Display:**
- Grid layout (3 columns on desktop, 1 on mobile)
- 12 lesson cards, each showing:
  - Lesson number badge (01-12) with green gradient
  - Emoji icon representing lesson topic
  - Lesson title
  - Brief description (2-3 sentences)
  - "View Lesson" button (green)
  - Hover effect: Shadow grows, border highlights

**Example Card:**
```
┌─────────────────────────────────┐
│  [01] 🎯                        │
│  Introduction: Why Delivery     │
│  and How We Got Here           │
│                                 │
│  Understand the explosion of   │
│  food delivery in Bali and why │
│  traditional marketing is dead.│
│                                 │
│  [View Lesson]                  │
└─────────────────────────────────┘
```

**User Action: Clicks on Any Lesson**

**Expected Behavior:**
- User clicks "View Lesson" on Lesson 01 (or any lesson)
- Browser navigates to `/free_content/lessons/01-introduction-why-delivery`
- **TRIGGER: Authentication Check**

---

## Journey Stage 3: Authentication Trigger & Modal

### Lesson Page Load (Unauthenticated)

**What User Sees:**
1. Page begins to load:
   - Title appears: "Lesson 1: Introduction - Why Delivery and How We Got Here"
   - Breadcrumb: Home > Free Content > Lesson 01
   - Sidebar navigation appears (desktop)

2. **Content Protection Activates (JavaScript):**
   - `checkAuthOnPageLoad()` function runs
   - Detects `#lesson-content-blur` element exists
   - Checks `data-authenticated="false"` on auth button
   - **Applies `blur-md` class to content**
   - **Shows authentication modal**

**Visual Effect:**
- Main content area (intro card, markdown, key takeaways) goes blurry (8px blur)
- Navigation, header, footer remain clear
- Modal window appears in center of screen with semi-transparent dark overlay

### Authentication Modal Experience

**Modal Design:**
- Fixed position, centered on screen
- White rounded card (rounded-2xl) with shadow
- Overlay: `bg-black/30` (30% black, allows seeing blurred content behind)
- Close button (X) in top-right corner

**Modal Content:**
```
┌───────────────────────────────────────┐
│  🔒                            [X]    │
│                                       │
│  Авторизуйтесь через Telegram         │
│                                       │
│  Для доступа к бесплатным урокам      │
│  необходимо авторизоваться через      │
│  Telegram. Это быстро и безопасно.    │
│                                       │
│  ┌───────────────────────────────┐   │
│  │ 🔐 Войти через Telegram       │   │
│  └───────────────────────────────┘   │
│                                       │
│  Зачем это нужно?                     │
│  • Защита контента                    │
│  • Персонализация обучения            │
│  • Доступ к сообществу                │
└───────────────────────────────────────┘
```

**Translation:**
- Heading: "Authorize via Telegram"
- Body: "To access free lessons, you must authorize via Telegram. It's fast and secure."
- Button: "🔐 Login via Telegram"
- Why section:
  - Content protection
  - Personalized learning
  - Community access

**User Options:**

**Option 1: Click "Login via Telegram"**
- Proceeds to authentication flow (see Journey Stage 4)

**Option 2: Click Close (X) Button**
- Modal closes
- User redirected to `/freecontent` (lesson list page)
- Remains unauthenticated
- Blur effect removed (user back at lesson list)

**Option 3: Click Outside Modal (on overlay)**
- Currently: No action (modal stays open)
- Alternative (not implemented): Same as close button

**User Psychology:**
- **Curiosity:** Content is visible but blurred, tantalizing
- **Low friction:** "Fast and secure," not asking for email/password
- **Trust:** Telegram = familiar, modern, privacy-focused
- **FOMO:** "I can almost read this, just need to click one button"

---

## Journey Stage 4: Telegram Authentication Flow

### Authentication Initiation

**User Action: Clicks "Login via Telegram" in Modal**

**Technical Flow:**

**Step 1: Generate Session Token**
- JavaScript `startAuth()` function fires
- POST request to `/auth/telegram/start`
- Server generates unique `session_token` (32-character hex string)
- Server stores in session: `session[:auth_token]` and `session[:auth_started_at]`
- Server returns JSON:
  ```json
  {
    "success": true,
    "deep_link": "https://t.me/dbcourse_auth_bot?start={session_token}",
    "session_token": "abc123...xyz789"
  }
  ```

**Step 2: Environment Detection**
- JavaScript detects user's environment:
  - **Desktop Browser:** Standard Chrome, Firefox, Safari on Mac/Windows
  - **Telegram WebView:** In-app browser within Telegram app
  - **Mobile Browser:** Safari on iOS, Chrome on Android

**Step 3A: Desktop Browser Flow**

**What Happens:**
1. `window.open(deep_link, '_blank')` opens bot in new tab/window
2. User sees Telegram web interface: "Open in Telegram app?"
3. User clicks "Open" → Telegram desktop app launches (if installed)
4. OR user continues in browser → Telegram web interface

**Meanwhile, in Original Tab:**
- Modal updates: "Waiting for authorization..."
- Spinner icon appears
- WebSocket connection established immediately:
  ```javascript
  cable.subscriptions.create({
    channel: "AuthChannel",
    session_token: "abc123...xyz789"
  })
  ```
- Waiting for broadcast from server

**In Telegram App/Web:**
- Bot conversation opens
- User sees message from @dbcourse_auth_bot:
  ```
  Добро пожаловать! 👋

  Нажмите кнопку ниже, чтобы авторизоваться на платформе.

  [✅ Войти в систему]  <-- Inline button
  ```
- User clicks "✅ Войти в систему" button

**Server Receives Callback:**
- Telegram sends callback query: `auth:{session_token}`
- Server extracts `session_token` from callback data
- Server finds or creates User record:
  ```ruby
  user = User.find_or_create_by(telegram_id: callback.from.id) do |u|
    u.username = callback.from.username
    u.first_name = callback.from.first_name
    u.last_name = callback.from.last_name
  end
  ```
- Server updates user:
  ```ruby
  user.update(
    session_token: session_token,
    authenticated: true
  )
  ```
- Server broadcasts via ActionCable:
  ```ruby
  ActionCable.server.broadcast(
    "auth_channel_#{session_token}",
    {
      type: 'authentication_success',
      user_id: user.id,
      username: user.username,
      first_name: user.first_name
    }
  )
  ```

**Back in Original Browser Tab:**
- WebSocket receives broadcast
- JavaScript `handleAuthSuccess()` function fires:
  - Stores user data in session
  - Updates modal: "Успешно авторизован! Перенаправление..."
  - After 1 second: `window.location.reload()`
  - Page reloads, now with `session[:user_id]` set

**Step 3B: Telegram WebView Flow**

**Unique Challenge:**
- Telegram in-app browser blocks `window.open()` and `target="_blank"`
- User is already inside Telegram, so different approach needed

**What Happens:**
1. JavaScript detects `window.Telegram.WebApp` or `window.TelegramWebviewProxy`
2. Creates invisible `<a>` element with `deep_link`, NO target attribute:
   ```javascript
   const link = document.createElement('a');
   link.href = deep_link;
   // NO target="_blank" - Telegram intercepts naturally
   link.click();
   ```
3. Telegram app intercepts link click, opens bot conversation natively
4. User leaves WebView (browser tab goes to background)

**Meanwhile:**
- NO WebSocket connection established yet (would be lost anyway)
- JavaScript listens for `visibilitychange` event:
  ```javascript
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // User returned from bot to WebView
      checkTokenViaAPI();
    }
  });
  ```

**In Telegram Bot:**
- Same as desktop: User sees welcome message, clicks "✅ Войти" button
- Server processes callback, creates/updates User, sets session_token

**User Returns to WebView:**
- User taps "Back to App" or closes bot conversation
- WebView tab comes to foreground
- `visibilitychange` event fires
- JavaScript immediately calls `GET /auth/check_token?session_token=abc123...xyz789`

**Server Response:**
```json
{
  "authenticated": true,
  "user_id": 42,
  "user": {
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Client Action:**
- If `authenticated: true`: Call `handleAuthSuccess()`, reload page
- If `authenticated: false`: Subscribe to WebSocket as fallback, keep waiting

**Step 3C: Mobile Browser Flow (Safari iOS, Chrome Android)**

**Unique Challenge:**
- Opening Telegram app switches away from browser
- Browser tab goes to background (loses WebSocket connection)

**What Happens:**
1. JavaScript detects mobile device (user agent regex)
2. Creates `<a>` element with `deep_link` AND `target="_blank"`:
   ```javascript
   const link = document.createElement('a');
   link.href = deep_link;
   link.target = '_blank';  // Required on mobile to trigger app switch
   link.click();
   ```
3. Mobile OS intercepts `t.me` link, prompts: "Open in Telegram?"
4. User confirms → Telegram app opens
5. Browser tab remains in background

**Meanwhile:**
- Same as Telegram WebView: Listen for `visibilitychange`
- When user returns to browser (swipes back from Telegram):
  - `visibilitychange` fires
  - Immediately check auth via API: `GET /auth/check_token`
  - If authenticated → reload page
  - If not → subscribe to WebSocket as fallback

**Why This Approach:**
- **Immediate feedback:** API check faster than WebSocket reconnection
- **Reliability:** Works even if WebSocket connection dropped
- **UX:** User sees success quickly (no "Waiting..." spinner for 5+ seconds)

### Authentication Success Experience

**Page Reload After Auth:**
- Browser reloads lesson page: `/free_content/lessons/01-introduction-why-delivery`
- Server detects `session[:user_id]` is set
- Server sets `@current_user` instance variable
- **Auth button renders differently:**

**Before (Unauthenticated):**
```html
<button class="bg-green-500 hover:bg-green-600 text-white ...">
  ✓ Авторизация
</button>
```

**After (Authenticated):**
```html
<button class="bg-blue-500 hover:bg-blue-600 text-white ...">
  👤 John  <!-- User's first_name -->
</button>
<button class="bg-red-500 hover:bg-red-600 text-white ...">
  Logout
</button>
```

**Content Protection Removed:**
- `checkAuthOnPageLoad()` runs again
- Detects `data-authenticated="true"` on button
- **DOES NOT** apply blur or show modal
- User sees full lesson content, clear and accessible

**User Can Now:**
- Read full lesson content (markdown, images, examples)
- Navigate between all 12 free lessons without interruption
- Access downloadable templates (if linked in lessons)
- Join community (if implemented)

---

## Journey Stage 5: Free Course Engagement (Authenticated)

### Lesson Consumption Experience

**Lesson Page Layout (Desktop):**

**Left Sidebar (Sticky):**
- "Free Mini-Course" heading
- List of all 12 lessons:
  - Current lesson highlighted (green background)
  - Other lessons: Gray background, clickable
  - Lesson numbers, emojis, titles
  - Progress indicator: "Lesson 3 of 12"

**Main Content Area:**
- Breadcrumb: Home > Free Content > Lesson 03
- Lesson title (large, bold)
- Intro card (colored background, summary of lesson)
- **Markdown content:**
  - Formatted text with headings, bullets, bold/italic
  - Embedded images (if any)
  - Code blocks (if any)
  - Links to resources
- **Key Takeaways card:**
  - Checklist-style bullets
  - Action items for student
- **Navigation:**
  - Bottom of page: "← Previous Lesson" | "Next Lesson →"

**Mobile Layout:**
- No sidebar
- Collapsible `<details>` dropdown at top:
  - "All Lessons (3 of 12)" clickable to expand
  - Shows full lesson list when open
  - Current lesson highlighted
- Same main content as desktop
- Stacked navigation buttons (full-width)

**Progression Pattern:**

**Lesson 1-2: Foundation**
- User learns basic concepts
- Gets excited about possibilities
- Builds trust in instructor's expertise

**Lesson 3-5: Quick Wins**
- Menu SEO, photo optimization, target audience
- User can implement immediately
- Sees small results → motivates continuation

**Lesson 6-8: Complexity Revelation**
- Pricing algorithms, ad types, ROI calculation
- User realizes: "This is deeper than I thought"
- **FIRST EXPLICIT CONVERSION CTA:**
  - End of Lesson 8: "Want to master profitability calculation? The full course includes a complete margin calculator and pricing framework. Learn more →"

**Lesson 9-11: Advanced Topics**
- Advertising, account managers, ratings
- User feels overwhelmed with variables
- **STRONGER CONVERSION CTAS:**
  - Lesson 9: "Struggling with ad ROI? Full course Module 2 is a complete advertising masterclass with campaign templates. Upgrade now →"
  - Lesson 11: "Protecting your rating is critical. Full course includes review management SOPs and recovery playbooks. Join here →"

**Lesson 12: Final Invitation**
- FAQ format addresses objections
- Case studies show what's possible
- **FINAL CTA (most explicit):**
  - "You've completed the free foundation. Ready to implement and scale? Join 200+ Bali F&B owners in the full course. View pricing and enroll →"
  - Special offer: "Free course completers get 10% off. Use code: FREECOMPLETE"

### Conversion Touchpoints Throughout Free Course

**In-Lesson CTAs:**
- Subtle text links: "Learn more in the full course"
- Banner at top of lessons 8-12: "Upgrade to access 8 hours of implementation training"
- Sticky footer bar (optional, not yet implemented): "Ready to go deeper? View course options"

**Email/Telegram Drip (if implemented):**
- Day 0 (auth): Welcome, encourage starting Lesson 1
- Day 3: Check-in, "How's it going? Any questions?"
- Day 7: Value reminder, "You're halfway through! Don't stop now"
- Day 14: Completion nudge, "Almost done! Lesson 12 awaits"
- Day 21 (post-completion): "What's next? See how full course can 10x your results"
- Day 30: Final offer, "Limited-time discount for free course graduates"

**Community Engagement (if implemented):**
- Telegram group for free course students
- Peer discussions, questions, wins
- Instructor occasional pop-ins with tips
- Cross-sell: "VIP students get private support. Learn more"

---

## Journey Stage 6: Purchase Decision

### Triggering Events (What Makes User Click "Buy")

**Pain Re-Activation:**
- User tries to implement free course tactics, hits roadblocks
- "I don't understand commission calculation" → Module 1 addresses this
- "My ads are losing money" → Module 2 teaches ROI optimization
- "I can't rank higher" → Module 3 decodes algorithms

**Comparison Shopping:**
- User searches for alternatives: Bali F&B consultants, other courses
- Discovers: Consultants charge $200-500/hour, generic courses don't cover GoFood/GrabFood
- Realizes: This course is best (only) option for niche need

**Social Proof:**
- Testimonials on sales page: "Increased revenue 40% in 2 months"
- Case studies in Lesson 12: Real numbers, real restaurants
- Community buzz (if implemented): Seeing other students' wins

**Urgency/Scarcity (if implemented):**
- "VIP tier: Only 5 spots left this month"
- "Price increase in 7 days"
- "Bonus: Early access to new module (limited time)"

### Navigating to Pricing Page

**Entry Points:**
- Free course lesson CTAs → Direct link to pricing
- Home page "View Pricing" button
- Nav menu: "Pricing" or "Enroll" link
- End of Lesson 12: Big green button "View Course Options"

### Pricing Page Experience

**Headline:**
"Choose Your Learning Path: From Self-Paced to Done-With-You"

**Subheadline:**
"All tiers include lifetime access, free updates, and 14-day money-back guarantee"

**Three-Column Comparison:**

| Feature | Basic ₽12K | Accelerator ₽38K ⭐ | VIP ₽120K |
|---------|-----------|---------------------|-----------|
| 5 Core Modules (8h video) | ✓ | ✓ | ✓ |
| Templates & Calculators | ✓ | ✓ | ✓ |
| Community Access | ✓ | ✓ | ✓ |
| **3 Live Workshops** | ✗ | ✓ | ✓ |
| **2 Group Q&A Sessions** | ✗ | ✓ | ✓ |
| **60-Day Direct Support** | ✗ | ✓ | ✓ |
| **3 Private 1-on-1 Sessions** | ✗ | ✗ | ✓ |
| **Personalized Audit** | ✗ | ✗ | ✓ |
| **Hands-On Implementation** | ✗ | ✗ | ✓ |
| Price | $149 | $497 | $1,497 |
| Best For | DIY learners | Growth-focused operators | High-revenue, time-constrained |
| **CTA Button** | Enroll Now | **Most Popular** - Enroll Now | Limited Spots - Enroll Now |

**Visual Design:**
- **Accelerator tier:** Highlighted with green border, "Most Popular" badge
- **VIP tier:** Gold/premium visual treatment, "Exclusive" badge
- **Basic tier:** Standard styling (acts as decoy)

**Below Comparison Table:**

**FAQ Section:**
- "What if I want to upgrade later?" → Pay difference, keep progress
- "What's the refund policy?" → 14-day money-back, no questions asked
- "How long do I have access?" → Lifetime + free updates
- "Are workshops recorded?" → Yes, if you miss live session
- "What's included in 1-on-1 sessions?" → Personalized strategy, implementation support
- "Do you offer payment plans?" → Not yet (add to roadmap)

**Social Proof Section:**
- Student testimonials specific to each tier:
  - Basic: "Perfect for getting started on my own"
  - Accelerator: "Workshops were game-changers, support helped me implement fast"
  - VIP: "1-on-1 sessions saved me months, ROI in first 30 days"

**Final CTA:**
"Ready to transform your delivery operations? Choose your tier above."

**Trust Indicators:**
- 🔒 Secure payment (Stripe)
- ✓ 200+ students enrolled
- ⭐ 4.9/5 average rating
- 💰 14-day money-back guarantee

### Checkout Process (Not Yet Implemented - Planned)

**Step 1: Tier Selection**
- User clicks "Enroll Now" on chosen tier
- Redirected to `/checkout?tier=accelerator`

**Step 2: Account Confirmation**
- "You're logged in as John (@johndoe)"
- "Course will be linked to this Telegram account"
- Option to logout and use different account (edge case)

**Step 3: Payment Details**
- Stripe checkout embed (or hosted page)
- Fields: Name, email (pre-filled from Telegram if available), card details
- Currency toggle: ₽ (RUB) or $ (USD)
- Apply discount code field: "FREECOMPLETE" for 10% off

**Step 4: Order Summary**
- Tier: Accelerator
- Price: ₽38,000 (or $497)
- Discount: -₽3,800 (if code applied)
- **Total: ₽34,200**
- Payment button: "Complete Purchase"

**Step 5: Processing**
- Spinner: "Processing payment..."
- Stripe handles card processing

**Step 6: Success**
- Redirect to `/welcome` or `/dashboard`
- "Thank you! You're enrolled in Accelerator tier"
- Next steps:
  1. Check email for login credentials (if not using existing auth)
  2. Access Module 1 immediately
  3. Join community (Telegram group invite)
  4. Workshop calendar links sent via email
- CTA: "Start Module 1 Now"

**Step 7: Access Granted**
- User record updated: `enrolled: true`, `tier: 'accelerator'`, `enrolled_at: Time.now`
- Nav menu changes: "Dashboard" link appears
- Access to all paid content unlocked

---

## Journey Stage 7: Paid Course Engagement

### Dashboard Experience (Post-Purchase)

**Dashboard Layout:**
- Welcome message: "Welcome back, John!"
- Progress overview:
  - Modules completed: 2/5
  - Next up: Module 3 - Visibility & Ranking Secrets
  - Overall progress bar: 40%
- Quick links:
  - Resume where you left off → Module 3, Lesson 1
  - Upcoming workshops (Accelerator/VIP only)
  - Community → Telegram group
  - Support (Accelerator/VIP only) → Contact instructor
  - Templates & Downloads → Resource library

**Module Navigation:**
- 5 module cards, each showing:
  - Module number and title
  - Lesson count (e.g., "6 lessons, 2h")
  - Completion status (0/6, 3/6, 6/6 with checkmark)
  - "Start" or "Continue" button
- Visual: Green checkmarks on completed modules

**Lesson Playback:**
- Video player (Vimeo or similar, DRM-protected)
- Lesson notes below video (markdown)
- Downloadable resources (templates, worksheets)
- Comment section (if implemented): Ask questions, peer discussion
- Navigation: "Previous Lesson" | "Mark Complete" | "Next Lesson"

**Completion Tracking:**
- Each lesson has "Mark Complete" checkbox
- Progress saves automatically
- Completion triggers:
  - Confetti animation (optional)
  - "Next lesson unlocked" message (if using drip schedule - not currently)
  - Certificate upon 100% completion

### Workshop Experience (Accelerator/VIP Only)

**Scheduling:**
- Workshops scheduled monthly (3 total over 3 months)
- Calendar invites sent via email with Zoom link
- Reminders: 1 week before, 1 day before, 1 hour before

**Live Workshop:**
- Zoom session, 2 hours
- Instructor screen-shares walkthrough (e.g., Menu optimization deep dive)
- Interactive: Students share screens, ask questions
- Breakout rooms (if large group): Small group exercises
- Recording available 24h later for those who missed

**Post-Workshop:**
- Recording added to dashboard: "Workshop Replays" section
- Slide deck and resources downloadable
- Homework assignment (optional): Implement one tactic before next workshop

### Q&A Sessions (Accelerator/VIP Only)

**Format:**
- Live Zoom call, 90 minutes
- Scheduled bi-weekly or monthly
- Open floor: Students ask anything
- Instructor prioritizes questions submitted in advance (Google Form)

**Topics Covered:**
- Platform updates (algorithm changes, new features)
- Troubleshooting (my ranking dropped, what happened?)
- Advanced tactics (beyond course material)
- Guest speakers (account managers, successful operators)

### Direct Support (Accelerator/VIP: 60 Days)

**Channel:**
- Private Telegram group: Instructor + Student(s)
- OR individual DMs to instructor

**Response Time:**
- Accelerator: 48-hour response guarantee
- VIP: 24-hour response guarantee

**Support Scope:**
- Questions about course material
- Implementation troubleshooting
- Account review (basic for Accelerator, deep audit for VIP)
- Strategy recommendations
- **NOT included:** Unlimited consulting (boundary set at 60 days)

**After 60 Days:**
- Support transitions to community (peer support)
- Instructor occasional pop-ins in community
- Optional: Purchase extended support package (future upsell)

### Private 1-on-1 Sessions (VIP Only)

**Session 1: Strategy Planning (Week 1-2 post-enrollment)**
- 90-minute video call
- Agenda:
  - Current state assessment: Menu, pricing, ad spend, rankings
  - Goal setting: Revenue targets, timeline
  - Custom strategy roadmap: Prioritized action items
- Deliverable: Written strategy document (Google Doc)

**Session 2: Mid-Implementation Review (Week 6-8)**
- 90-minute call
- Agenda:
  - Progress review: What's working, what's not
  - Troubleshooting: Obstacles, questions
  - Optimization: Refine tactics based on results
- Deliverable: Updated action plan

**Session 3: Final Audit & Scaling Roadmap (Week 10-12)**
- 90-minute call
- Agenda:
  - Comprehensive audit: Account settings, menu, ads, operations
  - Results review: Revenue impact, ROI calculation
  - Scaling plan: Next 6-12 months, multi-location considerations
- Deliverable: Final audit report + scaling roadmap PDF

**Scheduling:**
- VIP students book via Calendly link (sent post-enrollment)
- Flexible scheduling within 90-day window

---

## Journey Stage 8: Community & Retention

### Community Platforms (Planned/Partial Implementation)

**Telegram Group:**
- Private group for paid students
- Channels:
  - #general: Introductions, off-topic
  - #wins: Share successes, celebrate milestones
  - #questions: Peer support, troubleshooting
  - #platform-updates: Instructor posts GoFood/GrabFood changes
  - #resources: Shared tools, templates, hacks
- Moderation: Instructor + 2-3 community moderators (active students)
- Rules: No spam, be helpful, no consultant pitching

**Slack/Discord (Alternative, Not Implemented):**
- More structured channels
- Integration with course platform (automatic enrollment)
- Searchable history for future students

### Retention Strategies

**Content Updates:**
- Quarterly: New lessons added to existing modules (e.g., "2025 Algorithm Update")
- Notification: Email + Telegram message when new content available
- No extra charge (lifetime access promise)

**Ongoing Engagement:**
- Monthly newsletter: Platform tips, case studies, community highlights
- Webinars: Quarterly live sessions on advanced topics (free for all paid students)
- Office hours: Instructor available in community 1 hour/week for live Q&A

**Referral Program (Planned):**
- Existing students get 10% commission for each referral
- Tracked via unique referral links
- Payouts via PayPal or course credit

**Advanced Courses (Future Upsell):**
- Multi-Location Management course ($997)
- F&B Instagram Marketing course ($297)
- Private Mastermind group ($500/month)

---

## Journey Stage 9: Advocacy & Referral

### Creating Advocates

**Success Documentation:**
- Instructor requests success stories: "Share your results for case study?"
- Interview students: Revenue increase, processes improved, lessons learned
- Create testimonial videos (with permission)

**Incentivizing Sharing:**
- Referral rewards (see above)
- Feature in course updates: "Student Spotlight - Maria from Canggu"
- Social media shoutouts: Instagram/Facebook posts tagging student's restaurant

**Making Sharing Easy:**
- Pre-written social posts: "Just finished Bali Food Delivery Master course. If you're struggling with GoFood/GrabFood, check it out: [link]"
- Sharable graphics: Course completion certificate, "I'm a delivery master" badge
- Email signature template: "Optimized with Bali Food Delivery Master"

### Viral Loops

**Free Course Sharing:**
- Students share free lessons with F&B friends
- Low friction (no paywall, just Telegram auth)
- Network effects: Bali F&B community is tight-knit

**Community Value:**
- Active community = reason to stay engaged
- Engaged students = more likely to refer
- Referrals grow community = more value for all

---

## User Journey Analytics & Optimization

### Key Metrics to Track

**Acquisition:**
- Landing page → Free course signup rate: Target 30-40%
- Traffic sources: Organic, paid, referral breakdown
- Bounce rate on landing page: <50%

**Activation:**
- Free course lesson 1 start rate: >80% of signups
- Free course completion rate: 60-70%
- Time to first lesson: <24 hours for 70% of users

**Conversion:**
- Free → Paid conversion: 15-25% overall
  - By lesson completion: 30%+ for those finishing all 12 lessons
  - By time: 50% convert within 30 days, 80% within 90 days
- Tier distribution: 30% Basic, 60% Accelerator, 10% VIP
- Discount code usage: 40% use FREECOMPLETE

**Engagement (Paid Students):**
- Module 1 start rate: >95% within 7 days
- Course completion rate: 60%+ finish all 5 modules
- Workshop attendance: 70%+ attend live (Accelerator/VIP)
- Support usage: 80% Accelerator students use 60-day support

**Retention:**
- Community join rate: 85% of paid students
- Monthly active users in community: 50%+ (declining over time is normal)
- Content update engagement: 40% watch new lessons within 30 days

**Advocacy:**
- Referral rate: 30% refer at least one friend
- Testimonial rate: 15% provide written testimonial
- Case study participation: 5% do full interview

### A/B Testing Opportunities

**Landing Page:**
- Headline variants: Pain-focused vs. Benefit-focused
- CTA button: "Start Free Course" vs. "Get Free Access" vs. "Learn How to Optimize"
- Social proof placement: Above vs. below fold

**Pricing Page:**
- Tier order: Basic-Accelerator-VIP vs. Accelerator-centered layout
- "Most Popular" badge: Accelerator vs. no badge (control)
- Pricing display: ₽38,000 vs. $497 (currency preference by region)

**Email Sequences:**
- Send time: Morning vs. evening
- Subject lines: Curiosity vs. Value vs. Urgency
- CTA frequency: One CTA vs. multiple throughout

**Free Course:**
- Lesson 8 CTA: Soft sell vs. Hard sell
- Completion incentive: 10% discount vs. Bonus module vs. No incentive

---

## Conclusion

This user journey is designed to:
1. **Minimize friction at entry:** Telegram auth vs. email/password
2. **Build trust through free value:** 12 lessons demonstrate expertise
3. **Create natural upgrade path:** Free content reveals depth of topic
4. **Serve different buyer types:** 3 tiers for different needs/budgets
5. **Support implementation:** Workshops, Q&A, support ensure results
6. **Foster community:** Retention and referrals through peer connections

The journey is optimized for a niche market (Bali F&B) with high pain (delivery complexity) and clear ROI (save/earn thousands), making conversion rates higher than typical online courses.
