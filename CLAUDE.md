# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rails 8.0.3 application using Ruby 3.4.5 with the following stack:
- **Database**: SQLite3 (development, test, production)
- **Frontend**: Hotwire (Turbo + Stimulus), Tailwind CSS, Importmap
- **Background Jobs**: Solid Queue
- **Cache**: Solid Cache
- **WebSockets**: Solid Cable
- **Deployment**: Kamal (Docker-based)
- **Web Server**: Puma (development), Thruster (production)

This is a **multi-domain application** serving three separate domains in production:
- `course.aidelivery.tech` - Free course content and landing pages
- `crm.aidelivery.tech` - CRM dashboard (Kanban board, messenger)
- `admin.aidelivery.tech` - Admin dashboard with AI Chat analysis

In development, all routes are accessible on localhost:3000 without domain constraints.

## Development Commands

### Initial Setup
```bash
bin/setup
# Installs dependencies, prepares database, and starts development server
```

### Running the Application
```bash
bin/dev
# Starts both web server and Tailwind CSS watcher via Procfile.dev
```

### Testing
```bash
bin/rails test                    # Run all tests
bin/rails test test/models        # Run model tests
bin/rails test test/controllers   # Run controller tests
bin/rails test test/integration   # Run integration tests
bin/rails test:system             # Run system tests
```

### Code Quality
```bash
bin/rubocop                       # Run linter (Rails Omakase style)
bin/rubocop -a                    # Auto-correct offenses
bin/brakeman                      # Security vulnerability scan
```

### Database
```bash
bin/rails db:create               # Create database
bin/rails db:migrate              # Run migrations
bin/rails db:prepare              # Create and migrate database
bin/rails db:seed                 # Load seed data
bin/rails db:reset                # Drop, create, migrate, seed
bin/rails dbconsole               # Database console
```

### Assets
```bash
bin/rails assets:precompile       # Precompile assets for production
bin/rails tailwindcss:watch       # Watch Tailwind CSS (auto-run by bin/dev)
bin/rails tailwindcss:build       # Build Tailwind CSS
```

### Kamal Deployment
```bash
bin/kamal setup                   # Initial server setup
bin/kamal deploy                  # Deploy application
bin/kamal console                 # Rails console on server
bin/kamal shell                   # SSH into container
bin/kamal logs                    # Tail application logs
bin/kamal dbc                     # Database console on server
```

## Architecture

### Multi-Domain Routing
Routes are organized by domain constraints in `config/routes.rb`:
- **Production**: Uses `constraints(host: "domain.com")` to route requests by Host header
- **Development**: Domain constraints removed - all routes accessible on localhost:3000
- **Shared routes**: Auth endpoints and short links work across all domains

### Database Configuration
- **Multiple databases in production**: Primary, cache, queue, and cable databases all use SQLite3
- **Storage location**: All SQLite databases stored in `storage/` directory
- **Production volumes**: Persistent storage via Docker volume `aidelivery:/rails/storage`
- **Key models**:
  - `User` - Telegram auth users with CRM status enum (new_lead → contacted → qualified → interested → payment_pending → paid_status)
  - `Conversation` - Per-user conversation with AI analysis metadata (ai_ready_score, ai_action, ai_red_flags)
  - `Message` - Chat messages with direction (incoming/outgoing)
  - `TrafficSource` & `TrafficClick` - Conversion tracking and attribution

### Background Jobs
- Uses Solid Queue integrated into Puma process in production (`SOLID_QUEUE_IN_PUMA=true`)
- Schema defined in `db/queue_schema.rb`
- Configuration in `config/queue.yml` and `config/recurring.yml`
- **Key jobs**:
  - `AiChatAnalysisJob` - Sends questions to N8N webhook (Claude AI), broadcasts response via ActionCable
  - `TypingIndicatorJob` - Shows "typing..." indicator during AI processing
