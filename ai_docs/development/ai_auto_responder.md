# AI-Powered Auto-Responder

## Overview

The AI Auto-Responder is a sophisticated feature that provides context-aware, automated responses to user messages through an AI-powered workflow. When a user sends a message via Telegram, the system:

1. Displays a typing indicator to the user
2. Sends the message with full conversation history to N8N
3. N8N forwards to AI (OpenAI/Claude/etc.) for analysis
4. AI generates a structured response with lead qualification data
5. Response is sent back through the Rails API to Telegram
6. Typing indicator stops, user receives AI response

**Key Capabilities:**
- Real-time typing indicator during AI processing
- Context-aware responses using conversation history (last 50 messages)
- Automatic lead qualification (name, background, query analysis, readiness score)
- Structured AI responses with JSON parsing
- Markdown formatting support for rich message content
- Graceful fallbacks for error cases

---

## Architecture

### Components

**Backend:**
- `AuthController#handle_text_message` - Entry point for incoming messages, triggers typing indicator
- `TypingIndicatorJob` - Background job that loops every 4 seconds showing typing action
- `Conversation#ai_processing` flag - Start/stop mechanism for typing indicator
- `N8nController#send_message` - Receives AI response, parses JSON, stops typing, sends to Telegram
- `Conversation` AI fields - Stores qualification data (ai_real_name, ai_background, ai_query, ai_ready_score)

**External:**
- N8N workflow - Receives message events, calls AI API, sends response back to Rails
- AI Provider (OpenAI/Claude) - Analyzes conversation, generates response with qualification

**Flow:**
```
User Message → Telegram → Rails (AuthController)
                            ↓
                      Start typing indicator (TypingIndicatorJob)
                            ↓
                      N8N webhook (message_received event)
                            ↓
                      AI Analysis (OpenAI/Claude)
                            ↓
                      N8N → Rails API (N8nController)
                            ↓
                      Parse JSON, stop typing
                            ↓
                      Send to Telegram → User receives response
```

---

## Implementation Details

### 1. Incoming Message Processing

**Location:** `app/controllers/auth_controller.rb` (Lines 269-329)

**Flow:**

```ruby
def handle_text_message(message)
  telegram_id = message["from"]["id"]
  user = User.find_by(telegram_id: telegram_id, authenticated: true)
  return unless user # Ignore unauthenticated users

  # Create message in database
  conversation = user.conversation
  msg = conversation.messages.create!(
    user: user,
    body: message["text"],
    direction: :incoming,
    telegram_message_id: message["message_id"],
    read: false
  )

  # Reload conversation for fresh data
  conversation.reload

  # START AI PROCESSING
  # Set flag that AI is processing (starts typing indicator loop)
  conversation.update!(ai_processing: true)

  # Send first typing indicator immediately
  send_typing_action(telegram_id)

  # Schedule background job to continue showing typing (loops every 4 seconds)
  TypingIndicatorJob.set(wait: 4.seconds).perform_later(conversation.id)

  # Send message to N8N for AI processing
  send_message_to_n8n(msg, user, conversation)

  # Broadcast to admin dashboard via ActionCable
  ActionCable.server.broadcast("messenger_channel", {
    type: "new_message",
    conversation_id: conversation.id,
    message: msg.as_json(include: :user),
    conversation: { /* ... */ }
  })
end
```

**Key Points:**
- `ai_processing` flag set to `true` → triggers typing indicator loop
- First typing action sent immediately for instant UX feedback
- TypingIndicatorJob scheduled with 4-second delay
- N8N webhook sent with full conversation history

---

### 2. Typing Indicator Job

**Location:** `app/jobs/typing_indicator_job.rb` (Lines 1-40)

**Complete Implementation:**

```ruby
class TypingIndicatorJob < ApplicationJob
  queue_as :default

  def perform(conversation_id)
    conversation = Conversation.find_by(id: conversation_id)

    # Check if conversation exists and AI is still processing
    return unless conversation&.ai_processing

    # Send typing action to Telegram
    begin
      bot_client.api.send_chat_action(
        chat_id: conversation.user.telegram_id,
        action: 'typing'
      )

      Rails.logger.info "Typing indicator sent for conversation #{conversation_id}"
    rescue => e
      Rails.logger.error "Failed to send typing action: #{e.message}"
    end

    # Reload conversation to check if AI finished processing
    conversation.reload

    # SELF-RESCHEDULING LOOP
    # If AI still processing → schedule another typing indicator in 4 seconds
    if conversation.ai_processing
      TypingIndicatorJob.set(wait: 4.seconds).perform_later(conversation_id)
    else
      Rails.logger.info "AI processing finished, stopping typing indicator"
    end
  end

  private

  def bot_client
    @bot_client ||= Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
  end
end
```

**How It Works:**

