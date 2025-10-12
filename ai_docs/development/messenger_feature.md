# Real-Time Messenger Feature

## Overview

The messenger feature provides a real-time admin interface for communicating with course users through their Telegram accounts. Admins can view conversations, send messages via Telegram API, and receive messages in real-time via WebSocket broadcasts.

**Key Capabilities:**
- Two-way messaging between admin dashboard and user Telegram accounts
- Real-time message delivery and updates via ActionCable
- User avatar display from Telegram API
- Conversation management with unread counts
- Admin-only access with user deletion capability

---

## Architecture

### Components

**Backend:**
- `MessengerController` - Handles message CRUD, Telegram API integration
- `AuthController` - Processes incoming Telegram messages, creates conversations
- `MessengerChannel` - WebSocket channel for real-time updates
- `Conversation` model - Groups messages by user
- `Message` model - Individual message records

**Frontend:**
- `messenger_controller.js` - Stimulus controller for real-time UI updates
- `messenger/index.html.erb` - Admin dashboard view
- ActionCable subscription for live message broadcast

**External:**
- Telegram Bot API - Sends messages to users, receives messages via webhook

---

## Database Schema

### Conversations Table

```ruby
create_table :conversations do |t|
  t.references :user, null: false, foreign_key: true
  t.datetime :last_message_at
  t.timestamps
end

add_index :conversations, [:user_id], unique: true
```

**Fields:**
- `user_id` - Foreign key to users table (one conversation per user)
- `last_message_at` - Timestamp of most recent message (for sorting)
- `timestamps` - Standard created_at, updated_at

**Virtual Attributes:**
- `unread_count` - Calculated count of unread incoming messages

---

### Messages Table

```ruby
create_table :messages do |t|
  t.references :conversation, null: false, foreign_key: true
  t.references :user, foreign_key: true
  t.text :body, null: false
  t.string :direction, null: false  # 'incoming' or 'outgoing'
  t.boolean :read, default: false
  t.bigint :telegram_message_id
  t.timestamps
end

add_index :messages, [:conversation_id, :created_at]
add_index :messages, [:conversation_id, :read]
```

**Fields:**
- `conversation_id` - Parent conversation
- `user_id` - Sender (NULL for admin messages)
- `body` - Message text content
- `direction` - Either 'incoming' (from user) or 'outgoing' (from admin)
- `read` - Whether admin has read the message
- `telegram_message_id` - Telegram's unique message ID
- `timestamps` - When message was created/updated

**Scopes:**
- `by_time` - Orders by created_at ASC
- `unread` - Filters where read = false
- `incoming` - Filters where direction = 'incoming'
- `outgoing` - Filters where direction = 'outgoing'

---

## Request Flow

### Incoming Messages (User → Admin)

**Flow:**

1. **User sends message in Telegram**
   - User types message in bot conversation
   - Telegram sends POST to `/auth/telegram/webhook`

2. **Webhook processes message**
   ```ruby
   # app/controllers/auth_controller.rb
   def telegram_webhook
     if params[:message]&.dig(:text)
       handle_text_message(params[:message])
     end
   end

   def handle_text_message(message)
     user = User.find_by(telegram_id: message[:from][:id])
     conversation = Conversation.find_or_create_by(user: user)

     msg = conversation.messages.create!(
       body: message[:text],
       direction: :incoming,
       telegram_message_id: message[:message_id],
       user_id: user.id
     )

     # Update avatar if changed
     if message[:from][:photo_url]
       user.update(avatar_url: message[:from][:photo_url])
     end

     # Broadcast to admin dashboard
     ActionCable.server.broadcast("messenger_channel", {
       type: 'new_message',
       conversation_id: conversation.id,
       message: msg.as_json(include: :user),
       conversation: {
         id: conversation.id,
         user: user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
         last_message: msg.as_json(only: [:id, :body, :direction, :created_at]),
         unread_count: conversation.unread_count,
         last_message_at: conversation.last_message_at
       }
     })
   end
   ```

3. **Admin receives real-time update**
   - WebSocket broadcast triggers `messenger_controller.js`
   - New message appears in conversation
   - Conversation list updates with latest message
   - Unread count increments

---

