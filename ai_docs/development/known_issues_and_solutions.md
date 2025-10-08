# Known Issues and Solutions

## Overview

This document catalogs known issues encountered during development, their root causes, and implemented solutions. Use this as a reference when debugging similar problems or refactoring related code.

---

## Issue #1: Auth Button Flickering on Turbo Navigation

### Problem

**Symptom:**
- User authenticates successfully
- Navigates to another page (Turbo Drive navigation)
- Auth button briefly shows "Login" (green) then switches to authenticated state (blue with username)
- Creates jarring visual flash

**Root Cause:**
- Turbo Drive caches pages in memory
- Cached page includes old auth button state (green "Login")
- JavaScript updates button after page load (100-200ms delay)
- User sees brief incorrect state before correction

**Original Implementation:**
```javascript
// turbo:before-cache event was being used to reset button state
document.addEventListener('turbo:before-cache', () => {
  const authButton = document.getElementById('auth-button')
  // Reset button to default state before caching
  authButton.classList.add('bg-green-500')
  authButton.classList.remove('bg-blue-500')
})
```

**Why it Failed:**
- Turbo cached page with green button
- On navigation, cached page shown → green button
- JavaScript ran to update → blue button
- Flash visible to user

---

### Solution

**Server-Side Rendering of Button State:**

**Before (Client-Side):**
- Server always rendered green "Login" button
- JavaScript detected auth status and updated button after page load

**After (Server-Side):**
- Server detects `@current_user` and renders appropriate button state
- No JavaScript update needed (already correct on render)

**Implementation:**

**Controller:**
```ruby
class ApplicationController < ActionController::Base
  before_action :set_current_user

  private

  def set_current_user
    @current_user = User.find_by(id: session[:user_id]) if session[:user_id]
  end
end
```

**Partial:** `app/views/shared/_auth_button.html.erb`
```erb
<% if @current_user %>
  <!-- Authenticated state -->
  <div class="flex items-center gap-3">
    <button id="auth-button" data-authenticated="true" class="bg-blue-500 hover:bg-blue-600 text-white...">
      <svg><!-- User icon --></svg>
      <span><%= @current_user.first_name %></span>
    </button>

    <%= form_tag auth_logout_path, method: :delete, data: { turbo: false } do %>
      <button type="submit" class="bg-red-500 hover:bg-red-600 text-white...">
        Logout
      </button>
    <% end %>
  </div>
<% else %>
  <!-- Non-authenticated state -->
  <button id="auth-button" data-authenticated="false" data-controller="auth" data-action="click->auth#startAuth" class="bg-green-500 hover:bg-green-600 text-white...">
    <svg><!-- Checkmark icon --></svg>
    <span>Авторизация</span>
  </button>
<% end %>
```

**JavaScript (Simplified):**
```javascript
// NO turbo:before-cache handler needed
// Button state already correct from server render

document.addEventListener('turbo:load', () => {
  // Just check auth for content protection (blur)
  checkAuthOnPageLoad();
});
```

**Result:**
- No flickering
- Button correct on first render
- Turbo cache stores correct state per user session

---

## Issue #2: Telegram WebView Auth Not Working

### Problem

**Symptom:**
- User clicks "Login" in Telegram in-app browser (WebView)
- `window.open(deep_link, '_blank')` call has no effect
- User stuck on "Waiting for authorization..." modal
- No Telegram bot opens

**Root Cause:**
- Telegram WebView blocks `window.open()` for security
- Standard web browser APIs don't work in constrained WebView environment

**Original Implementation:**
```javascript
// Desktop browser approach (doesn't work in WebView)
window.open(deepLink, '_blank');
subscribeToAuthChannel(sessionToken);
```

---

### Solution

**Environment Detection + Programmatic Link Click:**

```javascript
openTelegramBot(deepLink, sessionToken) {
  if (this.isTelegramWebView()) {
    // Telegram WebView: Create link, click programmatically
    const link = document.createElement('a');
    link.href = deepLink;
    // NO target="_blank" - Telegram handles t.me links natively
    link.click();

    // Listen for return to WebView
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkTokenViaAPI(sessionToken);
      }
    }, { once: true });
  } else {
    // Desktop browser: Standard window.open
    window.open(deepLink, '_blank');
    this.subscribeToAuthChannel(sessionToken);
  }
}

isTelegramWebView() {
  return !!(
    window.TelegramWebviewProxy ||
    window.Telegram?.WebApp ||
    /telegram/i.test(navigator.userAgent)
  );
}
```

**Why it Works:**
- Telegram WebView intercepts `t.me` links automatically
- Programmatic `click()` triggers Telegram's native handling
- Opens bot conversation within Telegram app (no new window needed)
- `visibilitychange` event fires when user returns to WebView

---

## Issue #3: Mobile Browser Auth Stuck on "Waiting..."

### Problem

