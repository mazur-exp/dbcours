# API Endpoints Documentation

## Overview

This document catalogs all HTTP endpoints in the application, including request/response formats, authentication requirements, and error handling.

---

## Authentication Endpoints

### POST /auth/telegram/start

**Purpose:** Initialize Telegram authentication flow

**Authentication:** None required

**Request:**
```http
POST /auth/telegram/start
Content-Type: application/json
X-CSRF-Token: <token>
```

**Response:**
```json
{
  "success": true,
  "deep_link": "https://t.me/dbcourse_auth_bot?start=a7f3e9d2...",
  "session_token": "a7f3e9d2e8c4b1f6..."
}
```

**Status Codes:**
- `200 OK` - Token generated successfully
- `500 Internal Server Error` - Server error

---

### GET /auth/status

**Purpose:** Check current authentication status

**Authentication:** Session-based

**Request:**
```http
GET /auth/status
```

**Response (Authenticated):**
```json
{
  "authenticated": true,
  "user": {
    "username": "johndoe",
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

**Response (Not Authenticated):**
```json
{
  "authenticated": false
}
```

---

### GET /auth/check_token

**Purpose:** Verify session token and establish session

**Authentication:** None (uses session_token param)

**Request:**
```http
GET /auth/check_token?session_token=a7f3e9d2e8c4b1f6...
```

**Response (Valid Token):**
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

**Response (Invalid Token):**
```json
{
  "authenticated": false
}
```

**Status Codes:**
- `200 OK` - Request processed (check `authenticated` field)
- `400 Bad Request` - Missing session_token parameter

---

### DELETE /auth/logout

**Purpose:** End user session

**Authentication:** Session required

**Request:**
```http
DELETE /auth/logout
```

**Response:**
- `302 Redirect` to `/freecontent`
- Flash message: "Logged out successfully"

---

### POST /auth/telegram/webhook

**Purpose:** Receive callbacks from Telegram bot

**Authentication:** Telegram signature (future enhancement)

**Request (from Telegram):**
```json
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 987654321,
      "first_name": "John",
      "last_name": "Doe",
      "username": "johndoe"
    },
    "chat": { "id": 987654321 },
    "text": "/start a7f3e9d2e8c4b1f6..."
  }
}
```

OR

```json
{
  "update_id": 123456790,
  "callback_query": {
    "id": "callback_id",
    "from": {
      "id": 987654321,
      "first_name": "John",
      "username": "johndoe"
    },
    "message": { "chat": { "id": 987654321 } },
    "data": "auth:a7f3e9d2e8c4b1f6..."
  }
}
```

**Response:**
```http
200 OK
```

**Side Effects:**
- Creates/updates User record
- Sends Telegram message with inline button OR confirmation
- Broadcasts to ActionCable channel

---

## Page Endpoints (HTML)

### GET /

**Purpose:** Home page (landing page)

**Authentication:** Optional (shows different CTAs if authenticated)

**Response:** HTML page

---

### GET /freecontent

**Purpose:** Free course lesson list

**Authentication:** Optional

**Response:** HTML page with lesson cards

---

### GET /free_content/lessons/:slug

**Purpose:** Individual lesson page

**Authentication:** Optional (content blurred if not authenticated)

**Parameters:**
- `:slug` - Lesson identifier (e.g., `01-introduction-why-delivery`)

**Response:** HTML page with lesson content

**Behavior:**
- Non-authenticated: Content blurred, modal shown
- Authenticated: Full content visible

---

## Health Check Endpoints

### GET /up

**Purpose:** Application health check (used by Kamal, load balancers)

**Authentication:** None

**Response:**
```http
200 OK
```

**Use Case:**
- Kamal deployment health check
- Uptime monitoring (Pingdom, etc.)
- Load balancer health probe

---

## Messenger Endpoints (Admin Dashboard)

**Base Path:** `/messenger`

**Authentication:** Admin-only (before_action: require_admin)

**Authorization Check:**
```ruby
def require_admin
  unless @current_user&.admin?
    redirect_to root_path, alert: 'Access denied'
  end
