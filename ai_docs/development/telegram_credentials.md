# Telegram Bot Credentials Management

## Overview

Telegram Bot credentials are stored securely in Rails encrypted credentials file (`config/credentials.yml.enc`) and loaded via the initializer at `config/initializers/telegram_bot.rb`.

**Security Approach:** Encrypted storage using `master.key`, following Rails best practices.

---

## Credentials Structure

### Environment-Specific Configuration

The application uses separate encrypted credentials for development and production environments:

- **Development**: `config/credentials.yml.enc` (decrypted with `config/master.key`)
- **Production**: `config/credentials/production.yml.enc` (decrypted with `config/credentials/production.key`)

### Development Credentials

**File:** `config/credentials.yml.enc`

```yaml
telegram:
  bot_token: 8414411793:AAE_Onhi-g_9zxp_krmkApdnj9TI6tSm8Qg
  bot_username: dbcourse_auth_bot
  webhook_url: https://karri-unexpunged-becomingly.ngrok-free.dev/auth/telegram/webhook
  api_base_url: http://localhost:3000  # ✨ For N8N callback routing
```

**Bot:** [@dbcourse_auth_bot](https://t.me/dbcourse_auth_bot)
**Webhook:** ngrok URL (changes on ngrok restart)
**API Base:** Local development server

---

### Production Credentials

**File:** `config/credentials/production.yml.enc`

```yaml
telegram:
  bot_token: 8243168970:AAEq9-4_rpgahzBdwMq98wYKAcklJxJgDu8
  bot_username: ai_delivery_tech_assistent_bot
  webhook_url: https://crm.aidelivery.tech/auth/telegram/webhook
  api_base_url: https://crm.aidelivery.tech  # ✨ For N8N callback routing
```

**Bot:** [@ai_delivery_tech_assistent_bot](https://t.me/ai_delivery_tech_assistent_bot)
**Webhook:** https://crm.aidelivery.tech/auth/telegram/webhook (production domain)
**API Base:** Production server URL

---

### Fields

- **`bot_token`** - Telegram Bot API token from [@BotFather](https://t.me/BotFather)
- **`bot_username`** - Bot username (without @ symbol)
- **`webhook_url`** - Public URL for receiving Telegram webhook updates
- **`api_base_url`** ✨ NEW - Base URL for N8N callback routing
  - Used to construct `callback_url` sent to N8N webhooks
  - Enables single N8N workflow to work across dev/prod environments
  - Development: `http://localhost:3000`
  - Production: `https://crm.aidelivery.tech`

---

## Configuration Files

### Initializer

**Location:** `config/initializers/telegram_bot.rb`

```ruby
# Loads credentials from encrypted storage
TELEGRAM_BOT_TOKEN = Rails.application.credentials.dig(:telegram, :bot_token)
TELEGRAM_BOT_USERNAME = Rails.application.credentials.dig(:telegram, :bot_username)
TELEGRAM_WEBHOOK_URL = Rails.application.credentials.dig(:telegram, :webhook_url)

# Validates credentials are present
if TELEGRAM_BOT_TOKEN.blank?
  Rails.logger.warn "WARNING: TELEGRAM_BOT_TOKEN is not configured"
end
```

**Available Constants:**
- `TELEGRAM_BOT_TOKEN` - Bot API token
- `TELEGRAM_BOT_USERNAME` - Bot username
- `TELEGRAM_WEBHOOK_URL` - Webhook URL for updates

---

## Setup Instructions

### 1. Edit Encrypted Credentials

**Development:**
```bash
EDITOR="code --wait" bin/rails credentials:edit
```

**Production:**
```bash
EDITOR="code --wait" bin/rails credentials:edit --environment production
```

Add the following structure:

```yaml
telegram:
  bot_token: YOUR_BOT_TOKEN_FROM_BOTFATHER
  bot_username: your_bot_username
  webhook_url: https://your-domain.com/auth/telegram/webhook
  api_base_url: https://your-domain.com  # Production URL (or http://localhost:3000 for dev)
```

**Important:** Save the file (Cmd+S / Ctrl+S) and close the editor. Credentials will be automatically encrypted.

**Note:** The `api_base_url` field is required for N8N integration callback routing. It allows N8N workflows to automatically use the correct API endpoint based on the environment.

---

### 2. Verify Configuration

```bash
bin/rails console
```

Check that constants are loaded:

```ruby
TELEGRAM_BOT_TOKEN
# => "8414411793:AAE_Onhi..."

TELEGRAM_BOT_USERNAME
# => "dbcourse_auth_bot"

TELEGRAM_WEBHOOK_URL
# => "https://karri-unexpunged-becomingly.ngrok-free.dev/auth/telegram/webhook"
```

---

### 3. Restart Rails Server

```bash
# Development
bin/dev

# Or manually
bin/rails server
```

---

## Security

### Why Encrypted Credentials?

**Before (INSECURE):**
```ruby
# config/initializers/telegram_bot.rb
TELEGRAM_BOT_TOKEN = "8414411793:AAE_Onhi..."  # ❌ Visible in git
```

**After (SECURE):**
```ruby
# config/initializers/telegram_bot.rb
TELEGRAM_BOT_TOKEN = Rails.application.credentials.dig(:telegram, :bot_token)  # ✅ Encrypted
```

### Protection Mechanism

1. **Encrypted Storage**: Credentials encrypted with AES-256
2. **Master Key Protection**: Only `config/master.key` can decrypt
3. **Git Exclusion**: `master.key` is in `.gitignore` and never committed
4. **Environment Isolation**: Different credentials per environment if needed

---

## Comparison with N8N Integration

Both Telegram and N8N use the same secure credential management pattern:

| Feature | Telegram | N8N |
|---------|----------|-----|
| Storage | `credentials.yml.enc` | `credentials.yml.enc` |
| Initializer | `telegram_bot.rb` | `n8n.rb` |
| Validation | ✅ Warns if missing | ✅ Warns if missing |
| Security | ✅ Encrypted | ✅ Encrypted |

---

## Usage in Application

### Controllers

```ruby
# app/controllers/auth_controller.rb
def telegram_webhook
  # TELEGRAM_BOT_TOKEN is available globally
  bot = Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)

  # Process webhook...
end
```

### Services

```ruby
# app/services/telegram_service.rb
class TelegramService
  def initialize
    @bot = Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
    @username = TELEGRAM_BOT_USERNAME
  end

  def send_message(chat_id, text)
    @bot.api.send_message(chat_id: chat_id, text: text)
  end
end
```

---

## Production Deployment

### Kamal Configuration

Production credentials are automatically deployed with the application:

```yaml
# config/deploy.yml
env:
  secret:
    - RAILS_MASTER_KEY
```

**Important:** In production, use `config/credentials/production.key` instead of `config/master.key`

### Setting Production Key on Server

**Option 1: Via Kamal secrets (.kamal/secrets)**
```bash
# .kamal/secrets
RAILS_MASTER_KEY=$(cat config/credentials/production.key)
```

**Option 2: Manual export**
```bash
export RAILS_MASTER_KEY=$(cat config/credentials/production.key)
bin/kamal deploy
```

### Webhook Configuration

**Production Webhook Setup:**
```bash
# Set webhook on Telegram servers (after deploying bot)
curl -X POST "https://api.telegram.org/bot8243168970:AAEq9-4_rpgahzBdwMq98wYKAcklJxJgDu8/setWebhook" \
  -d "url=https://crm.aidelivery.tech/auth/telegram/webhook"

# Verify webhook is set
curl "https://api.telegram.org/bot8243168970:AAEq9-4_rpgahzBdwMq98wYKAcklJxJgDu8/getWebhookInfo"
```

**Development Webhook Setup (ngrok):**
```bash
# Start ngrok
ngrok http 3000

# Copy ngrok URL, update development credentials
EDITOR="code --wait" bin/rails credentials:edit

# Set webhook
curl -X POST "https://api.telegram.org/bot8414411793:AAE_Onhi-g_9zxp_krmkApdnj9TI6tSm8Qg/setWebhook" \
  -d "url=https://your-ngrok-url.ngrok-free.dev/auth/telegram/webhook"
```

---

## Troubleshooting

### Issue: "WARNING: TELEGRAM_BOT_TOKEN is not configured"

**Solution:**

1. Check credentials file:
   ```bash
   bin/rails credentials:show | grep telegram
   ```

2. Verify structure matches expected format:
   ```yaml
   telegram:
     bot_token: ...
     bot_username: ...
     webhook_url: ...
   ```

3. Restart Rails server:
   ```bash
   bin/dev
   ```

---

### Issue: Credentials file won't save

**Solution:**

1. Ensure `config/master.key` exists:
   ```bash
   ls -la config/master.key
   ```

2. If missing, regenerate credentials:
   ```bash
   rm config/credentials.yml.enc
   EDITOR="code --wait" bin/rails credentials:edit
   ```

3. Add back all credential sections (telegram, n8n, secret_key_base)

---

### Issue: Invalid YAML syntax

**Solution:**

1. Use proper YAML indentation (2 spaces, not tabs)
2. Check for special characters in values
3. Verify structure with online YAML validator before saving

**Good:**
```yaml
telegram:
  bot_token: abc123
  bot_username: mybot
```

**Bad:**
```yaml
telegram:
bot_token: abc123  # ❌ Wrong indentation
  bot_username mybot  # ❌ Missing colon
```

---

## Migration from Hardcoded Values

If you have hardcoded credentials in your codebase:

### Step 1: Identify Hardcoded Values

```bash
# Search for hardcoded tokens
grep -r "TELEGRAM_BOT_TOKEN = \"" config/
```

### Step 2: Extract to Credentials

```bash
EDITOR="code --wait" bin/rails credentials:edit
```

Add extracted values to `telegram:` section.

### Step 3: Update Initializer

Replace hardcoded values with credential loading:

```ruby
# Before
TELEGRAM_BOT_TOKEN = "hardcoded_value"

# After
TELEGRAM_BOT_TOKEN = Rails.application.credentials.dig(:telegram, :bot_token)
```

### Step 4: Verify

```bash
bin/rails runner "puts TELEGRAM_BOT_TOKEN"
```

---

## Best Practices

### ✅ DO

- Store all secrets in encrypted credentials
- Use descriptive credential keys (`telegram:bot_token`, not `telegram:token`)
- Validate credentials are present in initializer
- Keep `master.key` secure and backed up separately
- Document credential structure in comments

### ❌ DON'T

- Commit `config/master.key` to git
- Hardcode tokens in source code
- Share credentials via unencrypted channels
- Use production credentials in development

---

## Related Documentation

- **Telegram Authentication**: `ai_docs/development/telegram_authentication.md`
- **N8N Integration**: `ai_docs/development/n8n_integration.md`
- **Telegram Auth Flow**: `ai_docs/business/telegram_auth_flow.md`

---

## Quick Reference

### View Credentials

```bash
bin/rails credentials:show
```

### Edit Credentials

```bash
EDITOR="code --wait" bin/rails credentials:edit
```

### Verify in Console

```bash
bin/rails console
> TELEGRAM_BOT_TOKEN
> TELEGRAM_BOT_USERNAME
> TELEGRAM_WEBHOOK_URL
```

### Validate Initializer

```bash
bin/rails runner "puts 'Token: ' + (TELEGRAM_BOT_TOKEN.present? ? 'SET' : 'NOT SET')"
```

---

## Conclusion

Storing Telegram Bot credentials in Rails encrypted credentials provides a secure, maintainable approach that:

- ✅ Prevents credential leaks in source control
- ✅ Follows Rails security best practices
- ✅ Enables easy environment-specific configuration
- ✅ Maintains consistency with N8N and other integrations

**Security Level:** 🔒🔒🔒🔒🔒 (Maximum)
