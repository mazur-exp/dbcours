# Database Schema Documentation

## Overview

The application uses SQLite3 for all environments (development, test, production). The schema is minimal currently, with plans for expansion as paid course features are implemented.

---

## Current Schema

### Users Table

**Purpose:** Store authenticated user information from Telegram OAuth

**Schema:**
```ruby
create_table "users", force: :cascade do |t|
  t.bigint "telegram_id", null: false
  t.string "username"
  t.string "first_name"
  t.string "last_name"
  t.string "session_token"
  t.boolean "authenticated", default: false
  t.datetime "created_at", null: false
  t.datetime "updated_at", null: false
  t.boolean "admin", default: false, null: false      # Added 2025-10-08
  t.string "avatar_url"                               # Added 2025-10-08
  t.index ["session_token"], name: "index_users_on_session_token", unique: true
  t.index ["telegram_id"], name: "index_users_on_telegram_id", unique: true
end
```

**Field Descriptions:**

| Field | Type | Null | Default | Description |
|-------|------|------|---------|-------------|
| `id` | integer | NO | auto | Primary key (auto-increment) |
| `telegram_id` | bigint | NO | - | Unique Telegram user ID (e.g., 123456789) |
| `username` | string | YES | NULL | Telegram username (e.g., "johndoe"), may be null |
| `first_name` | string | YES | NULL | User's first name from Telegram |
| `last_name` | string | YES | NULL | User's last name from Telegram (may be null) |
| `session_token` | string | YES | NULL | Temporary token for auth flow (32-char hex) |
| `authenticated` | boolean | NO | false | Whether user has completed auth |
| `admin` | boolean | NO | false | Admin flag for messenger access |
| `avatar_url` | string | YES | NULL | Telegram profile photo URL |
| `paid` | boolean | NO | false | **NEW:** Paid user flag for dashboard access |
| `created_at` | datetime | NO | now() | Record creation timestamp |
| `updated_at` | datetime | NO | now() | Record last update timestamp |

**Indexes:**
- **Unique index on `telegram_id`:** Ensures one user per Telegram account
- **Unique index on `session_token`:** Prevents token collision, speeds up lookup

**Constraints:**
- `telegram_id` must be unique and not null
- `session_token` must be unique if present

**Admin and Avatar Fields (Added 2025-10-08):**

- **`admin`** - Boolean flag for admin dashboard access
  - Purpose: Controls access to `/messenger` and `/crm` admin interfaces
  - Usage: `@current_user.admin?` in controllers
  - Set manually in console: `user.update(admin: true)`

- **`avatar_url`** - Telegram profile photo URL
  - Purpose: Display user avatars in messenger interface
  - Format: `https://api.telegram.org/file/bot{token}/{file_path}`
  - Fetched from Telegram API during auth
  - Updated periodically (daily) for active users
  - Fallback: Show initials if avatar_url is nil

**Paid Access Control (Added 2025-10-16):**

- **`paid`** - Boolean flag for paid course access
  - Purpose: Controls access to premium content on `/dashboard` route
  - Default: `false` for new users
  - Automatically set to `true` for all admin users (via callback)
  - Usage: `@current_user.paid?` or `@current_user.has_dashboard_access?` in controllers
  - Authorization pattern:
    ```ruby
    # Dashboard requires EITHER admin OR paid status
    def has_dashboard_access?
      admin? || paid?
    end
    ```
  - Migration: Existing admins automatically marked as paid via data migration
  - Business logic: Admins always have paid=true (enforced by `after_save` callback)

---

## User Model

**File:** `app/models/user.rb`

**Associations:**
```ruby
class User < ApplicationRecord
  has_many :conversations, dependent: :destroy
  has_many :messages
end
```

**Scopes:**
```ruby
scope :admins, -> { where(admin: true) }
scope :authenticated_users, -> { where(authenticated: true) }
scope :paid_users, -> { where(paid: true) }
```

**Methods:**
```ruby
# Get or create conversation for this user
def conversation
  conversations.first_or_create!
end

# Full name (first + last)
def full_name
  [first_name, last_name].compact.join(' ').presence || 'Пользователь'
end

# Count of sent messages
def messages_count
  conversation&.messages&.where(direction: :incoming)&.count || 0
end

# Check if user has access to paid dashboard content
def has_dashboard_access?
  admin? || paid?
end
```