1. **Job starts** - Checks if `ai_processing` is still `true`
2. **Sends typing action** - Shows "typing..." indicator in Telegram (lasts ~5 seconds)
3. **Reloads conversation** - Gets fresh `ai_processing` status from database
4. **Loops or stops:**
   - If `ai_processing = true` → schedules itself again in 4 seconds (loop continues)
   - If `ai_processing = false` → stops (AI response received)

**Why 4 seconds?** Telegram typing indicator lasts ~5 seconds, so 4-second intervals ensure continuous "typing..." display without gaps.

---

### 3. AI Response Processing

**Location:** `app/controllers/n8n_controller.rb` (Lines 10-146)

**Complete Implementation:**

```ruby
def send_message
  telegram_id = params[:telegram_id]
  text_to_send = params[:text]

  # Validate parameters
  if telegram_id.blank?
    render json: { error: 'telegram_id is required' }, status: :unprocessable_entity
    return
  end

  if text_to_send.blank?
    render json: { error: 'text is required' }, status: :unprocessable_entity
    return
  end

  # AI квалификация - принимаем параметры напрямую из N8N
  # N8N отправляет отдельные поля через Code ноду (см. секцию HTTP Request Node)
  qualification_data = {
    real_name: params[:real_name],
    background: params[:background],
    query: params[:query],
    ready_score: params[:ready]
  }

  Rails.logger.info "Text to send: #{text_to_send[0..100]}..."
  Rails.logger.info "AI qualification: #{qualification_data.inspect}"

  # Find user
  user = User.find_by(telegram_id: telegram_id)
  if user.nil?
    render json: { error: 'User not found' }, status: :not_found
    return
  end

  conversation = user.conversation

  # STOP TYPING INDICATOR
  # This stops the TypingIndicatorJob loop
  conversation.update!(ai_processing: false)
  Rails.logger.info "AI processing finished for conversation #{conversation.id}"

  # SAVE AI QUALIFICATION DATA
  # Сохраняем все AI поля в conversation для отображения в dashboard
  conversation.update!(
    ai_real_name: qualification_data[:real_name],
    ai_background: qualification_data[:background],
    ai_query: qualification_data[:query],
    ai_ready_score: qualification_data[:ready_score]
  )

  Rails.logger.info "AI qualification saved for conversation #{conversation.id}"

  # SEND TO TELEGRAM
  begin
    result = bot_client.api.send_message(
      chat_id: telegram_id,
      text: text_to_send,
      parse_mode: 'Markdown'
    )

    # Save to database as outgoing message
    message = conversation.messages.create!(
      body: text_to_send,
      direction: :outgoing,
      telegram_message_id: result.message_id,
      read: true,
      user_id: nil # from AI/bot
    )

    conversation.reload

    # Broadcast to admin dashboard
    ActionCable.server.broadcast("messenger_channel", {
      type: 'new_message',
      conversation_id: conversation.id,
      message: message.as_json(include: :user),
      conversation: { /* ... */ }
    })

    render json: {
      success: true,
      message_id: message.id,
      telegram_message_id: result.message_id,
      user_id: user.id,
      conversation_id: conversation.id
    }
  rescue Telegram::Bot::Error => e
    # FALLBACK: Try without Markdown if parse error
    if e.message.include?('parse')
      result = bot_client.api.send_message(
        chat_id: telegram_id,
        text: text_to_send
      )

      message = conversation.messages.create!(
        body: text_to_send,
        direction: :outgoing,
        telegram_message_id: result.message_id,
        read: true,
        user_id: nil
      )

      render json: {
        success: true,
        message_id: message.id,
        warning: 'Markdown parse error, sent as plain text'
      }
      return
    end

    render json: { error: "Failed to send: #{e.message}" }, status: :internal_server_error
  end
end
```

**Key Steps:**

1. **Receive parameters** - N8N отправляет отдельные поля:
   - `params[:text]` - текст для пользователя
   - `params[:real_name]`, `params[:background]`, `params[:query]`, `params[:ready]` - квалификация
2. **Stop typing** - Set `ai_processing = false` (TypingIndicatorJob will stop on next check)
3. **Save qualification** - Store AI-extracted lead data in conversation (ai_real_name, ai_background, ai_query, ai_ready_score)
4. **Send to Telegram** - `text` отправляется с Markdown форматированием
5. **Broadcast to admin** - Update dashboard in real-time with new message and qualification data

---

### 4. AI Response Format & Code Node

**N8N Code Node:** Извлекает поля из AI ответа

**Expected AI Response Format:**

```json
{
  "output": "**Отличный вопрос!** Курс действительно включает...",
  "real_name": "Александр",
  "background": "Владеет рестораном в Москве, хочет открыть доставку еды на Бали",
  "query": "Стоимость и сроки запуска доставки еды",
  "ready": "7"
}
```