- **Job characteristics**:
  - Long-running: AI responses can take 60-120 seconds (Claude "thinking time")
  - Asynchronous: Uses ActionCable to broadcast results to unique session channel
  - Error handling: Gracefully handles JSON, Markdown, or plain text responses from N8N

### Frontend Stack
- **Hotwire**: Full SPA-like experience without separate frontend framework
- **Turbo**: Handles page navigation and updates
- **Stimulus**: JavaScript framework for controllers (`app/javascript/controllers/`)
- **Tailwind CSS**: Utility-first CSS framework with live reloading in development
- **Importmap**: ES modules without bundling (no Node.js build step)
- **ActionCable**: Real-time WebSocket communication
- **Key Stimulus controllers**:
  - `admin_chat_controller.js` - AI Chat form with dynamic ActionCable subscription
  - `kanban_controller.js` - CRM dashboard drag-and-drop
  - `messenger_controller.js` - Real-time messaging UI
  - `auth_controller.js` - Dynamic session/token auth flows

### Deployment
- **Kamal**: Zero-downtime Docker-based deployment
- **Thruster**: Production HTTP/2 proxy with caching and X-Sendfile support
- **Server**: 46.62.195.19 (SSH port 2222)
- **Docker image**: Built for arm64 architecture, pushed to ghcr.io
- **SSL**: Automatic Let's Encrypt certificates for all three domains
- **Critical timeout settings**: 150s response timeout for AI Chat (Claude thinking time)
  - `THRUSTER_HTTP_IDLE_TIMEOUT: 150s`
  - `THRUSTER_HTTP_READ_TIMEOUT: 150s`
  - `THRUSTER_HTTP_WRITE_TIMEOUT: 150s`
  - Kamal proxy `response_timeout: 150`

## Key Architectural Patterns

### AI Chat Flow (Async via ActionCable + Solid Queue)
1. User submits question in Admin Dashboard (`admin_chat_controller.js`)
2. POST to `/api/ai_chat/analyze` enqueues `AiChatAnalysisJob`
3. Job sends payload to N8N webhook (which calls Claude via N8N)
4. HTTP request waits up to 120s for AI response (`http.read_timeout = 120`)
5. Job broadcasts result via ActionCable to `ai_chat_channel_#{session_id}`
6. Client-side JavaScript receives broadcast and updates UI
7. **Session isolation**: Each chat session gets unique ActionCable channel ID

### Telegram Authentication Flow
1. `POST /auth/telegram/start` - Generates session token, returns Telegram deep link
2. User clicks Telegram link, bot processes auth via webhook
3. Webhook sets `authenticated: true` on User model
4. Client polls `GET /auth/check_token` or uses `GET /auth/complete` redirect
5. Session established with `user_id` stored in Rails session
6. Supports both cookie-based and token-based auth (for incognito/cookie-blocking)

### CRM Status Machine & Lead Scoring
- **User.crm_status** enum: `new_lead` → `contacted` → `qualified` → `interested` → `payment_pending` → `paid_status`
- **AI-derived scoring**: `Conversation.ai_ready_score` (0-10 scale)
- **Temperature calculation**:
  - Hot (🔥): score >= 7
  - Warm (🌤️): score >= 4
  - Cold (❄️): score < 4
- **Automatic escalation**: When `ai_action` changes to "escalate" or "schedule_call", Telegram notification sent to team
- **Real-time CRM updates**: Broadcasts to `crm_channel` when AI analysis completes or user payment status changes

### Real-Time Features via ActionCable
- **Dynamic subscriptions**: Channels created per session/user (`ai_chat_channel_#{session_id}`)
- **CRM broadcasts**: `crm_channel` receives card updates when user status/scores change
- **Messenger**: Real-time message delivery between users and admin
- **Backend**: Solid Cable uses SQLite for production WebSocket state persistence

