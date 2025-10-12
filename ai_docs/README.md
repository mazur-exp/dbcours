# Bali Food Delivery Master - Documentation Index

## Overview

This directory contains comprehensive documentation for the Bali Food Delivery Master course platform. Documentation is organized into three main categories: Business, UI/UX, and Development.

---

## Documentation Structure

```
ai_docs/
├── business/           # Business strategy, monetization, user journeys
├── ui/                 # Design system, components, responsive design
├── development/        # Technical implementation, architecture, deployment
└── README.md          # This file
```

---

## Business Documentation

**Location:** `/ai_docs/business/`

### 1. product_overview.md
**Purpose:** Complete product definition and market positioning

**Contents:**
- Product identity and target audience
- Core problems being solved
- Value proposition and competitive advantages
- Success metrics and risk factors
- Product roadmap considerations

**Use When:** Understanding the "why" behind product decisions, onboarding team members, pitching to stakeholders

---

### 2. monetization_strategy.md
**Purpose:** Detailed revenue model and pricing strategy

**Contents:**
- Freemium model (12 free lessons)
- Three-tier pricing structure (Basic ₽12K, Accelerator ₽38K, VIP ₽120K)
- Pricing psychology and conversion tactics
- Unit economics and revenue projections
- Upsell/cross-sell strategies

**Use When:** Planning marketing campaigns, setting pricing, analyzing financial performance

---

### 3. course_structure.md
**Purpose:** Complete curriculum breakdown

**Contents:**
- Free mini-course (12 lessons) - lesson-by-lesson breakdown
- Paid full course (5 modules, ~8 hours) - detailed syllabi
- Learning outcomes and deliverables
- Support tiers by pricing tier

**Use When:** Creating course content, planning workshops, explaining course value to customers

---

### 4. user_journey.md
**Purpose:** Complete user experience mapping

**Contents:**
- Discovery and landing (entry points, home page experience)
- Free course exploration (authentication trigger, lesson consumption)
- Purchase decision (pricing page, checkout)
- Paid course engagement (dashboard, workshops, support)
- Advocacy and referral

**Use When:** Optimizing conversion funnels, debugging UX issues, planning new features

---

### 5. telegram_auth_flow.md (Business Perspective)
**Purpose:** Strategic rationale for Telegram authentication

**Contents:**
- Why Telegram (vs. email/password)
- Target market fit (expat community, Russian speakers)
- Business impact scenarios
- Conversion optimization insights

**Use When:** Explaining auth choice to stakeholders, marketing positioning, competitive analysis

---

## UI/UX Documentation

**Location:** `/ai_docs/ui/`

### 1. design_system.md
**Purpose:** Complete visual design specification

**Contents:**
- Color palette (primary green, secondary blue/purple/red)
- Typography (font sizes, weights, line heights)
- Spacing system (padding, margin, gap)
- Border radius, shadows, animations
- Accessibility guidelines (contrast, focus states)

**Use When:** Building new components, ensuring design consistency, onboarding designers

---

### 2. component_library.md
**Purpose:** Catalog of all reusable UI components

**Contents:**
- Navigation components (top nav, breadcrumb, sidebar)
- Authentication components (auth button, modal)
- Content cards (lesson cards, pricing tiers, intro cards)
- Interactive elements (buttons, forms, badges)
- Loading states and alerts

**Use When:** Building new pages, finding reusable components, maintaining UI consistency

---

### 3. blur_content_protection.md
**Purpose:** Technical specification of content protection UX

**Contents:**
- User experience flow (unauthenticated → blurred content → auth modal)
- Technical implementation (HTML structure, CSS blur, JavaScript logic)
- Edge cases and solutions (FOUC, Turbo cache, direct URL access)
- Visual design rationale (why blur vs. hide)

**Use When:** Debugging auth protection, implementing similar protection elsewhere, A/B testing protection UX

---

### 4. responsive_design.md
**Purpose:** Complete responsive design guide

**Contents:**
- Breakpoint system (mobile, tablet, desktop)
- Layout patterns (grid, flexbox, sidebars)
- Typography scaling
- Component responsiveness
- Touch targets and mobile optimization

**Use When:** Building mobile-friendly features, testing across devices, debugging layout issues

---

## Development Documentation

**Location:** `/ai_docs/development/`

### 1. architecture.md
**Purpose:** High-level technical architecture

**Contents:**
- Technology stack (Rails 8, Hotwire, SQLite, Kamal)
- Architecture patterns (SSR, Turbo, Stimulus)
- Directory structure
- Request/response flow
- State management

**Use When:** Onboarding developers, making architectural decisions, understanding system design

---

### 2. database_schema.md
**Purpose:** Complete database documentation

**Contents:**
- Current schema (Users table)
- Future schema (Enrollments, LessonProgress, Payments)
- Query patterns and optimizations
- Migration strategy
- Backup and recovery

