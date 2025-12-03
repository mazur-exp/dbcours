# Telegram Bot Configuration
#
# This file loads Telegram Bot credentials from Rails encrypted credentials.
# To add/edit Telegram credentials, run: EDITOR="code --wait" bin/rails credentials:edit
#
# Expected credentials structure:
#   telegram:
#     bot_token: your_bot_token_here
#     bot_username: your_bot_username
#     webhook_url: https://your-domain.com/auth/telegram/webhook

# Telegram Bot Token
TELEGRAM_BOT_TOKEN = Rails.application.credentials.dig(:telegram, :bot_token)

# Telegram Bot Username
TELEGRAM_BOT_USERNAME = Rails.application.credentials.dig(:telegram, :bot_username)

# Telegram Webhook URL
TELEGRAM_WEBHOOK_URL = Rails.application.credentials.dig(:telegram, :webhook_url)

# Validate credentials are present
if TELEGRAM_BOT_TOKEN.blank?
  Rails.logger.warn "WARNING: TELEGRAM_BOT_TOKEN is not configured in credentials"
end

if TELEGRAM_BOT_USERNAME.blank?
  Rails.logger.warn "WARNING: TELEGRAM_BOT_USERNAME is not configured in credentials"
end

if TELEGRAM_WEBHOOK_URL.blank?
  Rails.logger.warn "WARNING: TELEGRAM_WEBHOOK_URL is not configured in credentials"
end

# DeliveryBooster Sales Agent Configuration
# Milana's Telegram ID for escalation notifications
MILANA_TELEGRAM_ID = Rails.application.credentials.dig(:delivery_booster, :milana_telegram_id)

# Booking link for scheduling calls
BOOKING_LINK = Rails.application.credentials.dig(:delivery_booster, :booking_link)

if MILANA_TELEGRAM_ID.blank?
  Rails.logger.warn "WARNING: MILANA_TELEGRAM_ID is not configured in credentials (delivery_booster.milana_telegram_id)"
end

if BOOKING_LINK.blank?
  Rails.logger.warn "WARNING: BOOKING_LINK is not configured in credentials (delivery_booster.booking_link)"
end
