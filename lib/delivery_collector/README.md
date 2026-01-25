# Delivery Data Collection Script - Rails Integration

## 🎯 Overview

This Node.js script collects delivery statistics from Grab and GoJek APIs and saves them **directly to Rails SQLite database** (table `client_stats`).

**Architecture:** ALL ON ONE SERVER
```
Grab/GoJek APIs → Node.js Script → Rails SQLite → Dashboard (instant!)
```

No intermediate MySQL server needed! ✨

---

## 📁 Structure

```
lib/delivery_collector/
├── start.js                    # Main entry point
├── package.json                # Node.js dependencies
├── config.js                   # Configuration (dates, etc.)
├── restaurants.js              # Credentials (from Rails via ENV)
├── database/
│   ├── db.js                   # Original local SQLite connection
│   └── db_rails.js             # ⭐ NEW: Rails SQLite connection
├── modules/
│   ├── fetchAllPreviousData.js # Main collection logic
│   ├── saveToRailsDB.js        # ⭐ NEW: Save to Rails client_stats
│   ├── grab/                   # Grab API modules
│   └── ...                     # GoJek API modules
└── test_*.js                   # Test scripts
```

---

## 🔧 How It Works

### Step 1: Collect Data (10-15 min)
```
Node.js script:
- Reads active clients from Rails `clients` table
- For each client:
  - Fetches Grab API data (10 endpoints)
  - Fetches GoJek API data (15 endpoints)
  - Saves to local SQLite (temporary)
- Then syncs all data to Rails `client_stats` table
```

### Step 2: Display (instant!)
```
Rails dashboard:
- Reads from `client_stats` table
- Queries take <15ms
- No HTTP requests to external servers!
```

---

## 🔐 Credentials Management

Credentials are stored in Rails `clients` table (will be encrypted in production):

```ruby
Client.first.to_collector_format
# => {
#   name: "Restaurant Name",
#   grab_token: "...",
#   grab_user_id: "...",
#   gojek_merchant_id: "...",
#   gojek_refresh_token: "...",
#   ...
# }
```

**Importing from old restaurants.js:**

```bash
# 1. Convert JS to JSON
node lib/delivery_collector/convert_to_json.js > lib/delivery_collector/restaurants_temp.json

# 2. Import to Rails
bin/rails runner lib/delivery_collector/import_credentials.rb
```

---

## 🚀 Usage

### Manual Collection (via Rails job):

```bash
# In Rails console or runner
bin/rails runner 'CollectDeliveryDataJob.perform_now'

# Or via UI button:
# Open http://localhost:3000/admin/dashboard
# Click "Собрать данные" button
```

### Automatic Collection (scheduled):

```yaml
# config/recurring.yml
collect_delivery_data:
  class: CollectDeliveryDataJob
  schedule: every day at 12:30am  # 00:30 UTC = 8:30 AM Bali
```

---

## 🧪 Testing

### Prerequisites:

1. Clients must have API credentials:
   ```bash
   bin/rails runner lib/delivery_collector/import_credentials.rb
   ```

2. Node.js dependencies installed:
   ```bash
   cd lib/delivery_collector
   npm install --ignore-scripts  # --ignore-scripts to avoid sqlite3 build issues on macOS
   ```

### Test Module Loading (local):

```bash
cd lib/delivery_collector
node test_simple.js
```

### Test via Rails Job:

```bash
bin/rails runner 'CollectDeliveryDataJob.perform_now'

# Check logs
tail -f log/development.log | grep Collection
```

### Verify Data:

```bash
bin/rails runner '
  puts "Total stats: #{ClientStat.count}"
  puts "Recent stats: #{ClientStat.where("synced_at > ?", 1.hour.ago).count}"
  ClientStat.order(synced_at: :desc).limit(3).each do |s|
    puts "  #{s.client.name} - #{s.stat_date}: Rp #{s.total_sales}"
  end
'
```

---

## 🐳 Production (Docker)

### Dockerfile Integration:

```dockerfile
# Install Node.js 20.x
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs

# Install script dependencies
RUN cd /rails/lib/delivery_collector && npm install --production
```

### Deploy:

```bash
bin/kamal deploy

# Script will be copied to container and dependencies installed
# Job will run automatically at 8:30 AM Bali every day
```

---

## 📊 What Gets Collected

### Grab Metrics (10 endpoints):
- Sales performance
- Customer breakdown
- Ad summary & conversion funnel
- Customer lifecycle
- Payouts
- Cancel reasons
- Operation metrics

### GoJek Metrics (15 endpoints):
- Transactions
- Rating
- Order metrics
- Ad cost & sales
- Incoming/accepted/cancelled orders
- Close time
- Clients status
- Potential losses
- Driver wait time
- Payouts

### Saved to Rails:

```sql
client_stats table:
- grab_sales, grab_orders, grab_ads_spend, grab_ads_sales
- grab_new_customers, grab_repeated_customers
- gojek_sales, gojek_orders, gojek_ads_spend, gojek_ads_sales
- gojek_new_customers, gojek_returned_customers
- total_sales, total_orders (aggregated)
```

---

## 🔧 Troubleshooting

### Issue: sqlite3 won't build on macOS

**Solution:** This is expected on macOS with Node.js 24+
- Use `npm install --ignore-scripts` (dependencies still install)
- Script will work in Docker production (Linux)
- For local testing, use Rails job approach

### Issue: "Client not found in Rails DB"

**Solution:** Import credentials first
```bash
bin/rails runner lib/delivery_collector/import_credentials.rb
```

### Issue: "Missing Active Record encryption credential"

**Solution:** Either:
1. Disable encryption temporarily (comment out `encrypts` in Client model)
2. Or add encryption keys to credentials:
   ```bash
   bin/rails db:encryption:init
   # Copy keys to config/credentials/development.yml.enc
   ```

---

## 📝 Files NOT Committed to Git

```.gitignore
/lib/delivery_collector/node_modules/
/lib/delivery_collector/database/database.sqlite
/lib/delivery_collector/database/*.sqlite
/lib/delivery_collector/.env
/lib/delivery_collector/config.local.js
```

---

## 🎉 Benefits

✅ **Simple**: All on one server (Rails)
✅ **Fast**: Direct save to Rails database
✅ **No sync**: No intermediate MySQL synchronization
✅ **Secure**: Credentials encrypted in Rails
✅ **Automated**: Runs daily via Solid Queue
✅ **Instant dashboard**: Data available immediately after collection

---

## 📞 Support

For issues or questions, check:
- Rails logs: `log/production.log` (search for "[Collection]")
- Solid Queue dashboard: Check job status
- Database: Verify data in `client_stats` table