**Fields Explanation:**

- `output` (required) - Message text sent to user (supports Markdown)
- `real_name` (optional) - Extracted real name from conversation
- `background` (optional) - User's business context/situation
- `query` (optional) - Main question or intent identified
- `ready` (optional) - Lead readiness score (0-10, where 10 = ready to buy now)

**N8N Code Node (between AI Agent and HTTP Request):**

См. код выше в разделе "HTTP Request Node" - Code нода парсит JSON и возвращает отдельные поля.

**Rails принимает напрямую:**
- `params[:text]` → отправляется пользователю
- `params[:real_name]` → сохраняется в `conversation.ai_real_name`
- `params[:background]` → сохраняется в `conversation.ai_background`
- `params[:query]` → сохраняется в `conversation.ai_query`
- `params[:ready]` → сохраняется в `conversation.ai_ready_score`

---

## AI Qualification Data

### Database Schema

**Table:** `conversations`

```ruby
# AI Qualification Fields (added 2025-10-09)
t.string  :ai_real_name      # User's real name (extracted by AI)
t.text    :ai_background     # User background/business stage
t.text    :ai_query          # Main question/intent
t.integer :ai_ready_score    # Readiness score (0-10)
t.boolean :ai_processing     # Flag: AI is processing message
```

### Purpose

These fields enable automatic lead qualification during conversations:

1. **ai_real_name** - AI extracts user's real name from casual chat
   - Example: "Hi, I'm Alex" → `ai_real_name = "Alex"`
   - Отображается в messenger dashboard как "Имя"

2. **ai_background** - Business context, current situation
   - Example: "I own 3 restaurants in Moscow" → `ai_background = "Restaurant owner, 3 locations, Moscow"`
   - Помогает понять контекст клиента

3. **ai_query** - Main question or goal
   - Example: "How much to start food delivery in Bali?" → `ai_query = "Cost of starting food delivery business in Bali"`
   - Отображается как "Запрос/Цель"

4. **ai_ready_score** - Lead readiness (0-10 шкала)
   - **0-3** (🔴 Холодный лид): Просто изучает, нет urgency, задаёт общие вопросы
   - **4-7** (🟡 Тёплый лид): Интересуется конкретно, собирает информацию, сравнивает варианты
   - **8-10** (🟢 Горячий лид): Готов к покупке, спрашивает детали оплаты, условия
   - Отображается в messenger с цветовым индикатором

5. **ai_processing** - Technical flag for typing indicator
   - `true` = AI is analyzing, show typing indicator
   - `false` = AI finished, stop typing indicator

### Use Cases

**Sales Dashboard:**
```ruby
# Show hot leads (ready to buy)
hot_leads = Conversation.where('ai_ready_score >= ?', 8)
                        .includes(:user)
                        .order(ai_ready_score: :desc)
```

**Lead Scoring:**
```ruby
# Segment leads by readiness (0-10 шкала)
cold_leads = Conversation.where('ai_ready_score <= 3')   # 🔴 Холодные
warm_leads = Conversation.where('ai_ready_score BETWEEN 4 AND 7')  # 🟡 Тёплые
hot_leads = Conversation.where('ai_ready_score >= 8')    # 🟢 Горячие
```

**Analytics:**
```ruby
# Track most common queries
Conversation.where.not(ai_query: nil)
            .group(:ai_query)
            .count
            .sort_by { |k, v| -v }
```

### Messenger Dashboard Display

**Location:** Right sidebar in `/messenger` (когда выбрана беседа)

**UI Секция "🤖 AI Квалификация":**

Отображается как отдельная карточка с градиентным фоном (purple-to-blue):

```erb
<!-- Если есть хотя бы одно AI поле -->
<div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
  <h4>🤖 AI Квалификация</h4>

  <!-- Real Name (если заполнено) -->
  <div>
    <p class="text-xs text-purple-600">👤 Имя</p>
    <p class="text-sm font-medium">Александр</p>
  </div>

  <!-- Background -->
  <div>
    <p class="text-xs text-purple-600">💼 Бэкграунд</p>
    <p class="text-sm">Владеет рестораном в Москве, планирует открыть доставку</p>
  </div>

  <!-- Query -->
  <div>
    <p class="text-xs text-purple-600">❓ Запрос/Цель</p>
    <p class="text-sm">Хочет понять стоимость и сроки запуска</p>
  </div>

  <!-- Ready Score с цветовым индикатором -->
  <div>
    <p class="text-xs text-purple-600">⚡ Готовность к покупке</p>
    <div class="flex items-center gap-2">
      <span class="badge bg-yellow-100 text-yellow-800">🟡 Тёплый лид</span>
      <span class="text-lg font-bold">7/10</span>
    </div>
  </div>
</div>
```

