namespace :telegram do
  desc "Setup Telegram bot webhook"
  task setup_webhook: :environment do
    require 'telegram/bot'

    token = TELEGRAM_BOT_TOKEN
    webhook_url = TELEGRAM_WEBHOOK_URL

    Telegram::Bot::Client.run(token) do |bot|
      result = bot.api.set_webhook(url: webhook_url)
      if result
        puts "✅ Webhook successfully set to: #{webhook_url}"
        info = bot.api.get_webhook_info
        puts "Webhook info: #{info.inspect}"
      else
        puts "❌ Failed to set webhook"
      end
    end
  end

  desc "Remove Telegram bot webhook"
  task remove_webhook: :environment do
    require 'telegram/bot'

    Telegram::Bot::Client.run(TELEGRAM_BOT_TOKEN) do |bot|
      bot.api.delete_webhook
      puts "✅ Webhook removed"
    end
  end

  desc "Get webhook info"
  task webhook_info: :environment do
    require 'telegram/bot'

    Telegram::Bot::Client.run(TELEGRAM_BOT_TOKEN) do |bot|
      info = bot.api.get_webhook_info
      puts "Webhook info:"
      puts JSON.pretty_generate(info.to_h)
    end
  end
end
