require 'telegram/bot'

class AuthController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:webhook]
  before_action :cleanup_stale_session, only: [:start]

  # Генерирует session_token и возвращает Telegram deep link
  def start
    session_token = SecureRandom.hex(16)  # 32 символа вместо 64
    session[:auth_token] = session_token
    session[:auth_started_at] = Time.current

    # Deep link для Telegram
    deep_link = "https://t.me/#{TELEGRAM_BOT_USERNAME}?start=#{session_token}"

    render json: {
      success: true,
      deep_link: deep_link,
      session_token: session_token
    }
  end

  # Проверяет статус авторизации
  def status
    if session[:user_id]
      user = User.find_by(id: session[:user_id])
      if user&.authenticated
        render json: { authenticated: true, user: user.as_json(only: [:username, :first_name, :last_name, :admin]) }
        return
      end
    end

    render json: { authenticated: false }
  end

  # Проверяет авторизацию по session_token
  def check_token
    session_token = params[:session_token]

    user = User.find_by(session_token: session_token, authenticated: true)

    if user && session[:auth_token] == session_token
      session[:user_id] = user.id
      render json: {
        authenticated: true,
        user_id: user.id,
        user: user.as_json(only: [:username, :first_name, :last_name, :admin])
      }
    else
      render json: { authenticated: false }
    end
  end

  # Устанавливает user_id в сессию после получения через WebSocket
  def set_session
    user_id = params[:user_id]
    session_token = params[:session_token]

    # Проверяем что токен совпадает
    if session[:auth_token] == session_token
      user = User.find_by(id: user_id, session_token: session_token, authenticated: true)

      if user
        session[:user_id] = user.id
        render json: { success: true, user: user.as_json(only: [:username, :first_name, :last_name, :admin]) }
      else
        render json: { success: false, error: "User not found or not authenticated" }, status: :unauthorized
      end
    else
      render json: { success: false, error: "Session token mismatch" }, status: :unauthorized
    end
  end

  # Завершает сессию пользователя
  def logout
    reset_session  # Полная очистка всей сессии
    redirect_to freecontent_path, notice: "Вы успешно вышли из системы"
  end

  # Webhook от Telegram бота
  def webhook
    update = JSON.parse(request.body.read)

    Rails.logger.info "Telegram webhook received: #{update.inspect}"

    # Обработка команды /start
    if update["message"] && update["message"]["text"]&.start_with?("/start")
      handle_start_command(update["message"])
    # Обработка обычных текстовых сообщений (для мессенджера)
    elsif update["message"] && update["message"]["text"]
      handle_text_message(update["message"])
    end

    # Обработка callback от inline кнопки
    if update["callback_query"]
      handle_callback_query(update["callback_query"])
    end

    render json: { status: "ok" }
  end

  private

  def handle_start_command(message)
    chat_id = message["chat"]["id"]
    text = message["text"]
    from = message["from"]

    # Извлекаем session_token из команды /start session_token
    session_token = text.split(" ")[1]

    Rails.logger.info "Handle start command: chat_id=#{chat_id}, session_token=#{session_token}"

    if session_token.present?
      # Отправляем сообщение с кнопкой авторизации
      Rails.logger.info "Sending auth message to chat_id=#{chat_id}"
      result = send_auth_message(chat_id, session_token, from)
      Rails.logger.info "Auth message sent result: #{result.inspect}"
    else
      # Если токен не передан - просто приветствие
      Rails.logger.info "Sending welcome message to chat_id=#{chat_id}"
      send_welcome_message(chat_id)
    end
  rescue => e
    Rails.logger.error "Error in handle_start_command: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
  end

  def handle_callback_query(callback_query)
    chat_id = callback_query["message"]["chat"]["id"]
    data = callback_query["data"]
    from = callback_query["from"]

    if data.start_with?("auth:")
      session_token = data.split(":")[1]

      # Находим или создаем пользователя
      user = User.find_or_initialize_by(telegram_id: from["id"])
      user.assign_attributes(
        username: from["username"],
        first_name: from["first_name"],
        last_name: from["last_name"],
        session_token: session_token,
        authenticated: true
      )

      # Получаем и сохраняем аватарку
      avatar_url = fetch_user_avatar(from["id"])
      user.avatar_url = avatar_url if avatar_url

      if user.save
        # Отправляем успешное сообщение
        answer_callback_query(callback_query["id"], "✅ Авторизация успешна!")
        send_success_message(chat_id, user)

        # Сохраняем user_id в сессию (через Redis или другой механизм)
        # Так как это webhook, сессии нет, используем broadcast для передачи user_id

        # Уведомляем браузер через ActionCable
        ActionCable.server.broadcast(
          "auth_channel_#{session_token}",
          {
            type: "authenticated",
            user_id: user.id,
            session_token: session_token,
            user: user.as_json(only: [:username, :first_name, :last_name, :admin])
          }
        )
      else
        answer_callback_query(callback_query["id"], "❌ Ошибка авторизации")
      end
    end
  end

  def send_auth_message(chat_id, session_token, from)
    begin
      reply_markup = {
        inline_keyboard: [
          [
            {
              text: "✅ Авторизоваться",
              callback_data: "auth:#{session_token}"
            }
          ]
        ]
      }.to_json

      result = bot_client.api.send_message(
        chat_id: chat_id,
        text: "👋 Привет, #{from['first_name']}!\n\n📚 Добро пожаловать в *Bali Food Delivery Master*\n\nНажмите кнопку ниже, чтобы авторизоваться и получить доступ к бесплатным урокам.",
        parse_mode: "Markdown",
        reply_markup: reply_markup
      )
      Rails.logger.info "Send message result: #{result.inspect}"
      result
    rescue => e
      Rails.logger.error "Error sending auth message: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      raise
    end
  end

  def send_welcome_message(chat_id)
    bot_client.api.send_message(
      chat_id: chat_id,
      text: "👋 Привет! Это бот для авторизации на платформе Bali Food Delivery Master.\n\nДля авторизации перейдите на сайт и нажмите кнопку 'Авторизация'.",
      parse_mode: "Markdown"
    )
  end

  def send_success_message(chat_id, user)
    bot_client.api.send_message(
      chat_id: chat_id,
      text: "✅ *Авторизация успешна!*\n\nДобро пожаловать, #{user.first_name}!\n\nТеперь вы можете вернуться на сайт и начать обучение. 🎓",
      parse_mode: "Markdown"
    )
  end

  def answer_callback_query(callback_query_id, text)
    bot_client.api.answer_callback_query(
      callback_query_id: callback_query_id,
      text: text
    )
  end

  def handle_text_message(message)
    telegram_id = message["from"]["id"]
    user = User.find_by(telegram_id: telegram_id, authenticated: true)

    # Игнорируем сообщения от неавторизованных пользователей
    return unless user

    # Обновляем аватарку если её нет или прошло время
    if user.avatar_url.blank? || user.updated_at < 1.day.ago
      avatar_url = fetch_user_avatar(telegram_id)
      user.update(avatar_url: avatar_url) if avatar_url
    end

    Rails.logger.info "Handle text message from user_id=#{user.id}: #{message['text']}"

    # Находим или создаём беседу
    conversation = user.conversation

    # Создаём сообщение
    msg = conversation.messages.create!(
      user: user,
      body: message["text"],
      direction: :incoming,
      telegram_message_id: message["message_id"],
      read: false
    )

    Rails.logger.info "Message created: #{msg.id}"

    # Reload conversation для получения актуального last_message_at и unread_count
    conversation.reload

    # Broadcast через ActionCable для real-time обновления
    ActionCable.server.broadcast("messenger_channel", {
      type: "new_message",
      conversation_id: conversation.id,
      message: msg.as_json(include: :user),
      conversation: {
        id: conversation.id,
        user: conversation.user.as_json(only: [:id, :first_name, :last_name, :username]),
        last_message: msg.as_json(only: [:id, :body, :direction, :created_at]),
        unread_count: conversation.unread_count,
        last_message_at: conversation.last_message_at
      }
    })
  rescue => e
    Rails.logger.error "Error in handle_text_message: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
  end

  def bot_client
    @bot_client ||= Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
  end

  def fetch_user_avatar(telegram_id)
    begin
      # Получаем фотографии профиля пользователя
      photos = bot_client.api.get_user_profile_photos(user_id: telegram_id, limit: 1)

      if photos && photos.photos && photos.photos.any?
        # Берем первое фото в наилучшем качестве (последний элемент массива - самое большое разрешение)
        photo_sizes = photos.photos[0]
        photo = photo_sizes.last if photo_sizes.any?

        if photo && photo.file_id
          # Получаем информацию о файле
          file_info = bot_client.api.get_file(file_id: photo.file_id)

          if file_info && file_info.file_path
            # Формируем URL для скачивания
            return "https://api.telegram.org/file/bot#{TELEGRAM_BOT_TOKEN}/#{file_info.file_path}"
          end
        end
      end
    rescue => e
      Rails.logger.error "Failed to fetch user avatar: #{e.message}"
    end

    nil # Возвращаем nil если не удалось получить аватарку
  end

  def cleanup_stale_session
    # Очищаем старую сессию если прошло больше 5 минут
    if session[:auth_token] && session[:auth_started_at]
      if Time.current - session[:auth_started_at].to_time > 5.minutes
        session.delete(:auth_token)
        session.delete(:auth_started_at)
        session.delete(:user_id)
        Rails.logger.info "Cleaned up stale session"
      end
    end
  end
end
