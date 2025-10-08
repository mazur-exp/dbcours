# Application Architecture

## Technology Stack

### Backend Framework
- **Rails 8.0.3** - Latest stable Rails release
- **Ruby 3.4.5** - Latest Ruby version with performance improvements
- **Puma** - Multi-threaded web server (development + production)
- **Thruster** - HTTP/2 proxy with caching in production

### Frontend Stack
- **Hotwire** (Turbo + Stimulus) - SPA-like experience without separate frontend framework
  - **Turbo Drive** - Page navigation without full page reloads
  - **Turbo Frames** - Partial page updates (future use)
  - **Stimulus** - JavaScript sprinkles for interactive components
- **Tailwind CSS** - Utility-first CSS framework
- **Importmap** - ES modules without bundling (no Webpack/Vite)

### Database
- **SQLite3** - All environments (development, test, production)
- **Multiple databases** in production:
  - Primary: Application data (users, lessons, enrollments)
  - Queue: Solid Queue background jobs
  - Cache: Solid Cache storage
  - Cable: Solid Cable WebSocket connections

### Background Jobs
- **Solid Queue** - Database-backed background job processor
- **In-Puma Mode** (production): `SOLID_QUEUE_IN_PUMA=true`
  - Jobs processed within Puma process (no separate worker)
  - Simplifies deployment (single container)

### WebSockets (Real-Time)
- **Solid Cable** - Database-backed ActionCable adapter
- **Use case:** Telegram authentication real-time notifications

### Deployment
- **Kamal** - Docker-based zero-downtime deployment
- **Docker** - Containerization (amd64 architecture)
- **Single server** - Web + DB + Jobs in one container (small-scale deployment)

---

## Architecture Patterns

### Server-Side Rendering (SSR)

**Primary Rendering Strategy:**
- All pages server-rendered with ERB templates
- No client-side React/Vue framework
- JavaScript enhances, doesn't control rendering

**Benefits:**
- Fast initial page load (HTML pre-rendered)
- SEO-friendly (content visible to crawlers)
- Works with JavaScript disabled (degrades gracefully)
- Simpler mental model (no client/server state sync)

**Example: Auth Button**
```erb
<!-- Server renders correct state -->
<% if @current_user %>
  <button class="bg-blue-500">
    <%= @current_user.first_name %>
  </button>
<% else %>
  <button class="bg-green-500">
    Авторизация
  </button>
<% end %>
```

---

### Hotwire for Interactivity

**Turbo Drive:**
- Intercepts link clicks and form submissions
- Fetches HTML via AJAX, swaps into page
- No full page reload (feels like SPA)

**Example Navigation:**
1. User clicks "Lesson 2" link
2. Turbo intercepts → GET `/free_content/lessons/02`
3. Server renders full HTML (same as traditional request)
4. Turbo swaps `<body>` content (keeps `<head>`)
5. Browser URL updates, no flash

**Stimulus Controllers:**
- Small JavaScript controllers for interactive components
- Connected via `data-controller` attributes
- Manage client-side state, DOM manipulation

**Example: Auth Controller**
```javascript
// app/javascript/controllers/auth_controller.js
export default class extends Controller {
  startAuth() {
    // Handle auth button click
  }

  handleAuthSuccess() {
    // Update UI on authentication
  }
}
```

**HTML Connection:**
```html
<button data-controller="auth" data-action="click->auth#startAuth">
  Login
</button>
```

---

### Markdown-Based Content Management

**Lesson Storage:**
- Location: `app/content/free_lessons/*.md`
- Format: Markdown with YAML frontmatter
- Rendering: Redcarpet gem with custom options

**Example Lesson File:**
```markdown
---
title: "Introduction: Why Delivery and How We Got Here"
---

# Why Food Delivery Exploded in Bali

Content goes here...
```

**Rendering Pipeline:**
1. FreeLessonsController loads `.md` file
2. Extracts frontmatter (title) via regex
3. Renders markdown to HTML (Redcarpet)
4. Injects into ERB template
5. Applies Tailwind styles via prose classes

**Benefits:**
- Easy content editing (no database migrations)
- Version control (Git tracks lesson changes)
- Fast iteration (edit file, refresh browser)
- Portable (export lessons as files)

