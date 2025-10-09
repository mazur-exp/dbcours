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

    if body.blank?
      render json: { error: 'Message cannot be blank' }, status: :unprocessable_entity
      return
    end

    # Отправляем сообщение через Telegram API
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
        telegram_message_id: result.message_id, # используем атрибут объекта, а не хэш
        read: true,
        user_id: nil # от админа
      )

      # Reload conversation для получения актуального last_message_at
      @conversation.reload

      # Broadcast через ActionCable
      ActionCable.server.broadcast("messenger_channel", {
        type: 'new_message',
        conversation_id: @conversation.id,
        message: message.as_json(include: :user),
        conversation: {
          id: @conversation.id,
          user: @conversation.user.as_json(only: [:id, :first_name, :last_name, :username, :avatar_url]),
          last_message: message.as_json(only: [:id, :body, :direction, :created_at]),
          unread_count: @conversation.unread_count,
          last_message_at: @conversation.last_message_at
        }
      })

      render json: { success: true, message: message.as_json }
    rescue => e
      Rails.logger.error "Failed to send message: #{e.message}"
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

  private

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