### Outgoing Messages (Admin → User)

**Flow:**

1. **Admin types message in dashboard**
   ```html
   <form data-action="submit->messenger#sendMessage">
     <input data-messenger-target="input" type="text" />
     <button>Send</button>
   </form>
   ```

2. **Frontend sends AJAX request**
   ```javascript
   // app/javascript/controllers/messenger_controller.js
   async sendMessage(event) {
     event.preventDefault()

     const body = this.inputTarget.value.trim()
     const conversationId = this.conversationIdValue

     const response = await fetch(`/messenger/conversations/${conversationId}/messages`, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
       },
       body: JSON.stringify({ body })
     })

     if (response.ok) {
       this.inputTarget.value = ''
     }
   }
   ```

3. **Backend sends via Telegram API**
   ```ruby
   # app/controllers/messenger_controller.rb
   def send_message
     body = params[:body]

     result = bot_client.api.send_message(
       chat_id: @conversation.user.telegram_id,
       text: body
     )

     message = @conversation.messages.create!(
       body: body,
       direction: :outgoing,
       telegram_message_id: result.message_id,
       read: true,
       user_id: nil  # from admin
     )

     # Broadcast to all admin sessions
     ActionCable.server.broadcast("messenger_channel", {
       type: 'new_message',
       conversation_id: @conversation.id,
       message: message.as_json,
       conversation: {
         id: @conversation.id,
         user: @conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
         last_message: message.as_json(only: [:id, :body, :direction, :created_at]),
         unread_count: @conversation.unread_count,
         last_message_at: @conversation.last_message_at
       }
     })
   end
   ```

4. **User receives message in Telegram**
   - Telegram delivers message to user's chat
   - User sees message from bot

5. **All admin sessions update**
   - WebSocket broadcast updates all connected admin dashboards
   - Message appears in conversation immediately

---

## Real-Time Avatar Display

### Problem Solved

**Issue:** When new messages arrived via WebSocket, user avatars showed fallback initials instead of actual Telegram profile photos. Avatars only appeared after page refresh.

**Root Cause:** Backend broadcasts didn't include `avatar_url` in user data, so frontend couldn't render actual images.

---

### Solution Implementation

**Backend Changes:**

1. **MessengerController - Include avatar in broadcasts**
   ```ruby
   # app/controllers/messenger_controller.rb (Line 73)
   conversation: {
     id: @conversation.id,
     user: @conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
     # ...
   }
   ```

2. **MessengerController - Include avatar in API responses**
   ```ruby
   # app/controllers/messenger_controller.rb (Line 31)
   def messages
     render json: {
       messages: @messages.as_json(include: :user),
       user: @conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url, :created_at])
     }
   end
   ```

3. **AuthController - Include avatar when broadcasting new messages**
   ```ruby
   # app/controllers/auth_controller.rb (Line 265)
   conversation: {
     user: user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
     # ...
   }
   ```

**Frontend Changes:**

1. **Message rendering with avatar check**
   ```javascript
   // app/javascript/controllers/messenger_controller.js (Lines 81-87)
   createMessageElement(message) {
     const isIncoming = message.direction === 'incoming'
     const user = message.user || this.currentUserValue

     // Check if avatar_url exists and is not null
     let avatarHtml
     if (user.avatar_url) {
       avatarHtml = `<img src="${user.avatar_url}" alt="${user.first_name}" class="w-8 h-8 rounded-full" />`
     } else {
       const initials = user.first_name[0] + (user.last_name ? user.last_name[0] : '')
       avatarHtml = `<div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">${initials}</div>`
     }

     return `
       <div class="flex gap-2 ${isIncoming ? '' : 'flex-row-reverse'}">
         ${avatarHtml}
         <div class="bg-${isIncoming ? 'gray' : 'blue'}-100 rounded-lg p-3">
           <p>${message.body}</p>
         </div>
       </div>
     `
   }
   ```

2. **Conversation list avatar update**
   ```javascript
   // app/javascript/controllers/messenger_controller.js (Lines 147-168)
   updateConversationElement(data) {
     const convElement = document.querySelector(`[data-conversation-id="${data.conversation.id}"]`)

     if (convElement) {
       // Update avatar dynamically
       const avatarContainer = convElement.querySelector('.avatar-container')
       if (avatarContainer && data.conversation.user.avatar_url) {
         avatarContainer.innerHTML = `
           <img src="${data.conversation.user.avatar_url}"
                alt="${data.conversation.user.first_name}"
                class="w-12 h-12 rounded-full" />
         `
       }

       // Update last message, timestamp, unread count
       // ...
     }
   }
   ```

**Result:**
- Avatars display immediately when new messages arrive
- No page refresh required
- Graceful fallback to initials if avatar unavailable
- Dynamic updates in both message list and conversation sidebar

---

## Admin Features

### User Management

**Admin Check:**
```ruby
# app/controllers/messenger_controller.rb
before_action :require_admin

