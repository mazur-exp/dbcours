require 'telegram/bot'

class AuthController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:webhook]

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
        render json: { authenticated: true, user: user.as_json(only: [:username, :first_name, :last_name]) }
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
        user: user.as_json(only: [:username, :first_name, :last_name])
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
        render json: { success: true, user: user.as_json(only: [:username, :first_name, :last_name]) }
      else
        render json: { success: false, error: "User not found or not authenticated" }, status: :unauthorized
      end
    else
      render json: { success: false, error: "Session token mismatch" }, status: :unauthorized
    end
  end

  # Завершает сессию пользователя
  def logout
    session[:user_id] = nil
    session[:auth_token] = nil
    redirect_to freecontent_path, notice: "Вы успешно вышли из системы"
  end

  # Webhook от Telegram бота
  def webhook
    update = JSON.parse(request.body.read)

    Rails.logger.info "Telegram webhook received: #{update.inspect}"

    # Обработка команды /start
    if update["message"] && update["message"]["text"]&.start_with?("/start")
      handle_start_command(update["message"])
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
            user: user.as_json(only: [:username, :first_name, :last_name])
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

  def bot_client
    @bot_client ||= Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
  end
end
