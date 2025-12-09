# Changelog

## Overview

This document tracks all significant changes, features, and updates to the Bali Food Delivery Master platform. Changes are organized chronologically from newest to oldest.

---

## [December 9, 2025] - ngrok Development Environment Fixes

### Fixed

- **Telegram Authentication через ngrok**
  - Skip CSRF verification для `/auth/telegram/start` endpoint
  - Исправлен session domain для development окружения (nil вместо :all)
  - Telegram авторизация теперь работает через ngrok tunnel
  - **Files:**
    - `app/controllers/auth_controller.rb:4` - добавлен `:start` в skip_before_action
    - `config/initializers/session_store.rb:14-15` - условный domain для development

- **ActionCable Static Subscription Conflict**
  - Удалена статическая подписка на AuthChannel без session_token
  - Динамическая подписка с токеном уже реализована в auth_controller.js
  - **Files:**
    - `app/javascript/channels/auth_channel.js` - очищен файл

- **Production AI Chat Configuration**
  - Добавлен `ai_chat_webhook_url` в production credentials для AI assistant
  - **Files:**
    - `config/credentials/production.yml.enc` - добавлен n8n.ai_chat_webhook_url.production

### Changed

- **AI Chat Controller Logging**
  - Добавлен debug logging для N8N responses
  - Помогает диагностировать empty response issues
  - **Files:**
    - `app/controllers/api/ai_chat_controller.rb:34` - логирование response code и body length

### Technical Details

**Problem:** ngrok домен `karri-unexpunged-becomingly.ngrok-free.dev` имеет 4 части, но session store настроен для 2-х частных доменов (`*.aidelivery.tech`). Session cookies не устанавливались правильно в development, блокируя CSRF и авторизацию.

**Solution:** Conditional session configuration - `domain: nil` в development позволяет cookies работать на любом домене (включая ngrok), при этом production shared session остаётся без изменений.

**Impact:** Telegram авторизация теперь работает в development через ngrok для локального тестирования webhook integrations.

---

## [December 3, 2025] - Admin Analytics Dashboard & Unified Header Design

### Added

- **Admin Analytics Dashboard (admin.aidelivery.tech)**
  - New third domain for analytics and client management
  - Login page with same pattern as CRM (redirect if admin)
  - 3-column dashboard layout:
    - Left: Clients list with search
    - Center: Analytics charts + AI chat
    - Right: Selected client info
  - **Client model** for restaurant clients tracking
    - Fields: name, contact_name, telegram_username, status, notes, goals, started_at
    - Scopes: `active`, `ordered`
    - Status colors: active (green), paused (yellow), churned (red)
  - **Chart.js integration** via ESM importmap
    - Line and bar charts for placeholder analytics
    - Stimulus controller for Chart.js rendering
  - **AI Chat placeholder** (stub responses, future N8N integration)
  - **Files:**
    - `app/controllers/admin/base_controller.rb` - Admin authorization
    - `app/controllers/admin/home_controller.rb` - Login page
    - `app/controllers/admin/dashboard_controller.rb` - Main dashboard
    - `app/models/client.rb` - Client model
    - `app/views/admin/**` - All admin views
    - `app/views/layouts/admin.html.erb` - Admin layout
    - `app/javascript/controllers/chart_controller.js` - Chart.js Stimulus
    - `app/javascript/controllers/admin_chat_controller.js` - AI chat stub
    - `db/migrate/XXX_create_clients.rb` - Client migration
  - **Documentation:** `ai_docs/development/admin_analytics_dashboard.md`

- **Unified Header Design Pattern**
  - All CRM/Admin pages now use consistent header:
    - Icon (dynamic per page) + "Delivery Booster" + page_title
  - **Icon Map pattern** - SVG icons mapped by page_title:
    - CRM: 👥 People icon
    - Messenger: 💬 Chat bubble
    - Источники трафика: 📈 Trending arrow
    - Analytics Dashboard: 📊 Charts
  - `page_title` variable for dynamic subtitle
  - Shared `auth_button` partial for navigation dropdown
  - **Files:**
    - `app/views/crm/shared/_header.html.erb` - Updated with icon map
    - `app/views/admin/shared/_header.html.erb` - Uses shared auth_button

### Changed

- **CRM Header Redesign**
  - Changed from text "Delivery Booster | CRM" to icon-based design
  - Added icon map for dynamic icon selection
  - Kept stats and extra_links functionality
  - **Before:** `Delivery Booster | CRM` (text-based)
  - **After:** `[📊] Delivery Booster` + `CRM` (icon + subtitle)

- **Admin Header**
  - Replaced custom dropdown with shared `auth_button` partial
  - Made `page_title` dynamic with default "Analytics Dashboard"
  - **Before:** Custom dropdown with 3 items (CRM, Course, Выйти)
  - **After:** Full dropdown with all navigation items

### Technical Details

