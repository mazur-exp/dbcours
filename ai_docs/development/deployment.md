# Deployment Documentation

## Overview

The application is deployed using Kamal, a Docker-based deployment tool that enables zero-downtime deployments to a single server (or multiple servers for larger scale).

---

## Deployment Stack

### Kamal

**What is Kamal:**
- Docker-based deployment tool by 37signals (creators of Rails)
- Zero-downtime deployments via health checks
- Simple configuration (single YAML file)
- No Kubernetes complexity

**File:** `config/deploy.yml`

---

## Deployment Configuration

### config/deploy.yml

```yaml
service: dbcours
image: username/dbcours

servers:
  web:
    - 192.168.0.1  # UPDATE THIS - your server IP

registry:
  server: ghcr.io
  username: your-github-username
  password:
    - KAMAL_REGISTRY_PASSWORD

env:
  clear:
    SOLID_QUEUE_IN_PUMA: true
    RAILS_ENV: production
  secret:
    - RAILS_MASTER_KEY
    - TELEGRAM_BOT_TOKEN
    - TELEGRAM_WEBHOOK_URL

volumes:
  - "dbcours_storage:/rails/storage"

# Asset compilation
asset_path: /rails/public/assets

# Health check
healthcheck:
  path: /up
  interval: 10s

# Proxy (Thruster - HTTP/2)
proxy:
  ssl: true
  host: your-domain.com
  acme:
    email: your-email@example.com
```

---

## Initial Server Setup

### Prerequisites

**Local Machine:**
- Docker installed
- Kamal gem: `gem install kamal`
- SSH access to server

**Server:**
- Ubuntu 20.04+ or Debian
- SSH access (key-based authentication)
- Docker will be installed by Kamal

---

### First-Time Setup

**1. Configure deploy.yml:**
```bash
# Edit config/deploy.yml
vim config/deploy.yml

# Update:
# - servers.web (your server IP)
# - registry (Docker registry credentials)
# - proxy.host (your domain)
# - proxy.acme.email (your email for Let's Encrypt)
```

**2. Set Environment Variables:**
```bash
# Set on your local machine
export KAMAL_REGISTRY_PASSWORD=your_github_token
export RAILS_MASTER_KEY=your_rails_master_key
```

**3. Run Kamal Setup:**
```bash
bin/kamal setup
```

**What it does:**
- Installs Docker on server (if not present)
- Creates necessary directories
- Pulls Docker image
- Starts containers (web + proxy)
- Runs database migrations
- Starts health checks

---

## Standard Deployment

### Deploy Command

```bash
bin/kamal deploy
```

**What happens:**

1. **Build Docker Image:**
   - Builds image locally based on Dockerfile
   - Compiles assets (`rails assets:precompile`)
   - Builds Tailwind CSS

2. **Push to Registry:**
   - Pushes image to Docker registry (GitHub Container Registry)

3. **Pull on Server:**
   - Server pulls latest image from registry

4. **Start New Container:**
   - Starts new container with updated image
   - Waits for health check to pass (`/up` endpoint)

5. **Switch Traffic:**
   - Once healthy, proxy switches traffic to new container
   - Old container continues serving existing requests

6. **Stop Old Container:**
   - After grace period, old container stopped
   - Zero downtime achieved

**Duration:** ~2-5 minutes (depending on image size)

---

## Docker Configuration

### Dockerfile

**File:** `Dockerfile`

```dockerfile
# Syntax
syntax = docker/dockerfile:1

# Base image
FROM ruby:3.4.5-slim AS base

# Set working directory
WORKDIR /rails

# Install dependencies
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    curl libjemalloc2 libsqlite3-0 libvips && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Environment
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development:test"

# Build stage
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential git pkg-config

# Copy Gemfile
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache

# Copy app
COPY . .

# Precompile assets
RUN bundle exec rails assets:precompile

# Final stage
FROM base

# Copy built app
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

# Create app user
RUN groupadd --system --gid 1000 rails && \
    useradd rails --uid 1000 --gid 1000 --create-home --shell /bin/bash && \
    chown -R rails:rails /rails

USER rails:rails

# Entrypoint
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

# Expose port
EXPOSE 3000

# Start server
CMD ["bundle", "exec", "thrust", "./bin/rails", "server"]
```

