class AiChatChannel < ApplicationCable::Channel
  def subscribed
    session_id = params[:session_id]
    if session_id.present?
      stream_from "ai_chat_channel_#{session_id}"
      Rails.logger.info "AiChatChannel: subscribed to ai_chat_channel_#{session_id}"
    else
      reject
    end
  end

  def unsubscribed
    Rails.logger.info "AiChatChannel: unsubscribed"
  end
end