**Callbacks:**
```ruby
after_save :ensure_admin_is_paid

private

# Automatically sets paid = true for admins
def ensure_admin_is_paid
  if admin? && !paid?
    update_column(:paid, true)
  end
end
```

---

### Conversations Table

**Purpose:** Group messages by user for messenger feature

**Schema:**
```ruby
create_table "conversations", force: :cascade do |t|
  t.integer "user_id", null: false
  t.datetime "last_message_at"
  t.integer "unread_count", default: 0
  t.datetime "created_at", null: false
  t.datetime "updated_at", null: false
  t.string "ai_real_name"                # Added 2025-10-09
  t.text "ai_background"                 # Added 2025-10-09
  t.text "ai_query"                      # Added 2025-10-09
  t.integer "ai_ready_score"             # Added 2025-10-09
  t.boolean "ai_processing", default: false  # Added 2025-10-09
  t.index ["last_message_at"], name: "index_conversations_on_last_message_at"
  t.index ["user_id"], name: "index_conversations_on_user_id"
end

add_foreign_key "conversations", "users"
```

**Field Descriptions:**

| Field | Type | Null | Default | Description |
|-------|------|------|---------|-------------|
| `id` | integer | NO | auto | Primary key |
| `user_id` | integer | NO | - | Foreign key to users table |
| `last_message_at` | datetime | YES | NULL | Timestamp of last message (for sorting) |
| `unread_count` | integer | NO | 0 | Cached count of unread incoming messages |
| `ai_real_name` | string | YES | NULL | **AI-extracted:** User's real name |
| `ai_background` | text | YES | NULL | **AI-extracted:** User's business context |
| `ai_query` | text | YES | NULL | **AI-extracted:** Main question/intent |
| `ai_ready_score` | integer | YES | NULL | **AI-extracted:** Lead readiness (0-100) |
| `ai_processing` | boolean | NO | false | **AI flag:** Typing indicator active |
| `created_at` | datetime | NO | now() | Record creation timestamp |
| `updated_at` | datetime | NO | now() | Record last update timestamp |

**Indexes:**
- `user_id` - Fast lookup of user's conversation
- `last_message_at` - Fast sorting of conversation list

**AI Qualification Fields (Added 2025-10-09):**

These fields enable automatic lead qualification during AI-powered conversations:

- **`ai_real_name`** - User's real name extracted by AI
  - Example: "Hi, I'm Alex" → `ai_real_name = "Alex"`
  - Used for personalization and CRM integration

- **`ai_background`** - Business context/situation
  - Example: "I own 3 restaurants in Moscow" → `ai_background = "Restaurant owner, 3 locations, Moscow"`
  - Used for lead segmentation and sales strategy

- **`ai_query`** - Main question or goal identified
  - Example: "How much to start food delivery?" → `ai_query = "Cost of starting delivery business"`
  - Used for analytics and FAQ optimization

- **`ai_ready_score`** - Lead readiness score (0-100)
  - 0-30: Just exploring, no urgency
  - 31-60: Interested, gathering info
  - 61-85: Serious buyer, evaluating options
  - 86-100: Ready to purchase
  - Used for lead prioritization

- **`ai_processing`** - Technical flag for typing indicator
  - `true` = AI analyzing message, show typing indicator
  - `false` = AI finished, stop typing indicator
  - Controls `TypingIndicatorJob` loop

**Constraints:**
- One conversation per user (enforced by application logic)
- Foreign key to users table (cascade delete)

---

## Conversation Model

**File:** `app/models/conversation.rb`

**Associations:**
```ruby
class Conversation < ApplicationRecord
  belongs_to :user
  has_many :messages, dependent: :destroy
end
```

**Scopes:**
```ruby
scope :recent, -> { order(last_message_at: :desc) }
scope :with_unread, -> { where('unread_count > 0') }
```

