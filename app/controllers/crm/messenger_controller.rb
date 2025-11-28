# frozen_string_literal: true

require "telegram/bot"

module Crm
  class MessengerController < BaseController
    before_action :set_conversation, only: [ :messages, :send_message, :mark_read, :toggle_ai_pause ]

    def index
      @conversations = Conversation.includes(:user, :messages)
                                   .recent
                                   .limit(50)

      @active_conversation = if params[:conversation_id]
                              @conversations.find_by(id: params[:conversation_id])
                             else
                              @conversations.first
                             end

      @active_user = @active_conversation&.user
      @messages = @active_conversation&.messages&.by_time || []

      @active_conversation&.mark_all_read!
    end

    def messages
      @messages = @conversation.messages.by_time
      render json: {
        messages: @messages.as_json(include: :user),
        user: @conversation.user.as_json(only: [ :id, :first_name, :last_name, :username, :avatar_url, :created_at ])
      }
    end

    def send_message
      body = params[:body]

      if body.blank?
        render json: { error: "Message cannot be blank" }, status: :unprocessable_entity
        return
      end

      source_type = params[:source_type] || "bot"

      Rails.logger.info "Sending message via #{source_type} channel"

      if source_type.to_s == "business"
        send_via_business_connection(body)
      else
        send_via_bot(body)
      end
    end

    def mark_read
      @conversation.mark_all_read!
      render json: { success: true }
    end

    def toggle_ai_pause
      @conversation.update!(ai_paused: !@conversation.ai_paused)

      Rails.logger.info "AI #{@conversation.ai_paused ? 'paused' : 'resumed'} for conversation #{@conversation.id}"

      ActionCable.server.broadcast("messenger_channel", {
        type: "ai_pause_toggled",
        conversation_id: @conversation.id,
        ai_paused: @conversation.ai_paused
      })

      render json: {
        success: true,
        ai_paused: @conversation.ai_paused,
        message: @conversation.ai_paused ? "AI приостановлен" : "AI активирован"
      }
    end

    def delete_user
      @user_to_delete = User.find_by(id: params[:id])

      if @user_to_delete.nil?
        redirect_to crm_messenger_path, alert: "Пользователь не найден"
        return
      end

      if @user_to_delete == @current_user
        redirect_to crm_messenger_path, alert: "Вы не можете удалить свой аккаунт"
        return
      end

      username = @user_to_delete.full_name
      @user_to_delete.destroy

      redirect_to crm_messenger_path, notice: "Пользователь #{username} и вся связанная информация успешно удалены"
    end

    private

    def send_via_bot(body)
      begin
        result = bot_client.api.send_message(
          chat_id: @conversation.user.telegram_id,
          text: body
        )

        Rails.logger.info "Telegram API response: #{result.inspect}"

        message = @conversation.messages.create!(
          body: body,
          direction: :outgoing,
          telegram_message_id: result.message_id,
          source_type: :bot,
          read: true,
          user_id: nil
        )

        @conversation.reload

        ActionCable.server.broadcast("messenger_channel", {
          type: "new_message",
          conversation_id: @conversation.id,
          message: message.as_json(include: :user).merge(source_type: "bot"),
          conversation: build_conversation_json(message)
        })

        render json: { success: true, message: message.as_json }
      rescue => e
        Rails.logger.error "Failed to send bot message: #{e.message}"
        render json: { error: "Failed to send message" }, status: :unprocessable_entity
      end
    end

    def send_via_business_connection(body)
      last_business_msg = @conversation.messages.incoming.where(source_type: :business).order(created_at: :desc).first

      Rails.logger.info "Looking for business connection from last incoming business message"
      Rails.logger.info "Last business message: #{last_business_msg.inspect}"

      unless last_business_msg&.business_connection_id
        Rails.logger.error "No business messages found in this conversation"
        render json: { error: "No business connection ID found in conversation. Client did not write through business account." }, status: :unprocessable_entity
        return
      end

      business_conn = BusinessConnection.find_by(business_connection_id: last_business_msg.business_connection_id)

      Rails.logger.info "Business connection found: #{business_conn.inspect}"

      unless business_conn
        Rails.logger.error "Business connection not found by ID: #{last_business_msg.business_connection_id}"
        render json: { error: "Business connection not found" }, status: :unprocessable_entity
        return
      end

      Rails.logger.info "Using business connection: #{business_conn.business_connection_id}, user_chat_id: #{business_conn.user_chat_id}"

      begin
        result = bot_client.api.send_message(
          business_connection_id: business_conn.business_connection_id,
          chat_id: @conversation.user.telegram_id,
          text: body
        )

        Rails.logger.info "Business message sent: #{result.inspect}"

        message = @conversation.messages.create!(
          body: body,
          direction: :outgoing,
          telegram_message_id: result.message_id,
          source_type: :business,
          business_connection_id: business_conn.business_connection_id,
          read: true,
          user_id: nil
        )

        @conversation.reload

        ActionCable.server.broadcast("messenger_channel", {
          type: "new_message",
          conversation_id: @conversation.id,
          message: message.as_json(include: :user).merge(source_type: "business"),
          conversation: build_conversation_json(message)
        })

        render json: { success: true, message: message.as_json }
      rescue => e
        Rails.logger.error "Failed to send business message: #{e.class} - #{e.message}"
        Rails.logger.error "Backtrace: #{e.backtrace.first(5).join("\n")}"
        render json: { error: "Failed to send business message: #{e.message}" }, status: :unprocessable_entity
      end
    end

    def build_conversation_json(message)
      {
        id: @conversation.id,
        user: @conversation.user.as_json(only: [ :id, :first_name, :last_name, :username, :avatar_url ]),
        last_message: message.as_json(only: [ :id, :body, :direction, :created_at, :source_type ]),
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
    end

    def set_conversation
      @conversation = Conversation.find(params[:id])
    end

    def bot_client
      @bot_client ||= Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)
    end
  end
end
