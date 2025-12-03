require 'telegram/bot'

class N8nController < ApplicationController
  skip_before_action :verify_authenticity_token
  # TODO: Добавить авторизацию позже когда всё заработает
  # before_action :verify_n8n_token

  # POST /api/n8n/send_message
  # Body: { telegram_id: 123456, text: "Message with **Markdown**", source_type: "bot|business", business_connection_id: "..." }
  def send_message
    Rails.logger.info "=== N8N send_message called ==="
    Rails.logger.info "Params: #{params.inspect}"

    telegram_id = params[:telegram_id]
    text_to_send = params[:text]
    source_type = params[:source_type] || 'bot'  # Канал отправки (bot или business)
    business_connection_id = params[:business_connection_id]  # Для business messages

    # Валидация параметров
    if telegram_id.blank?
      render json: { error: 'telegram_id is required' }, status: :unprocessable_entity
      return
    end

    if text_to_send.blank?
      render json: { error: 'text is required' }, status: :unprocessable_entity
      return
    end

    # AI квалификация - принимаем параметры напрямую из N8N (все на верхнем уровне)
    # Поддержка как старого формата (dbcourse), так и нового (DeliveryBooster)
    qualification_data = {
      # Базовые поля (совместимость с dbcourse)
      real_name: params[:real_name],
      background: params[:background],
      query: params[:query],
      ready_score: params[:ready_score] || params[:ready],

      # DeliveryBooster расширенная квалификация (все поля на верхнем уровне)
      restaurant_name: params[:restaurant_name],
      platform: params[:platform],
      orders_per_day: params[:orders_per_day],
      rating: params[:rating],
      uses_ads: params[:uses_ads],
      main_problem: params[:main_problem],
      urgency: params[:urgency],
      is_new_brand: params[:is_new_brand],
      location: params[:location],

      # PQL и эскалация
      is_pql: params[:is_pql],
      action: params[:action],
      red_flags: params[:red_flags],
      pql_signals: params[:pql_signals]
    }

    Rails.logger.info "Text to send: #{text_to_send[0..100]}..."
    Rails.logger.info "AI qualification: #{qualification_data.inspect}"
    Rails.logger.info "Action: #{params[:action]}, Is PQL: #{params[:is_pql]}"

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
    # Базовые поля (совместимость с dbcourse)
    update_attrs = {
      ai_real_name: qualification_data[:real_name],
      ai_background: qualification_data[:background],
      ai_query: qualification_data[:query],
      ai_ready_score: qualification_data[:ready_score]
    }

    # DeliveryBooster расширенные поля (если есть)
    if qualification_data[:restaurant_name].present? || qualification_data[:action].present?
      update_attrs.merge!(
        ai_restaurant_name: qualification_data[:restaurant_name],
        ai_platform: qualification_data[:platform],
        ai_orders_per_day: qualification_data[:orders_per_day],
        ai_rating: qualification_data[:rating],
        ai_uses_ads: qualification_data[:uses_ads],
        ai_main_problem: qualification_data[:main_problem],
        ai_urgency: qualification_data[:urgency],
        ai_is_new_brand: qualification_data[:is_new_brand],
        ai_location: qualification_data[:location],
        ai_is_pql: qualification_data[:is_pql],
        ai_action: qualification_data[:action],
        ai_red_flags: qualification_data[:red_flags],
        ai_pql_signals: qualification_data[:pql_signals]
      )
    end

    conversation.update!(update_attrs)

    Rails.logger.info "AI qualification saved for conversation #{conversation.id}"

    # Отправляем сообщение через нужный канал (bot или business)
    begin
      if source_type == 'business' && business_connection_id.present?
        # Отправляем через Business Connection
        Rails.logger.info "Sending via Business Connection: #{business_connection_id}"
        result = bot_client.api.send_message(
          business_connection_id: business_connection_id,
          chat_id: telegram_id,
          text: text_to_send,
          parse_mode: 'Markdown'
        )
      else
        # Отправляем через обычного бота
        Rails.logger.info "Sending via Bot"
        result = bot_client.api.send_message(
          chat_id: telegram_id,
          text: text_to_send,
          parse_mode: 'Markdown'
        )
      end

      Rails.logger.info "N8N → Telegram: message sent to user #{user.id}, message_id=#{result.message_id}"

      # Сохраняем в БД как outgoing message (от AI-bot)
      message = conversation.messages.create!(
        body: text_to_send,
        direction: :outgoing,
        source_type: source_type,  # bot или business
        business_connection_id: business_connection_id,  # для business messages
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
        message: message.as_json(include: :user).merge(source_type: source_type),
        conversation: {
          id: conversation.id,
          user: user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
          last_message: message.as_json(only: [:id, :body, :direction, :created_at, :source_type]),
          unread_count: conversation.unread_count,
          last_message_at: conversation.last_message_at,
          # AI Qualification данные для real-time обновления sidebar
          ai_qualification: {
            # Базовые поля
            real_name: conversation.ai_real_name,
            background: conversation.ai_background,
            query: conversation.ai_query,
            ready_score: conversation.ai_ready_score,
            # DeliveryBooster расширенные поля
            restaurant_name: conversation.ai_restaurant_name,
            platform: conversation.ai_platform,
            orders_per_day: conversation.ai_orders_per_day,
            rating: conversation.ai_rating,
            uses_ads: conversation.ai_uses_ads,
            main_problem: conversation.ai_main_problem,
            urgency: conversation.ai_urgency,
            is_new_brand: conversation.ai_is_new_brand,
            location: conversation.ai_location,
            is_pql: conversation.ai_is_pql,
            action: conversation.ai_action,
            red_flags: conversation.ai_red_flags,
            pql_signals: conversation.ai_pql_signals
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
    rescue Telegram::Bot::Exceptions::ResponseError => e
      Rails.logger.error "Telegram API error: #{e.message}"

      # Fallback: попробовать без Markdown если ошибка парсинга
      if e.message.include?('parse') || e.message.include?("can't parse entities")
        begin
          Rails.logger.warn "Markdown parse error detected, retrying without Markdown"

          # Отправляем через тот же канал, но без Markdown
          if source_type == 'business' && business_connection_id.present?
            result = bot_client.api.send_message(
              business_connection_id: business_connection_id,
              chat_id: telegram_id,
              text: text_to_send
            )
          else
            result = bot_client.api.send_message(
              chat_id: telegram_id,
              text: text_to_send
            )
          end

          Rails.logger.info "Successfully sent as plain text (no Markdown)"

          message = conversation.messages.create!(
            body: text_to_send,
            direction: :outgoing,
            source_type: source_type,
            business_connection_id: business_connection_id,
            telegram_message_id: result.message_id,
            read: true,
            user_id: nil
          )

          # Reload and broadcast
          conversation.reload

          ActionCable.server.broadcast("messenger_channel", {
            type: 'new_message',
            conversation_id: conversation.id,
            message: message.as_json(include: :user).merge(source_type: source_type),
            conversation: {
              id: conversation.id,
              user: user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
              last_message: message.as_json(only: [:id, :body, :direction, :created_at, :source_type]),
              unread_count: conversation.unread_count,
              last_message_at: conversation.last_message_at,
              ai_qualification: {
                # Базовые поля
                real_name: conversation.ai_real_name,
                background: conversation.ai_background,
                query: conversation.ai_query,
                ready_score: conversation.ai_ready_score,
                # DeliveryBooster расширенные поля
                restaurant_name: conversation.ai_restaurant_name,
                platform: conversation.ai_platform,
                orders_per_day: conversation.ai_orders_per_day,
                rating: conversation.ai_rating,
                uses_ads: conversation.ai_uses_ads,
                main_problem: conversation.ai_main_problem,
                urgency: conversation.ai_urgency,
                is_new_brand: conversation.ai_is_new_brand,
                location: conversation.ai_location,
                is_pql: conversation.ai_is_pql,
                action: conversation.ai_action,
                red_flags: conversation.ai_red_flags,
                pql_signals: conversation.ai_pql_signals
              },
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
            warning: 'Markdown parse error, sent as plain text'
          }
          return
        rescue => fallback_error
          Rails.logger.error "Fallback also failed: #{fallback_error.message}"
        end
      end

      render json: { error: "Failed to send message: #{e.message}" }, status: :internal_server_error
    rescue StandardError => e
      Rails.logger.error "N8N send_message error: #{e.class.name} - #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")
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