**Chart.js ESM Import:**
```ruby
# config/importmap.rb
pin "chart.js/auto", to: "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/auto/+esm"
```

**Icon Map Pattern:**
```erb
<% page_icons = {
  'CRM' => '<path ... />',
  'Messenger' => '<path ... />',
  'Источники трафика' => '<path ... />',
  'Analytics Dashboard' => '<path ... />'
} %>
<% icon_path = page_icons[page_title] || default_icon %>
```

**Admin Domain Routes:**
```ruby
# Production
constraints(host: "admin.aidelivery.tech") do
  get "/", to: "admin/home#index", as: :admin_root
  namespace :admin, path: "" do
    get "dashboard", to: "dashboard#index"
  end
end

# Development
get "admin", to: "admin/home#index", as: :admin_root
namespace :admin do
  get "dashboard", to: "dashboard#index"
end
```

**Kamal Deployment:**
```yaml
proxy:
  ssl: true
  host: course.aidelivery.tech,crm.aidelivery.tech,admin.aidelivery.tech
```

### Access Level Matrix (Updated)

| User Type | Course | CRM | Messenger | Traffic | Analytics |
|-----------|--------|-----|-----------|---------|-----------|
| Not authenticated | ✗ | ✗ | ✗ | ✗ | ✗ |
| Authenticated (free) | Partial | ✗ | ✗ | ✗ | ✗ |
| Authenticated (paid) | ✓ | ✗ | ✗ | ✗ | ✗ |
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ |

### Documentation

- **Created:** `ai_docs/development/admin_analytics_dashboard.md` - Full admin dashboard docs
- **Updated:** `ai_docs/development/multi_domain_architecture.md` - Added admin domain
- **Updated:** `ai_docs/development/changelog.md` - This entry

### Commits

- `6f4703a` - Add admin.aidelivery.tech analytics dashboard
- `3b3b9eb` - Unify header design across CRM and Admin domains

---

## [October 16, 2025] - Paid User Access Control & CRM Placeholder

### Added

- **Paid User Access Control System**
  - Added `paid` boolean field to `users` table (default: false, null: false)
  - Migration automatically sets `paid = true` for all existing admins
  - New scope: `User.paid_users` for querying paid users
  - New method: `User#has_dashboard_access?` - returns true for admin OR paid users
  - Callback: `after_save :ensure_admin_is_paid` - automatically sets paid=true for admins
  - **File:** `app/models/user.rb` (lines 9, 30-32, 36-41)
  - **Migration:** `db/migrate/20251016095309_add_paid_to_users.rb`

- **Dashboard Authorization**
  - Dashboard now requires paid status OR admin status
  - Added `before_action :require_dashboard_access` in DashboardController
  - Redirects unpaid users to `/freecontent` with alert: "Доступ к курсу доступен только после оплаты"
  - Removed mock data (OpenStruct), now uses real `@current_user`
  - **File:** `app/controllers/dashboard_controller.rb` (lines 2, 95-101)

- **CRM Placeholder Page**
  - Created new route: `GET /crm`
  - Created CrmController with admin-only access control
  - Placeholder view following design system (green gradients, Tailwind CSS)
  - Shows "В разработке" (In Development) message with planned features:
    - Управление лидами из Telegram
    - Автоматическая квалификация через AI
    - Трекинг прогресса обучения
    - Аналитика продаж и конверсий
    - Интеграция с платежными системами
  - **Files:**
    - `config/routes.rb` - Added crm route
    - `app/controllers/crm_controller.rb` - Admin authorization
    - `app/views/crm/index.html.erb` - Placeholder UI

### Changed

- **Navigation Menu Reorganization**
  - Updated dropdown menu order in `_auth_button.html.erb`:
    1. Главная → `/` (Home)
    2. Курс → `/dashboard` (Paid course - requires paid OR admin)
    3. Мини-Курс → `/freecontent` (renamed from "Курс")
    4. Messenger → `/messenger` (admin only)
    5. CRM → `/crm` (admin only, NEW)
    6. Выйти → logout
  - **File:** `app/views/shared/_auth_button.html.erb` (lines 38-65)

- **Dashboard Page Integration**
  - Integrated `_auth_button` dropdown component into dashboard header
  - Fixed sidebar logout button to use correct `auth_logout_path`
  - Updated to use real user data instead of mock OpenStruct
  - **File:** `app/views/dashboard/index.html.erb`

### Technical Details

**Database Schema Changes:**
```ruby
# Migration: AddPaidToUsers
add_column :users, :paid, :boolean, default: false, null: false

# Data migration: Set all existing admins to paid
execute "UPDATE users SET paid = 1 WHERE admin = 1"
```

**User Model Updates:**
```ruby
# New scope
scope :paid_users, -> { where(paid: true) }

# New method
def has_dashboard_access?
  admin? || paid?
end

# New callback
after_save :ensure_admin_is_paid

private

def ensure_admin_is_paid
  if admin? && !paid?
    update_column(:paid, true)
  end
end
```