**Цветовая индикация готовности:**
- 🔴 **0-3** - Холодный лид (bg-red-100 text-red-800)
- 🟡 **4-7** - Тёплый лид (bg-yellow-100 text-yellow-800)
- 🟢 **8-10** - Горячий лид (bg-green-100 text-green-800)

**Визуальное отличие от других секций:**
- Градиентный фон (purple-to-blue) выделяет AI данные
- Фиолетовые иконки и лейблы
- Показывается только если есть хотя бы одно заполненное поле

**Обновление в реальном времени:**
- AI данные обновляются при каждом ответе AI
- Можно видеть эволюцию квалификации по ходу беседы
- Ready score может повышаться/понижаться

---

## Typing Indicator Flow

### Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ USER                                                            │
│   │                                                             │
│   │ Sends message: "How much does the course cost?"            │
│   └─────────────────────────────────────────────────────────┐  │
│                                                               │  │
│                                                               ▼  │
│                                                         ┌──────────┐
│                                                         │ Telegram │
│                                                         │   Bot    │
│                                                         └──────────┘
│                                                               │
│                                                               ▼
│   ┌───────────────────────────────────────────────────────────────┐
│   │ RAILS: AuthController#handle_text_message                     │
│   │   1. Create message in database                               │
│   │   2. conversation.update!(ai_processing: true) ──────────┐    │
│   │   3. send_typing_action(telegram_id)                     │    │
│   │   4. TypingIndicatorJob.set(wait: 4.sec).perform_later  │    │
│   │   5. send_message_to_n8n(msg, user, conversation)       │    │
│   └───────────────────────────────────────────────────────────────┘
│         │                                │                    │
│         │                                │                    │
│   Typing Action                    Telegram API        TypingIndicatorJob
│   (immediate)                      shows typing         (scheduled +4s)
│         │                                │                    │
│         │                                ▼                    │
│         │                         ┌──────────┐               │
│         │                         │ USER     │               │
│         │                         │ Sees:    │               │
│         │                         │ typing...│               │
│         │                         └──────────┘               │
│         │                                                     │
│         ▼                                                     ▼
│   ┌──────────────────────────────────────────────────────────────┐
│   │ BACKGROUND LOOP (TypingIndicatorJob)                         │
│   │                                                              │
│   │   def perform(conversation_id)                               │
│   │     conversation = Conversation.find(conversation_id)        │
│   │                                                              │
│   │     return unless conversation.ai_processing # Check flag   │
│   │                                                              │
│   │     bot_client.api.send_chat_action(action: 'typing')       │
│   │                                                              │
│   │     conversation.reload                                      │
│   │                                                              │
│   │     if conversation.ai_processing                            │
│   │       TypingIndicatorJob.set(wait: 4.seconds).perform_later │
│   │     else                                                     │
│   │       # Stop loop - AI finished                             │
│   │     end                                                      │
│   │   end                                                        │
│   └──────────────────────────────────────────────────────────────┘
│         │                                                     │
│         │ Loop continues every 4 seconds                      │
│         │ while ai_processing = true                          │
│         │                                                     │
│         │   ... typing ... (4s)                              │
│         │   ... typing ... (4s)                              │
│         │   ... typing ... (4s)                              │
│         │                                                     │
│         │                     Meanwhile...                    │
│         │                                                     │
│   ┌─────▼───────────────────────────────────────────────────────┐
│   │ N8N WORKFLOW                                                 │
│   │   1. Receives message_received webhook                       │
│   │   2. Calls OpenAI/Claude API                                │
│   │   3. AI analyzes conversation history (50 messages)         │
│   │   4. AI generates JSON response:                            │
│   │      {                                                       │
│   │        "output": "The course costs $199...",                │
│   │        "real_name": "Alex",                                 │
│   │        "background": "Restaurant owner",                    │
│   │        "query": "Course pricing",                           │
│   │        "ready": 80                                          │
│   │      }                                                       │
│   │   5. POST to Rails API: /api/n8n/send_message               │
│   └─────────────────────────────────────────────────────────────┘
│                                │
│                                ▼
│   ┌─────────────────────────────────────────────────────────────┐
│   │ RAILS: N8nController#send_message                           │
│   │   1. Parse AI response JSON                                 │
│   │   2. conversation.update!(ai_processing: false) ───────┐    │
│   │      ▲ This stops TypingIndicatorJob loop              │    │
│   │   3. Save qualification data (ai_real_name, etc.)      │    │
│   │   4. Send message to Telegram with Markdown            │    │
│   │   5. Broadcast to admin dashboard                      │    │
│   └─────────────────────────────────────────────────────────────┘
│         │                                                     │
│         │ ai_processing = false                               │
│         │                                                     │
│         ▼                                                     ▼
│   ┌──────────────┐                               ┌──────────────────┐
│   │ Typing stops │                               │ TypingIndicatorJob│
│   │ (no more     │                               │ sees ai_processing│
│   │  loop calls) │                               │ = false, stops   │
│   └──────────────┘                               └──────────────────┘
│                                │
│                                ▼
│                         ┌──────────┐
│                         │ USER     │
│                         │ Receives:│
│                         │ "The     │
│                         │  course  │
│                         │  costs   │
│                         │  $199..."│
│                         └──────────┘
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Timing