def require_admin
  unless @current_user&.admin?
    redirect_to root_path, alert: 'Access denied'
  end
end
```

**Delete User:**
```ruby
# DELETE /messenger/users/:id
def delete_user
  user = User.find(params[:id])
  conversation = Conversation.find_by(user: user)

  # Delete conversation and all messages (cascade)
  conversation&.destroy

  # Delete user account
  user.destroy

  redirect_to messenger_path, notice: "User deleted successfully"
end
```

**UI:**
```erb
<%= button_to "Delete User",
    messenger_delete_user_path(@active_user),
    method: :delete,
    data: { confirm: "Are you sure? This will delete all messages and user data." },
    class: "bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded" %>
```

---

### Mark as Read

**Automatic on conversation view:**
```ruby
# app/controllers/messenger_controller.rb
def index
  @active_conversation = @conversations.find_by(id: params[:conversation_id])
  @active_conversation&.mark_all_read!  # Marks all messages as read
end
```

**Manual mark read:**
```ruby
# PATCH /messenger/conversations/:id/mark_read
def mark_read
  @conversation.mark_all_read!
  render json: { success: true }
end
```

**Model implementation:**
```ruby
# app/models/conversation.rb
def mark_all_read!
  messages.incoming.unread.update_all(read: true)
end

def unread_count
  messages.incoming.unread.count
end
```

---

## WebSocket Architecture

### MessengerChannel

**Channel Definition:**
```ruby
# app/channels/messenger_channel.rb
class MessengerChannel < ApplicationCable::Channel
  def subscribed
    stream_from "messenger_channel"
  end

  def unsubscribed
    # Cleanup when channel is unsubscribed
  end
end
```

**Frontend Subscription:**
```javascript
// app/javascript/controllers/messenger_controller.js
connect() {
  this.channel = createConsumer().subscriptions.create("MessengerChannel", {
    connected: () => {
      console.log("Connected to MessengerChannel")
    },

    disconnected: () => {
      console.log("Disconnected from MessengerChannel")
    },

    received: (data) => {
      if (data.type === 'new_message') {
        this.handleNewMessage(data)
        this.updateConversationElement(data)
      }
    }
  })
}

disconnect() {
  if (this.channel) {
    this.channel.unsubscribe()
  }
}
```

**Broadcast Events:**

1. **New Message:**
   ```javascript
   {
     type: 'new_message',
     conversation_id: 123,
     message: {
       id: 456,
       body: "Hello!",
       direction: "incoming",
       created_at: "2025-01-08T12:00:00Z",
       user: {
         id: 1,
         first_name: "John",
         last_name: "Doe",
         username: "johndoe",
         avatar_url: "https://..."
       }
     },
     conversation: {
       id: 123,
       user: { /* user data */ },
       last_message: { /* message summary */ },
       unread_count: 3,
       last_message_at: "2025-01-08T12:00:00Z"
     }
   }
   ```

---

## UI Components

### Conversation List

**Layout:**
```erb
<!-- Left sidebar: Conversation list -->
<div class="w-1/3 border-r overflow-y-auto">
  <% @conversations.each do |conversation| %>
    <a href="<%= messenger_path(conversation_id: conversation.id) %>"
       data-conversation-id="<%= conversation.id %>"
       class="block p-4 hover:bg-gray-50 <%= 'bg-blue-50' if conversation == @active_conversation %>">

      <!-- Avatar -->
      <div class="avatar-container">
        <% if conversation.user.avatar_url.present? %>
          <img src="<%= conversation.user.avatar_url %>"
               alt="<%= conversation.user.first_name %>"
               class="w-12 h-12 rounded-full" />
        <% else %>
          <div class="w-12 h-12 rounded-full bg-blue-500 text-white flex items-center justify-center">
            <%= conversation.user.first_name[0] %><%= conversation.user.last_name&.first %>
          </div>
        <% end %>
      </div>

      <!-- User info -->
      <div class="flex-1">
        <div class="flex justify-between">
          <span class="font-semibold"><%= conversation.user.first_name %></span>
          <span class="text-xs text-gray-500">
            <%= time_ago_in_words(conversation.last_message_at) %> ago
          </span>
        </div>

        <!-- Last message preview -->
        <p class="text-sm text-gray-600 truncate">
          <%= conversation.messages.last&.body %>
        </p>
      </div>

      <!-- Unread badge -->
      <% if conversation.unread_count > 0 %>
        <span class="bg-red-500 text-white text-xs rounded-full px-2 py-1">
          <%= conversation.unread_count %>
        </span>
      <% end %>
    </a>
  <% end %>
