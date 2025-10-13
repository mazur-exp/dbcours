# Telegram Business API Integration

## Overview

Telegram Business API позволяет боту подключаться к личному бизнес-аккаунту Telegram и управлять сообщениями от имени этого аккаунта. Это создаёт seamless опыт где клиенты общаются с бизнес-аккаунтом, а ответы обрабатываются ботом и админами в CRM системе.

**Status:** ✅ Implemented (October 13, 2025)

---

## How It Works

### Connection Flow

1. **Business account owner** подключает бота к своему Telegram бизнес-аккаунту
2. Telegram отправляет `business_connection` update в webhook
3. Rails сохраняет connection в базу данных
4. Бот начинает получать сообщения из чатов бизнес-аккаунта
5. Админ видит все сообщения в messenger dashboard
6. Админ может отвечать через бота ИЛИ через бизнес-аккаунт

---

## Database Schema

### business_connections Table

```ruby
create_table :business_connections do |t|
  t.string :business_connection_id, null: false  # Unique ID from Telegram
  t.references :user, null: false                # User who owns business account
  t.bigint :user_chat_id, null: false            # Chat ID for sending business messages
  t.boolean :can_reply, default: false           # Bot can send messages
  t.boolean :is_enabled, default: true           # Connection active
  t.datetime :connected_at, null: false          # When connected
  t.datetime :disconnected_at                    # When disconnected (if applicable)
  t.integer :status, default: 0                  # enum: active=0, disconnected=1
  t.timestamps
end

add_index :business_connections, :business_connection_id, unique: true
add_index :business_connections, [:user_id, :status]
```

### messages Table (Updated)

```ruby
# New fields added
t.integer :source_type, default: 0, null: false  # enum: bot=0, business=1
t.string :business_connection_id                 # Связь с business connection

add_index :messages, :business_connection_id
add_index :messages, [:conversation_id, :source_type]
```

---

## Webhook Handling

### business_connection Update

**Trigger:** User connects/disconnects bot from business account

**Payload:**
```json
{
  "business_connection": {
    "id": "ABCD1234567890",
    "user": {
      "id": 123456789,
      "first_name": "John",
      "username": "johndoe"
    },
    "user_chat_id": 123456789,
    "date": 1697654321,
    "can_reply": true,
    "is_enabled": true
  }
}
```

**Handler:** `AuthController#handle_business_connection` (lines 469-506)

**Actions:**
- Creates/updates BusinessConnection record
- Sets status: active/disconnected
- Logs connection event

---

### business_message Update

**Trigger:** Customer sends message to business account

**Payload:**
```json
{
  "business_connection_id": "ABCD1234567890",
  "business_message": {
    "message_id": 456,
    "from": {
      "id": 987654321,
      "first_name": "Customer",
      "username": "customer123"
    },
    "chat": {"id": 987654321},
    "text": "Hello, I have a question"
  }
}
```

**Handler:** `AuthController#handle_business_message` (lines 508-577)

**Actions:**
- Saves message with `source_type: :business`
- Stores `business_connection_id`
- Triggers AI processing (same as bot messages)
- Broadcasts to messenger with source indicator

---

## Sending Messages

### Through Bot (Default)

```ruby
# MessengerController#send_via_bot (lines 94-148)
bot_client.api.send_message(
  chat_id: user.telegram_id,
  text: body
)

# Saved with source_type: :bot
```

### Through Business Connection

```ruby
# MessengerController#send_via_business_connection (lines 152-232)
bot_client.api.send_message(
  business_connection_id: connection.business_connection_id,
  chat_id: user.telegram_id,
  text: body
)

# Saved with source_type: :business
```

**Routing Logic (User-Selected Channel):**

Раньше канал выбирался автоматически на основе последнего входящего сообщения. Теперь админ выбирает канал через UI вкладки.

```ruby
# app/controllers/messenger_controller.rb (lines 35-54)
def send_message
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

**Frontend передает source_type:**
```javascript
// app/javascript/controllers/messenger_controller.js (lines 522-532)
fetch(`/messenger/conversations/${conversationId}/messages`, {
  method: 'POST',
  body: JSON.stringify({
    body: body,
    source_type: this.activeTab  // Передаём выбранную вкладку (bot/business)
  })
})
```

---

## UI Components

### Tab-Based UI for Channel Selection

**Status:** ✅ Implemented (October 13, 2025)

**Описание:**
Вместо автоматического роутинга админ теперь выбирает канал отправки через вкладки. Система показывает две вкладки с количеством сообщений по каждому каналу и фильтрует отображаемые сообщения при переключении.

**Расположение:** `app/views/messenger/index.html.erb` (lines 70-87)

**Структура вкладок:**
```erb
<!-- Вкладки для фильтрации по источнику -->
<div class="bg-white border-b border-gray-200 px-4 py-2 flex gap-2">
  <button
    data-messenger-target="tabBot"
    data-action="click->messenger#switchTab"
    data-tab="bot"
    class="tab-button px-4 py-2 rounded-lg font-medium transition-colors">
    🤖 Бот (<%= @messages.from_bot.count %>)
  </button>
  <button
    data-messenger-target="tabBusiness"
    data-action="click->messenger#switchTab"
    data-tab="business"
    class="tab-button px-4 py-2 rounded-lg font-medium transition-colors">
    👤 Бизнес (<%= @messages.from_business.count %>)
  </button>
