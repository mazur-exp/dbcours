# N8N Integration

## Overview

N8N is a workflow automation platform integrated with the Bali Food Delivery Master application. It enables automated workflows triggered by events in the Rails application (user registration, purchases, lesson completions, etc.).

**Integration Type:** Webhook-based (Rails → N8N)

**Key Capabilities:**
- Send events to N8N workflows via webhooks
- Automated email notifications
- Data synchronization with external services
- Custom workflow triggers based on application events

---

## Architecture

### Components

**Backend:**
- `config/initializers/n8n.rb` - N8N configuration and constants
- Rails encrypted credentials - Stores API token and webhook URLs
- Event triggers - Controllers/models that send webhooks

**External:**
- N8N instance at `https://n8n.aidelivery.tech`
- Separate webhook endpoints for test and production environments

---

## Configuration

### Credentials Structure

Credentials are stored in Rails encrypted credentials (`config/credentials.yml.enc`):

```yaml
n8n:
  api_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
  webhook_url:
    test: https://n8n.aidelivery.tech/webhook-test/6d426ce1-6e61-42dd-96e3-ca96969f4c51
    production: https://n8n.aidelivery.tech/webhook/6d426ce1-6e61-42dd-96e3-ca96969f4c51

telegram:
  api_base_url: https://crm.aidelivery.tech  # or http://localhost:3000 for dev
  # ... other telegram config
```

**Fields:**
- `api_token` - JWT token for N8N API authentication
- `webhook_url.test` - Webhook endpoint for development/test environments
- `webhook_url.production` - Webhook endpoint for production environment
- **`telegram.api_base_url`** ✨ NEW - Base URL for callback routing (enables automatic dev/prod switching)

---

### Initializer

**Location:** `config/initializers/n8n.rb`

```ruby
# N8N API Token (JWT)
N8N_API_TOKEN = Rails.application.credentials.dig(:n8n, :api_token)

# N8N Webhook URL (automatically switches between test/production)
N8N_WEBHOOK_URL = if Rails.env.production?
  Rails.application.credentials.dig(:n8n, :webhook_url, :production)
else
  Rails.application.credentials.dig(:n8n, :webhook_url, :test)
end
```

**Available Constants:**
- `N8N_API_TOKEN` - API authentication token
- `N8N_WEBHOOK_URL` - Environment-specific webhook URL

---

## Usage

### Basic Webhook Send

```ruby
require 'net/http'
require 'json'

def send_n8n_event(event_type, data)
  uri = URI(N8N_WEBHOOK_URL)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true

  request = Net::HTTP::Post.new(uri.path)
  request['Authorization'] = "Bearer #{N8N_API_TOKEN}"
  request['Content-Type'] = 'application/json'
  request.body = {
    event: event_type,
    timestamp: Time.current.iso8601,
    data: data
  }.to_json

  response = http.request(request)

  unless response.is_a?(Net::HTTPSuccess)
    Rails.logger.error "N8N webhook failed: #{response.code} #{response.body}"
  end

  response
end
```

---

### Common Events

#### User Registration

```ruby
# app/controllers/auth_controller.rb
def handle_callback_query
  # ... user creation logic

  if user.save
    # Send event to N8N
    send_n8n_event('user_registered', {
      user_id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      registered_at: user.created_at.iso8601
    })
  end
end
```

---

#### Purchase Completed

```ruby
# app/controllers/payments_controller.rb (future)
def create
  # ... payment processing

  if payment.successful?
    send_n8n_event('purchase_completed', {
      user_id: user.id,
      payment_id: payment.id,
      amount: payment.amount,
      tier: payment.tier,
      purchased_at: payment.created_at.iso8601
    })
  end
end
```

---

#### Lesson Completed

```ruby
# app/controllers/lessons_controller.rb (future)
def mark_complete
  # ... lesson completion logic

  send_n8n_event('lesson_completed', {
    user_id: @current_user.id,
    lesson_id: @lesson.id,
    lesson_title: @lesson.title,
    completed_at: Time.current.iso8601
  })
end
```

---