**Multi-Stage Build:**
- **Build stage:** Installs build tools, compiles gems, precompiles assets
- **Final stage:** Copies only runtime dependencies (smaller image)

**Image Size:** ~500MB (Rails + Ruby + dependencies)

---

## Database Management

### Running Migrations

**On Deploy:**
```bash
# Migrations run automatically during deploy
bin/kamal deploy
```

**Manually:**
```bash
# Run migrations without full deploy
bin/kamal app exec 'bin/rails db:migrate'
```

---

### Database Console

```bash
# Access Rails database console on server
bin/kamal dbc
```

**OR:**

```bash
# Access SQLite directly
bin/kamal app exec 'sqlite3 storage/production.sqlite3'
```

---

### Database Backup

**Manual Backup:**
```bash
# Create backup
bin/kamal app exec 'tar -czf /tmp/db_backup.tar.gz storage/*.sqlite3'

# Download backup
bin/kamal app exec 'cat /tmp/db_backup.tar.gz' > db_backup_$(date +%Y%m%d).tar.gz
```

**Automated Backup (Future):**
- Cron job on server
- Daily backups to S3/Backblaze
- 30-day retention policy

---

## Logs & Monitoring

### View Logs

**Application Logs:**
```bash
# Tail logs in real-time
bin/kamal logs

# Last 100 lines
bin/kamal logs --lines 100

# Specific container
bin/kamal app logs
```

**Proxy Logs:**
```bash
bin/kamal proxy logs
```

---

### Rails Console

```bash
# Access production Rails console
bin/kamal console
```

**Use cases:**
- Debug production issues
- Run one-off scripts
- Check database records

**⚠️ Warning:** Be careful - this is production!

---

## Server Access

### SSH into Server

```bash
# SSH into server
ssh deploy@192.168.0.1
```

---

### Shell in Container

```bash
# Shell inside running container
bin/kamal shell
```

**Use cases:**
- Inspect file system
- Check environment variables
- Run commands inside container

---

## Rollback

### Rollback to Previous Version

```bash
# Rollback to previous image
bin/kamal rollback <VERSION>
```

**How it works:**
- Kamal keeps previous images
- Switches traffic back to old container
- Quick recovery from bad deploys

---

## Environment Variables

### Managing Secrets

**Encrypted Credentials:**
```bash
# Edit production credentials
bin/rails credentials:edit --environment production
```

**Example:**
```yaml
telegram:
  bot_token: "8414411793:AAE_Onhi-g_9zxp_krmkApdnj9TI6tSm8Qg"
  bot_username: "dbcourse_auth_bot"
  webhook_url: "https://your-domain.com/auth/telegram/webhook"
```

**Access in App:**
```ruby
Rails.application.credentials.telegram[:bot_token]
```

**RAILS_MASTER_KEY:**
- Set on server via Kamal secrets
- Decrypts credentials.yml.enc

---

## SSL/TLS

### Let's Encrypt (Automatic)

**Configuration in deploy.yml:**
```yaml
proxy:
  ssl: true
  host: your-domain.com
  acme:
    email: your-email@example.com
```

**What happens:**
- Kamal automatically requests SSL certificate from Let's Encrypt
- Certificate auto-renews before expiry
- HTTPS enforced (HTTP → HTTPS redirect)

---

## Scaling

### Vertical Scaling (More Resources)

**Upgrade server:**
1. Provision larger server
2. Update `servers.web` in deploy.yml
3. Run `bin/kamal setup` on new server
4. Update DNS to point to new server

---

### Horizontal Scaling (Multiple Servers)

**deploy.yml:**
```yaml
servers:
  web:
    - 192.168.0.1
    - 192.168.0.2
    - 192.168.0.3
```

**Load Balancer:**
- Add load balancer (Cloudflare, AWS ELB)
- Distribute traffic across servers
- Session storage: Switch to Redis (from cookie)

---

## Performance Tuning

### Puma Configuration

**File:** `config/puma.rb`