</div>
```

---

### Message Thread

**Layout:**
```erb
<!-- Right side: Message thread -->
<div class="w-2/3 flex flex-col"
     data-controller="messenger"
     data-messenger-conversation-id-value="<%= @active_conversation&.id %>">

  <!-- Header -->
  <div class="border-b p-4 flex justify-between items-center">
    <div class="flex items-center gap-3">
      <% if @active_user.avatar_url.present? %>
        <img src="<%= @active_user.avatar_url %>" class="w-10 h-10 rounded-full" />
      <% else %>
        <div class="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
          <%= @active_user.first_name[0] %>
        </div>
      <% end %>

      <div>
        <h2 class="font-semibold"><%= @active_user.first_name %> <%= @active_user.last_name %></h2>
        <p class="text-sm text-gray-500">@<%= @active_user.username %></p>
      </div>
    </div>

    <%= button_to "Delete User", messenger_delete_user_path(@active_user),
        method: :delete,
        data: { confirm: "Delete user and all messages?" },
        class: "bg-red-500 text-white px-4 py-2 rounded" %>
  </div>

  <!-- Messages -->
  <div class="flex-1 overflow-y-auto p-4" data-messenger-target="messageList">
    <% @messages.each do |message| %>
      <%= render 'message', message: message %>
    <% end %>
  </div>

  <!-- Input form -->
  <form class="border-t p-4 flex gap-2"
        data-action="submit->messenger#sendMessage">
    <input type="text"
           data-messenger-target="input"
           placeholder="Type a message..."
           class="flex-1 border rounded-lg px-4 py-2" />
    <button type="submit" class="bg-blue-500 text-white px-6 py-2 rounded-lg">
      Send
    </button>
  </form>
</div>
```

---

## Security Considerations

### Admin Access Control

**Before Action:**
```ruby
before_action :require_admin

def require_admin
  unless @current_user&.admin?
    redirect_to root_path, alert: 'Access denied'
  end
end
```

**Admin Flag in Database:**
```ruby
# db/migrate/xxx_add_admin_to_users.rb
add_column :users, :admin, :boolean, default: false
```

**Set Admin in Console:**
```ruby
# In Rails console
user = User.find_by(username: 'admin_username')
user.update(admin: true)
```

---

### CSRF Protection

**Rails Default:**
- All POST/PATCH/DELETE requests require CSRF token
- Frontend includes token in AJAX requests

**Implementation:**
```javascript
fetch('/messenger/conversations/123/messages', {
  method: 'POST',
  headers: {
    'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
  }
})
```

---

### Rate Limiting (Future)

**Telegram API Limits:**
- 30 messages per second per bot
- 20 messages per minute per chat

**Recommended Implementation:**
```ruby
# app/controllers/messenger_controller.rb
before_action :check_rate_limit, only: [:send_message]

def check_rate_limit
  key = "messenger:#{@current_user.id}:messages"
  count = Rails.cache.read(key) || 0

  if count >= 20
    render json: { error: 'Rate limit exceeded' }, status: 429
    return
  end

  Rails.cache.write(key, count + 1, expires_in: 1.minute)