---

## Directory Structure

### Key Directories

```
app/
├── channels/          # ActionCable channels (AuthChannel)
├── content/           # Markdown content files
│   └── free_lessons/  # 12 free lesson markdown files
├── controllers/       # Rails controllers
│   ├── auth_controller.rb
│   ├── free_lessons_controller.rb
│   └── pages_controller.rb
├── helpers/           # View helpers
│   └── free_content_helper.rb  # Markdown rendering
├── javascript/        # Stimulus controllers
│   └── controllers/
│       └── auth_controller.js
├── models/            # ActiveRecord models
│   └── user.rb
├── views/             # ERB templates
│   ├── layouts/
│   ├── free_lessons/
│   ├── pages/
│   └── shared/        # Partials (_auth_button, etc.)
├── assets/
│   └── stylesheets/
│       └── application.tailwind.css

config/
├── routes.rb          # Route definitions
├── database.yml       # Database configuration
├── deploy.yml         # Kamal deployment config
└── initializers/      # App initialization

db/
├── schema.rb          # Primary database schema
├── queue_schema.rb    # Solid Queue schema
└── migrate/           # Migrations

test/
├── controllers/
├── models/
├── integration/
└── system/            # Browser-based integration tests
```

---

## Request/Response Flow

### Traditional Page Load

**Example: User visits `/freecontent`**

1. **Route Resolution:**
   ```ruby
   # config/routes.rb
   get '/freecontent', to: 'free_lessons#index'
   ```

2. **Controller:**
   ```ruby
   # app/controllers/free_lessons_controller.rb
   def index
     @current_user = User.find_by(id: session[:user_id])
     @lessons = load_all_lessons  # From filesystem
   end
   ```

3. **View Rendering:**
   ```erb
   <!-- app/views/free_lessons/index.html.erb -->
   <%= render 'shared/auth_button' %>
   <% @lessons.each do |lesson| %>
     <!-- Render lesson cards -->
   <% end %>
   ```

4. **Response:**
   - Full HTML page sent to browser
   - Browser renders immediately (no JS required for initial render)
   - JavaScript enhances after page load

---

### Turbo-Enhanced Navigation

**Example: User clicks lesson link**

1. **Link Click:**
   ```html
   <a href="/free_content/lessons/01-introduction">Lesson 1</a>
   ```

2. **Turbo Intercept:**
   - Prevents default browser navigation
   - Sends AJAX GET to `/free_content/lessons/01-introduction`
   - Adds `Accept: text/html; turbo-stream` header

3. **Server Response:**
   - Same controller action as traditional request
   - Renders full HTML page (no special Turbo handling needed)

4. **Turbo Swaps Content:**
   - Replaces `<body>` in DOM
   - Preserves `<head>` (CSS/JS already loaded)
   - Updates browser URL and history
   - Triggers `turbo:load` event

5. **JavaScript Enhancement:**
   ```javascript
   document.addEventListener('turbo:load', () => {
     checkAuthOnPageLoad();  // Apply blur if needed
   });
   ```

---

### API Request (Telegram Auth Check)

**Example: Check if session token authenticated**

1. **Client Request:**
   ```javascript
   fetch(`/auth/check_token?session_token=${token}`)
   ```

2. **Route:**
   ```ruby
   get '/auth/check_token', to: 'auth#check_token'
   ```

3. **Controller:**
   ```ruby
   def check_token
     user = User.find_by(
       session_token: params[:session_token],
       authenticated: true
     )

     if user && session[:auth_token] == params[:session_token]
       session[:user_id] = user.id
       render json: { authenticated: true, user: user }
     else
       render json: { authenticated: false }
     end
   end
   ```

4. **Client Handles Response:**
   ```javascript
   if (data.authenticated) {
     window.location.reload();  // Reload to show authenticated state
   }
   ```

---

## State Management

### Server-Side State (Session)

**Rails Session (Cookie-Based):**
```ruby
# Store user ID after authentication
session[:user_id] = user.id

# Store temporary auth token
session[:auth_token] = SecureRandom.hex(16)
session[:auth_started_at] = Time.now

# Check authentication
@current_user = User.find_by(id: session[:user_id])
```