#### Message Received (Messenger Integration) ✅ IMPLEMENTED

**Status:** ✅ Active in production

**Trigger:** When user sends any message (except /start command) via Telegram bot

**Implementation:**
```ruby
# app/controllers/auth_controller.rb (Line 301-302)
def handle_text_message(message)
  # ... user lookup and conversation creation

  msg = conversation.messages.create!(
    user: user,
    body: message["text"],
    direction: :incoming,
    telegram_message_id: message["message_id"],
    read: false
  )

  # Reload conversation
  conversation.reload

  # Send to N8N
  send_message_to_n8n(msg, user, conversation)

  # Then broadcast via ActionCable
  # ...
end

private

def send_message_to_n8n(message, user, conversation)
  return if N8N_WEBHOOK_URL.blank?

  payload = {
    event: 'message_received',
    message_id: message.id,
    telegram_message_id: message.telegram_message_id,
    text: message.body,
    timestamp: message.created_at.iso8601,
    conversation_id: conversation.id,
    user: {
      id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
      avatar_url: user.avatar_url
    }
  }

  # POST to N8N webhook with Bearer token auth
  # Includes error handling and logging
end
```

**Payload Structure:**
```json
{
  "event": "message_received",
  "message_id": 123,
  "telegram_message_id": 456789,
  "text": "Hello, I have a question about the course",
  "timestamp": "2025-01-09T14:30:00Z",
  "conversation_id": 45,
  "callback_url": "https://crm.aidelivery.tech/api/n8n/send_message",
  "user": {
    "id": 12,
    "telegram_id": 987654321,
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe",
    "avatar_url": "https://api.telegram.org/file/bot.../photo.jpg"
  },
  "conversation_history": "[2025-01-09 14:25] Клиент John: Hi, I'm interested in the course\n[2025-01-09 14:26] Сотрудник: Hello! Welcome! How can I help you?\n[2025-01-09 14:27] Клиент John: What does the course cover?\n[2025-01-09 14:28] Сотрудник: The course covers...\n[2025-01-09 14:30] Клиент John: Hello, I have a question about the course"
}
```

**Fields:**
- `event` - Event type ("message_received")
- `message_id` - Database message ID
- `telegram_message_id` - Telegram API message ID
- `text` - Current message text
- `timestamp` - Message creation time (ISO 8601)
- `conversation_id` - Conversation ID
- **`callback_url`** ✨ NEW - Environment-specific API endpoint for sending responses back
  - Development: `http://localhost:3000/api/n8n/send_message`
  - Production: `https://crm.aidelivery.tech/api/n8n/send_message`
  - **Single N8N workflow works for both environments** - no URL hardcoding needed!
- `user` - Full user profile data
- **`conversation_history`** ✨ - Last 50 messages formatted as text (newest last)
  - Format: `[YYYY-MM-DD HH:MM] Sender: message text`
  - Sender: "Сотрудник" for staff, "Клиент [Name]" for customer
  - Perfect for AI context and automated responses

**Use Cases:**
- **AI-powered auto-responder** - Use conversation history for context-aware responses
- **Smart FAQ detection** - Analyze history to avoid repeating same answers
- **Sentiment analysis** - Track conversation mood changes over time
- **CRM integration** - Log all customer interactions with full context
- **Support ticket creation** - Include conversation history in tickets
- **Analytics and categorization** - Classify conversations based on content
- **Escalation detection** - Identify frustrated customers from message patterns
- **Personalized recommendations** - Suggest courses based on conversation topics