**Methods:**
```ruby
# Get last message
def last_message
  messages.order(created_at: :desc).first
end

# Update last_message_at timestamp
def touch_last_message!
  update!(last_message_at: Time.current)
end

# Increment unread counter
def increment_unread!
  increment!(:unread_count)
end

# Mark all messages as read
def mark_all_read!
  update!(unread_count: 0)
  messages.where(read: false).update_all(read: true)
end
```

---

### Messages Table

**Purpose:** Store individual messages in conversations

**Schema:**
```ruby
create_table "messages", force: :cascade do |t|
  t.integer "conversation_id", null: false
  t.integer "user_id"
  t.text "body", null: false
  t.integer "direction", default: 0, null: false
  t.bigint "telegram_message_id"
  t.boolean "read", default: false
  t.datetime "created_at", null: false
  t.datetime "updated_at", null: false
  t.index ["conversation_id", "created_at"], name: "index_messages_on_conversation_id_and_created_at"
  t.index ["conversation_id"], name: "index_messages_on_conversation_id"
  t.index ["telegram_message_id"], name: "index_messages_on_telegram_message_id"
  t.index ["user_id"], name: "index_messages_on_user_id"
end

add_foreign_key "messages", "conversations"
add_foreign_key "messages", "users"
```

**Field Descriptions:**

| Field | Type | Null | Default | Description |
|-------|------|------|---------|-------------|
| `id` | integer | NO | auto | Primary key |
| `conversation_id` | integer | NO | - | Parent conversation |
| `user_id` | integer | YES | NULL | Sender (NULL for admin/AI messages) |
| `body` | text | NO | - | Message text content |
| `direction` | integer | NO | 0 | Enum: 0=incoming, 1=outgoing |
| `telegram_message_id` | bigint | YES | NULL | Telegram API message ID |
| `read` | boolean | NO | false | Whether admin has read the message |
| `created_at` | datetime | NO | now() | Message creation timestamp |
| `updated_at` | datetime | NO | now() | Message update timestamp |

**Direction Enum:**
- `0` (incoming) - Message from user to admin
- `1` (outgoing) - Message from admin/AI to user

**Indexes:**
- `conversation_id` - Fast lookup of conversation messages
- `conversation_id + created_at` - Fast chronological sorting
- `telegram_message_id` - Fast lookup by Telegram ID
- `user_id` - Fast lookup of user's sent messages

**Constraints:**
- `body` must not be null (text required)
- `direction` must be 0 or 1
- Foreign keys to conversations and users

---

## Message Model

**File:** `app/models/message.rb`

**Associations:**
```ruby
class Message < ApplicationRecord
  belongs_to :conversation
  belongs_to :user, optional: true  # nullable for admin messages
end
```

**Enum:**
```ruby
enum :direction, { incoming: 0, outgoing: 1 }
```

**Validations:**
```ruby
validates :body, presence: true
validates :direction, presence: true
```

**Scopes:**
```ruby
scope :unread, -> { where(read: false) }
scope :by_time, -> { order(created_at: :asc) }
```

**Methods:**
```ruby
# Check if message is from admin
def from_admin?
  outgoing? && user_id.nil?
end

# Check if message is from user
def from_user?
  incoming? && user_id.present?
end
```

**Callbacks:**
```ruby
after_create :update_conversation_timestamp
after_create :increment_conversation_unread, if: :incoming?

private

def update_conversation_timestamp
  conversation.touch_last_message!
end

def increment_conversation_unread
  conversation.increment_unread!
end
```

---

## Future Schema (Planned)

### Enrollments Table

**Purpose:** Track paid course purchases

```ruby
create_table "enrollments" do |t|
  t.references :user, null: false, foreign_key: true
  t.string :tier, null: false  # 'basic', 'accelerator', 'vip'
  t.decimal :amount_paid, precision: 10, scale: 2
  t.string :currency, default: 'RUB'
  t.string :payment_id  # Stripe/YooKassa transaction ID
  t.datetime :enrolled_at, null: false
  t.datetime :expires_at  # NULL = lifetime access
  t.timestamps
end

add_index :enrollments, [:user_id, :tier], unique: true
```

