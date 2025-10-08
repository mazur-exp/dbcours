class AuthChannel < ApplicationCable::Channel
  def subscribed
    session_token = params[:session_token]
    if session_token.present?
      stream_from "auth_channel_#{session_token}"
      Rails.logger.info "AuthChannel: subscribed to auth_channel_#{session_token}"
    else
      reject
    end
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
    Rails.logger.info "AuthChannel: unsubscribed"
  end
end
