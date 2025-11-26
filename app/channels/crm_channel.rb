class CrmChannel < ApplicationCable::Channel
  def subscribed
    # Подписываемся на канал CRM (страница уже защищена через require_admin)
    stream_from "crm_channel"
    Rails.logger.info "CrmChannel: subscribed to crm_channel"
  end

  def unsubscribed
    Rails.logger.info "CrmChannel: unsubscribed"
  end
end