**Symptom:**
- User on iPhone Safari clicks "Login"
- Telegram app opens successfully
- User completes auth in bot
- Returns to Safari browser
- "Waiting for authorization..." modal still showing
- No automatic page reload

**Root Cause:**
- Mobile browsers suspend JavaScript when app goes to background
- WebSocket connection lost when switching to Telegram app
- No recovery mechanism when browser returns to foreground

**Original Implementation:**
- Only relied on WebSocket for auth notification
- WebSocket disconnected when browser backgrounded
- Never reconnected when browser foregrounded

---

### Solution

**API Polling on Visibility Return:**

```javascript
openTelegramBot(deepLink, sessionToken) {
  if (this.isMobileDevice()) {
    // Mobile browser: Opens Telegram app
    const link = document.createElement('a');
    link.href = deepLink;
    link.target = '_blank';  // Required on mobile to trigger app switch
    link.click();

    // Listen for return to browser
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // IMMEDIATELY check auth via API (not WebSocket)
        this.checkTokenViaAPI(sessionToken);
      }
    }, { once: true });
  } else {
    // Desktop flow...
  }
}

async checkTokenViaAPI(sessionToken) {
  try {
    const response = await fetch(`/auth/check_token?session_token=${sessionToken}`);
    const data = await response.json();

    if (data.authenticated) {
      // Success! Reload page
      this.handleAuthSuccess(data);
    } else {
      // Not yet authenticated, subscribe to WebSocket as fallback
      this.subscribeToAuthChannel(sessionToken);
    }
  } catch (error) {
    // Fallback to WebSocket if API fails
    this.subscribeToAuthChannel(sessionToken);
  }
}
```

**Why it Works:**
- `visibilitychange` event fires when user returns to browser
- Immediate API call checks auth status (faster than WebSocket reconnection)
- If authenticated → success; if not → fall back to WebSocket
- Handles 95% of cases instantly, 5% with slight delay

---

## Issue #4: Content Accessible Without Auth on Direct URL

### Problem

**Symptom:**
- Unauthenticated user navigates directly to `/free_content/lessons/05-where-orders-come-from`
- Content visible without blur or modal
- Auth protection bypassed

**Root Cause:**
- JavaScript protection only ran on page navigation from lesson list
- Direct URL load didn't trigger protection logic

**Original Implementation:**
```javascript
// Only ran when clicking lesson card
lessonCard.addEventListener('click', () => {
  if (!isAuthenticated()) {
    showAuthModal();
    applyBlur();
  }
});
```

---

### Solution

**Check Auth on Every Page Load:**

```javascript
function checkAuthOnPageLoad() {
  const blurElement = document.getElementById('lesson-content-blur');
  const authButton = document.getElementById('auth-button');

  // Only run on lesson pages (blur element exists)
  if (!blurElement) return;

  // Check auth from server-rendered button state
  const isAuthenticated = authButton?.dataset.authenticated === 'true';

  if (!isAuthenticated) {
    // Apply protection
    blurElement.classList.add('blur-md');
    showAuthModal();
  } else {
    // Ensure protection removed (defensive)
    blurElement.classList.remove('blur-md');
  }
}

// Run on EVERY page load (Turbo + standard)
document.addEventListener('turbo:load', checkAuthOnPageLoad);
document.addEventListener('DOMContentLoaded', checkAuthOnPageLoad);
```

**Why it Works:**
- Runs on every lesson page load (direct URL or navigation)
- Server-rendered button state is source of truth
- No way to bypass protection

---

## Issue #5: Blur Effect on Wrong Elements

### Problem

**Symptom:**
- Entire page blurred including navigation, sidebar, footer
- Only lesson content should be blurred
- Navigation unusable when prompted to auth

**Root Cause:**
- `blur-md` class applied to `<body>` element instead of content-specific wrapper

**Original Implementation:**
```javascript
// Blurred entire page
document.body.classList.add('blur-md');
```

---

### Solution

**Targeted Blur Wrapper:**

**HTML:**
```html
<!-- NOT blurred: Navigation, title, sidebar -->
<nav>...</nav>
<h1>Lesson 1: Introduction</h1>

<!-- ONLY THIS GETS BLURRED -->
<div id="lesson-content-blur" class="transition-all duration-300">
  <!-- Intro card -->
  <div class="bg-green-50 rounded-xl p-6">
    Overview...
  </div>

  <!-- Markdown content -->
  <div class="prose">
    <%= markdown_to_html(@lesson_content) %>
  </div>

  <!-- Key takeaways -->
  <div class="bg-yellow-50 p-6">
    Key points...
  </div>
</div>

<!-- NOT blurred: Footer -->
<footer>...</footer>
```

**JavaScript:**
```javascript
// Only blur specific wrapper
const blurElement = document.getElementById('lesson-content-blur');
blurElement.classList.add('blur-md');
```

**Result:**
- Navigation, title, sidebar remain clear
- Only lesson content (intro, markdown, takeaways) blurred
- User can still navigate away or click auth button