```ruby
# Workers (processes)
workers ENV.fetch("WEB_CONCURRENCY") { 2 }

# Threads per worker
threads_count = ENV.fetch("RAILS_MAX_THREADS") { 5 }
threads threads_count, threads_count

# Preload app (faster worker boot)
preload_app!
```

**Calculation:**
- 2 workers × 5 threads = 10 concurrent requests
- Suitable for 512MB-1GB RAM server

---

### Database Connection Pool

**config/database.yml:**
```yaml
pool: <%= ENV.fetch("RAILS_MAX_THREADS") { 5 } %>
```

**Rule:** Pool size ≥ Puma threads (5)

---

## Troubleshooting

### Deploy Fails

**Check Logs:**
```bash
bin/kamal logs
```

**Common Issues:**
- Health check failing: `/up` endpoint not responding
- Asset compilation error: Check Tailwind config
- Database migration error: Check schema compatibility

---

### High Memory Usage

**Check Container Stats:**
```bash
bin/kamal app exec 'free -h'
```

**Solutions:**
- Reduce Puma workers
- Add swap file
- Upgrade server RAM

---

### Slow Performance

**Check Database:**
```bash
bin/kamal app exec 'bin/rails runner "puts User.count"'
```

**Check Logs for Slow Queries:**
```bash
bin/kamal logs | grep "Completed 200" | grep -E "\d{3,} ms"
```

---

## Monitoring (Future)

### Uptime Monitoring

**Tools:**
- Pingdom
- UptimeRobot
- StatusCake

**Configuration:**
- Monitor `/up` endpoint every 5 minutes
- Email alert if down

---

### Application Performance Monitoring (APM)

**Tools:**
- New Relic
- Scout APM
- Skylight

**Metrics:**
- Response times
- Slow queries
- Error rates
- Throughput

---

### Error Tracking

**Tools:**
- Sentry
- Rollbar
- Bugsnag

**Benefits:**
- Automatic error capture
- Stack traces
- User context
- Deploy tracking

---

## Backup & Disaster Recovery

### Full System Backup

**What to backup:**
1. Database files (`storage/*.sqlite3`)
2. Uploaded assets (`storage/`)
3. Credentials (`config/credentials/production.yml.enc`)
4. Environment variables

**Backup Script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
bin/kamal app exec "tar -czf /tmp/backup_$DATE.tar.gz storage/"
bin/kamal app exec "cat /tmp/backup_$DATE.tar.gz" > backup_$DATE.tar.gz
# Upload to S3
aws s3 cp backup_$DATE.tar.gz s3://backups/dbcours/
```

---

### Restore from Backup

```bash
# Download backup
aws s3 cp s3://backups/dbcours/backup_20250115.tar.gz .

# Upload to server
cat backup_20250115.tar.gz | bin/kamal app exec "cat > /tmp/restore.tar.gz"

# Extract
bin/kamal app exec "tar -xzf /tmp/restore.tar.gz -C /rails/"

# Restart app
bin/kamal app restart
```

---

## CI/CD Integration (Future)

### GitHub Actions

**File:** `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Ruby
        uses: ruby/setup-ruby@v1
        with:
          ruby-version: 3.4.5
      - name: Install Kamal
        run: gem install kamal
      - name: Deploy
        env:
          KAMAL_REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
          RAILS_MASTER_KEY: ${{ secrets.RAILS_MASTER_KEY }}
        run: kamal deploy
```

**Benefits:**
- Automatic deployment on push to main
- Test before deploy
- Deployment history

---

## Security

### Server Hardening

**Firewall (ufw):**
```bash
ufw allow 22   # SSH
ufw allow 80   # HTTP
ufw allow 443  # HTTPS
ufw enable
```

**SSH Key-Only:**
```bash
# Disable password authentication
vim /etc/ssh/sshd_config
# PasswordAuthentication no
service sshd restart
```

**Automatic Updates:**
```bash
apt install unattended-upgrades
```

---

## Conclusion

Kamal simplifies deployment to a single command (`bin/kamal deploy`) while providing zero-downtime, automated SSL, and easy rollbacks. The Docker-based approach ensures consistency between environments. For small-to-medium scale (<10,000 users), a single server with SQLite is sufficient and costs ~$5-20/month on DigitalOcean/Hetzner.
