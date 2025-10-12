require 'telegram/bot'

class N8nController < ApplicationController
  skip_before_action :verify_authenticity_token
  # TODO: Добавить авторизацию позже когда всё заработает
  # before_action :verify_n8n_token

  # POST /api/n8n/send_message
  # Body: { telegram_id: 123456, text: "Message with **Markdown**" }
  def send_message
    Rails.logger.info "=== N8N send_message called ==="
    Rails.logger.info "Params: #{params.inspect}"

    telegram_id = params[:telegram_id]
    text_to_send = params[:text]

    # Валидация параметров
    if telegram_id.blank?
      render json: { error: 'telegram_id is required' }, status: :unprocessable_entity
      return
    end

    if text_to_send.blank?
      render json: { error: 'text is required' }, status: :unprocessable_entity
      return
    end

    # AI квалификация - принимаем параметры напрямую из N8N
    qualification_data = {
      real_name: params[:real_name],
      background: params[:background],
      query: params[:query],
      ready_score: params[:ready]
    }

    Rails.logger.info "Text to send: #{text_to_send[0..100]}..."
    Rails.logger.info "AI qualification: #{qualification_data.inspect}"

    # Находим пользователя
    user = User.find_by(telegram_id: telegram_id)

    if user.nil?
      render json: { error: 'User not found' }, status: :not_found
      return
    end

    # Находим или создаём беседу
    conversation = user.conversation

    # Сбрасываем флаг AI обработки (останавливает typing indicator)
    conversation.update!(ai_processing: false)

    Rails.logger.info "AI processing finished for conversation #{conversation.id}"

    # Сохраняем AI-квалификацию в conversation
    conversation.update!(
      ai_real_name: qualification_data[:real_name],
      ai_background: qualification_data[:background],
      ai_query: qualification_data[:query],
      ai_ready_score: qualification_data[:ready_score]
    )

    Rails.logger.info "AI qualification saved for conversation #{conversation.id}"

    # Отправляем сообщение через Telegram API с Markdown
    begin
      result = bot_client.api.send_message(
        chat_id: telegram_id,
        text: text_to_send,
        parse_mode: 'Markdown'
      )

      Rails.logger.info "N8N → Telegram: message sent to user #{user.id}, message_id=#{result.message_id}"

      # Сохраняем в БД как outgoing message (от AI-bot)
      message = conversation.messages.create!(
        body: text_to_send,
        direction: :outgoing,
        telegram_message_id: result.message_id,
        read: true,
        user_id: nil # от AI/бота
      )

      # Reload conversation
      conversation.reload

      # Broadcast через ActionCable для admin dashboard
      ActionCable.server.broadcast("messenger_channel", {
        type: 'new_message',
        conversation_id: conversation.id,
        message: message.as_json(include: :user),
        conversation: {
          id: conversation.id,
          user: user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
          last_message: message.as_json(only: [:id, :body, :direction, :created_at]),
          unread_count: conversation.unread_count,
          last_message_at: conversation.last_message_at,
          # AI Qualification данные для real-time обновления sidebar
          ai_qualification: {
            real_name: conversation.ai_real_name,
            background: conversation.ai_background,
            query: conversation.ai_query,
            ready_score: conversation.ai_ready_score
          },
          # Статистика сообщений
          statistics: {
            total_messages: conversation.messages.count,
            incoming_count: conversation.messages.incoming.count,
            outgoing_count: conversation.messages.outgoing.count
          }
        }
      })

      render json: {
        success: true,
        message_id: message.id,
        telegram_message_id: result.message_id,
        user_id: user.id,
        conversation_id: conversation.id
      }
    rescue Telegram::Bot::Error => e
      Rails.logger.error "Telegram API error: #{e.message}"

      # Fallback: попробовать без Markdown если ошибка парсинга
      if e.message.include?('parse')
        begin
          result = bot_client.api.send_message(
            chat_id: telegram_id,
            text: text_to_send
          )

          Rails.logger.warn "Sent without Markdown due to parse error"

          message = conversation.messages.create!(
            body: text_to_send,
            direction: :outgoing,
            telegram_message_id: result.message_id,
            read: true,
            user_id: nil
          )

          render json: {
            success: true,
            message_id: message.id,
            telegram_message_id: result.message_id,
            warning: 'Markdown parse error, sent as plain text'
          }
          return
        rescue => fallback_error
          Rails.logger.error "Fallback also failed: #{fallback_error.message}"
        end
      end

      render json: { error: "Failed to send message: #{e.message}" }, status: :internal_server_error
    rescue => e
      Rails.logger.error "N8N send_message error: #{e.message}"
      render json: { error: 'Internal server error' }, status: :internal_server_error
    end
  end

  private

  def verify_n8n_token
    token = request.headers['Authorization']&.split(' ')&.last

    unless token == N8N_API_TOKEN
      Rails.logger.warn "N8N webhook: Unauthorized access attempt"
      render json: { error: 'Unauthorized' }, status: :unauthorized
      return
    end
  end

  def bot_client
    @bot_client ||= Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
  end
end