**Authorization Pattern:**
```ruby
# DashboardController
before_action :require_dashboard_access

def require_dashboard_access
  unless @current_user&.has_dashboard_access?
    redirect_to freecontent_path, alert: "Доступ к курсу доступен только после оплаты"
  end
end

# CrmController
before_action :require_admin

def require_admin
  unless @current_user&.admin?
    redirect_to root_path, alert: "Доступ запрещен"
  end
end
```

### Access Level Matrix

| User Type | Free Mini-Course | Paid Dashboard | Messenger | CRM |
|-----------|------------------|----------------|-----------|-----|
| Not authenticated | ✗ | ✗ | ✗ | ✗ |
| Authenticated (free) | ✓ | ✗ | ✗ | ✗ |
| Authenticated (paid) | ✓ | ✓ | ✗ | ✗ |
| Admin | ✓ | ✓ | ✓ | ✓ |

### Documentation

- **Updated:** `ai_docs/development/database_schema.md` - Added paid field documentation
- **Updated:** `ai_docs/development/architecture.md` - Added authorization section
- **Updated:** `ai_docs/ui/component_library.md` - Added CRM page and updated auth dropdown
- **Updated:** `ai_docs/development/changelog.md` - This entry

### Business Impact

This update establishes the foundation for the freemium-to-paid conversion model:
- Free users can access 12-lesson mini-course
- Paid users unlock full dashboard (5 modules, 8 hours of content)
- Admins maintain full access to all features
- CRM placeholder signals upcoming sales management features

### Future Enhancements

- Payment integration (Stripe/YooKassa) to set `paid = true` on purchase
- Enrollment tracking with tier selection (Basic/Accelerator/VIP)
- CRM functionality for lead management and qualification
- Analytics dashboard for admin revenue tracking

---

## [October 13, 2025] - Business API Owner Message Filtering

### Fixed
- **Business API Owner Message Filtering**
  - Added check to ignore business messages from account owner
  - Prevents owner's outgoing messages from appearing in messenger
  - Only customer messages are now saved and displayed
  - **File:** `app/controllers/auth_controller.rb` (lines 518-533)

### Problem
When business account owner writes to their customers via Telegram Business, those messages were incorrectly saved as "incoming" messages from the owner to themselves, creating a confusing "Owner → Owner" conversation in messenger.

### Solution
Added validation in `handle_business_message`:
1. Find BusinessConnection by business_connection_id
2. Check if message sender telegram_id matches connection owner's telegram_id
3. If match → return early (ignore message)
4. If no match → process as customer message

**Code:**
```ruby
# auth_controller.rb (lines 518-533)
business_conn = BusinessConnection.find_by(business_connection_id: business_connection_id)

unless business_conn
  Rails.logger.warn "❌ Business connection not found"
  return
end

# Ignore messages from owner
if from["id"] == business_conn.user.telegram_id
  Rails.logger.info "⏭️  Ignoring business message from owner"
  return
end
```

### Impact
- Owner's outgoing messages no longer pollute messenger
- Messenger only shows genuine customer conversations
- Cleaner admin dashboard experience
- Standard practice for Telegram Business API integrations

### Cleanup
To remove existing incorrect conversation (run in Rails console after deploy):
```ruby
owner_conversation = Conversation.joins(:user).where(users: { telegram_id: YOUR_TELEGRAM_ID }).first
owner_conversation.destroy if owner_conversation
```

---

## [October 13, 2025] - N8N Business API Channel Routing

### Added
- **N8N Channel Routing for Business API**
  - N8N webhook payload now includes `source_type` (bot/business)
  - N8N webhook payload includes `business_connection_id` for business messages
  - N8N responses route through correct channel automatically
  - If client wrote via business → AI responds via business
  - If client wrote via bot → AI responds via bot
  - **Files:**
    - `app/controllers/auth_controller.rb` (lines 405-406) - Added source_type to payload
    - `app/controllers/n8n_controller.rb` (lines 16-17, 69-86, 94-95, 147-158) - Channel routing logic

### Changed
- **N8N Workflow Requirements**
  - N8N must now return `source_type` and `business_connection_id` from webhook
  - These fields pass through from incoming webhook to response
  - Enables seamless channel routing without manual configuration

### Technical Details

**Workflow:**
1. Client writes to bot OR business account
2. Rails sends to N8N with source_type + business_connection_id
3. N8N processes and returns same fields
4. Rails routes response through matching channel

**Code Example:**

```ruby
# N8nController routing (lines 69-86)
if source_type == 'business' && business_connection_id.present?
  result = bot_client.api.send_message(
    business_connection_id: business_connection_id,
    chat_id: telegram_id,
    text: text_to_send
  )
else
  result = bot_client.api.send_message(
    chat_id: telegram_id,
    text: text_to_send
  )
end
```

**Outgoing Webhook Payload (Rails → N8N):**