**Fields:**
- `user_id` - Foreign key to users table
- `tier` - Course tier purchased (basic/accelerator/vip)
- `amount_paid` - Price paid (e.g., 38000.00)
- `currency` - RUB or USD
- `payment_id` - External payment processor reference
- `enrolled_at` - When course was purchased
- `expires_at` - NULL for lifetime access

---

### LessonProgress Table

**Purpose:** Track which lessons user has completed

```ruby
create_table "lesson_progress" do |t|
  t.references :user, null: false, foreign_key: true
  t.string :lesson_slug, null: false  # e.g., '01-introduction'
  t.boolean :completed, default: false
  t.datetime :completed_at
  t.integer :time_spent_seconds  # Video watch time
  t.timestamps
end

add_index :lesson_progress, [:user_id, :lesson_slug], unique: true
```

**Fields:**
- `user_id` - Foreign key to users
- `lesson_slug` - Unique lesson identifier
- `completed` - Boolean flag
- `completed_at` - Timestamp of completion
- `time_spent_seconds` - Analytics (how long user watched)

---

### Payments Table

**Purpose:** Audit trail of all payment transactions

```ruby
create_table "payments" do |t|
  t.references :user, null: false, foreign_key: true
  t.references :enrollment, foreign_key: true
  t.string :payment_processor  # 'stripe', 'yookassa'
  t.string :transaction_id, null: false
  t.decimal :amount, precision: 10, scale: 2, null: false
  t.string :currency, default: 'RUB'
  t.string :status, null: false  # 'pending', 'completed', 'failed', 'refunded'
  t.text :metadata  # JSON blob with processor-specific data
  t.timestamps
end

add_index :payments, :transaction_id, unique: true
```

**Fields:**
- `payment_processor` - Which service processed payment
- `transaction_id` - External reference ID
- `amount` - Amount charged
- `status` - Payment state machine
- `metadata` - Extra data (card type, error messages, etc.)

---

## Migrations Strategy

### Current Migration

**File:** `db/migrate/[timestamp]_create_users.rb`

```ruby
class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.bigint :telegram_id, null: false
      t.string :username
      t.string :first_name
      t.string :last_name
      t.string :session_token
      t.boolean :authenticated, default: false

      t.timestamps
    end

    add_index :users, :telegram_id, unique: true
    add_index :users, :session_token, unique: true
  end
end
```

### Running Migrations

```bash
# Development
bin/rails db:migrate

# Production (via Kamal)
bin/kamal app exec 'bin/rails db:migrate'

# Rollback last migration
bin/rails db:rollback

# Check migration status
bin/rails db:migrate:status
```

---

## Seed Data

**File:** `db/seeds.rb`

**Current Seeds (Example):**
```ruby
# Create test user for development
User.find_or_create_by(telegram_id: 123456789) do |user|
  user.username = 'testuser'
  user.first_name = 'Test'
  user.last_name = 'User'
  user.authenticated = true
end
```

**Running Seeds:**
```bash
bin/rails db:seed

# Reset database and re-seed
bin/rails db:reset
```

---

## Database Configuration

**File:** `config/database.yml`

**Development:**
```yaml
development:
  adapter: sqlite3
  database: storage/development.sqlite3
  pool: 5
  timeout: 5000
```

**Production:**
```yaml
production:
  primary:
    adapter: sqlite3
    database: storage/production.sqlite3
    pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
    timeout: 5000

  cache:
    adapter: sqlite3
    database: storage/production_cache.sqlite3
    migrations_paths: db/cache_migrate

  queue:
    adapter: sqlite3
    database: storage/production_queue.sqlite3
    migrations_paths: db/queue_migrate

  cable:
    adapter: sqlite3
    database: storage/production_cable.sqlite3
    migrations_paths: db/cable_migrate
```

---

## Query Patterns

### Finding Users

**By Telegram ID:**
```ruby
user = User.find_by(telegram_id: telegram_id)
```

**By Session Token:**
```ruby
user = User.find_by(session_token: token, authenticated: true)
```

**By Username:**
```ruby
user = User.find_by(username: 'johndoe')
```

### Creating Users

**Find or Create (Auth Flow):**
```ruby
user = User.find_or_create_by(telegram_id: telegram_id) do |u|
  u.username = telegram_username
  u.first_name = telegram_first_name
  u.last_name = telegram_last_name
end

user.update(session_token: token, authenticated: true)
```

