require 'telegram/bot'

class MessengerController < ApplicationController
  before_action :require_admin
  before_action :set_conversation, only: [:messages, :send_message, :mark_read]

  def index
    @conversations = Conversation.includes(:user, :messages)
                                 .recent
                                 .limit(50)

    # Выбираем активную беседу по параметру или первую
    @active_conversation = if params[:conversation_id]
                            @conversations.find_by(id: params[:conversation_id])
                          else
                            @conversations.first
                          end

    @active_user = @active_conversation&.user
    @messages = @active_conversation&.messages&.by_time || []

    # Отмечаем сообщения как прочитанные
    @active_conversation&.mark_all_read!
  end

  # GET /messenger/conversations/:id/messages
  def messages
    @messages = @conversation.messages.by_time
    render json: {
      messages: @messages.as_json(include: :user),
      user: @conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url, :created_at])
    }
  end

  # POST /messenger/conversations/:id/messages
  def send_message
    body = params[:body]
    source_type = params[:source_type] || 'bot'  # 'bot' или 'business'

    if body.blank?
      render json: { error: 'Message cannot be blank' }, status: :unprocessable_entity
      return
    end

    # Определяем через какой канал отправлять
    if source_type == 'business'
      send_via_business_connection(body)
    else
      send_via_bot(body)
    end
  end

  # PATCH /messenger/conversations/:id/mark_read
  def mark_read
    @conversation.mark_all_read!
    render json: { success: true }
  end

  # DELETE /messenger/users/:id
  def delete_user
    # Дополнительная проверка прав админа
    unless @current_user&.admin?
      redirect_to messenger_path, alert: 'У вас нет прав для выполнения этого действия'
      return
    end

    @user_to_delete = User.find_by(id: params[:id])

    if @user_to_delete.nil?
      redirect_to messenger_path, alert: 'Пользователь не найден'
      return
    end

    # Не позволяем удалить самого себя
    if @user_to_delete == @current_user
      redirect_to messenger_path, alert: 'Вы не можете удалить свой аккаунт'
      return
    end

    username = @user_to_delete.full_name

    # Удаляем пользователя (каскадно удалятся conversations и messages благодаря dependent: :destroy)
    @user_to_delete.destroy

    redirect_to messenger_path, notice: "Пользователь #{username} и вся связанная информация успешно удалены"
  end

  private

  def send_via_bot(body)
    # Отправляем сообщение через Telegram Bot API
    begin
      result = bot_client.api.send_message(
        chat_id: @conversation.user.telegram_id,
        text: body
      )

      Rails.logger.info "Telegram API response: #{result.inspect}"

      # Сохраняем сообщение в БД
      # result - это объект Telegram::Bot::Types::Message
      message = @conversation.messages.create!(
        body: body,
        direction: :outgoing,
        telegram_message_id: result.message_id,
        source_type: :bot,  # отправлено через бота
        read: true,
        user_id: nil # от админа
      )

      # Reload conversation
      @conversation.reload

      # Broadcast
      ActionCable.server.broadcast("messenger_channel", {
        type: 'new_message',
        conversation_id: @conversation.id,
        message: message.as_json(include: :user).merge(source_type: 'bot'),
        conversation: {
          id: @conversation.id,
          user: @conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
          last_message: message.as_json(only: [:id, :body, :direction, :created_at, :source_type]),
          unread_count: @conversation.unread_count,
          last_message_at: @conversation.last_message_at,
          ai_qualification: {
            real_name: @conversation.ai_real_name,
            background: @conversation.ai_background,
            query: @conversation.ai_query,
            ready_score: @conversation.ai_ready_score
          },
          statistics: {
            total_messages: @conversation.messages.count,
            incoming_count: @conversation.messages.incoming.count,
            outgoing_count: @conversation.messages.outgoing.count
          }
        }
      })

      render json: { success: true, message: message.as_json }
    rescue => e
      Rails.logger.error "Failed to send bot message: #{e.message}"
      render json: { error: 'Failed to send message' }, status: :unprocessable_entity
    end
  end

  # PATCH /messenger/conversations/:id/mark_read
  def mark_read
    @conversation.mark_all_read!
    render json: { success: true }
  end

  # DELETE /messenger/users/:id
  def delete_user
    # Дополнительная проверка прав админа
    unless @current_user&.admin?
      redirect_to messenger_path, alert: 'У вас нет прав для выполнения этого действия'
      return
    end

    @user_to_delete = User.find_by(id: params[:id])

    if @user_to_delete.nil?
      redirect_to messenger_path, alert: 'Пользователь не найден'
      return
    end

    # Не позволяем удалить самого себя
    if @user_to_delete == @current_user
      redirect_to messenger_path, alert: 'Вы не можете удалить свой аккаунт'
      return
    end

    username = @user_to_delete.full_name

    # Удаляем пользователя (каскадно удалятся conversations и messages благодаря dependent: :destroy)
    @user_to_delete.destroy

    redirect_to messenger_path, notice: "Пользователь #{username} и вся связанная информация успешно удалены"
  end

  def send_via_business_connection(body)
    # Находим активный business connection для пользователя
    business_conn = @conversation.user.business_connections.active_connections.first

    unless business_conn&.can_send_messages?
      render json: { error: 'No active business connection or cannot reply' }, status: :unprocessable_entity
      return
    end

    begin
      # Отправляем через Business Connection API
      result = bot_client.api.send_business_message(
        business_connection_id: business_conn.business_connection_id,
        chat_id: business_conn.user_chat_id,
        text: body
      )

      Rails.logger.info "Business message sent: #{result.inspect}"

      # Сохраняем в БД как business message
      message = @conversation.messages.create!(
        body: body,
        direction: :outgoing,
        telegram_message_id: result.message_id,
        source_type: :business,  # отправлено через business
        business_connection_id: business_conn.business_connection_id,
        read: true,
        user_id: nil # от админа через business
      )

      # Reload и broadcast
      @conversation.reload

      ActionCable.server.broadcast("messenger_channel", {
        type: 'new_message',
        conversation_id: @conversation.id,
        message: message.as_json(include: :user).merge(source_type: 'business'),
        conversation: {
          id: @conversation.id,
          user: @conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
          last_message: message.as_json(only: [:id, :body, :direction, :created_at, :source_type]),
          unread_count: @conversation.unread_count,
          last_message_at: @conversation.last_message_at,
          ai_qualification: {
            real_name: @conversation.ai_real_name,
            background: @conversation.ai_background,
            query: @conversation.ai_query,
            ready_score: @conversation.ai_ready_score
          },
          statistics: {
            total_messages: @conversation.messages.count,
            incoming_count: @conversation.messages.incoming.count,
            outgoing_count: @conversation.messages.outgoing.count
          }
        }
      })

      render json: { success: true, message: message.as_json }
    rescue => e
      Rails.logger.error "Failed to send business message: #{e.message}"
      render json: { error: 'Failed to send business message' }, status: :unprocessable_entity
    end
  end

  def require_admin
    unless @current_user&.admin?
      redirect_to root_path, alert: 'Access denied'
    end
  end

  def set_conversation
    @conversation = Conversation.find(params[:id])
  end

  def bot_client
    @bot_client ||= Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
  end
end