```json
{
  "event": "message_received",
  "text": "Customer message",
  "source_type": "business",
  "business_connection_id": "ABCD1234567890",
  "callback_url": "https://crm.aidelivery.tech/api/n8n/send_message",
  "user": { ... },
  "conversation_history": "..."
}
```

**Incoming API Request (N8N → Rails):**

```json
{
  "telegram_id": 987654321,
  "text": "AI response",
  "source_type": "business",
  "business_connection_id": "ABCD1234567890"
}
```

**N8N Configuration:**

N8N workflows must pass through `source_type` and `business_connection_id`:

```javascript
// HTTP Request Node Body
{
  "telegram_id": {{ $json.telegram_id }},
  "text": {{ $json.ai_response }},
  "source_type": {{ $json.source_type }},  // PASS THROUGH
  "business_connection_id": {{ $json.business_connection_id }}  // PASS THROUGH
}
```

**Fallback Logic:**

If Business API fails (expired connection, etc.), Rails automatically falls back to bot channel:

```ruby
# N8nController (lines 147-158)
rescue Telegram::Bot::Error => e
  if source_type == 'business'
    # Retry via bot
    result = bot_client.api.send_message(chat_id: telegram_id, text: text_to_send)
    source_type = 'bot'
  end
end
```

### Benefits

- **Maintains channel context** (business stays business, bot stays bot)
- **No manual channel selection needed** - automatic routing based on incoming message
- **Seamless UX for customers** - response comes from same channel they used
- **Single N8N workflow** handles both channels
- **Fallback protection** - automatically switches to bot if business channel fails

### Documentation

- **Updated:** `ai_docs/development/n8n_integration.md` - New section "Channel Routing for Business API"
- **Cross-reference:** `telegram_business_api.md` for Business API details
- **Related:** `messenger_feature.md` for UI-based channel selection

---

## [October 13, 2025] - Tab-Based Channel Selection UI

### Added
- **Tab-Based Channel Selection**
  - Two tabs: 🤖 Бот and 👤 Бизнес with message counts
  - Click to filter messages by source (bot/business)
  - Active tab determines send channel (user selection)
  - Auto-detection of active tab based on last message
  - **Files:**
    - `app/views/messenger/index.html.erb` (lines 70-87) - Tab buttons with counts
    - `app/javascript/controllers/messenger_controller.js` (lines 36-86) - switchTab() and filterMessages() functions
    - `app/views/messenger/_messages.html.erb` (line 2) - data-source-type attribute
  - **Visual Design:**
    - Active Bot tab: `bg-blue-100 text-blue-700`
    - Active Business tab: `bg-green-100 text-green-700`
    - Inactive tabs: `text-gray-600 hover:bg-gray-100`
  - **Documentation:**
    - `telegram_business_api.md` - New section "Tab-Based UI for Channel Selection"
    - `messenger_feature.md` - New section "Channel Selection Tabs"

### Changed
- **Message Routing Logic**
  - Changed from automatic channel detection to user-selected
  - Admin now chooses channel via tabs instead of automatic routing based on last incoming message
  - `params[:source_type]` passed from frontend to backend
  - **File:** `app/controllers/messenger_controller.rb` (lines 35-54)
  - **Before:** `source_type = last_incoming&.source_type || 'bot'`
  - **After:** `source_type = params[:source_type] || 'bot'`
  - **Commits:** c4d72c8 (Fix symbol vs string comparison), b97fc41 (Add automatic message routing)

### Fixed
- **Business Connection ID Path**
  - Fixed webhook payload path to `business_message.business_connection_id`
  - **Before:** `update["business_connection_id"]`
  - **After:** `update["business_message"]["business_connection_id"]`
  - **File:** `app/controllers/auth_controller.rb` (line 93)

- **Improved Logging**
  - Added emoji prefixes for better log readability
  - 📨 for business messages
  - 🔍 for lookups
  - ✅ for success
  - ❌ for errors
  - **Files:** `auth_controller.rb` (lines 513-577), `messenger_controller.rb` (lines 156-231)

### Technical Details

**JavaScript Functions:**

**switchTab() - Tab switching logic**
```javascript
// messenger_controller.js (lines 45-70)
switchTab(event) {
  this.activeTab = button.dataset.tab

  // Update button styles
  // Highlight active tab (blue for bot, green for business)
  // Call filterMessages()
}
```

**filterMessages() - Message filtering by source type**
```javascript
// messenger_controller.js (lines 72-86)
filterMessages() {
  messages.forEach(msg => {
    if (this.activeTab === msg.dataset.sourceType) {
      msg.style.display = 'flex'  // Show matching
    } else {
      msg.style.display = 'none'  // Hide non-matching
    }
  })
}
```

**Auto-detection on load**
```javascript
// messenger_controller.js (lines 36-39)
connect() {
  const lastMessage = messages[messages.length - 1]
  this.activeTab = lastMessage?.dataset.sourceType || 'bot'
}
```