end
```

---

### GET /messenger

**Purpose:** Admin messenger dashboard

**Authentication:** Admin required

**Parameters:**
- `conversation_id` (optional) - ID of conversation to display

**Request:**
```http
GET /messenger?conversation_id=5
```

**Response:** HTML page with:
- Left sidebar: List of conversations (sorted by last_message_at)
- Right panel: Active conversation messages + input form
- Real-time updates via ActionCable (MessengerChannel)

**Side Effects:**
- Marks all messages in active conversation as read
- Updates unread_count to 0

**Example Response Structure:**
```erb
<div class="messenger-container">
  <!-- Left: Conversations list -->
  <aside>
    <% @conversations.each do |conv| %>
      <!-- Conversation card with avatar, last message, unread badge -->
    <% end %>
  </aside>

  <!-- Right: Active conversation -->
  <main data-controller="messenger">
    <!-- Header with user info + delete button -->
    <!-- Messages list (scrollable) -->
    <!-- Input form -->
  </main>
</div>
```

---

### GET /messenger/conversations/:id/messages

**Purpose:** Fetch messages for a conversation (AJAX)

**Authentication:** Admin required

**Parameters:**
- `:id` - Conversation ID

**Request:**
```http
GET /messenger/conversations/5/messages
```

**Response:**
```json
{
  "messages": [
    {
      "id": 123,
      "body": "Hello!",
      "direction": "incoming",
      "created_at": "2025-10-10T14:30:00Z",
      "read": true,
      "telegram_message_id": 456789,
      "user": {
        "id": 12,
        "first_name": "John",
        "last_name": "Doe",
        "username": "johndoe",
        "avatar_url": "https://..."
      }
    },
    {
      "id": 124,
      "body": "How can I help?",
      "direction": "outgoing",
      "created_at": "2025-10-10T14:31:00Z",
      "read": true,
      "user": null
    }
  ],
  "user": {
    "id": 12,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "avatar_url": "https://...",
    "created_at": "2025-10-08T10:00:00Z"
  }
}
```

**Status Codes:**
- `200 OK` - Messages fetched successfully
- `401 Unauthorized` - Not admin
- `404 Not Found` - Conversation doesn't exist

---

### POST /messenger/conversations/:id/messages

**Purpose:** Send message to user via Telegram

**Authentication:** Admin required

**Parameters:**
- `:id` - Conversation ID

**Request:**
```http
POST /messenger/conversations/5/messages
Content-Type: application/json
X-CSRF-Token: <token>

{
  "body": "Thank you for your question! Here's how..."
}
```

**Response:**
```json
{
  "success": true,
  "message": {
    "id": 125,
    "body": "Thank you for your question! Here's how...",
    "direction": "outgoing",
    "created_at": "2025-10-10T14:32:00Z",
    "telegram_message_id": 456790,
    "read": true,
    "user_id": null
  }
}
```

**Status Codes:**
- `200 OK` - Message sent successfully
- `401 Unauthorized` - Not admin
- `404 Not Found` - Conversation doesn't exist
- `422 Unprocessable Entity` - Message body blank or Telegram API error

**Side Effects:**
- Sends message via Telegram Bot API to user
- Saves message to database (direction: outgoing)
- Broadcasts to MessengerChannel (all admin sessions see update)
- Updates conversation last_message_at timestamp

**Error Handling:**
- If Telegram API fails → returns 422 with error message
- Message not saved if Telegram API fails

---

### PATCH /messenger/conversations/:id/mark_read

**Purpose:** Mark all messages in conversation as read

**Authentication:** Admin required

**Parameters:**
- `:id` - Conversation ID

**Request:**
```http
PATCH /messenger/conversations/5/mark_read
X-CSRF-Token: <token>
```

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200 OK` - Messages marked as read
- `401 Unauthorized` - Not admin
- `404 Not Found` - Conversation doesn't exist

