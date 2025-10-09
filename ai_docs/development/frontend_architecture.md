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

**File:** `app/javascript/controllers/messenger_controller.js` (Lines 1-415)

**Purpose:** Real-time admin messaging interface with ActionCable WebSocket integration

**Responsibilities:**
- Subscribe to MessengerChannel for real-time message updates
- Send messages to Telegram users via AJAX
- Dynamically update conversation list with new messages
- Display user avatars (with fallback to initials)
- Auto-scroll chat to latest message
- Handle Enter key for message sending
- Create new conversation elements dynamically
- Format timestamps ("5 minutes ago")

**Lifecycle:**

```javascript
connect() {
  // 1. Find active conversation ID from DOM
  this.activeConversationId = this.element.querySelector('main[data-conversation-id]')?.dataset.conversationId

  // 2. Subscribe to MessengerChannel
  this.subscribeToChannel()

  // 3. Scroll to bottom of messages
  this.scrollToBottom()
}

disconnect() {
  // Unsubscribe from WebSocket when controller removed
  if (this.subscription) {
    this.subscription.unsubscribe()
  }
}
```

**Key Methods:**

**1. WebSocket Subscription**
```javascript
subscribeToChannel() {
  this.subscription = consumer.subscriptions.create("MessengerChannel", {
    connected: () => {
      console.log("Connected to MessengerChannel")
    },

    disconnected: () => {
      console.log("Disconnected from MessengerChannel")
    },

    received: (data) => {
      if (data.type === "new_message") {
        this.handleNewMessage(data)
      }
    }
  })
}
```

**2. Message Handling**
```javascript
handleNewMessage(data) {
  const conversationId = data.conversation_id
  const message = data.message

  // If message is for active conversation → add to chat
  if (String(conversationId) === String(this.activeConversationId)) {
    this.appendMessage(message)
    this.scrollToBottom()

    // Mark as read if incoming
    if (message.direction === 'incoming') {
      this.markAsRead(conversationId)
    }
  }

  // Update conversation list (for all conversations)
  if (data.conversation) {
    this.updateConversationsList(conversationId, data.conversation)
  }
}
```

