# Frontend Architecture

## Overview

The frontend uses a hybrid approach: server-side rendering for initial page loads with Stimulus JavaScript controllers for interactive enhancements. No separate frontend framework (React, Vue) is used.

---

## Technology Stack

### Hotwire

**Turbo Drive:**
- Intercepts link clicks/form submissions
- Fetches HTML via AJAX
- Swaps content without full page reload
- Manages browser history

**Turbo Frames (Not Yet Used):**
- Partial page updates
- Future use: Lazy-load lesson content

**Turbo Streams (Not Yet Used):**
- Real-time partial updates via WebSocket
- Future use: Live course updates, notifications

**Stimulus:**
- Lightweight JavaScript framework
- Connects HTML to JavaScript via data attributes
- Controller-based architecture

---

## Stimulus Controllers

### Auth Controller

**File:** `app/javascript/controllers/auth_controller.js`

**Responsibilities:**
- Handle auth button clicks
- Open Telegram bot in appropriate manner (desktop/mobile/webview)
- Subscribe to ActionCable for real-time auth notifications
- Update UI on authentication success

**Key Methods:**
- `startAuth()` - Initiates authentication flow
- `openTelegramBot()` - Environment-specific bot opening logic
- `checkTokenViaAPI()` - Polls server for auth completion
- `subscribeToAuthChannel()` - WebSocket subscription
- `handleAuthSuccess()` - Updates UI, reloads page

**Data Attributes:**
```html
<button
  data-controller="auth"
  data-action="click->auth#startAuth"
>
  Login
</button>
```

---

### Dropdown Controller

**File:** `app/javascript/controllers/dropdown_controller.js`

**Responsibilities:**
- Handle dropdown menu toggle (user menu, settings, etc.)
- Close dropdown on outside click
- Close dropdown on ESC key press
- Manage chevron rotation animation
- Clean up event listeners on disconnect

**Key Methods:**
- `toggle(event)` - Opens/closes dropdown, prevents event bubbling
- `open()` - Shows dropdown, adds global listeners
- `close()` - Hides dropdown, removes global listeners
- `closeOnClickOutside(event)` - Closes if click outside dropdown
- `closeOnEscape(event)` - Closes on ESC key press

**Lifecycle:**
- `connect()` - Binds event handlers (called when controller attached to DOM)
- `disconnect()` - Removes event listeners (called when controller removed from DOM)

**Data Attributes:**
```html
<div data-controller="dropdown" class="relative">
  <!-- Toggle button -->
  <button data-action="click->dropdown#toggle">
    <span>Username</span>
    <svg data-dropdown-target="chevron" class="transition-transform">
      <!-- Chevron icon -->
    </svg>
  </button>

  <!-- Dropdown menu -->
  <div data-dropdown-target="menu" class="hidden">
    <!-- Menu items -->
  </div>
</div>
```

**Targets:**
- `menu` - The dropdown content container (required)
- `chevron` - The chevron icon for rotation animation (optional)

**Why Stimulus Pattern vs. Global Functions:**
- Works with Turbo Drive page caching
- Automatic lifecycle management (connect/disconnect)
- Scoped to component (no global namespace pollution)
- Automatic cleanup prevents memory leaks
- Compatible with dynamically-loaded content

---

### Messenger Controller

**File:** `app/javascript/controllers/messenger_controller.js`

**Responsibilities:**
- Handle real-time message updates via WebSocket
- Send messages to Telegram users
- Update conversation list dynamically
- Display user avatars in real-time
- Scroll to new messages automatically

**Key Methods:**
- `connect()` - Subscribe to MessengerChannel WebSocket
- `sendMessage(event)` - POST message to backend, send via Telegram API
- `handleNewMessage(data)` - Render new message in chat
- `updateConversationElement(data)` - Update conversation list with new message
- `createMessageElement(message)` - Generate message HTML with avatar
- `scrollToBottom()` - Auto-scroll chat to latest message

**Data Attributes:**
```html
<div data-controller="messenger" data-messenger-conversation-id-value="123">
  <!-- Message list -->
  <div data-messenger-target="messageList">
    <!-- Messages rendered here -->
  </div>

  <!-- Message form -->
  <form data-action="submit->messenger#sendMessage">
    <input data-messenger-target="input" type="text" />
    <button type="submit">Send</button>
  </form>
</div>
```

**Targets:**
- `messageList` - Container for messages
- `input` - Message input field

**Values:**
- `conversationId` - Active conversation ID for WebSocket filtering

---

## JavaScript Architecture

### Global Functions

**Location:** Inline script in `app/views/shared/_auth_script.html.erb`

**Functions:**
- `window.showAuthModal()` - Display authentication modal
- `window.hideAuthModal()` - Close authentication modal
- `checkAuthOnPageLoad()` - Apply blur to content if unauthenticated

**Rationale:**
- Simple functions don't require Stimulus controller
- Need to be callable from anywhere (not scoped to element)

---

### Event Handling

**Turbo Events:**
```javascript
document.addEventListener('turbo:load', () => {
  checkAuthOnPageLoad();
  initializeLessonLinks();
});

document.addEventListener('turbo:before-cache', () => {
  // Clean up before Turbo caches page
  // Currently: No-op (server renders correct state)
});
```