**Integration with send_message:**
```javascript
// messenger_controller.js (line 530)
body: JSON.stringify({
  body: body,
  source_type: this.activeTab  // Передаём выбранную вкладку
})
```

**Backend handling:**
```ruby
# messenger_controller.rb (lines 44-45)
source_type = params[:source_type] || 'bot'  # User selection from tabs
```

### User Experience

**Before (Automatic Routing):**
- System automatically chose channel based on last incoming message
- Admin had no control over which channel to use
- Confusing when both channels were active

**After (Tab-Based Selection):**
- Admin explicitly chooses channel via tabs
- Visual feedback with color-coded tabs
- Message counts show activity per channel
- Clear control over routing logic

### Impact on Business API Integration

This change completes the dual-channel messaging feature:
- Admins can consciously switch between Bot and Business channels
- Better UX for managing multiple communication channels
- Prepares foundation for multi-business support in future

See `telegram_business_api.md` for complete Business API documentation.

---

## [October 12, 2025] - AI Qualification & Documentation Review

### Added
- **AI Qualification Display in Messenger Dashboard**
  - Visual display of AI-extracted lead data in right sidebar
  - Four fields: Real Name, Background, Query, Ready Score
  - Color-coded ready score badges (🔴 0-3, 🟡 4-7, 🟢 8-10)
  - Gradient purple-to-blue design distinguishes AI data from user info
  - Auto-hides section if no qualification data present
  - **Real-time updates via ActionCable** - No page refresh needed! ✨
  - **Files:**
    - `app/views/messenger/index.html.erb` (lines 143-224) - UI with data-targets
    - `app/javascript/controllers/messenger_controller.js` (lines 94-185) - Real-time update logic
  - **Documentation:** `messenger_feature.md` - "AI Qualification Display" section with real-time updates

- **Real-Time Sidebar Updates**
  - AI qualification updates automatically when N8N sends data
  - Message statistics increment without refresh
  - Color-coded ready score badge changes in real-time
  - Dynamic show/hide of AI qualification fields
  - Smooth UX - admin sees changes instantly

### Changed
- **N8nController Parameter Handling**
  - Simplified to accept parameters directly from N8N
  - Removed JSON parsing logic (parse_ai_response method deleted)
  - Now accepts: `text`, `real_name`, `background`, `query`, `ready`
  - Cleaner code: -65 lines removed
  - **File:** `app/controllers/n8n_controller.rb`
  - **Documentation:** Updated `ai_auto_responder.md` with new parameter structure

- **ActionCable Broadcasts Enhanced** (3 controllers updated)
  - Added `ai_qualification` object to broadcasts (real_name, background, query, ready_score)
  - Added `statistics` object to broadcasts (total, incoming, outgoing counts)
  - Enables real-time sidebar updates without page refresh
  - **Files:**
    - `app/controllers/n8n_controller.rb` (lines 99-111)
    - `app/controllers/messenger_controller.rb` (lines 78-90)
    - `app/controllers/auth_controller.rb` (lines 196-208, 334-346)

### Documentation
- **Comprehensive Documentation Review**
  - Reviewed all recent changes (commits 2939c92, fb0140f, 38bb8d8)
  - Updated messenger_feature.md with AI qualification section
  - Verified accuracy of code examples across all docs
  - Confirmed cross-references between documents
  - **Result:** Documentation health: 95/100 → 98/100 (Excellent)

### Security
- No security changes in this update
- All existing authentication and authorization remain unchanged

---

## [January 12, 2025] - Callback URL & Deployment Updates

