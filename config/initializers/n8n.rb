# N8N Integration Configuration
#
# This file loads N8N credentials from Rails encrypted credentials.
# To add/edit N8N credentials, run: EDITOR="code --wait" bin/rails credentials:edit
#
# Expected credentials structure:
#   n8n:
#     api_token: your_jwt_token_here
#     webhook_url:
#       test: https://n8n.aidelivery.tech/webhook-test/your-webhook-id
#       production: https://n8n.aidelivery.tech/webhook/your-webhook-id

# N8N API Token (JWT)
N8N_API_TOKEN = Rails.application.credentials.dig(:n8n, :api_token)

# N8N Webhook URL (automatically switches between test/production based on environment)
N8N_WEBHOOK_URL = if Rails.env.production?
  Rails.application.credentials.dig(:n8n, :webhook_url, :production)
else
  Rails.application.credentials.dig(:n8n, :webhook_url, :test)
end

# Validate credentials are present
if N8N_API_TOKEN.blank?
  Rails.logger.warn "WARNING: N8N_API_TOKEN is not configured in credentials"
end

if N8N_WEBHOOK_URL.blank?
  Rails.logger.warn "WARNING: N8N_WEBHOOK_URL is not configured in credentials for #{Rails.env} environment"
end