**Use When:** Writing database queries, planning schema changes, debugging data issues

---

### 3. telegram_authentication.md (Technical)
**Purpose:** Complete technical implementation of Telegram OAuth

**Contents:**
- Environment variables and configuration
- Backend implementation (AuthController, routes)
- Frontend implementation (Stimulus controller, ActionCable)
- Three-environment handling (desktop, WebView, mobile)
- Security considerations

**Use When:** Debugging auth issues, implementing similar OAuth flows, understanding WebSocket integration

---

### 4. telegram_credentials.md
**Purpose:** Secure Telegram Bot credentials management

**Contents:**
- Environment-specific credentials (development vs production)
- Rails encrypted credentials structure
- Bot tokens and webhook URLs
- **api_base_url field** ✨ - For N8N callback routing
- Initializer configuration (telegram_bot.rb)
- Bitwarden CLI integration patterns
- Security best practices
- Setup instructions and verification

**Use When:** Setting up new environments, managing bot credentials, configuring N8N integrations, rotating API tokens

---

### 5. api_endpoints.md
**Purpose:** Complete API reference

**Contents:**
- Authentication endpoints (/auth/telegram/start, /auth/check_token, etc.)
- Page endpoints (HTML rendering)
- Future endpoints (enrollments, lesson progress)
- Error responses and rate limiting

**Use When:** Building API clients, debugging HTTP requests, planning new endpoints

---

### 6. frontend_architecture.md
**Purpose:** Frontend implementation details

**Contents:**
- Hotwire (Turbo + Stimulus) usage
- Stimulus controllers (auth controller)
- JavaScript architecture (global functions, event handling)
- ActionCable integration
- Asset pipeline (Importmap, Tailwind)

**Use When:** Building interactive features, debugging JavaScript, optimizing frontend performance

---

### 7. content_management.md
**Purpose:** Markdown-based content system

**Contents:**
- Lesson file structure (Markdown + frontmatter)
- Rendering pipeline (Redcarpet)
- Asset management (images, videos)
- Content versioning (Git-based)
- Future enhancements (search, translation, export)

**Use When:** Creating/editing lessons, managing content updates, planning content features

---

### 8. deployment.md
**Purpose:** Complete deployment guide

**Contents:**
- Kamal configuration (config/deploy.yml, ghcr.io registry)
- Bitwarden CLI integration for secrets management
- ARM64 architecture configuration
- Environment-specific credentials (production.key vs master.key)
- Initial server setup
- Standard deployment workflow
- Database management (migrations, backups)
- Logs, monitoring, rollbacks

**Use When:** Deploying changes, troubleshooting production issues, setting up new servers, managing secrets

---

### 9. known_issues_and_solutions.md
**Purpose:** Documented bugs and their fixes

**Contents:**
- Issue #1: Auth button flickering (server-side rendering solution)
- Issue #2: Telegram WebView auth (environment detection solution)
- Issue #3: Mobile browser auth stuck (API polling solution)
- Issue #4: Content accessible without auth (page load check solution)
- Issue #5: Blur on wrong elements (targeted wrapper solution)
- Issue #10: Dropdown menu not working after page refresh (Stimulus controller solution)
- Issue #11: N8N workflows require hardcoded environment URLs (callback_url solution)
- Plus 4 more documented issues

**Use When:** Debugging similar issues, understanding past decisions, preventing regressions

---

### 10. messenger_feature.md
**Purpose:** Complete real-time messenger implementation documentation

**Contents:**
- Architecture overview (backend, frontend, WebSocket)
- Database schema (conversations, messages)
- Request flow (incoming/outgoing messages)
- Real-time avatar display implementation
- Admin features (user management, mark as read)
- WebSocket architecture (MessengerChannel)
- UI components (conversation list, message thread)
- Security considerations
- Future enhancements (rich media, search, templates)

**Use When:** Understanding messenger functionality, debugging real-time features, extending messaging capabilities

---

### 11. ai_auto_responder.md
**Purpose:** AI-powered auto-responder with typing indicator documentation

**Contents:**
- Overview of AI auto-responder flow (10-step process)
- Architecture components (AuthController, TypingIndicatorJob, N8nController)
- Typing indicator implementation (4-second loop, ai_processing flag)
- AI response parsing (JSON code blocks, structured data extraction)
- Lead qualification fields (ai_real_name, ai_background, ai_query, ai_ready_score)
- Complete code examples with line numbers
- Flow diagrams (visual representation of process)
- N8N workflow configuration (webhook → AI → Rails → Telegram)
- Troubleshooting guide (typing not showing, parsing errors, stuck indicators)
- Testing strategies (manual and automated)
- Security considerations (Bearer token auth)

**Use When:** Implementing AI workflows, debugging typing indicators, understanding lead qualification, troubleshooting N8N integration