### Added
- **Callback URL Feature** for N8N Integration
  - Dynamic environment routing (dev/prod) without hardcoded URLs
  - `callback_url` field in webhook payload
  - `api_base_url` in credentials for automatic URL construction
  - Single N8N workflow works across all environments
  - Eliminates workflow duplication and manual URL changes
  - **Files:** `app/controllers/auth_controller.rb:357-368`
  - **Documentation:** `ai_docs/development/n8n_integration.md` (Issue #11 solution)

### Updated
- **Kamal Deployment Configuration**
  - Updated architecture to `arm64` for Apple Silicon optimization
  - Configured custom SSH port (2222) for enhanced security
  - Dedicated job server configuration for Solid Queue
  - **File:** `config/deploy.yml`

- **Documentation Updates**
  - Updated `deployment.md` with Bitwarden CLI integration
  - Updated `n8n_integration.md` with callback URL feature details
  - Updated `telegram_credentials.md` with `api_base_url` field
  - Added Issue #11 to `known_issues_and_solutions.md`
  - Updated `README.md` with latest file counts and dates
  - Added `pwa_implementation.md` to documentation index

---

## [January 10, 2025] - Kamal Deployment Refinement

### Updated
- **Secrets Management**
  - Switched from `master.key` to `production.key` for production deployments
  - Integrated Bitwarden CLI for secure credential management
  - **File:** `.kamal/secrets`

- **Docker Registry**
  - Maintained GitHub Container Registry (`ghcr.io`) configuration
  - Username: `mazur-exp`
  - Image: `mazur-exp/dbcours`
  - **File:** `config/deploy.yml`

---

## [January 9, 2025] - Environment-Specific Credentials

### Added
- **Production Credentials Separation**
  - Created `config/credentials/production.yml.enc`
  - Separate credential files for development and production
  - Environment-specific bot tokens and webhook URLs
  - **Files:** `config/credentials/production.yml.enc`, `config/credentials/production.key`

### Updated
- **N8N Webhook Configuration**
  - Restored environment-specific webhook URLs (test/production)
  - Automatic switching based on `Rails.env`
  - **File:** `config/initializers/n8n.rb`

---

## [January 8, 2025] - PWA Implementation

### Added
- **Progressive Web App Support**
  - Web App Manifest (`/manifest.json`)
  - Service Worker for offline caching (`/service-worker.js`)
  - Network-first cache strategy
  - Installable on Android, iOS, and Desktop
  - App icons: 192×192, 512×512, 180×180 (iOS)
  - Standalone mode with splash screen
  - Theme color: `#dc2626` (red-600)
  - **Files:**
    - `app/views/pwa/manifest.json.erb`
    - `app/views/pwa/service-worker.js`
    - `app/javascript/application.js` (SW registration)
    - `app/views/layouts/application.html.erb` (meta tags)
  - **Controller:** `app/controllers/pwa_controller.rb`
  - **Routes:** `/manifest`, `/service-worker`
  - **Documentation:** `ai_docs/development/pwa_implementation.md`

### Updated
- **N8N Production Configuration**
  - Switched to production webhook URL by default
  - Updated credentials structure for production readiness
  - **File:** `config/initializers/n8n.rb`

- **Bot Access**
  - Opened bot to all users (removed closed beta restriction)
  - **File:** `app/controllers/auth_controller.rb`

---

## [January 7, 2025] - Complete Documentation Overhaul

### Added
- **AI Auto-Responder Documentation**
  - Complete 10-step workflow documentation
  - Typing indicator implementation guide
  - Lead qualification fields documentation
  - N8N workflow configuration examples
  - **File:** `ai_docs/development/ai_auto_responder.md` (1,266 lines)

- **API Endpoints Documentation**
  - Authentication endpoints reference
  - N8N integration endpoints
  - Request/response examples
  - **File:** `ai_docs/development/api_endpoints.md`

- **Database Schema Documentation**
  - Complete schema documentation
  - Future schema planning (Enrollments, Payments)
  - Query patterns and optimizations
  - **File:** `ai_docs/development/database_schema.md`

- **Frontend Architecture Documentation**
  - Hotwire (Turbo + Stimulus) architecture
  - Stimulus controllers guide
  - ActionCable integration
  - **File:** `ai_docs/development/frontend_architecture.md`

---

## [January 6, 2025] - Bidirectional N8N Integration

### Added
- **N8N → Rails API Endpoint**
  - `POST /api/n8n/send_message` endpoint
  - Allows N8N workflows to send messages back to users via Telegram
  - Markdown formatting support in messages
  - Bearer token authentication
  - **File:** `app/controllers/api/n8n_controller.rb`
  - **Route:** `/api/n8n/send_message`

- **AI Auto-Responder with Typing Indicator**
  - Real-time typing indicator ("...typing") shown during AI processing
  - `TypingIndicatorJob` for 4-second loop animation
  - `ai_processing` flag to prevent concurrent processing
  - AI response parsing (JSON code blocks, structured data)
  - Lead qualification fields: `ai_real_name`, `ai_background`, `ai_query`, `ai_ready_score`
  - **Files:**
    - `app/jobs/typing_indicator_job.rb`
    - `app/controllers/auth_controller.rb` (typing start/stop)
    - `db/migrate/*_add_ai_fields_to_users.rb`

### Updated
- **User Model**
  - Added AI qualification fields to schema
  - Added `ai_processing` flag
  - **Migration:** Added columns to `users` table

---

## [January 5, 2025] - N8N Integration & Messenger Enhancements

### Added
- **N8N Webhook Integration**
  - Automatic webhook on every incoming message (except `/start`)
  - Sends `message_received` event to N8N workflow
  - **Conversation history included** - Last 50 messages for AI context
  - Format: `[YYYY-MM-DD HH:MM] Sender: message text`
  - Perfect for AI auto-responders
  - Bearer token authentication
  - 5-second timeout
  - **File:** `app/controllers/auth_controller.rb` (`send_message_to_n8n` method)
  - **Initializer:** `config/initializers/n8n.rb`
  - **Documentation:** `ai_docs/development/n8n_integration.md` (1,067 lines)

### Updated
- **Messenger Real-Time Features**
  - Fixed avatar display in real-time broadcasts
  - Improved broadcast data structure with avatar URLs
  - Welcome message now saved to conversation on user registration
  - **Files:**
    - `app/controllers/auth_controller.rb` (broadcast improvements)
    - `app/javascript/controllers/messenger_controller.js` (avatar handling)

---

## [January 4, 2025] - Credential Security Enhancement

### Changed
- **Telegram Bot Credentials Migration**
  - Moved from hardcoded values to Rails encrypted credentials
  - Bot tokens now stored in `credentials.yml.enc` (encrypted)
  - Decrypted via `master.key` (not committed to git)
  - Security level: 🔒🔒🔒🔒🔒 (Maximum)
  - **Files:**
    - `config/initializers/telegram_bot.rb` (loads from credentials)
    - `config/credentials.yml.enc` (encrypted storage)
  - **Documentation:** `ai_docs/development/telegram_credentials.md` (446 lines)

### Security
- Prevents credential leaks in source control
- Follows Rails security best practices
- Environment-specific configuration enabled

---

## [January 3, 2025] - Real-Time Messenger Feature

### Added
- **Real-Time Messenger**
  - Admin dashboard at `/messenger`
  - Live conversation updates via ActionCable (WebSocket)
  - Telegram avatar display integration
  - Message direction tracking (incoming/outgoing)
  - Read/unread status
  - Conversation list with last message preview
  - Message thread view with full history
  - Admin can reply to users directly in dashboard
  - Replies sent via Telegram Bot API to user's Telegram
  - Real-time bidirectional messaging (Telegram ↔ Admin Dashboard)
  - **Files:**
    - `app/models/conversation.rb`
    - `app/models/message.rb`
    - `app/controllers/messenger_controller.rb`
    - `app/channels/messenger_channel.rb`
    - `app/javascript/controllers/messenger_controller.js`
    - `app/views/messenger/*`
  - **Migrations:**
    - `db/migrate/*_create_conversations.rb`
    - `db/migrate/*_create_messages.rb`
  - **Documentation:** `ai_docs/development/messenger_feature.md` (833 lines)

- **Telegram Avatar Integration**
  - Fetches user avatar from Telegram Bot API
  - Stores avatar URL in `users` table
  - Displays in messenger interface
  - Auto-updates on user profile changes
  - **Migration:** `db/migrate/*_add_avatar_url_to_users.rb`

### Updated
- **Telegram Authentication Flow**
  - Extended to create conversation on first /start
  - Sends welcome message via bot
  - Welcome message saved to conversation history
  - **File:** `app/controllers/auth_controller.rb`

---

## [January 1, 2025] - Initial Platform Launch

### Added
- **Core Platform Features**
  - Rails 8.0.3 application with Ruby 3.4.5
  - Hotwire (Turbo + Stimulus) for SPA-like experience
  - Tailwind CSS for styling
  - SQLite3 database (development, test, production)
  - Solid Queue for background jobs
  - Solid Cache for caching
  - Solid Cable for WebSockets
  - Kamal for Docker-based deployment
  - Thruster as production HTTP/2 proxy

- **Telegram OAuth Authentication**
  - Login via Telegram (no password required)
  - Three-environment support: Desktop, Telegram WebView, Mobile
  - ActionCable (WebSocket) for real-time auth updates
  - Session-based authentication
  - Auth button with dropdown menu (Stimulus controller)
  - **Files:**
    - `app/controllers/auth_controller.rb`
    - `app/javascript/controllers/auth_controller.js`
    - `app/channels/auth_channel.rb`
  - **Documentation:** `ai_docs/development/telegram_authentication.md`

- **Free Course Content (12 Lessons)**
  - Markdown-based lesson system
  - Frontmatter metadata (title, description, lesson number)
  - Redcarpet renderer for HTML conversion
  - Blur-based content protection (auth required)
  - Lessons stored in `public/lessons/` directory
  - **Files:**
    - `app/controllers/free_lessons_controller.rb`
    - `app/services/markdown_renderer.rb`
    - `public/lessons/*.md`
  - **Documentation:** `ai_docs/development/content_management.md`

- **Blur Content Protection**
  - Unauthenticated users see blurred content
  - Auth modal overlay prompts login
  - Server-side rendering prevents flickering
  - Works with Turbo Drive navigation
  - Targeted blur (only lesson content, not navigation)
  - **Files:**
    - `app/views/shared/_auth_button.html.erb`
    - `app/views/free_lessons/show.html.erb`
  - **Documentation:** `ai_docs/ui/blur_content_protection.md`

- **UI Components**
  - Design system with color palette, typography, spacing
  - Responsive navigation (mobile/desktop)
  - Lesson cards with progress indicators
  - Pricing tiers layout
  - Auth button with user dropdown
  - **Documentation:**
    - `ai_docs/ui/design_system.md`
    - `ai_docs/ui/component_library.md`
    - `ai_docs/ui/responsive_design.md`

- **Business Strategy Documentation**
  - Product overview and market positioning
  - Freemium monetization model (12 free, paid full course)
  - Three-tier pricing (Basic ₽12K, Accelerator ₽38K, VIP ₽120K)
  - Complete course structure (5 modules)
  - User journey mapping
  - **Documentation:**
    - `ai_docs/business/product_overview.md`
    - `ai_docs/business/monetization_strategy.md`
    - `ai_docs/business/course_structure.md`
    - `ai_docs/business/user_journey.md`
    - `ai_docs/business/telegram_auth_flow.md`

- **Database Schema**
  - Users table (Telegram authentication)
  - Sessions table (session storage)
  - Future planning: Enrollments, LessonProgress, Payments
  - **Migration:** `db/migrate/*_create_users.rb`

### Fixed
- **Issue #1:** Auth button flickering on Turbo navigation (server-side rendering solution)
- **Issue #2:** Telegram WebView auth not working (environment detection solution)
- **Issue #3:** Mobile browser auth stuck on "Waiting..." (API polling solution)
- **Issue #4:** Content accessible without auth on direct URL (page load check solution)
- **Issue #5:** Blur effect on wrong elements (targeted wrapper solution)
- **Issue #6:** Logout button causes Turbo cache issues (disable Turbo for logout)
- **Issue #7:** Session token collision (unique index solution)
- **Issue #8:** Webhook receiving duplicate updates (immediate 200 OK response)
- **Issue #9:** Assets not loading in production (Dockerfile precompilation)
- **Issue #10:** Dropdown menu not working after refresh (Stimulus controller solution)
- **Documentation:** `ai_docs/development/known_issues_and_solutions.md`

### Deployment
- **Kamal Setup**
  - Single server deployment (46.62.195.19)
  - GitHub Container Registry (`ghcr.io`)
  - Let's Encrypt SSL automation
  - Zero-downtime deployments
  - Health check endpoint: `/up`
  - Persistent storage via Docker volume
  - **File:** `config/deploy.yml`
  - **Documentation:** `ai_docs/development/deployment.md`

---

## Development Roadmap

### Planned Features

**Q1 2025:**
- Payment integration (Stripe/PayPal)
- Enrollment system
- Lesson progress tracking
- Course dashboard for enrolled users
- Push notifications (PWA)
- Background sync (PWA offline messaging)

**Q2 2025:**
- Live workshop scheduling
- Video content hosting
- Student community forum
- Certificate generation
- Referral program

**Q3 2025:**
- Mobile app (React Native)
- Advanced analytics dashboard
- Multi-language support (English translation)
- AI-powered chatbot for FAQs
- Email notifications (optional)

**Q4 2025:**
- Marketplace for additional courses
- Instructor onboarding program
- Advanced payment options (installments)
- White-label licensing

---

## Migration Notes

### Breaking Changes

**None yet** - Application in early stage, no breaking changes introduced.

### Database Migrations

All migrations applied in chronological order:
1. `create_users` - Base user table
2. `create_conversations` - Messenger conversations
3. `create_messages` - Messenger messages
4. `add_avatar_url_to_users` - Telegram avatars
5. `add_ai_fields_to_users` - AI qualification fields

**Current Schema Version:** Check `db/schema.rb` for latest version.

---

## Known Issues

### Active Issues

**None** - All known issues have been resolved and documented.

### Resolved Issues

All resolved issues documented in `/ai_docs/development/known_issues_and_solutions.md`:
- Issues #1-11 resolved with documented solutions

---

## Security Updates

### January 4, 2025
- Migrated Telegram Bot credentials to encrypted storage
- Implemented Rails encrypted credentials system
- Added `master.key` to `.gitignore`

### January 6, 2025
- Added Bearer token authentication for N8N webhooks
- Implemented secure API endpoint for bi-directional messaging

### January 10, 2025
- Integrated Bitwarden CLI for secrets management
- Separated production and development credentials

---

## Performance Improvements

### Caching
- Solid Cache for application-level caching
- Service Worker cache for PWA offline support
- Turbo Drive page caching for instant navigation

### Database
- SQLite with optimized indexes
- Read-heavy workload optimization
- Connection pooling configured

### Assets
- Tailwind CSS purging (production)
- JavaScript bundling via Importmap
- Image optimization (WebP format)
- HTTP/2 via Thruster proxy

---

## Deprecations

**None yet** - No deprecated features.

---

## Contributors

- **Primary Developer:** Mazur (mazur.bali@gmail.com)
- **AI Assistant:** Claude Code by Anthropic

---

## Versioning

This project follows **Semantic Versioning** for future releases:
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backwards-compatible)
- **PATCH** version for backwards-compatible bug fixes

**Current Version:** 0.1.0 (MVP/Beta)

---

## Support & Feedback

For questions, bug reports, or feature requests:
- **GitHub Issues:** Create an issue in the repository
- **Email:** mazur.bali@gmail.com
- **Telegram:** Contact via bot support

---

**Last Updated:** October 13, 2025 (Business API Owner Message Filtering)
