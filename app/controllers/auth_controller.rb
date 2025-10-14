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

    Rails.logger.info "Telegram webhook received: #{update.keys.join(', ')}"

    # Обработка Business Connection updates
    if update["business_connection"]
      handle_business_connection(update["business_connection"])
    end

    # Обработка Business Messages
    if update["business_message"]
      handle_business_message(update["business_message"], update["business_message"]["business_connection_id"])
    end

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

      # Получаем и сохраняем аватарку (с повторной попыткой при неудаче)
      avatar_url = fetch_user_avatar(from["id"])
      # Если не получили с первого раза - попробуем ещё раз через 1 секунду
      if avatar_url.nil?
        sleep(1)
        avatar_url = fetch_user_avatar(from["id"])
        Rails.logger.info "Retried fetching avatar for user #{from["id"]}, result: #{avatar_url.present? ? 'success' : 'failed'}"
      end
      user.avatar_url = avatar_url if avatar_url

      if user.save
        # Отправляем успешное сообщение
        answer_callback_query(callback_query["id"], "✅ Авторизация успешна!")

        # Текст приветственного сообщения
        welcome_text = "✅ *Авторизация успешна!*\n\nДобро пожаловать, #{user.first_name}!\n\nТеперь вы можете вернуться на сайт и начать обучение. 🎓"

        # Отправляем сообщение в Telegram
        telegram_result = send_success_message(chat_id, user)

        # Создаём или получаем беседу для пользователя
        conversation = user.conversation

        # Сохраняем приветственное сообщение в БД как первое сообщение от админа
        welcome_message = conversation.messages.create!(
          body: welcome_text,
          direction: :outgoing,
          telegram_message_id: telegram_result&.message_id,
          read: true,
          user_id: nil # от админа
        )

        Rails.logger.info "Created conversation #{conversation.id} and welcome message #{welcome_message.id} for user #{user.id}"

        # Reload conversation для получения актуального last_message_at
        conversation.reload

        # Broadcast через messenger_channel для появления чата у админа
        ActionCable.server.broadcast("messenger_channel", {
          type: "new_message",
          conversation_id: conversation.id,
          message: welcome_message.as_json(include: :user),
          conversation: {
            id: conversation.id,
            user: user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
            last_message: welcome_message.as_json(only: [:id, :body, :direction, :created_at]),
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

        Rails.logger.info "Broadcasted new conversation #{conversation.id} to messenger_channel"

        # Уведомляем браузер через ActionCable об успешной авторизации
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
    result = bot_client.api.send_message(
      chat_id: chat_id,
      text: "✅ *Авторизация успешна!*\n\nДобро пожаловать, #{user.first_name}!\n\nТеперь вы можете вернуться на сайт и начать обучение. 🎓",
      parse_mode: "Markdown"
    )
    Rails.logger.info "Success message sent to chat_id=#{chat_id}, message_id=#{result.message_id}"
    result
  end

  def answer_callback_query(callback_query_id, text)
    bot_client.api.answer_callback_query(
      callback_query_id: callback_query_id,
      text: text
    )
  end

  def handle_text_message(message)
    telegram_id = message["from"]["id"]
    from = message["from"]

    # Находим или создаем пользователя (без проверки authenticated)
    user = User.find_or_initialize_by(telegram_id: telegram_id)

    # Если пользователь новый или данные устарели - обновляем
    if user.new_record? || user.updated_at < 1.day.ago
      user.assign_attributes(
        username: from["username"],
        first_name: from["first_name"],
        last_name: from["last_name"]
      )

      # Получаем аватарку
      avatar_url = fetch_user_avatar(telegram_id)
      user.avatar_url = avatar_url if avatar_url

      user.save!
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

    # Проверяем, не на паузе ли AI для этой беседы
    if conversation.ai_paused
      Rails.logger.info "🚫 AI paused for conversation #{conversation.id}, skipping N8N webhook"
    else
      # Устанавливаем флаг что AI обрабатывает сообщение
      conversation.update!(ai_processing: true)

      # Отправляем первый typing indicator сразу
      send_typing_action(telegram_id)

      # Запускаем фоновую задачу для продолжения typing индикатора
      TypingIndicatorJob.set(wait: 4.seconds).perform_later(conversation.id)

      # Отправляем сообщение на N8N
      send_message_to_n8n(msg, user, conversation)
    end

    # Broadcast через ActionCable для real-time обновления
    ActionCable.server.broadcast("messenger_channel", {
      type: "new_message",
      conversation_id: conversation.id,
      message: msg.as_json(include: :user),
      conversation: {
        id: conversation.id,
        user: conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
        last_message: msg.as_json(only: [:id, :body, :direction, :created_at]),
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
  rescue => e
    Rails.logger.error "Error in handle_text_message: #{e.message}"
    Rails.logger.error e.backtrace.join("\n")
  end

  def send_message_to_n8n(message, user, conversation)
    return if N8N_WEBHOOK_URL.blank?

    begin
      require 'net/http'
      require 'json'

      uri = URI(N8N_WEBHOOK_URL)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.open_timeout = 5
      http.read_timeout = 5

      request = Net::HTTP::Post.new(uri.path)
      request['Authorization'] = "Bearer #{N8N_API_TOKEN}" if N8N_API_TOKEN.present?
      request['Content-Type'] = 'application/json'

      # Получаем callback URL из credentials (автоматически dev/prod)
      api_base_url = Rails.application.credentials.dig(:telegram, :api_base_url)
      callback_url = "#{api_base_url}/api/n8n/send_message"

      payload = {
        event: 'message_received',
        message_id: message.id,
        telegram_message_id: message.telegram_message_id,
        text: message.body,
        timestamp: message.created_at.iso8601,
        conversation_id: conversation.id,
        callback_url: callback_url,
        source_type: message.source_type,  # bot or business
        business_connection_id: message.business_connection_id,  # для business messages
        user: {
          id: user.id,
          telegram_id: user.telegram_id,
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name,
          avatar_url: user.avatar_url
        },
        conversation_history: format_conversation_history(conversation)
      }

      request.body = payload.to_json

      response = http.request(request)

      if response.is_a?(Net::HTTPSuccess)
        Rails.logger.info "N8N webhook sent successfully for message #{message.id}"
      else
        Rails.logger.warn "N8N webhook failed: HTTP #{response.code} - #{response.body}"
      end
    rescue => e
      Rails.logger.error "N8N webhook error for message #{message.id}: #{e.message}"
    end
  end

  def format_conversation_history(conversation)
    # Получаем последние 50 сообщений, сортируем от старых к новым
    messages = conversation.messages
                          .order(created_at: :desc)
                          .limit(50)
                          .reverse

    # Форматируем каждое сообщение
    formatted_messages = messages.map do |msg|
      # Определяем отправителя
      sender = if msg.outgoing?
                 "Сотрудник"
               else
                 "Клиент #{conversation.user.first_name}"
               end

      # Форматируем время
      timestamp = msg.created_at.strftime("%Y-%m-%d %H:%M")

      # Собираем строку
      "[#{timestamp}] #{sender}: #{msg.body}"
    end

    # Объединяем все сообщения с переносами строк
    formatted_messages.join("\n")
  end

  def send_typing_action(telegram_id)
    begin
      bot_client.api.send_chat_action(
        chat_id: telegram_id,
        action: 'typing'
      )
      Rails.logger.info "Typing action sent to telegram_id=#{telegram_id}"
    rescue => e
      Rails.logger.error "Failed to send typing action: #{e.message}"
    end
  end

  def handle_business_connection(connection_data)
    business_connection_id = connection_data["id"]
    user_data = connection_data["user"]
    user_chat_id = connection_data["user_chat_id"]
    can_reply = connection_data["can_reply"]
    is_enabled = connection_data["is_enabled"]
    date = connection_data["date"]

    Rails.logger.info "Business connection update: #{business_connection_id}, user: #{user_data['id']}, can_reply: #{can_reply}"

    # Находим или создаём пользователя
    user = User.find_or_initialize_by(telegram_id: user_data["id"])
    user.assign_attributes(
      username: user_data["username"],
      first_name: user_data["first_name"],
      last_name: user_data["last_name"]
    )
    user.save!

    # Находим или создаём business connection
    business_conn = BusinessConnection.find_or_initialize_by(
      business_connection_id: business_connection_id
    )

    business_conn.assign_attributes(
      user: user,
      user_chat_id: user_chat_id,
      can_reply: can_reply,
      is_enabled: is_enabled,
      connected_at: Time.at(date),
      status: is_enabled ? :active : :disconnected,
      disconnected_at: is_enabled ? nil : Time.current
    )

    business_conn.save!

    Rails.logger.info "Business connection #{is_enabled ? 'established' : 'disconnected'} for user #{user.id}"
  end

  def handle_business_message(message, business_connection_id)
    from = message["from"]
    text = message["text"]
    message_id = message["message_id"]

    Rails.logger.info "📨 Business message from #{from['id']}: #{text}"
    Rails.logger.info "📨 Business connection ID: #{business_connection_id}"

    # Находим business connection
    business_conn = BusinessConnection.find_by(business_connection_id: business_connection_id)

    unless business_conn
      Rails.logger.warn "❌ Business connection not found: #{business_connection_id}"
      return
    end

    # КРИТИЧЕСКАЯ ПРОВЕРКА: Игнорируем сообщения от owner бизнес-аккаунта
    # Owner пишет своим клиентам → эти сообщения НЕ должны попадать в messenger
    if from["id"] == business_conn.user.telegram_id
      Rails.logger.info "⏭️  Ignoring business message from owner (#{from['id']})"
      return
    end

    Rails.logger.info "✅ Business message from customer (not owner)"

    # Находим или создаём пользователя
    user = User.find_or_initialize_by(telegram_id: from["id"])
    user.assign_attributes(
      username: from["username"],
      first_name: from["first_name"],
      last_name: from["last_name"]
    )
    user.save!

    # Находим или создаём беседу
    conversation = user.conversation

    # Сохраняем сообщение с source_type: business
    msg = conversation.messages.create!(
      user: user,
      body: text,
      direction: :incoming,
      telegram_message_id: message_id,
      source_type: :business,  # ← КЛЮЧЕВОЕ ОТЛИЧИЕ от обычных сообщений
      business_connection_id: business_connection_id,
      read: false
    )

    Rails.logger.info "Business message created: #{msg.id}, source: business"

    conversation.reload

    # Проверяем, не на паузе ли AI для этой беседы
    if conversation.ai_paused
      Rails.logger.info "🚫 AI paused for conversation #{conversation.id}, skipping N8N webhook"
    else
      # Устанавливаем флаг AI обработки (typing indicator)
      conversation.update!(ai_processing: true)
      send_typing_action(user.telegram_id)
      TypingIndicatorJob.set(wait: 4.seconds).perform_later(conversation.id)

      # Отправляем в N8N (как обычно)
      send_message_to_n8n(msg, user, conversation)
    end

    # Broadcast в messenger с указанием source_type
    ActionCable.server.broadcast("messenger_channel", {
      type: "new_message",
      conversation_id: conversation.id,
      message: msg.as_json(include: :user).merge(source_type: 'business'),  # добавляем source_type
      conversation: {
        id: conversation.id,
        user: conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
        last_message: msg.as_json(only: [:id, :body, :direction, :created_at, :source_type]),
        unread_count: conversation.unread_count,
        last_message_at: conversation.last_message_at,
        ai_qualification: {
          real_name: conversation.ai_real_name,
          background: conversation.ai_background,
          query: conversation.ai_query,
          ready_score: conversation.ai_ready_score
        },
        statistics: {
          total_messages: conversation.messages.count,
          incoming_count: conversation.messages.incoming.count,
          outgoing_count: conversation.messages.outgoing.count
        }
      }
    })
  rescue => e
    Rails.logger.error "Error in handle_business_message: #{e.message}"
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
            # Получаем временный URL из Telegram
            telegram_url = "https://api.telegram.org/file/bot#{TELEGRAM_BOT_TOKEN}/#{file_info.file_path}"

            # Скачиваем и сохраняем локально
            return download_and_store_avatar(telegram_id, telegram_url)
          end
        end
      end
    rescue => e
      Rails.logger.error "Failed to fetch user avatar: #{e.message}"
    end

    nil # Возвращаем nil если не удалось получить аватарку
  end

  def download_and_store_avatar(telegram_id, telegram_url)
    require 'open-uri'

    begin
      # Скачиваем изображение из Telegram
      image_data = URI.open(telegram_url, read_timeout: 10).read

      # Создаем папку если её нет
      avatar_dir = Rails.root.join('public', 'avatars')
      FileUtils.mkdir_p(avatar_dir) unless Dir.exist?(avatar_dir)

      # Определяем расширение файла из URL
      extension = telegram_url.match(/\.(jpg|jpeg|png|gif|webp)/i)&.captures&.first || 'jpg'
      filename = "#{telegram_id}.#{extension}"
      filepath = avatar_dir.join(filename)

      # Сохраняем файл
      File.write(filepath, image_data, mode: 'wb')

      Rails.logger.info "✅ Avatar saved for user #{telegram_id}: /avatars/#{filename}"

      # Возвращаем публичный URL
      return "/avatars/#{filename}"

    rescue OpenURI::HTTPError => e
      Rails.logger.error "HTTP error downloading avatar for #{telegram_id}: #{e.message}"
      return nil
    rescue => e
      Rails.logger.error "Failed to download and store avatar for #{telegram_id}: #{e.message}"
      return nil
    end
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
