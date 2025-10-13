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

### Channel Selection Tabs

**Status:** ✅ Implemented (October 13, 2025)

**Overview:**
Tab-based UI для выбора канала отправки сообщений (Bot или Business). Каждая вкладка показывает количество сообщений по каждому каналу и при нажатии фильтрует видимые сообщения.

**Файлы:**
- `app/views/messenger/index.html.erb` (lines 70-87) - HTML структура вкладок
- `app/javascript/controllers/messenger_controller.js` (lines 36-86) - Логика переключения и фильтрации
- `app/views/messenger/_messages.html.erb` (line 2) - Атрибут `data-source-type`

**Визуальный дизайн:**

```erb
<!-- Вкладки для фильтрации по источнику -->
<div class="bg-white border-b border-gray-200 px-4 py-2 flex gap-2">
  <!-- Вкладка "Бот" -->
  <button
    data-messenger-target="tabBot"
    data-action="click->messenger#switchTab"
    data-tab="bot"
    class="tab-button px-4 py-2 rounded-lg font-medium transition-colors <%= last_message_source == 'bot' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100' %>">
    🤖 Бот (<%= @messages.from_bot.count %>)
  </button>

  <!-- Вкладка "Бизнес" -->
  <button
    data-messenger-target="tabBusiness"
    data-action="click->messenger#switchTab"
    data-tab="business"
    class="tab-button px-4 py-2 rounded-lg font-medium transition-colors <%= last_message_source == 'business' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100' %>">
    👤 Бизнес (<%= @messages.from_business.count %>)
  </button>
</div>
```

**Цветовые схемы:**
- **Бот (активная):** `bg-blue-100 text-blue-700` - Синий
- **Бизнес (активная):** `bg-green-100 text-green-700` - Зеленый
- **Неактивная:** `text-gray-600 hover:bg-gray-100` - Серый с hover эффектом

**JavaScript реализация:**

**1. Автодетекция активной вкладки при загрузке**
```javascript
// app/javascript/controllers/messenger_controller.js (lines 36-42)
connect() {
  // Определяем активную вкладку по последнему сообщению
  const messages = this.element.querySelectorAll('.message-item')
  const lastMessage = messages[messages.length - 1]
  this.activeTab = lastMessage?.dataset.sourceType || 'bot'

  this.subscribeToChannel()
  this.scrollToBottom()
}
```

**2. switchTab() - Обработчик переключения вкладок**
```javascript
// app/javascript/controllers/messenger_controller.js (lines 45-70)
switchTab(event) {
  const button = event.currentTarget
  const tab = button.dataset.tab

  // Обновляем активную вкладку
  this.activeTab = tab

  // Обновляем стили кнопок
  const allButtons = this.element.querySelectorAll('.tab-button')
  allButtons.forEach(btn => {
    btn.classList.remove('bg-blue-100', 'text-blue-700', 'bg-green-100', 'text-green-700')
    btn.classList.add('text-gray-600', 'hover:bg-gray-100')
  })

  // Подсвечиваем активную
  if (tab === 'bot') {
    button.classList.remove('text-gray-600', 'hover:bg-gray-100')
    button.classList.add('bg-blue-100', 'text-blue-700')
  } else if (tab === 'business') {
    button.classList.remove('text-gray-600', 'hover:bg-gray-100')
    button.classList.add('bg-green-100', 'text-green-700')
  }

  // Фильтруем сообщения
  this.filterMessages()
}
```

**3. filterMessages() - Фильтрация сообщений по типу**
```javascript
// app/javascript/controllers/messenger_controller.js (lines 72-86)
filterMessages() {
  const messages = this.messagesTarget.querySelectorAll('.message-item')

  messages.forEach(msg => {
    const sourceType = msg.dataset.sourceType

    if (this.activeTab === sourceType) {
      msg.style.display = 'flex'  // Показываем совпадающие
    } else {
      msg.style.display = 'none'  // Скрываем несовпадающие
    }
  })

  this.scrollToBottom()
}
```

**Интеграция с отправкой сообщений:**

При отправке сообщения админом, `activeTab` передается в backend через `source_type` параметр:

```javascript
// app/javascript/controllers/messenger_controller.js (lines 506-532)
async sendMessage(event) {
  event.preventDefault()

  const body = this.inputTarget.value.trim()
  if (!body) return

  try {
    const response = await fetch(`/messenger/conversations/${this.activeConversationId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      },
      body: JSON.stringify({
        body: body,
        source_type: this.activeTab  // ← Передаём выбранную вкладку
      })
    })

    // ...
  }
}
```

**Backend обработка:**
```ruby
# app/controllers/messenger_controller.rb (lines 35-54)
def send_message
  body = params[:body]

  # Используем source_type из параметров запроса (выбор пользователя через вкладки)
  source_type = params[:source_type] || 'bot'

  Rails.logger.info "Sending message via #{source_type} channel"

  # Отправляем через выбранный канал
  if source_type.to_s == 'business'
    send_via_business_connection(body)
  else
    send_via_bot(body)
  end
end
```

**Real-time обновления при новых сообщениях:**

Когда приходит новое сообщение через ActionCable, система автоматически добавляет его с корректным `data-source-type` атрибутом:

```javascript
// app/javascript/controllers/messenger_controller.js (lines 246-301)
createMessageElement(message) {
  const sourceType = message.source_type || 'bot';

  // ... message rendering
  return `
    <div class="message-item flex" data-message-id="${message.id}" data-source-type="${sourceType}">
      <!-- message content -->
    </div>
  `
}
```

**Пользовательский опыт:**

1. **При открытии беседы:**
   - Автоматически активируется вкладка последнего сообщения
   - Отображаются только сообщения этого типа

2. **При переключении вкладок:**
   - Мгновенная фильтрация через CSS `display: none`
   - Цвет вкладки меняется (синий/зеленый)
   - Счетчик показывает количество сообщений

3. **При отправке сообщения:**
   - Сообщение отправляется через канал активной вкладки
   - Новое сообщение появляется в текущей вкладке
   - Счетчик обновляется автоматически

**Связь с Telegram Business API:**
См. `telegram_business_api.md` для деталей о:
- Dual-channel messaging (Bot + Business)
- Business connection setup
- Message routing logic

---

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

**Update Trigger:** AI sends response via N8N → Rails → ActionCable broadcast

**Data Flow:**
1. User sends message in Telegram
2. AI analyzes conversation history
3. AI generates response with qualification data
4. N8N sends to Rails with separate parameters
5. Rails saves AI data to `conversation` table
6. **Rails broadcasts via ActionCable with AI data**
7. **Messenger Stimulus controller updates sidebar automatically** ✨

**Real-Time Updates:** ✅ Implemented (October 12, 2025)
- No page refresh needed
- AI data appears instantly when N8N sends response
- Ready score badge updates with correct color (🔴🟡🟢)
- Statistics increment automatically with each message

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
                         ActionCable broadcast with AI data
                                      ↓
                    Messenger Stimulus controller receives data
                                      ↓
                         Updates sidebar UI automatically
```

**Technical Implementation:**

**Backend Broadcast (N8nController, MessengerController, AuthController):**
```ruby
ActionCable.server.broadcast("messenger_channel", {
  type: 'new_message',
  conversation: {
    # ... other fields
    ai_qualification: {
      real_name: conversation.ai_real_name,
      background: conversation.ai_background,
      query: conversation.ai_query,
      ready_score: conversation.ai_ready_score
    },
    statistics: {
      total_messages: conversation.messages.count,
      incoming_count: conversation.messages.incoming.count,
      outgoing_count: conversation.messages.outgoing.count
    }
  }
})
```

**Frontend Handler (messenger_controller.js:88-185):**
```javascript
handleNewMessage(data) {
  // ... handle message display

  // Update sidebar if active conversation
  if (String(conversationId) === String(this.activeConversationId)) {
    this.updateSidebar(data.conversation)
  }
}

updateSidebar(conversationData) {
  if (conversationData.ai_qualification) {
    this.updateAIQualification(conversationData.ai_qualification)
  }
  if (conversationData.statistics) {
    this.updateStatistics(conversationData.statistics)
  }
}

updateAIQualification(aiData) {
  // Updates real_name, background, query fields
  // Updates ready_score with color-coded badge
  // Shows/hides containers dynamically
}

updateStatistics(stats) {
  // Updates total_messages, incoming_count, outgoing_count
}
```

**Stimulus Targets:**
```javascript
static targets = [
  "aiQualificationSection",    // Container for entire AI section
  "aiRealName",                 // Real name text
  "aiBackground",               // Background text
  "aiQuery",                    // Query text
  "aiReadyBadge",              // Badge with color and label
  "aiReadyScore",              // Score number (7/10)
  "totalMessages",             // Total message count
  "incomingMessages",          // Incoming count
  "outgoingMessages"           // Outgoing count
]
```