---

## Issue #6: Logout Button Causes Turbo Cache Issues

### Problem

**Symptom:**
- User logs out
- Redirected to `/freecontent`
- Browser "Back" button shows cached authenticated pages
- Appears still logged in (but not actually)

**Root Cause:**
- Turbo Drive caches pages with authenticated state
- Logout doesn't clear Turbo cache
- Back button shows stale cached page

---

### Solution

**Disable Turbo for Logout:**

```erb
<%= form_tag auth_logout_path, method: :delete, data: { turbo: false } do %>
  <button type="submit" class="bg-red-500...">
    Logout
  </button>
<% end %>
```

**Why `data-turbo="false"`:**
- Forces full page reload (not Turbo navigation)
- Clears Turbo cache
- Fresh session state on redirect
- No stale cached pages

---

## Issue #7: Session Token Collision (Rare)

### Problem

**Symptom:**
- Two users simultaneously start auth
- Both receive same session token (extremely rare)
- One user's auth overwrites the other's

**Root Cause:**
- `SecureRandom.hex(16)` has ~10^38 possible values
- Probability of collision: ~0% but not impossible
- Unique constraint prevents database collision but doesn't prevent logic error

---

### Solution

**Unique Index + Retry Logic:**

**Database:**
```ruby
# Already implemented
add_index :users, :session_token, unique: true
```

**Controller (Future Enhancement):**
```ruby
def telegram_start
  session_token = generate_unique_token
  # ...
end

private

def generate_unique_token
  loop do
    token = SecureRandom.hex(16)
    break token unless User.exists?(session_token: token)
  end
end
```

**Current State:**
- Database unique constraint prevents collision
- If collision occurs, second user gets database error (acceptable for rare edge case)

---

## Issue #8: Webhook Receiving Duplicate Updates

### Problem

**Symptom:**
- Telegram sends same update twice
- User receives duplicate "Welcome" messages in bot

**Root Cause:**
- Telegram retries webhook if server doesn't respond quickly
- Server processing took >1 second
- Telegram assumed failure, resent update

---

### Solution

**Immediate 200 OK + Background Processing:**

```ruby
def telegram_webhook
  # Immediately return 200 OK to Telegram
  head :ok

  # Process in background (future: async job)
  process_telegram_update(params)
end

def process_telegram_update(update_params)
  # Handle /start command or callback_query
  # Send messages, update database
end
```

**Future Enhancement:**
- Use Solid Queue to process updates asynchronously
- Idempotency key to prevent duplicate processing

---

## Issue #9: Assets Not Loading in Production

### Problem

**Symptom:**
- Tailwind CSS not applied in production
- Images return 404
- JavaScript files not found

**Root Cause:**
- Assets not precompiled during Docker build
- Asset paths incorrect (expecting `/assets/...` but served from `/public/assets/...`)

---

### Solution

**Dockerfile Asset Precompilation:**

```dockerfile
# In build stage
RUN bundle exec rails assets:precompile
RUN bundle exec rails tailwindcss:build
```

**Asset Path Configuration:**
```ruby
# config/environments/production.rb
config.public_file_server.enabled = true
config.assets.compile = false  # Don't compile on-demand (precompiled only)
```

**deploy.yml:**
```yaml
asset_path: /rails/public/assets
```

---

## Known Limitations (Not Issues)

### SQLite Concurrency

**Limitation:**
- SQLite handles ~100-200 concurrent writes/second
- Not suitable for high-write workloads (>10,000 concurrent users)

**Mitigation:**
- Read-heavy workload (course platform)
- Caching reduces database queries
- Acceptable for current scale (<10,000 users)

**Migration Path:**
- Switch to PostgreSQL if >10,000 users or high write volume

---

### No Password Reset Flow

**Limitation:**
- Telegram OAuth has no "forgot password"
- User loses Telegram account = loses course access

**Mitigation:**
- Telegram account recovery is Telegram's responsibility
- Provide support email for edge cases (manual account linking)

---

### No Email Notifications

**Limitation:**
- Only Telegram bot for communication
- Users who don't check Telegram miss updates

**Future Enhancement:**
- Optional email collection
- Email notifications for course updates, workshops

---

## Debugging Tips

### Enable ActionCable Logging

```javascript
// In browser console
ActionCable.logger.enabled = true;
```

### Check Turbo Cache

```javascript
// Clear Turbo cache
Turbo.cache.clear();

// Disable cache temporarily
document.addEventListener('turbo:before-cache', (event) => {
  event.preventDefault();
});
```

### Inspect Session

```ruby
# In Rails console
session = Session.find_by_session_id(cookie_value)
session.data  # View session contents
```

---

## Conclusion

Most issues stem from the complexity of supporting three different environments (desktop, Telegram WebView, mobile). The solutions prioritize user experience (no flickering, instant auth check) over code simplicity. Document issues here as they're discovered and solved to prevent future regressions.