**Side Effects:**
- Sets `read = true` for all incoming messages in conversation
- Sets `unread_count = 0` for conversation
- No ActionCable broadcast (automatic on page view)

---

### DELETE /messenger/users/:id

**Purpose:** Delete user and all associated data

**Authentication:** Admin required

**Parameters:**
- `:id` - User ID

**Request:**
```http
DELETE /messenger/users/12
X-CSRF-Token: <token>
```

**Response:** Redirect to `/messenger` with notice

**Status Codes:**
- `302 Found` - Redirect to messenger page
- `401 Unauthorized` - Not admin

**Side Effects:**
- Deletes user record
- Cascades delete to conversations (dependent: :destroy)
- Cascades delete to all messages in conversations
- Cannot delete self (safety check)
- Shows confirmation modal before delete (data-confirm)

**Confirmation Dialog:**
```erb
<%= button_to "Delete User", messenger_delete_user_path(@user),
    method: :delete,
    data: { confirm: "Are you sure? This will delete all messages and user data." },
    class: "..." %>
```

---

## N8N API Endpoints (Webhook Integration)

**Base Path:** `/api/n8n`

**Authentication:** Bearer token (currently disabled, TODO: enable in production)

**Purpose:** Allow N8N workflows (and AI) to send messages back to users

---

### POST /api/n8n/send_message

**Purpose:** Send message to user via Telegram (called by N8N/AI workflows)

**Authentication:** Bearer token (N8N_API_TOKEN) - **CURRENTLY DISABLED**

**Request:**
```http
POST /api/n8n/send_message
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "telegram_id": 987654321,
  "text": "**Great question!** The course costs $199...\n\nHere's what you get:\n• Module 1\n• Module 2",
  "real_name": "Александр",
  "background": "Restaurant owner in Moscow, planning Bali delivery",
  "query": "Course pricing and timeline",
  "ready": "7"
}
```

**Request Fields:**
- `telegram_id` (required) - User's Telegram ID
- `text` (required) - Message text to send to user (supports Markdown)
- `real_name` (optional) - AI-extracted real name of customer
- `background` (optional) - Customer's business context/situation
- `query` (optional) - Customer's main question or goal
- `ready` (optional) - Lead readiness score (0-10 scale, where 10 = ready to buy now)

**Markdown Support:**
- `**bold**` → bold
- `*italic*` → italic
- `` `code` `` → code
- `[text](url)` → links
- `\n` → line breaks

**Response (Success):**
```json
{
  "success": true,
  "message_id": 126,
  "telegram_message_id": 456791,
  "user_id": 12,
  "conversation_id": 5
}
```

**Response (Error - User not found):**
```json
{
  "error": "User not found"
}
```

**Response (Error - Missing parameter):**
```json
{
  "error": "telegram_id is required"
}
```

**Status Codes:**
- `200 OK` - Message sent successfully
- `401 Unauthorized` - Invalid Bearer token (when enabled)
- `404 Not Found` - User not found
- `422 Unprocessable Entity` - Missing required parameters
- `500 Internal Server Error` - Telegram API failed

**Side Effects:**
- Sends `text` to user via Telegram API with Markdown formatting
- Saves message to database (direction: outgoing, user_id: nil)
- **Stops typing indicator** - Sets conversation.ai_processing = false
- **Saves AI qualification data** to conversation:
  - `real_name` → `conversation.ai_real_name`
  - `background` → `conversation.ai_background`
  - `query` → `conversation.ai_query`
  - `ready` → `conversation.ai_ready_score`
- Broadcasts to MessengerChannel (admin sees message + qualification in real-time)
- Updates conversation last_message_at timestamp
- **Displays in messenger dashboard** - AI data shown in right sidebar with color-coded badges

**Error Handling:**

1. **Markdown parse error** - Retries without Markdown
2. **JSON parse error** - Treats entire text as plain message
3. **User not found** - Returns 404, no message saved
4. **Telegram API error** - Returns 500, no message saved

**Example N8N Workflow Configuration:**