end
```

---

## Testing

### Controller Tests

**Test message sending:**
```ruby
# test/controllers/messenger_controller_test.rb
class MessengerControllerTest < ActionDispatch::IntegrationTest
  setup do
    @admin = users(:admin)
    @user = users(:user_one)
    @conversation = conversations(:one)
    sign_in @admin
  end

  test "should send message via Telegram API" do
    assert_difference('Message.count') do
      post messenger_conversation_messages_path(@conversation),
           params: { body: "Hello from admin" },
           as: :json
    end

    assert_response :success
    message = Message.last
    assert_equal 'outgoing', message.direction
    assert_equal "Hello from admin", message.body
  end

  test "non-admin cannot access messenger" do
    sign_in @user
    get messenger_path
    assert_redirected_to root_path
  end
end
```

---

### System Tests

**Test real-time messaging:**
```ruby
# test/system/messenger_test.rb
class MessengerTest < ApplicationSystemTestCase
  test "admin receives real-time message" do
    admin = users(:admin)
    sign_in admin

    visit messenger_path

    # Simulate incoming message via ActionCable
    ActionCable.server.broadcast("messenger_channel", {
      type: 'new_message',
      message: {
        body: "Test message",
        direction: "incoming"
      }
    })

    # Verify message appears
    assert_text "Test message"
  end
end
```

---

## Future Enhancements

### Rich Media Support

**Images/Photos:**
```ruby
# Handle Telegram photo messages
def handle_photo_message(message)
  photo_url = download_largest_photo(message[:photo])
  conversation.messages.create!(
    body: message[:caption] || "[Photo]",
    direction: :incoming,
    photo_url: photo_url
  )
end
```

---

### Message Search

**Full-text search:**
```ruby
# Add search to controller
def search
  @messages = Message.where("body LIKE ?", "%#{params[:query]}%")
                    .includes(:conversation, :user)
                    .order(created_at: :desc)
end
```

---

### Message Templates

**Quick replies:**
```ruby
# app/models/message_template.rb
class MessageTemplate < ApplicationRecord
  validates :name, :body, presence: true

  # Predefined templates
  TEMPLATES = {
    welcome: "Welcome to the course! Let me know if you have questions.",
    thanks: "Thank you for your message! I'll get back to you soon.",
    support: "For technical support, please email support@example.com"
  }
end
```

---

### Typing Indicators

**Send typing action:**
```ruby
def send_typing_indicator
  bot_client.api.send_chat_action(
    chat_id: @conversation.user.telegram_id,
    action: 'typing'
  )
end
```

**Frontend:**
```javascript
sendMessage(event) {
  // Send typing indicator before message
  fetch(`/messenger/conversations/${id}/typing`, { method: 'POST' })

  // Then send actual message
  // ...
}
```

---

## AI Qualification Display

### Overview

The messenger dashboard includes an AI-powered lead qualification section that automatically extracts and displays customer information as the AI learns about them through conversation.

**Status:** ✅ Active (Added October 12, 2025)

---

### UI Components

**Location:** Right sidebar in `/messenger` (when conversation selected)

**File:** `app/views/messenger/index.html.erb` (Lines 142-224)

**Visual Design:**
- Gradient purple-to-blue background (`from-purple-50 to-blue-50`)
- Purple-themed icons and labels
- Appears between "Информация" and "Статистика" sections
- Auto-hides if no qualification data present

---

### Fields Displayed

#### 1. Real Name (👤 Имя)
- AI-extracted real name if different from Telegram `first_name`
- Example: Telegram shows "Alex" → AI extracts "Александр" from conversation
- Displayed with purple user icon

#### 2. Background (💼 Бэкграунд)
- Customer's business context and current situation
- Example: "Владеет рестораном в Москве, планирует открыть доставку на Бали"
- Helps admin understand customer's context

#### 3. Query (❓ Запрос/Цель)
- Customer's main question or goal
- Example: "Хочет понять стоимость и сроки запуска доставки"
- Shows what customer wants to achieve

#### 4. Ready Score (⚡ Готовность к покупке)
- Lead readiness score on 0-10 scale
- Color-coded badges with labels:
  - **🔴 0-3** - Холодный лид (red badge, bg-red-100 text-red-800)
  - **🟡 4-7** - Тёплый лид (yellow badge, bg-yellow-100 text-yellow-800)
  - **🟢 8-10** - Горячий лид (green badge, bg-green-100 text-green-800)
- Displays score numerically: "7/10"

---

### Data Source

**Backend:** `N8nController#send_message` (app/controllers/n8n_controller.rb:28-34)