---

---

## AI Pause Control

### Overview

The AI Pause Control feature allows admins to temporarily pause the AI auto-responder for specific conversations and take over manually when needed. This provides flexibility to handle complex, sensitive, or high-priority conversations with a human touch.

**Status:** ✅ Active (Added October 13, 2025)

**Use Cases:**
- **Complex discussions** - Pause AI when customer needs nuanced conversation
- **Hot leads** - Pause AI for personalized sales approach (ready score 8+)
- **Technical support** - Pause AI when expert knowledge required
- **Routine questions** - Resume AI for automated handling

---

### UI Components

**Location:** Channel tab bar in `/messenger` (next to 🤖 Бот / 👤 Бизнес tabs)

**File:** `app/views/messenger/index.html.erb` (Lines 88-106)

**Visual Design:**
- Positioned on same line as channel tabs, aligned right with `ml-auto`
- Two states with distinct visual indicators:
  - **AI Active:** Gray button "Пауза AI" (`bg-gray-100 text-gray-700`)
  - **AI Paused:** Green button "Включить AI" (`bg-green-100 text-green-700`)
- SVG icons: Pause icon (⏸) when active, Play icon (▶️) when paused

**Button HTML:**
```erb
<button
  data-messenger-target="aiPauseButton"
  data-action="click->messenger#toggleAiPause"
  data-ai-paused="<%= @active_conversation.ai_paused %>"
  class="ml-auto px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 <%= @active_conversation.ai_paused ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-200' %>">
  <% if @active_conversation.ai_paused %>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    Включить AI
  <% else %>
    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
    </svg>
    Пауза AI
  <% end %>
</button>
```

---

### Backend Implementation

**Database Schema:**

```ruby
# db/migrate/20251013111309_add_ai_paused_to_conversations.rb
add_column :conversations, :ai_paused, :boolean, default: false, null: false
```

**Controller Action:**

**File:** `app/controllers/messenger_controller.rb` (Lines 63-81)

**Route:** `PATCH /messenger/conversations/:id/toggle_ai_pause`

```ruby
def toggle_ai_pause
  @conversation.update!(ai_paused: !@conversation.ai_paused)

  Rails.logger.info "AI #{@conversation.ai_paused ? 'paused' : 'resumed'} for conversation #{@conversation.id}"

  # Broadcast обновление состояния паузы всем админам
  ActionCable.server.broadcast("messenger_channel", {
    type: 'ai_pause_toggled',
    conversation_id: @conversation.id,
    ai_paused: @conversation.ai_paused
  })

  render json: {
    success: true,
    ai_paused: @conversation.ai_paused,
    message: @conversation.ai_paused ? 'AI приостановлен' : 'AI активирован'
  }
end
```

**Before Action:**
```ruby
# Line 5
before_action :set_conversation, only: [:messages, :send_message, :mark_read, :toggle_ai_pause]
```

---

### JavaScript Implementation

**File:** `app/javascript/controllers/messenger_controller.js`

**Stimulus Target:**
```javascript
// Line 14
static targets = [
  "aiPauseButton",
  // ... other targets
]
```

**Method: toggleAiPause() (Lines 457-489)**

Sends PATCH request to toggle AI pause state:

```javascript
async toggleAiPause(event) {
  event.preventDefault()

  if (!this.activeConversationId) {
    console.error('No active conversation')
    return
  }

  const button = this.aiPauseButtonTarget

  try {
    const response = await fetch(`/messenger/conversations/${this.activeConversationId}/toggle_ai_pause`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
      }
    })

    const data = await response.json()

    if (data.success) {
      // Обновляем кнопку
      this.updateAiPauseButton(data.ai_paused)
      console.log('AI pause toggled:', data.message)
    } else {
      alert('Не удалось изменить статус AI')
    }
  } catch (error) {
    console.error('Failed to toggle AI pause:', error)
    alert('Ошибка изменения статуса AI')
  }
}
```

**Method: updateAiPauseButton() (Lines 491-516)**

Updates button appearance based on pause state:

```javascript
updateAiPauseButton(isPaused) {
  const button = this.aiPauseButtonTarget

  if (isPaused) {
    // AI на паузе - показываем кнопку "Включить AI" (зеленая)
    button.className = 'ml-auto px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 bg-green-100 text-green-700 hover:bg-green-200'
    button.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Включить AI
    `
  } else {
    // AI активен - показываем кнопку "Пауза AI" (серая)
    button.className = 'ml-auto px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200'
    button.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      Пауза AI
    `
  }

  button.dataset.aiPaused = isPaused
}
```

**Method: handleAiPauseToggled() (Lines 151-157)**

Handles real-time updates from other admin sessions via ActionCable:

```javascript
handleAiPauseToggled(data) {
  // Обновляем кнопку только если это для активной беседы
  if (String(data.conversation_id) === String(this.activeConversationId)) {
    this.updateAiPauseButton(data.ai_paused)
    console.log('AI pause status updated via broadcast:', data.ai_paused)
  }
}
```

**Updated received() handler (Lines 106-114):**

```javascript
received: (data) => {
  console.log("Received from MessengerChannel:", data)

  if (data.type === "new_message") {
    this.handleNewMessage(data)
  } else if (data.type === "ai_pause_toggled") {
    this.handleAiPauseToggled(data)
  }
}
```

---

### AI Filtering Logic

The `ai_paused` flag prevents AI webhook calls when conversation is paused.

**File:** `app/controllers/auth_controller.rb`

**In handle_text_message() (Lines 333-348):**

Checks `ai_paused` before triggering N8N webhook for bot messages:

```ruby
# Reload conversation для получения актуального last_message_at и unread_count
conversation.reload

# Проверяем, не на паузе ли AI для этой беседы
if conversation.ai_paused
  Rails.logger.info "🚫 AI paused for conversation #{conversation.id}, skipping N8N webhook"
else
  # Устанавливаем флаг что AI обрабатывает сообщение
  conversation.update!(ai_processing: true)

  # Отправляем первый typing indicator сразу
  send_typing_action(telegram_id)

  # Запускаем фоновую задачу для продолжения typing индикатора
  TypingIndicatorJob.set(wait: 4.seconds).perform_later(conversation.id)

  # Отправляем сообщение на N8N
  send_message_to_n8n(msg, user, conversation)
end
```

**In handle_business_message() (Lines 567-578):**

Same logic applied to business messages:

```ruby
conversation.reload

# Проверяем, не на паузе ли AI для этой беседы
if conversation.ai_paused
  Rails.logger.info "🚫 AI paused for conversation #{conversation.id}, skipping N8N webhook"
else
  # Устанавливаем флаг AI обработки (typing indicator)
  conversation.update!(ai_processing: true)
  send_typing_action(user.telegram_id)
  TypingIndicatorJob.set(wait: 4.seconds).perform_later(conversation.id)

  # Отправляем в N8N (как обычно)
  send_message_to_n8n(msg, user, conversation)
end
```

**Result:**
- When `ai_paused = true`: Incoming messages are saved to database and broadcasted to admin, but N8N webhook is skipped
- No typing indicator shown to customer
- No AI processing triggered
- Admin can respond manually

---

### Real-Time Updates

**ActionCable Broadcast:**

**Broadcast Type:** `ai_pause_toggled`

**Payload:**
```javascript
{
  type: 'ai_pause_toggled',
  conversation_id: 123,
  ai_paused: true
}
```

**Behavior:**
- When admin toggles AI pause in one browser/tab
- Rails broadcasts `ai_pause_toggled` event
- All other admin sessions receive the broadcast
- Buttons update automatically without page refresh

**Example:**
1. Admin A opens conversation, clicks "Пауза AI"
2. Backend broadcasts `{type: 'ai_pause_toggled', conversation_id: 123, ai_paused: true}`
3. Admin B (who has same conversation open) sees button turn green "Включить AI" automatically

---

### Workflow Example

**Scenario:** Hot lead ready to buy (ready score: 9)

**Before AI Pause:**
1. Customer: "What's the price for VIP tier?"
2. AI: "VIP tier is $3,000. Includes..."
3. Customer: "Can I get a discount?"
4. AI: "Unfortunately we don't offer..."

**With AI Pause:**
1. Customer: "What's the price for VIP tier?"
2. Admin sees ready score: 9/10 (🟢 Горячий лид)
3. Admin clicks "⏸ Пауза AI" (button turns green)
4. AI auto-responder is now disabled for this conversation
5. Customer: "Can I get a discount?"
6. **No AI response** (N8N webhook skipped)
7. Admin responds manually: "Absolutely! For serious buyers like you, I can offer 15% off. Let me send you a personalized proposal..."
8. Customer: "Great! Send it please"
9. Admin handles sale personally
10. After sale closes, admin clicks "▶️ Включить AI" to resume automation

---

### Integration with AI Auto-Responder

**Related Documentation:** See `ai_auto_responder.md` for:
- How AI processing works
- N8N webhook integration
- Typing indicator implementation

**Data Flow with AI Pause:**

```
User Message → Telegram → Rails (AuthController)
                            ↓
                      Check ai_paused flag
                            ↓
                ┌───────────┴──────────┐
                │                      │
         ai_paused = true       ai_paused = false
                │                      │
         Skip N8N webhook       Start typing indicator
         Admin handles manually        ↓
                                N8N webhook (AI)
                                       ↓
                                 AI response
```

**Technical Implementation:**

**Route Configuration:**
```ruby
# config/routes.rb (Line 23)
patch 'conversations/:id/toggle_ai_pause', to: 'messenger#toggle_ai_pause'
```

---

### Testing

**Manual Testing:**

1. Open messenger dashboard
2. Select conversation
3. Click "⏸ Пауза AI" button
4. Verify:
   - Button turns green with "Включить AI" text
   - Play icon (▶️) appears
5. Send message from Telegram as user
6. Verify:
   - Message appears in admin dashboard
   - No AI response sent to user
   - No typing indicator shown
   - Log shows: "🚫 AI paused for conversation X, skipping N8N webhook"
7. Admin responds manually
8. Click "▶️ Включить AI" button
9. Verify:
   - Button turns gray with "Пауза AI" text
   - Pause icon (⏸) appears
10. Send message from Telegram
11. Verify:
    - AI responds automatically
    - Typing indicator appears
    - Log shows N8N webhook sent

**Multi-Session Testing:**

1. Open conversation in Browser A
2. Open same conversation in Browser B
3. In Browser A, click "⏸ Пауза AI"
4. Verify in Browser B:
   - Button updates to "Включить AI" automatically
   - No page refresh needed

---

### Security Considerations

**Admin-Only Access:**
- Only admins can toggle AI pause
- `before_action :require_admin` enforced on MessengerController
- No API endpoint exposed to non-admin users

**CSRF Protection:**
- All PATCH requests include CSRF token
- Standard Rails protection applies

---

### Future Enhancements

**Potential Features:**

1. **Auto-pause on hot leads:**
   ```ruby
   # Automatically pause AI when ready_score >= 9
   if conversation.ai_ready_score.to_i >= 9
     conversation.update!(ai_paused: true)
     AdminNotification.hot_lead_alert(conversation)
   end
   ```

2. **Pause with reason:**
   ```ruby
   # Track why AI was paused
   add_column :conversations, :ai_pause_reason, :string
   # Reasons: 'manual', 'hot_lead', 'complex_issue', 'technical_support'
   ```

3. **Auto-resume after timeout:**
   ```ruby
   # Resume AI after 30 minutes of inactivity
   class ResumeAiJob < ApplicationJob
     def perform(conversation_id)
       conversation = Conversation.find(conversation_id)
       if conversation.ai_paused && conversation.last_message_at < 30.minutes.ago
         conversation.update!(ai_paused: false)
       end
     end
   end
   ```

4. **Pause notifications:**
   ```ruby
   # Notify admin when AI is paused
   ActionCable.server.broadcast("admin_notifications", {
     type: 'ai_paused',
     conversation_id: conversation.id,
     user_name: conversation.user.full_name
   })
   ```

---

## Conclusion

The messenger feature provides a complete admin communication interface integrated with Telegram. Real-time WebSocket updates ensure instant message delivery, while avatar synchronization creates a polished user experience. The new AI qualification display gives admins instant visibility into lead quality and customer context, enabling prioritized and personalized responses.

**Key Achievements:**
- Two-way real-time messaging
- Avatar synchronization from Telegram
- **AI-powered lead qualification** ✨
- **Color-coded readiness scoring** ✨
- **AI Pause Control for manual intervention** ✨
- Clean Stimulus-based architecture
- Admin access control
- Graceful error handling
- Foundation for future enhancements

**Last Updated:** October 13, 2025