**Features:**
- ✅ Automatic webhook on every incoming message
- ✅ Excludes /start command (handled separately for auth)
- ✅ Includes full user context (ID, Telegram ID, username, avatar)
- ✅ **Conversation history** - Last 50 messages for AI context
- ✅ **Callback URL** - Dynamic environment routing (dev/prod)
- ✅ Environment-aware (test vs production webhook URLs)
- ✅ Error handling (N8N failures don't break messenger)
- ✅ Request timeout: 5 seconds
- ✅ Bearer token authentication

---

### 🔄 Callback URL: Automatic Environment Routing ✨

**Problem Solved:**
Before `callback_url`, N8N workflows needed hardcoded URLs like `https://crm.aidelivery.tech/api/n8n/send_message`. This meant:
- ❌ Separate workflows for development and production
- ❌ Manual URL changes when testing
- ❌ Risk of accidentally hitting production from dev environment
- ❌ Workflow duplication and maintenance overhead

**Solution:**
Now Rails includes `callback_url` in every webhook payload, automatically determined from `telegram.api_base_url` credential:

```ruby
# app/controllers/auth_controller.rb (lines 357-359, 368)
api_base_url = Rails.application.credentials.dig(:telegram, :api_base_url)
callback_url = "#{api_base_url}/api/n8n/send_message"

payload = {
  # ...
  callback_url: callback_url,  # Auto-switches based on environment
  # ...
}
```

**N8N Configuration:**
In your HTTP Request node, simply use:
```
URL: {{ $node["Webhook"].json.callback_url }}
```

**Result:**
- ✅ **Development:** Webhook → `http://localhost:3000/api/n8n/send_message`
- ✅ **Production:** Webhook → `https://crm.aidelivery.tech/api/n8n/send_message`
- ✅ **Single workflow** works everywhere
- ✅ **Zero configuration** when deploying

**Setup:**
```bash
# Edit credentials
EDITOR="code --wait" bin/rails credentials:edit

# Add api_base_url
telegram:
  api_base_url: http://localhost:3000  # Development
  # ...

# For production credentials
EDITOR="code --wait" bin/rails credentials:edit --environment production

telegram:
  api_base_url: https://crm.aidelivery.tech  # Production
  # ...
```

**Benefits:**
- 🚀 **Deploy once, use everywhere** - N8N workflow works on any environment
- 🔒 **Environment isolation** - Dev webhooks never hit production
- 🎯 **No human error** - URLs automatically correct
- ⚡ **Faster testing** - Switch environments without touching N8N

**Security:**
- Uses encrypted credentials (N8N_API_TOKEN, N8N_WEBHOOK_URL)
- HTTPS-only communication
- JWT Bearer token authentication
- No sensitive data exposed in logs

---

## N8N Workflow Examples

### Welcome Email Workflow

**Trigger:** Webhook receives `user_registered` event

**Steps:**
1. Receive webhook with user data
2. Format welcome email template
3. Send email via SMTP/SendGrid
4. Log success/failure

**N8N Nodes:**
- Webhook Trigger
- Set (format email data)
- Gmail/SendGrid (send email)
- HTTP Request (log to analytics)

---

### Payment Notification Workflow

**Trigger:** Webhook receives `purchase_completed` event

**Steps:**
1. Receive webhook with payment data
2. Send Telegram message to admin
3. Update Google Sheets revenue tracking
4. Trigger course access grant

**N8N Nodes:**
- Webhook Trigger
- Telegram (send notification)
- Google Sheets (update row)
- HTTP Request (Rails API to grant access)

---

### Messenger Auto-Responder Workflow ✅ ACTIVE

**Trigger:** Webhook receives `message_received` event

**Steps:**
1. Receive webhook with user message and context
2. Check message text for keywords (IF node)
3. Branch based on message content:
   - **FAQ keywords** → Send pre-defined answer
   - **"help" or "support"** → Create support ticket + notify admin
   - **Course-related** → Send course info and progress
   - **Default** → Log to CRM, no auto-response

**N8N Nodes:**
- Webhook Trigger (catches `message_received` events)
- Switch (route based on message.text keywords)
- HTTP Request (send Telegram message to user via Rails API)
- Airtable/Notion (create support ticket)
- Telegram (notify admin of new support request)
- Google Sheets (log all messages for analytics)

**Example Flow:**

```
User sends: "How do I reset my password?"
  ↓
Webhook trigger receives event
  ↓
Switch node detects keyword "password"
  ↓
HTTP POST to Rails: /api/send_message
  {
    "telegram_id": 987654321,
    "text": "To reset password, visit https://course.com/reset"
  }
  ↓
User receives instant response in Telegram
  ↓
Message logged to Google Sheets for analytics
```

**Benefits:**
- Instant automated responses for common questions
- 24/7 support without human intervention
- Reduces admin workload
- Captures all interactions for future AI training
- Creates support tickets automatically for complex issues

**Configuration:**
```json
{
  "webhook_url": "https://n8n.aidelivery.tech/webhook-test/...",
  "keywords": {
    "password": "To reset password...",
    "course": "Access your course at...",
    "help": "CREATE_SUPPORT_TICKET"
  }
}
```

---

### AI-Powered Context-Aware Responder ✨ ENHANCED

**Trigger:** Webhook receives `message_received` event with `conversation_history`

**Steps:**
1. Receive webhook with current message + last 50 messages history
2. Send conversation history to AI (OpenAI/Claude/Local LLM)
3. AI analyzes full context and generates personalized response
4. Send AI response back to user via Telegram
5. Log interaction to analytics

**N8N Nodes:**
- Webhook Trigger (receives `message_received` with `conversation_history`)
- OpenAI/Anthropic node (GPT-4, Claude Sonnet)
- Function node (format prompt with history)
- HTTP Request (send response via Rails Messenger API)
- Database/Airtable (log AI interactions)

**Example Flow:**

```
User sends: "Is this still available?"
  ↓
Webhook receives with conversation_history:
  "[2025-01-09 14:25] Клиент John: Hi, interested in Bali course
   [2025-01-09 14:26] Сотрудник: Hello! Which tier?
   [2025-01-09 14:27] Клиент John: Premium tier
   [2025-01-09 14:28] Сотрудник: Great choice! Price is $199
   [2025-01-09 14:30] Клиент John: Is this still available?"
  ↓
Send to AI with prompt:
  "Based on conversation history, respond to customer.
   History: {conversation_history}
   Current message: {text}"
  ↓
AI generates context-aware response:
  "Yes! The Premium Bali course tier is still available for $199.
   Would you like me to send you the payment link?"
  ↓
Send response to user via Rails API
  ↓
User receives personalized, context-aware answer
```

**AI Prompt Template:**
```
You are a helpful course sales assistant.

Conversation History:
{conversation_history}

Customer's latest message: {text}

Instructions:
- Analyze the full conversation context
- Provide helpful, relevant response
- Maintain professional tone
- If unsure, ask clarifying questions
- For sales questions, be persuasive but honest

Response:
```

**Benefits:**
- **Context-aware responses** - AI understands conversation flow
- **No repeated questions** - AI remembers what was already discussed
- **Natural conversation** - Feels like talking to human
- **Escalation detection** - AI can detect frustration and notify admin
- **Multilingual support** - AI can respond in user's language
- **Learning over time** - Log successful conversations for fine-tuning

**Advanced Features:**
- **Sentiment tracking** - Monitor mood changes across messages
- **Intent detection** - Identify purchase intent, support needs, etc.
- **Smart escalation** - Transfer to human when AI confidence is low
- **A/B testing** - Test different AI models/prompts
- **Cost optimization** - Cache common responses to reduce API calls

**Configuration:**
```json
{
  "ai_provider": "openai",
  "model": "gpt-4-turbo",
  "temperature": 0.7,
  "max_tokens": 200,
  "system_prompt": "You are a helpful course assistant...",
  "auto_respond": true,
  "confidence_threshold": 0.8
}
```

---

## 🔄 Bi-directional Integration (Rails ↔ N8N)

### Incoming Webhook (Rails → N8N) ✅ IMPLEMENTED

Описано выше в секции "Message Received". Rails отправляет события в N8N.

---

### Outgoing API (N8N → Rails) ✅ IMPLEMENTED

**Endpoint:** `POST /api/n8n/send_message`

**Purpose:** Позволяет N8N (или AI-workflow) отправлять сообщения клиентам через Telegram Bot

**Authentication:** Bearer token (N8N_API_TOKEN)

**Request Format:**

```http
POST https://your-domain.com/api/n8n/send_message
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "telegram_id": 1978625688,
  "text": "**Привет!** Вот ответ на ваш вопрос:\n\n• Пункт 1\n• Пункт 2\n\nПодробнее: [ссылка](https://example.com)"
}
```

**Fields:**
- `telegram_id` (required) - Telegram user ID клиента
- `text` (required) - Текст сообщения в Markdown формате

**Markdown Support:**
- `**bold**` → **bold**
- `*italic*` → *italic*
- `` `code` `` → `code`
- `[text](url)` → links
- `• List items` → bullet lists
- `\n` → переносы строк

**Response (Success):**

```json
{
  "success": true,
  "message_id": 169,
  "telegram_message_id": 452,
  "user_id": 15,
  "conversation_id": 8
}
```

**Response (Error):**

```json
{
  "error": "User not found"
}
```

**Status Codes:**
- `200` - Success
- `401` - Unauthorized (invalid Bearer token)
- `404` - User not found
- `422` - Missing required parameters
- `500` - Internal server error (Telegram API failed)

---

### N8N Workflow: AI Auto-Responder (Full Cycle)

**Complete Flow:**

```
1. User sends message in Telegram
   ↓
2. Telegram → Rails webhook (/auth/telegram/webhook)
   ↓
3. Rails → N8N webhook (message_received event)
   Payload includes: message text + conversation_history (last 50)
   ↓
4. N8N → OpenAI/Claude API
   Prompt: "Analyze conversation history and respond as sales consultant"
   ↓
5. AI generates Markdown-formatted response
   ↓
6. N8N → Rails API (POST /api/n8n/send_message)
   {
     "telegram_id": 1978625688,
     "text": "**Отличный вопрос!** Вот что я могу порекомендовать..."
   }
   ↓
7. Rails → Telegram Bot API (send_message with Markdown)
   ↓
8. User receives AI response in Telegram
   ↓
9. Rails → ActionCable broadcast
   ↓
10. Admin sees AI response in messenger dashboard
```

**N8N Nodes Configuration:**

1. **Webhook Trigger** - receives `message_received` from Rails
2. **Function Node** - extract `conversation_history` and `text`
3. **OpenAI/Claude Node** - AI analysis and response generation
   - Model: GPT-4 or Claude Sonnet
   - System prompt: Sales consultant instructions
   - Include: conversation_history for context
4. **HTTP Request Node** - POST to Rails `/api/n8n/send_message`
   - Method: POST
   - **URL: `{{ $node["Webhook"].json.callback_url }}`** ✨ Dynamic environment routing!
   - Headers:
     - `Authorization: Bearer {{$env.N8N_API_TOKEN}}`
     - `Content-Type: application/json`
   - Body:
     ```json
     {
       "telegram_id": {{$json.user.telegram_id}},
       "text": {{$json.ai_response}}
     }
     ```
   - **Benefits:**
     - ✅ Single workflow for dev + production
     - ✅ No hardcoded URLs
     - ✅ Automatic environment switching
     - ✅ No workflow duplication needed
5. **Airtable/Database Node** (optional) - log AI interactions

**Example AI Prompt:**

```
You are a sales consultant for Bali Food Delivery Master course.

Conversation History:
{{$json.conversation_history}}

Customer's latest message: {{$json.text}}

Customer Info:
- Name: {{$json.user.first_name}}
- Business stage: [extract from history]

Instructions:
- Use consultative selling (70% value, 30% qualification)
- Apply "Value First" principle
- Show empathy to objections
- Recommend appropriate tier (Базовый/Акселератор/VIP)
- Use Markdown formatting for better readability
- Keep response concise (2-3 paragraphs max)

Response (in Markdown):
```

**Benefits:**
- **Context-aware AI** - sees full conversation history
- **Markdown formatting** - professional, readable messages
- **Automatic sales** - qualifies and closes leads 24/7
- **Admin oversight** - all messages visible in dashboard
- **Fallback to human** - admin can jump in anytime

---

### API Usage Examples

**Send simple message:**

```bash
curl -X POST https://your-domain.com/api/n8n/send_message \
  -H 'Authorization: Bearer YOUR_N8N_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "telegram_id": 1978625688,
    "text": "Спасибо за вопрос! Проверяю информацию..."
  }'
```

**Send Markdown-formatted message:**

```bash
curl -X POST https://your-domain.com/api/n8n/send_message \
  -H 'Authorization: Bearer YOUR_N8N_API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "telegram_id": 1978625688,
    "text": "**Акселератор тариф** включает:\n\n• 5 модулей видео\n• 3 живых воркшопа\n• 60 дней поддержки\n\n*Цена:* ₽38,000\n\nПодробнее: [тарифы](/pricing)"
  }'
```

**From N8N (HTTP Request node):**

```javascript
// N8N Function node to format request
return {
  json: {
    telegram_id: $input.item.json.user.telegram_id,
    text: $input.item.json.ai_response // AI-generated Markdown text
  }
}
```

---

### Error Handling

**Invalid Markdown fallback:**

If Telegram API returns Markdown parse error, the endpoint automatically:
1. Logs the error
2. Retries sending as plain text
3. Returns success with warning

**Example:**

```json
{
  "success": true,
  "message_id": 170,
  "warning": "Markdown parse error, sent as plain text"
}
```

---

## Security

### Authentication

All webhook requests include Bearer token authentication:

```http
POST /webhook/6d426ce1-6e61-42dd-96e3-ca96969f4c51
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Token Format:** JWT (JSON Web Token)

**Token Contents:**
```json
{
  "sub": "ae29c5b7-7e63-4c80-ba87-7d61b2e79b34",
  "iss": "n8n",
  "aud": "public-api",
  "iat": 1759980741
}
```

---

### Webhook Security

**N8N Side:**
- Webhook URL contains UUID that's hard to guess
- Validates Bearer token on every request
- Rate limiting enabled

**Rails Side:**
- API token stored in encrypted credentials
- HTTPS-only communication
- Error logging without exposing sensitive data

---

## Error Handling

### Webhook Failures

```ruby
def send_n8n_event(event_type, data)
  # ... setup request

  begin
    response = http.request(request)

    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error "N8N webhook failed: #{response.code}"
      # Optional: Store failed events for retry
      FailedWebhook.create!(
        event_type: event_type,
        data: data,
        error: response.body,
        attempted_at: Time.current
      )
    end
  rescue => e
    Rails.logger.error "N8N webhook exception: #{e.message}"
    # Optional: Alert admin via Telegram
  end
end
```

---

### Retry Logic (Future Enhancement)

```ruby
# app/jobs/retry_failed_webhooks_job.rb
class RetryFailedWebhooksJob < ApplicationJob
  def perform
    FailedWebhook.pending.find_each do |failed_webhook|
      response = send_n8n_event(
        failed_webhook.event_type,
        failed_webhook.data
      )

      if response.is_a?(Net::HTTPSuccess)
        failed_webhook.update!(status: 'succeeded', retried_at: Time.current)
      else
        failed_webhook.increment!(:retry_count)
        failed_webhook.update!(status: 'failed') if failed_webhook.retry_count >= 3
      end
    end
  end
end
```

---

## Testing

### Development Testing

**Manual Test:**
```bash
bin/rails console

# Test webhook send
send_n8n_event('test_event', { message: 'Hello from Rails!' })
```

**Check N8N:**
- Open N8N workflow executions
- Verify webhook was received
- Check execution logs

---

### RSpec Tests

```ruby
# spec/services/n8n_service_spec.rb
require 'rails_helper'

RSpec.describe 'N8N Integration' do
  describe 'send_n8n_event' do
    it 'sends webhook with correct payload' do
      stub_request(:post, N8N_WEBHOOK_URL)
        .with(
          headers: { 'Authorization' => "Bearer #{N8N_API_TOKEN}" },
          body: hash_including(event: 'test_event')
        )
        .to_return(status: 200)

      response = send_n8n_event('test_event', { test: true })

      expect(response.code).to eq('200')
    end

    it 'handles webhook failures gracefully' do
      stub_request(:post, N8N_WEBHOOK_URL).to_return(status: 500)

      expect {
        send_n8n_event('test_event', { test: true })
      }.not_to raise_error
    end
  end
end
```

---

## Setup Instructions

### 1. Edit Credentials

```bash
EDITOR="code --wait" bin/rails credentials:edit
```

Add:
```yaml
n8n:
  api_token: your_jwt_token
  webhook_url:
    test: https://n8n.aidelivery.tech/webhook-test/your-webhook-id
    production: https://n8n.aidelivery.tech/webhook/your-webhook-id
```

---

### 2. Restart Rails Server

```bash
# Development
bin/dev

# Or production (via Kamal)
bin/kamal deploy
```

---

### 3. Verify Configuration

```bash
bin/rails console

N8N_API_TOKEN
# => "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

N8N_WEBHOOK_URL
# => "https://n8n.aidelivery.tech/webhook-test/..."
```

---

## Production Deployment

### Kamal Configuration

Credentials are automatically deployed with application:

```yaml
# config/deploy.yml
env:
  secret:
    - RAILS_MASTER_KEY
```

The `master.key` is used to decrypt credentials containing N8N configuration.

---

### Environment-Specific URLs

- **Development/Test:** Uses `webhook_url.test`
- **Production:** Uses `webhook_url.production`

This ensures test events don't trigger production workflows.

---

## Monitoring

### Logging

All N8N webhook calls are logged:

```ruby
Rails.logger.info "N8N event sent: #{event_type}"
Rails.logger.error "N8N webhook failed: #{response.code}"
```

**Log Location:**
- Development: `log/development.log`
- Production: `bin/kamal logs` (via Docker)

---

### N8N Dashboard

Monitor workflows at: https://n8n.aidelivery.tech

**Metrics to Track:**
- Successful executions
- Failed executions
- Average execution time
- Error rates

---

## Future Enhancements

### 1. Async Job Processing

```ruby
# app/jobs/send_n8n_event_job.rb
class SendN8nEventJob < ApplicationJob
  queue_as :default

  def perform(event_type, data)
    send_n8n_event(event_type, data)
  end
end

# Usage
SendN8nEventJob.perform_later('user_registered', user_data)
```

---

### 2. Event Batching

Batch multiple events into single webhook call for efficiency:

```ruby
def send_n8n_batch(events)
  request.body = { events: events }.to_json
  # ...
end
```

---

### 3. Bi-directional Integration

Allow N8N to trigger actions in Rails:

```ruby
# app/controllers/n8n_controller.rb
class N8nController < ApplicationController
  skip_before_action :verify_authenticity_token
  before_action :verify_n8n_token

  def webhook
    event_type = params[:event]

    case event_type
    when 'grant_course_access'
      user = User.find(params[:user_id])
      user.grant_access!(params[:course_id])
    when 'send_reminder'
      user = User.find(params[:user_id])
      ReminderMailer.send_reminder(user).deliver_later
    end

    render json: { success: true }
  end

  private

  def verify_n8n_token
    token = request.headers['Authorization']&.split(' ')&.last
    unless token == N8N_API_TOKEN
      render json: { error: 'Unauthorized' }, status: 401
    end
  end
end
```

---

## Troubleshooting

### Issue: Webhook Not Received

**Check:**
1. Verify N8N workflow is active
2. Check webhook URL is correct in credentials
3. Verify API token is valid
4. Check N8N execution logs for errors

---

### Issue: Authentication Failed

**Solution:**
```bash
# Verify token in credentials
bin/rails credentials:show | grep n8n

# Re-generate token in N8N if needed
```

---

### Issue: SSL Certificate Error

**Solution:**
```ruby
# In production, ensure SSL verification is enabled
http.use_ssl = true
http.verify_mode = OpenSSL::SSL::VERIFY_PEER
```

---

## Conclusion

The N8N integration provides a flexible foundation for workflow automation in the Bali Food Delivery Master platform. The webhook-based approach ensures loose coupling while enabling powerful automation capabilities for user engagement, notifications, and data synchronization.

**Key Benefits:**
- Zero-downtime deployment (credentials encrypted)
- Environment-specific workflows (test vs production)
- Scalable event-driven architecture
- Easy to extend with new event types