| Time | Event | Component | Action |
|------|-------|-----------|--------|
| 0s | User sends message | Telegram | Message delivered to webhook |
| 0.1s | Rails receives message | AuthController | Creates message in DB |
| 0.2s | Set ai_processing = true | AuthController | Starts typing loop mechanism |
| 0.3s | First typing action sent | AuthController | Immediate UX feedback |
| 0.4s | N8N webhook sent | AuthController | AI processing starts |
| 4.3s | Second typing action | TypingIndicatorJob | Loop iteration 1 |
| 8.3s | Third typing action | TypingIndicatorJob | Loop iteration 2 |
| 12.3s | Fourth typing action | TypingIndicatorJob | Loop iteration 3 |
| 15s | AI finishes analysis | N8N → N8nController | Response received |
| 15.1s | Set ai_processing = false | N8nController | Stops typing loop |
| 15.2s | Message sent to Telegram | N8nController | User receives response |
| 16.3s | Job checks ai_processing | TypingIndicatorJob | Finds false, stops loop |

---

## N8N Workflow Configuration

### Webhook Trigger

**Receives:** `message_received` event from Rails

**Payload Structure:**
```json
{
  "event": "message_received",
  "message_id": 123,
  "telegram_message_id": 456789,
  "text": "How much does the course cost?",
  "timestamp": "2025-10-10T14:30:00Z",
  "conversation_id": 45,
  "user": {
    "id": 12,
    "telegram_id": 987654321,
    "username": "alexdoe",
    "first_name": "Alex",
    "last_name": "Doe",
    "avatar_url": "https://..."
  },
  "conversation_history": "[2025-10-10 14:25] Клиент Alex: Hi...\n[2025-10-10 14:26] Сотрудник: Hello!...\n..."
}
```

### AI Processing Node

**Provider:** OpenAI, Anthropic Claude, or custom LLM

**Prompt Template:**

```
You are a sales consultant for Bali Food Delivery Master course.

CONVERSATION HISTORY:
{{$json.conversation_history}}

CUSTOMER'S LATEST MESSAGE:
{{$json.text}}

CUSTOMER INFO:
- Name: {{$json.user.first_name}}
- Username: @{{$json.user.username}}

INSTRUCTIONS:
1. Analyze the full conversation to understand context
2. Provide helpful, consultative response
3. Extract qualification data:
   - real_name: Customer's real name if mentioned
   - background: Business context (e.g., "owns 2 restaurants")
   - query: Main question/intent
   - ready: Readiness score 0-100 (0=browsing, 100=ready to buy)
4. Use Markdown formatting for better readability

RESPONSE FORMAT (ALWAYS return valid JSON):
{
  "output": "Your message to customer with **Markdown** formatting",
  "real_name": "Customer's real name or null",
  "background": "Customer's business context or null",
  "query": "Main question/intent or null",
  "ready": 75
}

IMPORTANT:
- Be conversational and helpful
- Use consultative selling (70% value, 30% qualification)
- If customer shows objections, show empathy
- Recommend tier (Базовый/Акселератор/VIP) based on needs
- Keep response concise (2-3 paragraphs max)
```

### HTTP Request Node (Send to Rails)

**Method:** POST

**URL:** `{{ $node["Webhook"].json.callback_url }}`

**Headers:**
```json
{
  "Authorization": "Bearer {{$env.N8N_API_TOKEN}}",
  "Content-Type": "application/json"
}
```

**Body Type:** JSON

**Parameters (добавить в Body Parameters):**

| Name | Value | Description |
|------|-------|-------------|
| `telegram_id` | `{{ $node["Webhook"].json.user.telegram_id }}` | Telegram ID пользователя |
| `text` | `{{ $json.text }}` | Текст сообщения для отправки |
| `real_name` | `{{ $json.real_name }}` | Имя клиента (из Code ноды) |
| `background` | `{{ $json.background }}` | Бэкграунд клиента (из Code ноды) |
| `query` | `{{ $json.query }}` | Запрос/цель клиента (из Code ноды) |
| `ready` | `{{ $json.ready }}` | Готовность к покупке 0-10 (из Code ноды) |

**ВАЖНО:** Нужна промежуточная **Code нода** между AI Agent и HTTP Request для извлечения полей из JSON:

```javascript
// Code нода: Extract AI Data
const rawOutput = $input.item.json.output;

// Убираем markdown code blocks если есть
let cleanText = rawOutput.trim();
if (cleanText.startsWith('```json') || cleanText.startsWith('```')) {
  cleanText = cleanText.replace(/^```json\n?/, '')
                       .replace(/^```\n?/, '')
                       .replace(/\n?```$/, '');
}

// Парсим JSON
const parsed = JSON.parse(cleanText);

// Возвращаем отдельные поля для HTTP Request
return {
  text: parsed.output,
  real_name: parsed.real_name || "",
  background: parsed.background || "",
  query: parsed.query || "",
  ready: parsed.ready || "0"
};
```

**Результат:** Rails получает все параметры отдельно, сохраняет квалификацию в базу, отправляет `text` пользователю.

---

## Troubleshooting

### Issue: Typing Indicator Not Showing

**Symptoms:**
- User sends message
- No "typing..." indicator appears
- Response arrives but without typing feedback

**Diagnosis:**
```ruby
# In Rails console
conversation = Conversation.last
conversation.ai_processing # Should be true when AI processing

# Check Solid Queue for jobs
SolidQueue::Job.where(job_class: 'TypingIndicatorJob').order(created_at: :desc).limit(5)
```

**Common Causes:**

1. **ai_processing not set to true**
   ```ruby
   # Fix: Ensure AuthController sets flag
   conversation.update!(ai_processing: true)
   ```

2. **TypingIndicatorJob not running**
   ```bash
   # Check Solid Queue is running
   bin/rails solid_queue:status

   # Restart if needed
   bin/rails restart
   ```

3. **Telegram API error**
   ```bash
   # Check logs
   tail -f log/development.log | grep "typing"
   ```

**Solution:**
- Verify `ai_processing` flag is set in `AuthController#handle_text_message`
- Check Solid Queue is running (`bin/dev` includes it)
- Verify `TELEGRAM_BOT_TOKEN` is correct in credentials

---

### Issue: AI Response Not Parsing

**Symptoms:**
- AI sends response
- Parsing fails, fallback to plain text
- Qualification data not saved (all nil)

**Diagnosis:**
```ruby
# Check recent conversations with nil qualification
Conversation.where(ai_real_name: nil).recent.limit(10)

# Check N8N controller logs
grep "Could not parse AI response" log/production.log
```

**Common Causes:**

1. **AI returns invalid JSON**
   ```
   # BAD: Missing quotes
   {output: "Hello", ready: 75}

   # GOOD: Valid JSON
   {"output": "Hello", "ready": 75}
   ```

2. **AI returns JSON without code block**
   ```
   # Works fine - parser handles both formats
   {"output": "Hello"}

   # Also works
   ```json
   {"output": "Hello"}
   ```
   ```

3. **AI adds extra text outside JSON**
   ```
   # BAD: Extra text after JSON
   {"output": "Hello"}
   Here's some extra explanation...

   # GOOD: Only JSON
   {"output": "Hello"}
   ```

**Solution:**

1. **Update AI prompt** to strictly return ONLY JSON:
   ```
   IMPORTANT: Return ONLY the JSON object, no extra text before or after.
   ```

2. **Add JSON validation in N8N:**
   ```javascript
   // N8N Function node before sending to Rails
   try {
     const parsed = JSON.parse($input.item.json.ai_response);
     return { json: { text: JSON.stringify(parsed) } };
   } catch (e) {
     // Fallback: wrap in output field
     return { json: { text: JSON.stringify({output: $input.item.json.ai_response}) } };
   }
   ```

---

### Issue: Typing Indicator Doesn't Stop

**Symptoms:**
- AI sends response successfully
- User receives message
- Typing indicator continues forever

**Diagnosis:**
```ruby
# Check conversations stuck in ai_processing
stuck = Conversation.where(ai_processing: true)
                    .where('updated_at < ?', 5.minutes.ago)

stuck.each do |conv|
  puts "Conversation #{conv.id}: stuck for #{Time.current - conv.updated_at} seconds"
end
```

**Common Causes:**

1. **N8nController not setting ai_processing = false**
   ```ruby
   # Verify in N8nController#send_message
   conversation.update!(ai_processing: false)
   ```

2. **N8N workflow didn't call Rails API**
   - N8N node failed/crashed
   - Network timeout
   - Rails API returned error

3. **Database transaction failed**
   - Rare, but check logs for ActiveRecord errors

**Solution:**

1. **Manual fix for stuck conversations:**
   ```ruby
   # In Rails console
   Conversation.where(ai_processing: true)
               .where('updated_at < ?', 5.minutes.ago)
               .update_all(ai_processing: false)
   ```