---

### 12. n8n_integration.md
**Purpose:** N8N workflow automation platform integration

**Contents:**
- N8N configuration (credentials, webhook URLs)
- **Callback URL feature** ✨ - Automatic environment routing (dev/prod)
- Event types (user_registered, message_received, purchase_completed)
- Webhook payload structures (includes callback_url)
- Conversation history format (50 messages for AI context)
- Bi-directional integration (Rails → N8N, N8N → Rails)
- POST /api/n8n/send_message endpoint documentation
- Markdown formatting support
- AI auto-responder workflow example
- Security (Bearer token authentication)
- Error handling and retry logic

**Use When:** Setting up N8N workflows, integrating AI responses, debugging webhooks, understanding automation flows, configuring environment-specific routing

---

## How to Use This Documentation

### For New Team Members

**Day 1:** Read business/product_overview.md and business/user_journey.md
**Day 2:** Read development/architecture.md and development/database_schema.md
**Day 3:** Read ui/design_system.md and ui/component_library.md
**Day 4:** Hands-on: Deploy to staging using development/deployment.md

---

### For Product Managers

**Key Docs:**
- business/product_overview.md - Product strategy
- business/monetization_strategy.md - Revenue model
- business/user_journey.md - User experience
- business/course_structure.md - Curriculum details

---

### For Designers

**Key Docs:**
- ui/design_system.md - Design tokens and guidelines
- ui/component_library.md - Reusable components
- ui/responsive_design.md - Mobile/tablet/desktop patterns
- ui/blur_content_protection.md - Content protection UX

---

### For Developers

**Key Docs:**
- development/architecture.md - System overview
- development/telegram_authentication.md - OAuth implementation
- development/frontend_architecture.md - JavaScript patterns
- development/known_issues_and_solutions.md - Common bugs

---

### For DevOps/Infrastructure

**Key Docs:**
- development/deployment.md - Kamal workflow
- development/database_schema.md - Database management
- development/api_endpoints.md - Health checks and monitoring

---

## Documentation Maintenance

### When to Update Documentation

**After Feature Development:**
- Update relevant business/, ui/, or development/ docs
- Add new components to component_library.md
- Document new API endpoints in api_endpoints.md

**After Bug Fixes:**
- Add issue to known_issues_and_solutions.md with solution
- Update related technical docs if architecture changed

**After Design Changes:**
- Update design_system.md with new colors/spacing/typography
- Update component_library.md with new component variants

**Quarterly Reviews:**
- Review all docs for accuracy
- Archive outdated sections
- Add new sections for emerging patterns

---

## Documentation Standards

### Markdown Style

**Headings:** Use `#` for title, `##` for sections, `###` for subsections
**Code Blocks:** Always specify language (```ruby, ```javascript, ```html)
**Lists:** Use `-` for unordered, `1.` for ordered
**Emphasis:** Use `**bold**` for strong emphasis, `*italic*` for light emphasis
**Code:** Use `backticks` for inline code

---

### File Naming

**Format:** `lowercase_with_underscores.md`
**Examples:** `product_overview.md`, `telegram_authentication.md`
**Avoid:** CamelCase, spaces, special characters

---

### Structure

**Every doc should have:**
1. Title (# heading)
2. Overview section (brief description)
3. Horizontal rules (`---`) between major sections
4. Conclusion section (summary + next steps)

---

## Quick Reference

### File Count
- **Business:** 5 files
- **UI:** 4 files
- **Development:** 12 files
- **Total:** 21 documentation files

### Total Word Count
- **Approximate:** 75,000+ words
- **Reading Time:** 12-15 hours for complete documentation

### Last Updated
- **Initial Creation:** January 2025
- **Last Major Update:** January 12, 2025 (Callback URL feature, Kamal deployment updates, PWA implementation)
- **Update Frequency:** After each major feature release

---

## Contributing to Documentation

### Internal Team

1. Identify documentation gap
2. Draft new content in appropriate category
3. Follow existing format and style
4. Submit for review (if team process exists)
5. Merge to main branch

### External Contributors (Future)

1. Fork repository
2. Add/update documentation
3. Submit pull request
4. Documentation maintainer reviews
5. Merge if approved

---

## Related Resources

### External Documentation

**Rails 8:** https://guides.rubyonrails.org/
**Hotwire:** https://hotwired.dev/
**Tailwind CSS:** https://tailwindcss.com/docs
**Kamal:** https://kamal-deploy.org/
**Telegram Bot API:** https://core.telegram.org/bots/api

---

## Contact

For documentation questions or suggestions:
- Create GitHub issue (if repository is on GitHub)
- Contact technical lead
- Email: [your-email@example.com]

---

**Note:** This documentation represents the state of the application as of January 2025. Features marked as "Future" or "Planned" are not yet implemented but are documented for planning purposes.