```javascript
// N8N HTTP Request node (after Code node that extracts AI fields)
{
  "method": "POST",
  "url": "{{ $node['Webhook'].json.callback_url }}",
  "headers": {
    "Authorization": "Bearer {{$env.N8N_API_TOKEN}}",
    "Content-Type": "application/json"
  },
  "body": {
    "telegram_id": "{{ $node['Webhook'].json.user.telegram_id }}",
    "text": "{{ $json.text }}",
    "real_name": "{{ $json.real_name }}",
    "background": "{{ $json.background }}",
    "query": "{{ $json.query }}",
    "ready": "{{ $json.ready }}"
  }
}
```

**Note:** Requires Code node before HTTP Request to extract fields from AI JSON response. See `ai_auto_responder.md` for Code node implementation.

**Security Note:**

Currently authentication is **DISABLED** for testing:

```ruby
# app/controllers/n8n_controller.rb
skip_before_action :verify_authenticity_token
# TODO: Добавить авторизацию позже когда всё заработает
# before_action :verify_n8n_token
```

**Production Implementation Required:**

```ruby
before_action :verify_n8n_token

def verify_n8n_token
  token = request.headers['Authorization']&.split(' ')&.last
  unless token == N8N_API_TOKEN
    render json: { error: 'Unauthorized' }, status: :unauthorized
  end
end
```

---

## Future Endpoints (Planned)

### POST /enrollments

**Purpose:** Enroll user in paid course

**Authentication:** Required

**Request:**
```json
{
  "tier": "accelerator",
  "payment_token": "stripe_token_123"
}
```

**Response:**
```json
{
  "success": true,
  "enrollment_id": 42,
  "access_granted": true
}
```

---

### GET /api/v1/lessons/:slug/progress

**Purpose:** Get lesson progress for user

**Authentication:** Required

**Response:**
```json
{
  "lesson_slug": "01-introduction",
  "completed": true,
  "completed_at": "2025-01-15T10:30:00Z",
  "time_spent_seconds": 480
}
```

---

### POST /api/v1/lessons/:slug/complete

**Purpose:** Mark lesson as completed

**Authentication:** Required

**Request:**
```json
{
  "time_spent_seconds": 600
}
```

**Response:**
```json
{
  "success": true,
  "progress_updated": true
}
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message here",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

**401 Unauthorized:**
```json
{
  "error": "Authentication required",
  "code": "UNAUTHORIZED"
}
```

**403 Forbidden:**
```json
{
  "error": "Access denied",
  "code": "FORBIDDEN"
}
```

**404 Not Found:**
```json
{
  "error": "Resource not found",
  "code": "NOT_FOUND"
}
```

**422 Unprocessable Entity:**
```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "telegram_id": ["can't be blank"]
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

## Rate Limiting (Future)

**Endpoint:** `/auth/telegram/start`

**Limit:** 10 requests per minute per IP

**Response (Rate Limit Exceeded):**
```http
429 Too Many Requests
Retry-After: 60
```

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT",
  "retry_after": 60
}
```

---

## CORS Configuration (Future)

**Allowed Origins:**
- `https://dbcours.com`
- `https://www.dbcours.com`

**Allowed Methods:**
- GET, POST, PUT, DELETE, OPTIONS

**Allowed Headers:**
- Content-Type, Authorization, X-CSRF-Token

---

## Testing Endpoints

### cURL Examples

**Start Auth:**
```bash
curl -X POST https://dbcours.com/auth/telegram/start \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token>"
```

**Check Auth Status:**
```bash
curl https://dbcours.com/auth/status \
  -H "Cookie: _dbcours_session=<session_cookie>"
```

**Check Token:**
```bash
curl "https://dbcours.com/auth/check_token?session_token=abc123"
```

---

## Conclusion

All endpoints follow RESTful conventions. JSON APIs return consistent response formats with appropriate HTTP status codes. Future expansion will include versioned API endpoints (`/api/v1/...`) for paid course features, with proper authentication, authorization, and rate limiting.
