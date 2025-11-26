class Conversation < ApplicationRecord
  belongs_to :user
  has_many :messages, dependent: :destroy

  # Callbacks
  after_update :update_user_crm_status, if: :ai_ready_score_changed?

  # Scopes
  scope :recent, -> { order(last_message_at: :desc) }
  scope :with_unread, -> { where('unread_count > 0') }

  # Получить последнее сообщение
  def last_message
    messages.order(created_at: :desc).first
  end

  # Обновить timestamp последнего сообщения
  def touch_last_message!
    update!(last_message_at: Time.current)
  end

  # Инкрементировать счётчик непрочитанных
  def increment_unread!
    increment!(:unread_count)
  end

  # Сбросить счётчик непрочитанных
  def mark_all_read!
    update!(unread_count: 0)
    messages.where(read: false).update_all(read: true)
  end

  private

  def update_user_crm_status
    # При заполнении ai_ready_score: contacted -> qualified
    if ai_ready_score.present? && user.contacted?
      user.qualified!
      broadcast_crm_update
    end

    # Если score высокий (>= 7): qualified/contacted -> interested
    if ai_ready_score && ai_ready_score >= 7 && (user.qualified? || user.contacted?)
      user.interested!
      broadcast_crm_update
    end
  end

  def broadcast_crm_update
    ActionCable.server.broadcast("crm_channel", {
      type: "card_updated",
      user_id: user.id,
      user: {
        id: user.id,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
        crm_status: user.crm_status,
        crm_position: user.crm_position,
        ready_score: user.ready_score,
        temperature: user.lead_temperature.to_s,
        temperature_emoji: user.temperature_emoji,
        messages_count: user.messages_count
      }
    })
  end
end