AI response from N8N includes parameters:
```ruby
{
  text: "Message for customer",
  real_name: "Александр",
  background: "Restaurant owner in Moscow",
  query: "Course pricing and timeline",
  ready: "7"
}
```

**Saved to Conversation:**
```ruby
conversation.update!(
  ai_real_name: params[:real_name],
  ai_background: params[:background],
  ai_query: params[:query],
  ai_ready_score: params[:ready]
)
```

---

### Real-Time Updates

**Update Trigger:** AI sends response via N8N → Rails

**Data Flow:**
1. User sends message in Telegram
2. AI analyzes conversation history
3. AI generates response with qualification data
4. N8N sends to Rails with separate parameters
5. Rails saves AI data to `conversation` table
6. Page refresh shows updated qualification

**Future Enhancement:** Real-time update via ActionCable broadcast (no refresh needed)

---

### Use Cases

**Sales Prioritization:**
```ruby
# Find hot leads (ready to buy)
hot_leads = Conversation.where('ai_ready_score >= 8').includes(:user)
```

**Lead Segmentation:**
```ruby
# Segment by readiness
cold = Conversation.where('ai_ready_score <= 3')   # Need nurturing
warm = Conversation.where('ai_ready_score BETWEEN 4 AND 7')  # Active engagement
hot = Conversation.where('ai_ready_score >= 8')    # Close to purchase
```

**Context for Responses:**
- Admin can see customer background before responding
- Query field shows what customer is trying to achieve
- Ready score helps prioritize which conversations to handle first

---

### Visual Example

```erb
<div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4 border border-purple-100">
  <h4 class="text-sm font-semibold text-purple-700 flex items-center gap-2">
    🤖 AI Квалификация
  </h4>

  <div class="space-y-3">
    <!-- Real Name -->
    <div>
      <p class="text-xs text-purple-600">👤 Имя</p>
      <p class="text-sm font-medium">Александр</p>
    </div>

    <!-- Background -->
    <div>
      <p class="text-xs text-purple-600">💼 Бэкграунд</p>
      <p class="text-sm">Владеет рестораном в Москве, планирует открыть на Бали</p>
    </div>

    <!-- Query -->
    <div>
      <p class="text-xs text-purple-600">❓ Запрос/Цель</p>
      <p class="text-sm">Стоимость и сроки запуска доставки</p>
    </div>

    <!-- Ready Score with Badge -->
    <div>
      <p class="text-xs text-purple-600">⚡ Готовность к покупке</p>
      <div class="flex items-center gap-2">
        <span class="px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-800">
          🟡 Тёплый лид
        </span>
        <span class="text-lg font-bold">7/10</span>
      </div>
    </div>
  </div>
</div>
```

---

### Integration with AI Auto-Responder

**Related Documentation:** See `ai_auto_responder.md` for:
- How AI extracts qualification data
- N8N workflow configuration
- Prompt engineering for data extraction
- Backend processing details

**Data Flow:**
```
User Message → AI Analysis → N8N → Rails (N8nController)
                                      ↓
                            Save to conversation fields
                                      ↓
                            Display in messenger dashboard
```

---

## Conclusion

The messenger feature provides a complete admin communication interface integrated with Telegram. Real-time WebSocket updates ensure instant message delivery, while avatar synchronization creates a polished user experience. The new AI qualification display gives admins instant visibility into lead quality and customer context, enabling prioritized and personalized responses.

**Key Achievements:**
- Two-way real-time messaging
- Avatar synchronization from Telegram
- **AI-powered lead qualification** ✨
- **Color-coded readiness scoring** ✨
- Clean Stimulus-based architecture
- Admin access control
- Graceful error handling
- Foundation for future enhancements