### Updating Users

**Complete Authentication:**
```ruby
user.update(
  session_token: session_token,
  authenticated: true
)
```

**Clear Session Token:**
```ruby
user.update(session_token: nil, authenticated: false)
```

---

## Data Integrity

### Constraints

**Application-Level:**
- Model validations (presence, uniqueness)
- Callbacks (before_save, after_create)

**Database-Level:**
- Unique indexes (prevent duplicates)
- NOT NULL constraints (require fields)
- Foreign keys (future, for enrollments)

### Handling Duplicates

**Scenario:** User tries to auth twice simultaneously

**Solution:**
```ruby
# find_or_create_by is atomic (creates OR finds, not both)
User.find_or_create_by(telegram_id: telegram_id) do |user|
  # Only executed if user doesn't exist
  user.username = telegram_username
  # ...
end
```

---

## Backup & Recovery

### Manual Backup (Development)

```bash
# Backup SQLite database
cp storage/development.sqlite3 storage/development_backup_$(date +%Y%m%d).sqlite3

# Restore from backup
cp storage/development_backup_20250101.sqlite3 storage/development.sqlite3
```

### Production Backup (Kamal)

**Docker Volume Backup:**
```bash
# Backup entire storage volume (includes all databases)
kamal app exec 'tar -czf /tmp/storage_backup.tar.gz /rails/storage'
kamal app exec 'cat /tmp/storage_backup.tar.gz' > storage_backup.tar.gz
```

**Automated Backups (Future):**
- Cron job on server: Daily backup to S3/Backblaze
- Retention: 30 daily, 12 monthly backups

---

## Performance Optimization

### Indexes

**Current Indexes:**
- `telegram_id` (unique) - Fast user lookup during auth
- `session_token` (unique) - Fast token validation

**Future Indexes:**
```ruby
# For enrollment queries
add_index :enrollments, :user_id
add_index :enrollments, :tier

# For lesson progress queries
add_index :lesson_progress, [:user_id, :completed]
add_index :lesson_progress, :lesson_slug
```

### Query Optimization

**N+1 Query Prevention:**
```ruby
# Bad: N+1 queries
users = User.all
users.each { |u| puts u.enrollments.count }

# Good: Eager loading
users = User.includes(:enrollments).all
users.each { |u| puts u.enrollments.count }
```

### Database Connection Pooling

**Configuration:**
```yaml
pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
```

**Puma Workers:**
- Each Puma worker has its own connection pool
- Pool size = max thread count (default 5)

---

## Testing Database

**Configuration:**
```yaml
test:
  adapter: sqlite3
  database: storage/test.sqlite3
  pool: 5
  timeout: 5000
```

**Test Database Management:**
```bash
# Create test database
bin/rails db:test:prepare

# Reset test database (drop, create, migrate)
bin/rails db:test:prepare RAILS_ENV=test

# Load schema directly (faster than migrations)
bin/rails db:schema:load RAILS_ENV=test
```

**Test Isolation:**
- Each test transaction is rolled back (database reset after each test)
- Parallel tests use separate database files (test_1.sqlite3, test_2.sqlite3)

---

## Schema Versioning

**Current Version:** Check `db/schema.rb`

```ruby
ActiveRecord::Schema[8.0].define(version: 2025_01_10_120000) do
  # ...
end
```

**Version Number:** Timestamp from migration filename
- Format: YYYY_MM_DD_HHMMSS
- Example: 2025_01_10_120000 = January 10, 2025, 12:00:00

---

## Conclusion

The current schema is minimal (single Users table) to support authentication. Future expansion will add enrollments, lesson progress tracking, and payment records. SQLite is suitable for current scale (<10,000 users); migration to PostgreSQL would be required at 100,000+ users for better concurrent write performance.

**Migration Path to PostgreSQL:**
1. Update `database.yml` adapter
2. Install `pg` gem
3. Export SQLite data → Import to PostgreSQL
4. Test queries (SQLite vs. Postgres have subtle differences)
5. Deploy with zero downtime (blue-green deployment)