**Session Configuration:**
- Storage: Encrypted cookie (Rails default)
- Expiry: Browser session (closes when browser closes)
- Security: HTTPOnly, Secure (HTTPS only in production)

---

### Client-Side State (Minimal)

**DOM as State:**
- Server renders correct state (auth button color, content visibility)
- JavaScript reads DOM attributes for state
- Example: `data-authenticated="true"` on button

**Event-Based Updates:**
```javascript
// State change triggers from server events
AuthChannel.received = (data) => {
  if (data.type === 'authentication_success') {
    // Server notifies → client updates
    window.location.reload();
  }
};
```

**No Client-Side State Management Libraries:**
- No Redux, MobX, Zustand
- Server is source of truth
- Client reflects server state

---

## Database Architecture

### Schema Design

**Users Table:**
```ruby
create_table :users do |t|
  t.bigint :telegram_id, null: false, index: { unique: true }
  t.string :username
  t.string :first_name
  t.string :last_name
  t.string :session_token, index: { unique: true }
  t.boolean :authenticated, default: false
  t.timestamps
end
```

**Future Tables (Not Yet Implemented):**
- `enrollments` - Course purchases (user_id, tier, purchased_at)
- `lesson_progress` - Tracking completion (user_id, lesson_slug, completed_at)
- `payments` - Transaction records (user_id, amount, status)

---

### Multiple Databases (Production)

**Configuration:**
```yaml
# config/database.yml
production:
  primary:
    database: storage/production.sqlite3
  cache:
    database: storage/production_cache.sqlite3
    migrations_paths: db/cache_migrate
  queue:
    database: storage/production_queue.sqlite3
    migrations_paths: db/queue_migrate
  cable:
    database: storage/production_cable.sqlite3
    migrations_paths: db/cable_migrate
```

**Why Separate Databases?**
- **Isolation:** Queue jobs don't slow down app queries
- **Backups:** Can backup app DB without massive job queue data
- **Scaling:** Later can move queue to separate server

---

## Caching Strategy

### Solid Cache

**Configuration:**
```ruby
# config/environments/production.rb
config.cache_store = :solid_cache_store
```

**Use Cases:**
- Fragment caching (lesson cards, pricing tiers)
- Low-level caching (API responses, computed data)
- Session storage (alternative to cookies)

**Example:**
```erb
<% cache @lesson do %>
  <%= render @lesson %>
<% end %>
```

---

## Background Jobs (Future)

### Solid Queue Setup

**Job Example (Not Yet Implemented):**
```ruby
# app/jobs/send_welcome_email_job.rb
class SendWelcomeEmailJob < ApplicationJob
  queue_as :default

  def perform(user)
    UserMailer.welcome_email(user).deliver_now
  end
end

# Enqueue job
SendWelcomeEmailJob.perform_later(@user)
```

**In-Puma Mode (Production):**
- Jobs processed in same Puma process
- No separate worker container needed
- Suitable for low job volume (<100/hour)

---

## WebSocket Architecture (ActionCable)

### Solid Cable

**Use Case:** Real-time Telegram authentication

**Channel:**
```ruby
# app/channels/auth_channel.rb
class AuthChannel < ApplicationCable::Channel
  def subscribed
    stream_from "auth_channel_#{params[:session_token]}"
  end
end
```

**Broadcasting:**
```ruby
# After Telegram auth success
ActionCable.server.broadcast(
  "auth_channel_#{session_token}",
  { type: 'authentication_success', user_id: user.id }
)
```

**Client Subscription:**
```javascript
cable.subscriptions.create({
  channel: "AuthChannel",
  session_token: token
}, {
  received(data) {
    if (data.type === 'authentication_success') {
      handleAuthSuccess(data);
    }
  }
});
```

---

## Security Architecture

### Authentication

**No Passwords:**
- Telegram OAuth-based (no password storage)
- Session token for temporary auth flow (10 min expiry)
- Browser session for logged-in state

### Authorization (Future)