2. **Add timeout in N8N workflow:**
   ```javascript
   // N8N Set node after AI call
   // If AI takes > 30s, skip Rails API and log error
   if ($json.ai_response) {
     return { json: $json };
   } else {
     // Timeout or error - manually call Rails to stop typing
     return { json: {
       telegram_id: $node["Webhook"].json.user.telegram_id,
       text: "Извините, произошла ошибка. Попробуйте еще раз."
     }};
   }
   ```

3. **Add automatic cleanup job:**
   ```ruby
   # app/jobs/cleanup_stuck_typing_job.rb
   class CleanupStuckTypingJob < ApplicationJob
     def perform
       Conversation.where(ai_processing: true)
                   .where('updated_at < ?', 10.minutes.ago)
                   .find_each do |conv|
         conv.update!(ai_processing: false)
         Rails.logger.warn "Cleaned up stuck typing for conversation #{conv.id}"
       end
     end
   end

   # config/recurring.yml
   cleanup_stuck_typing:
     class: CleanupStuckTypingJob
     schedule: every 5 minutes
   ```

---

### Issue: Job Not Running (Solid Queue)

**Symptoms:**
- No typing indicator at all
- Jobs not executing
- Database has scheduled jobs but nothing happens

**Diagnosis:**
```bash
# Check Solid Queue processes
bin/rails runner "puts SolidQueue::Process.all.to_a.inspect"

# Check pending jobs
bin/rails runner "puts SolidQueue::Job.pending.count"

# Check failed jobs
bin/rails runner "puts SolidQueue::Job.failed.count"
```

**Solution:**

1. **Ensure Solid Queue is running:**
   ```bash
   # Development
   bin/dev  # Includes Solid Queue via Procfile.dev

   # Production (via Kamal)
   # Check config/deploy.yml has SOLID_QUEUE_IN_PUMA=true
   ```

2. **Check Solid Queue configuration:**
   ```yaml
   # config/queue.yml
   production:
     dispatchers:
       - polling_interval: 1
         batch_size: 500
     workers:
       - queues: "*"
         threads: 3
         processes: 2
   ```

3. **Restart Solid Queue:**
   ```bash
   # Development
   pkill -f solid_queue
   bin/dev

   # Production
   bin/kamal app exec "bin/rails solid_queue:restart"
   ```

---

## Testing

### Manual Testing

**Test typing indicator:**

1. Open Telegram bot as non-admin user
2. Send message: "How much is the course?"
3. **Verify:** "typing..." indicator appears immediately
4. **Verify:** "typing..." continues for duration of AI processing
5. **Verify:** "typing..." stops when response arrives
6. **Verify:** Response arrives with Markdown formatting

**Test AI qualification:**

```ruby
# In Rails console after conversation
conv = Conversation.last

conv.ai_real_name      # Should have extracted name
conv.ai_background     # Should have context
conv.ai_query          # Should have main question
conv.ai_ready_score    # Should be 0-100
conv.ai_processing     # Should be false (stopped)
```

### Automated Testing

**Test TypingIndicatorJob:**

```ruby
# test/jobs/typing_indicator_job_test.rb
require 'test_helper'

class TypingIndicatorJobTest < ActiveJob::TestCase
  test "sends typing action when ai_processing is true" do
    conversation = conversations(:one)
    conversation.update!(ai_processing: true)

    # Mock Telegram API
    Telegram::Bot::Client.any_instance.expects(:api).returns(
      mock(send_chat_action: true)
    )

    TypingIndicatorJob.perform_now(conversation.id)
  end

  test "stops loop when ai_processing is false" do
    conversation = conversations(:one)
    conversation.update!(ai_processing: false)

    # Should not schedule another job
    assert_no_enqueued_jobs do
      TypingIndicatorJob.perform_now(conversation.id)
    end
  end

  test "reschedules itself after 4 seconds if ai_processing remains true" do
    conversation = conversations(:one)
    conversation.update!(ai_processing: true)

    # Mock Telegram API
    Telegram::Bot::Client.any_instance.expects(:api).returns(
      mock(send_chat_action: true)
    )

    # Should enqueue another job
    assert_enqueued_with(job: TypingIndicatorJob, args: [conversation.id], at: 4.seconds.from_now) do
      TypingIndicatorJob.perform_now(conversation.id)
    end
  end
end
```

**Test N8nController JSON parsing:**

```ruby
# test/controllers/n8n_controller_test.rb
require 'test_helper'

class N8nControllerTest < ActionDispatch::IntegrationTest
  test "parses AI response with JSON code block" do
    user = users(:one)

    json_response = <<~JSON
      ```json
      {
        "output": "Hello!",
        "real_name": "Alex",
        "ready": 85
      }
      ```
    JSON

    post api_n8n_send_message_url, params: {
      telegram_id: user.telegram_id,
      text: json_response
    }

    assert_response :success

    conversation = user.conversation.reload
    assert_equal "Alex", conversation.ai_real_name
    assert_equal 85, conversation.ai_ready_score
    assert_equal false, conversation.ai_processing
  end

  test "handles plain text fallback" do
    user = users(:one)

    post api_n8n_send_message_url, params: {
      telegram_id: user.telegram_id,
      text: "Just plain text, not JSON"
    }

    assert_response :success

    conversation = user.conversation.reload
    assert_nil conversation.ai_real_name
    assert_equal false, conversation.ai_processing
  end
end
```

