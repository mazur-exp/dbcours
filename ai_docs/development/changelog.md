# Changelog

## Overview

This document tracks all significant changes, features, and updates to the Bali Food Delivery Master platform. Changes are organized chronologically from newest to oldest.

---

## [January 12, 2025] - Latest Updates

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

**Last Updated:** January 12, 2025