**Enrollment Check:**
```ruby
# app/controllers/paid_lessons_controller.rb
before_action :require_enrollment

def require_enrollment
  unless @current_user&.enrolled?
    redirect_to pricing_path, alert: "Please enroll first"
  end
end
```

### CSRF Protection

**Rails Default:**
- All POST/PUT/DELETE requests require CSRF token
- Token embedded in forms automatically
- API requests must include token in header

### Data Protection

**Encrypted Credentials:**
```bash
# Edit encrypted credentials
bin/rails credentials:edit

# Access in app
Rails.application.credentials.telegram[:bot_token]
```

**Environment Variables:**
- `RAILS_MASTER_KEY` - Decrypts credentials
- `TELEGRAM_BOT_TOKEN` - Bot authentication
- `TELEGRAM_WEBHOOK_URL` - Ngrok/production URL

---

## Testing Architecture

### Test Suite Structure

**Unit Tests:**
```ruby
# test/models/user_test.rb
class UserTest < ActiveSupport::TestCase
  test "should not save user without telegram_id" do
    user = User.new
    assert_not user.save
  end
end
```

**Controller Tests:**
```ruby
# test/controllers/auth_controller_test.rb
class AuthControllerTest < ActionDispatch::IntegrationTest
  test "should generate session token on start" do
    post auth_telegram_start_path
    assert_response :success
    assert_not_nil session[:auth_token]
  end
end
```

**System Tests (Headless Browser):**
```ruby
# test/system/authentication_test.rb
class AuthenticationTest < ApplicationSystemTestCase
  test "visiting lesson shows auth modal" do
    visit free_content_lesson_path('01-introduction')
    assert_selector '#auth-modal'
  end
end
```

---

## Monitoring & Logging

### Development Logging

**Rails Logger:**
```ruby
# View logs in development
tail -f log/development.log

# Custom logging
Rails.logger.info "User authenticated: #{@user.username}"
```

### Production Monitoring (Future)

**Error Tracking:**
- Sentry / Rollbar integration
- Captures exceptions, provides stack traces

**Performance Monitoring:**
- New Relic / Scout APM
- Tracks slow queries, controller actions

**Uptime Monitoring:**
- Pingdom / UptimeRobot
- Alerts if site goes down

---

## Deployment Architecture

### Kamal Deployment

**Build Process:**
1. Kamal builds Docker image locally
2. Pushes to Docker registry
3. Pulls image on server
4. Starts new container
5. Waits for health check
6. Stops old container (zero downtime)

**Health Check:**
```ruby
# config/routes.rb
get '/up', to: 'rails/health#show', as: :rails_health_check
```

**Asset Compilation:**
```bash
# Runs during Docker build
bin/rails assets:precompile
bin/rails tailwindcss:build
```

---

## Scaling Considerations

### Current Architecture (Single Server)

**Suitable For:**
- 1-1,000 concurrent users
- 100,000 page views/month
- Low background job volume

**Bottlenecks:**
- Single SQLite database (read-heavy workload OK, write-heavy may struggle)
- Single server (no horizontal scaling)

### Future Scaling Paths

**Option 1: Vertical Scaling**
- Larger server (more CPU/RAM)
- Sufficient for 10,000+ concurrent users

**Option 2: Horizontal Scaling**
- Multiple app servers behind load balancer
- Shared PostgreSQL database
- Redis for session storage + cable
- Dedicated job worker servers

**Option 3: Managed Services**
- Heroku / Render / Fly.io
- Automatic scaling, less DevOps burden

---

## Conclusion

The architecture prioritizes simplicity and developer productivity over premature optimization. Server-side rendering with Hotwire provides SPA-like UX without frontend framework complexity. SQLite + Solid* (Queue/Cache/Cable) keeps infrastructure minimal while retaining professional features. The monolith architecture is appropriate for current scale (<10,000 users) and can be refactored for horizontal scaling if needed.

**Key Principles:**
1. **Server-side rendering first** - JavaScript enhances, doesn't control
2. **Convention over configuration** - Rails defaults are good defaults
3. **Monolith until proven otherwise** - Microservices add complexity
4. **Database-backed everything** - Solid* libraries eliminate Redis/Sidekiq
5. **Deploy early, deploy often** - Kamal enables zero-downtime deployments