**3. Message Rendering**
```javascript
createMessageElement(message) {
  const isIncoming = message.direction === 'incoming'
  const user = message.user || this.currentUserValue
  const avatarUrl = user.avatar_url

  // Avatar HTML (image or initials)
  let avatarHtml
  if (avatarUrl) {
    avatarHtml = `<img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover" />`
  } else {
    const initials = user.first_name[0] + (user.last_name ? user.last_name[0] : '')
    avatarHtml = `<div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white">${initials}</div>`
  }

  // Message bubble HTML
  return `
    <div class="flex ${isIncoming ? '' : 'flex-row-reverse'} gap-2">
      ${avatarHtml}
      <div class="bg-${isIncoming ? 'white' : 'blue-500'} rounded-lg px-4 py-3">
        <p class="${isIncoming ? 'text-gray-900' : 'text-white'}">${this.escapeHtml(message.body)}</p>
        <span class="text-xs text-gray-500">${time}</span>
      </div>
    </div>
  `
}
```

**4. Sending Messages**
```javascript
async sendMessage(event) {
  event.preventDefault()

  const body = this.inputTarget.value.trim()
  if (!body) return

  // Clear input immediately
  this.inputTarget.value = ''
  this.inputTarget.style.height = 'auto'

  try {
    const response = await fetch(`/messenger/conversations/${this.activeConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({ body })
    })

    const data = await response.json()

    if (!data.success) {
      alert('Failed to send message')
      this.inputTarget.value = body // Restore text
    }
    // Success: Message will appear via ActionCable broadcast
  } catch (error) {
    console.error('Failed to send message:', error)
    alert('Error sending message')
    this.inputTarget.value = body // Restore text
  }
}
```

**5. Conversation List Updates**
```javascript
updateConversationElement(element, data) {
  const { user, last_message, unread_count } = data

  // Update avatar dynamically
  if (user && user.avatar_url) {
    const avatarContainer = element.querySelector('.flex-shrink-0')
    if (avatarContainer) {
      const existingAvatar = avatarContainer.querySelector('img, div')
      if (existingAvatar.tagName === 'IMG') {
        existingAvatar.src = user.avatar_url
      } else {
        // Replace initials div with actual image
        const img = document.createElement('img')
        img.src = user.avatar_url
        img.className = 'w-12 h-12 rounded-full object-cover'
        existingAvatar.replaceWith(img)
      }
    }
  }

  // Update last message text
  const messageTextElement = element.querySelector('.text-sm.text-gray-600')
  if (messageTextElement && last_message) {
    const prefix = last_message.direction === 'outgoing' ? '📤 Вы: ' : ''
    messageTextElement.textContent = prefix + last_message.body
  }

  // Update timestamp
  const timeElement = element.querySelector('.text-xs.text-gray-500')
  if (timeElement && last_message) {
    timeElement.textContent = this.timeAgo(new Date(last_message.created_at)) + ' назад'
  }

  // Update unread badge
  const isActive = String(element.dataset.conversationId) === String(this.activeConversationId)
  let unreadBadge = element.querySelector('.bg-blue-500.text-white.rounded-full')

  if (!isActive && unread_count > 0) {
    if (unreadBadge) {
      unreadBadge.textContent = unread_count
    } else {
      // Create new badge
      const newBadge = document.createElement('span')
      newBadge.className = 'inline-block mt-2 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full'
      newBadge.textContent = unread_count
      element.querySelector('.flex-1.min-w-0').appendChild(newBadge)
    }
  } else if (unreadBadge) {
    unreadBadge.remove() // Hide badge if active or no unread
  }
}
```

**6. Time Formatting**
```javascript
timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000)

  const intervals = {
    'год': 31536000,
    'месяц': 2592000,
    'неделю': 604800,
    'день': 86400,
    'час': 3600,
    'минуту': 60
  }

  for (const [name, secondsInInterval] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInInterval)
    if (interval >= 1) {
      return `${interval} ${name}${this.pluralize(interval, name)}`
    }
  }

  return 'менее минуты'
}

pluralize(number, word) {
  const lastDigit = number % 10
  const lastTwoDigits = number % 100

  // Russian pluralization rules
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return wordCases[2] // "лет", "дней"
  }
  if (lastDigit === 1) {
    return wordCases[0] // "год", "день"
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return wordCases[1] // "года", "дня"
  }
  return wordCases[2]
}
```

**Data Attributes:**
```html
<div data-controller="messenger" data-messenger-conversation-id-value="123">
  <!-- Conversations list (left sidebar) -->
  <aside data-messenger-target="conversationsList">
    <div data-conversation-id="123" data-action="click->messenger#selectConversation">
      <!-- Conversation card -->
    </div>
  </aside>

  <!-- Messages panel (right side) -->
  <main data-conversation-id="123">
    <div data-messenger-target="messages" class="overflow-y-auto">
      <!-- Messages rendered here -->
    </div>

    <!-- Input form -->
    <form data-action="submit->messenger#sendMessage">
      <textarea
        data-messenger-target="input"
        data-action="keydown->messenger#handleKeydown"
        placeholder="Type a message..."
      ></textarea>
      <button type="submit">Send</button>
    </form>
  </main>
</div>
```

**Targets:**
- `messages` - Container for message list (scrollable)
- `input` - Message input textarea
- `conversationsList` - Left sidebar with all conversations

**Values:**
- `conversationId` - Active conversation ID (for filtering WebSocket events)

**Features:**

1. **Real-time Updates** - Messages appear instantly via WebSocket (no polling)
2. **Avatar Display** - Shows Telegram avatars with fallback to initials
3. **Optimistic UI** - Input clears immediately, message appears via broadcast
4. **Error Handling** - Restores input text if send fails
5. **Keyboard Shortcuts** - Enter sends, Shift+Enter for new line
6. **Auto-scroll** - Jumps to latest message on new messages
7. **Unread Badges** - Shows count, hides when conversation active
8. **Time Formatting** - Human-readable ("5 минут назад")
9. **Security** - HTML escaping, CSRF token, XSS prevention

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