</div>
```

**Визуальные стили:**
- **Активная вкладка "Бот":** `bg-blue-100 text-blue-700`
- **Активная вкладка "Бизнес":** `bg-green-100 text-green-700`
- **Неактивная:** `text-gray-600 hover:bg-gray-100`

**JavaScript функции:**

**1. switchTab() - Переключение вкладок**
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

**2. filterMessages() - Фильтрация сообщений**
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

**3. Автоматическое определение активной вкладки**
```javascript
// app/javascript/controllers/messenger_controller.js (lines 36-39)
connect() {
  // Определяем активную вкладку по последнему сообщению
  const messages = this.element.querySelectorAll('.message-item')
  const lastMessage = messages[messages.length - 1]
  this.activeTab = lastMessage?.dataset.sourceType || 'bot'
}
```

**Атрибут data-source-type в сообщениях:**
```erb
<!-- app/views/messenger/_messages.html.erb (line 2) -->
<div class="message-item flex" data-message-id="<%= message.id %>" data-source-type="<%= message.source_type %>">
  <!-- message content -->
</div>
```

**Логика работы:**
1. При загрузке страницы автоматически активируется вкладка последнего сообщения
2. Клик по вкладке переключает `activeTab` в Stimulus контроллере
3. `filterMessages()` скрывает сообщения несовпадающего типа через `display: none`
4. При отправке сообщения передается `source_type: this.activeTab` в бэкенд
5. Новые сообщения отображаются только на соответствующей вкладке

**Преимущества:**
- Ясный контроль админа над каналом отправки
- Визуальное разделение потоков сообщений (Bot vs Business)
- Счетчики помогают видеть объем общения по каждому каналу
- Фильтрация работает мгновенно через JavaScript

---

### Message Source Indicators

**Bot Messages:**
- 🤖 Blue icon
- Blue background for outgoing
- Tooltip: "Через бота"

**Business Messages:**
- 👤 Green icon
- Green background for outgoing
- Tooltip: "Через бизнес-аккаунт"

**Location:** `app/views/messenger/_messages.html.erb` + `messenger_controller.js`

---

### Business Connections Admin Page

**Route:** `/messenger/business_connections`

**Access:** Admins only

**Shows:**
- ✅ Active connections (green section)
- ❌ Disconnected connections (gray section)
- User info, connection ID, date, permissions

**File:** `app/views/business_connections/index.html.erb`

---

## Setup Instructions

### Step 1: Enable Business Features in BotFather

1. Open [@BotFather](https://t.me/BotFather)
2. Send `/mybots`
3. Select your bot
4. Choose "Bot Settings" → "Business Mode"
5. Enable Business Mode

### Step 2: Connect Bot to Business Account

1. Open Telegram on device where you have business account
2. Go to Settings → Business → Linked Bots
3. Tap "Link Bot"
4. Search for your bot
5. Grant permissions
6. Confirm connection

### Step 3: Verify in Admin Panel

1. Login as admin
2. Go to `/messenger/business_connections`
3. Verify connection appears with ✅ status
4. Check `can_reply` permission

### Step 4: Test Messaging

1. Send message to business account from customer
2. Verify appears in messenger dashboard with 👤 icon
3. Reply from dashboard
4. Customer receives message from business account (not bot)

---

## API Methods

### sendBusinessMessage

```ruby
bot_client.api.send_business_message(
  business_connection_id: "ABCD1234",
  chat_id: 987654321,
  text: "Message text"
)
```

**Returns:** Message object with message_id

---

## Models

### BusinessConnection

**File:** `app/models/business_connection.rb`

**Methods:**
- `can_send_messages?` - Check if can reply
- `disconnect!` - Deactivate connection

**Scopes:**
- `active_connections` - Only active
- `recent` - Ordered by connected_at desc

---

### Message (Updated)

**New enum:**
```ruby
enum :source_type, { bot: 0, business: 1 }
```

**New scopes:**
- `from_bot` - Bot messages only
- `from_business` - Business messages only

---

## Future Enhancements

### Business Connection Management

- Disable/enable connections from admin panel
- View connection analytics (message volume per source)
- Export conversation by source type

### Multi-Business Support

- Support multiple business connections per user
- Choose which business account to use for reply
- Business account selector in messenger UI

---

## Security

**Admin Access:** Only users with `admin: true` can:
- View business connections list
- See source type of messages
- Send messages through business connection

**Connection Permissions:** Checked before sending:
```ruby
business_conn.can_send_messages?  # checks active + can_reply + is_enabled
```

---

## Troubleshooting

### Connection Not Appearing

**Check:**
1. Bot has Business Mode enabled in BotFather
2. Webhook is active and receiving updates
3. Check Rails logs for business_connection updates

### Messages Not Routing Correctly

**Check message source_type:**
```ruby
Message.last.source_type  # Should be 'bot' or 'business'
```

**Verify business_connection_id:**
```ruby
Message.where.not(business_connection_id: nil).count
```

---

## Documentation Files

- **This file:** `telegram_business_api.md` - Business API integration
- **Related:** `messenger_feature.md` - Messenger UI and real-time updates
- **Related:** `telegram_authentication.md` - Bot authentication flow

---

**Last Updated:** October 13, 2025