**Custom Events:**
```javascript
document.addEventListener('visibilitychange', () => {
  // User returned from Telegram app
  if (document.visibilityState === 'visible') {
    checkAuthViaAPI();
  }
});
```

---

## ActionCable Integration

### Consumer Setup

**File:** `app/javascript/channels/consumer.js`

```javascript
import { createConsumer } from "@rails/actioncable"
export default createConsumer()
```

### Auth Channel Subscription

```javascript
import consumer from "../channels/consumer"

consumer.subscriptions.create(
  { channel: "AuthChannel", session_token: token },
  {
    connected() {
      console.log("Connected to AuthChannel");
    },

    disconnected() {
      console.log("Disconnected from AuthChannel");
    },

    received(data) {
      if (data.type === 'authentication_success') {
        handleAuthSuccess(data);
      }
    }
  }
);
```

---

## CSS Architecture

### Tailwind CSS

**Configuration:** `config/tailwind.config.js`

```javascript
module.exports = {
  content: [
    './app/views/**/*.html.erb',
    './app/helpers/**/*.rb',
    './app/javascript/**/*.js'
  ],
  theme: {
    extend: {
      // Custom theme extensions
    }
  }
}
```

**Build Process:**
- Development: `bin/rails tailwindcss:watch` (auto-rebuild on file changes)
- Production: `bin/rails tailwindcss:build` (minified output)

**Output:** `app/assets/builds/tailwind.css`

---

### Custom CSS

**File:** `app/assets/stylesheets/application.tailwind.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom styles */
@layer components {
  .prose {
    /* Markdown rendering styles */
  }
}
```

---

## Asset Pipeline

### Importmap

**Configuration:** `config/importmap.rb`

```ruby
pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"
pin "@rails/actioncable", to: "actioncable.esm.js"
```

**No Bundler:**
- No Webpack, Vite, esbuild
- ES modules loaded directly by browser
- HTTP/2 makes many small requests efficient

---

## State Management

### Server as Source of Truth

**Pattern:**
1. Server renders page with correct state (authenticated/not)
2. JavaScript reads state from DOM (`data-authenticated="true"`)
3. On state change (auth), server re-renders page

**No Client-Side State:**
- No Redux, MobX, Zustand
- State lives in session (server) and DOM (client reflection)

---

## Form Handling

### Turbo-Enhanced Forms (Future)

```html
<form data-turbo-stream>
  <!-- Submits via Turbo, updates page via Turbo Stream -->
</form>
```

**Current Forms:**
- Standard Rails form helpers
- CSRF token automatic
- Logout form uses `data-turbo="false"` for full page reload

---

## Image Optimization

### Lazy Loading

```html
<img src="/image.jpg" loading="lazy" alt="Description">
```

**Browser Support:** All modern browsers

---

### Responsive Images (Future)

```html
<img
  srcset="
    /image-small.jpg 640w,
    /image-medium.jpg 1024w,
    /image-large.jpg 1920w
  "
  sizes="(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1920px"
  src="/image-medium.jpg"
  alt="Description"
>
```

---

## Performance Optimization

### Turbo Caching

**How it Works:**
- Turbo caches visited pages in memory
- Instant back/forward navigation
- Cache invalidated on Turbo visit

**Cache Control:**
```html
<meta name="turbo-cache-control" content="no-cache">
```

---

### Code Splitting (Future)

**Lazy Load Controllers:**
```javascript
// Only load modal controller when modal opened
const { default: ModalController } = await import('./modal_controller.js');
application.register('modal', ModalController);
```

---

## Browser Compatibility

### Target Browsers

**Supported:**
- Chrome 90+
- Safari 14+
- Firefox 88+
- Edge 90+

**Not Supported:**
- IE11 (no CSS blur, no ES6 modules)

---

## Debugging

### Browser DevTools

**Console Logging:**
```javascript
console.log('Auth started:', data);
```

**Turbo Events:**
```javascript
document.addEventListener('turbo:before-visit', (event) => {
  console.log('Navigating to:', event.detail.url);
});
```

**ActionCable:**
```javascript
// Enable ActionCable debugging
ActionCable.logger.enabled = true;
```

---

## Testing

### System Tests (Browser-Based)

```ruby
class AuthenticationTest < ApplicationSystemTestCase
  test "clicking login shows modal" do
    visit freecontent_path
    click_button 'Авторизация'

    assert_selector '#auth-modal', visible: true
  end
end
```

**Headless Browser:** Selenium with headless Chrome

---

## Future Enhancements

### Offline Support (PWA)

**Service Worker:**
- Cache static assets (CSS, JS, images)
- Offline page when no connection
- Background sync for form submissions

---

### Web Components (Future)

**Custom Elements:**
```javascript
class LessonCard extends HTMLElement {
  connectedCallback() {
    this.render();
  }
}

customElements.define('lesson-card', LessonCard);
```

---

## Conclusion

The frontend architecture prioritizes simplicity and server-rendered content over complex client-side frameworks. Stimulus provides just enough JavaScript for interactivity, while Turbo makes navigation feel instant. This approach reduces build complexity, improves SEO, and maintains fast performance across devices.