### Traffic Attribution & Conversion Tracking
- **TrafficSource**: Defines marketing campaigns with product type and UTM parameters
- **TrafficClick**: Logs each click with IP, user agent, and source attribution
- **User association**: `user.traffic_source` tracks which campaign brought each lead
- **Conversion tracking**: Increments `conversions_count` when user pays
- **Metrics**: Leads count, conversions count, conversion rate calculated per source

### Delivery Stats Integration (Admin Analytics)
**External data source:** MySQL database `deliverybooster_api` on 5.187.7.140:3306

**Architecture:** HTTP API Client pattern (not direct MySQL connection)
- `DeliveryStatsClient` - HTTP client for Express API (5.187.7.140:3000)
- `Analytics::ClientStatsService` - Data aggregation and formatting
- Caching: 1 hour for stats, 24 hours for commission settings

**Data flow:**
1. Admin Dashboard requests analytics for a Client
2. Service calls DeliveryStatsClient with client name + date range
3. HTTP request to Express API → MySQL query → JSON response
4. Service aggregates data from `looker_summary` (Grab + GoJek combined)
5. UI displays: summary cards, charts, platform breakdown table

**Key features:**
- **Date picker:** Select custom date ranges
- **Platform breakdown:** Separate Grab vs GoJek metrics in detailed table
- **Real metrics:** Sales, orders, customers, ROI, fake orders count
- **Graceful fallback:** Shows "no data" message if client not in external DB
- **Important:** Client.name MUST exactly match restaurants.name in MySQL

**Data sources available:**
- `looker_summary` - Combined Grab + GoJek + fake orders (default)
- `grab` / `gojek` - Platform-specific detailed stats
- `fake_orders` - Boost/manipulation history
- `commission_settings` - Client commission agreements
- `monthly_commissions` - Monthly totals and profit/loss

**Cache strategy:**
```ruby
Rails.cache.fetch("client_#{id}_#{dates}_looker_summary", expires_in: 1.hour)
Rails.cache.fetch("client_#{id}_commission_settings", expires_in: 24.hours)
```

**Troubleshooting:**
- If showing zeros: Check client name matches exactly with MySQL restaurant name
- If cached wrong data: `bin/rails runner 'Rails.cache.clear'`
- Default period: October 2025 (where real data exists)

## Important Constraints & Gotchas

### Long AI Response Times
- Claude AI can "think" for 60-120 seconds before responding
- All timeouts configured to 150s+ to prevent premature connection closure
- Users see typing indicator during AI processing
- Async architecture prevents request blocking

### Multi-Database Migrations
When creating migrations affecting Solid Queue/Cache/Cable:
```bash
# Primary database (default)
bin/rails generate migration CreateUsers
bin/rails db:migrate

# Queue database
bin/rails solid_queue:install:migrations
bin/rails db:migrate:queue

# Cache database
bin/rails solid_cache:install:migrations
bin/rails db:migrate:cache
```

### Domain Routing in Development
- Production routes use `constraints(host: "domain.com")`
- Development removes constraints - all routes work on localhost:3000
- Test domain-specific behavior using custom hosts file or ngrok (configured in Procfile.dev)

### N8N Webhook Integration
- **Purpose**: AI Chat analysis proxy (Rails → N8N → Claude AI → Rails)
- **Webhook URL**: Configured in Rails credentials as `N8N_AI_CHAT_WEBHOOK_URL`
- **Authentication**: Bearer token via `N8N_API_TOKEN` (optional)
- **Request timeout**: 120s read timeout to accommodate Claude thinking
- **Response parsing**: Flexibly handles JSON, Markdown, or plain text responses
- **Development mode**: SSL verification disabled for local N8N testing

### Telegram Bot Integration
- Webhook endpoint: `POST /auth/telegram/webhook`
- Bot sends notifications for escalations via `Conversation#handle_delivery_booster_escalation`
- Booking links sent directly to users when AI flags them as ready
- Bot token configured in Rails credentials

## Code Style
- Follows **rubocop-rails-omakase** style guide (Rails default conventions)
- Configuration in `.rubocop.yml`
