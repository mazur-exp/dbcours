require 'telegram/bot'

class TypingIndicatorJob < ApplicationJob
  queue_as :default

  def perform(conversation_id)
    conversation = Conversation.find_by(id: conversation_id)

    # Проверяем что conversation существует и AI ещё обрабатывает
    return unless conversation&.ai_processing

    # Отправляем typing action в Telegram
    begin
      bot_client.api.send_chat_action(
        chat_id: conversation.user.telegram_id,
        action: 'typing'
      )

      Rails.logger.info "Typing indicator sent for conversation #{conversation_id}"
    rescue => e
      Rails.logger.error "Failed to send typing action: #{e.message}"
    end

    # Перезапускаем job через 4 секунды если AI ещё обрабатывает
    conversation.reload

    if conversation.ai_processing
      TypingIndicatorJob.set(wait: 4.seconds).perform_later(conversation_id)
    else
      Rails.logger.info "AI processing finished, stopping typing indicator for conversation #{conversation_id}"
    end
  end

  private

  def bot_client
    @bot_client ||= Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
  end
end
