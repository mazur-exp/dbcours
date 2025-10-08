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