---

## Security Considerations

### N8N API Authentication

**Current Status:** DISABLED (for testing)

```ruby
# app/controllers/n8n_controller.rb
skip_before_action :verify_authenticity_token
# TODO: Добавить авторизацию позже когда всё заработает
# before_action :verify_n8n_token
```

**Production Implementation (Required):**

```ruby
class N8nController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :verify_n8n_token  # ENABLE THIS

  private

  def verify_n8n_token
    token = request.headers['Authorization']&.split(' ')&.last

    unless token == N8N_API_TOKEN
      Rails.logger.warn "N8N webhook: Unauthorized access attempt"
      render json: { error: 'Unauthorized' }, status: :unauthorized
      return
    end
  end
end
```

**N8N Configuration:**

```yaml
# In N8N workflow HTTP Request node
Headers:
  Authorization: Bearer {{$env.N8N_API_TOKEN}}
```

**Credentials Storage:**

```bash
# Edit Rails credentials
EDITOR="code --wait" bin/rails credentials:edit
```

```yaml
n8n:
  api_token: your_secure_jwt_token_here
  webhook_url:
    test: https://n8n.aidelivery.tech/webhook-test/...
    production: https://n8n.aidelivery.tech/webhook/...
```

**Generate Secure Token:**

```ruby
# In Rails console
SecureRandom.hex(32)  # 64-character token
# => "a1b2c3d4..."
```

### Rate Limiting (Future)

```ruby
# app/controllers/n8n_controller.rb
before_action :check_rate_limit

def check_rate_limit
  key = "n8n:send_message:#{params[:telegram_id]}"
  count = Rails.cache.read(key) || 0

  if count >= 10  # Max 10 messages per minute per user
    render json: { error: 'Rate limit exceeded' }, status: 429
    return
  end

  Rails.cache.write(key, count + 1, expires_in: 1.minute)
end
```

---

## Future Enhancements

### 1. AI Model Selection

Allow switching between AI providers based on conversation context:

```ruby
# app/services/ai_router_service.rb
class AiRouterService
  def self.select_model(conversation)
    if conversation.ai_ready_score && conversation.ai_ready_score > 80
      'claude-sonnet'  # More empathetic for hot leads
    else
      'gpt-4-turbo'  # Faster for cold leads
    end
  end
end
```

### 2. Admin Override

Allow admin to manually stop AI and take over conversation:

```ruby
# app/controllers/messenger_controller.rb
def takeover_conversation
  conversation = Conversation.find(params[:id])
  conversation.update!(ai_processing: false, ai_override: true)

  render json: { success: true }
end
```

### 3. A/B Testing Prompts

Test different AI prompts to optimize conversion:

```ruby
# app/models/conversation.rb
def ai_prompt_variant
  # Assign variant based on user_id hash
  variants = ['consultative', 'direct', 'educational']
  variants[user_id % variants.length]
end
```

### 4. Typing Indicator Speed Control

Adjust typing frequency based on message length:

```ruby
# app/jobs/typing_indicator_job.rb
def typing_interval(message_length)
  # Longer messages = more typing time
  base_interval = 4.seconds
  extra_time = (message_length / 100) * 2.seconds
  [base_interval + extra_time, 10.seconds].min
end
```

### 5. AI Confidence Scoring

Track AI confidence and escalate to human if low:

```ruby
# If AI returns confidence < 70%, notify admin
if ai_data[:confidence] < 70
  AdminMailer.low_confidence_alert(conversation).deliver_later
end
```

---

## Conclusion

The AI Auto-Responder feature provides:

- **Seamless UX** - Typing indicator makes AI feel human
- **Context-aware responses** - 50-message history ensures relevance
- **Automatic qualification** - Extracts lead data without asking directly
- **Scalable architecture** - Background jobs handle high volume
- **Robust error handling** - Graceful fallbacks for all failure modes

**Key Achievements:**
- Real-time typing indicator with self-rescheduling job loop
- Structured AI responses with JSON parsing
- Lead qualification data captured automatically
- Markdown formatting for rich messages
- Admin dashboard visibility into all AI interactions

**Integration Points:**
- Telegram Bot API (typing actions, message delivery)
- N8N workflow automation (AI orchestration)
- ActionCable (real-time admin updates)
- Solid Queue (background job processing)

This feature transforms casual conversations into qualified leads while maintaining natural, helpful interactions that feel human-powered rather than automated.
