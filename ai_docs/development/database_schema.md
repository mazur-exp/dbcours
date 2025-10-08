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
| `created_at` | datetime | NO | now() | Record creation timestamp |
| `updated_at` | datetime | NO | now() | Record last update timestamp |

**Indexes:**
- **Unique index on `telegram_id`:** Ensures one user per Telegram account
- **Unique index on `session_token`:** Prevents token collision, speeds up lookup

**Constraints:**
- `telegram_id` must be unique and not null
- `session_token` must be unique if present

---

## User Model

**File:** `app/models/user.rb`

**Validations:**
```ruby
class User < ApplicationRecord
  validates :telegram_id, presence: true, uniqueness: true
  validates :session_token, uniqueness: true, allow_nil: true
end
```

**Methods (Current):**
```ruby
# Example custom method (not yet implemented)
def display_name
  first_name || username || "User #{telegram_id}"
end

def enrolled?
  # Future: Check enrollment record
  false
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
