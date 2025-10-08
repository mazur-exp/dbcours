class MessengerChannel < ApplicationCable::Channel
  def subscribed
    # Подписываемся на общий канал мессенджера
    stream_from "messenger_channel"
    Rails.logger.info "MessengerChannel: subscribed to messenger_channel"
  end

  def unsubscribed
    Rails.logger.info "MessengerChannel: unsubscribed"
  end

  # Клиент может отправить событие "mark_read"
  def mark_read(data)
    conversation_id = data['conversation_id']
    conversation = Conversation.find_by(id: conversation_id)

    if conversation
      conversation.mark_all_read!
      Rails.logger.info "MessengerChannel: marked conversation #{conversation_id} as read"
    end
  end
end
