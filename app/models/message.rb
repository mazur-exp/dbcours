class Message < ApplicationRecord
  belongs_to :conversation
  belongs_to :user, optional: true # nullable для админских сообщений
  belongs_to :business_connection, optional: true

  # Enum для направления сообщения
  enum :direction, { incoming: 0, outgoing: 1 }

  # Enum для источника сообщения
  enum :source_type, { bot: 0, business: 1 }

  # Validations
  validates :body, presence: true
  validates :direction, presence: true
  validates :source_type, presence: true

  # Scopes
  scope :unread, -> { where(read: false) }
  scope :by_time, -> { order(created_at: :asc) }
  scope :from_bot, -> { where(source_type: :bot) }
  scope :from_business, -> { where(source_type: :business) }

  # Callbacks
  after_create :update_conversation_timestamp
  after_create :increment_conversation_unread, if: :incoming?
  after_create :update_crm_status, if: :from_user?

  # Проверка является ли сообщение от админа
  def from_admin?
    outgoing? && user_id.nil?
  end

  # Проверка является ли сообщение от пользователя
  def from_user?
    incoming? && user_id.present?
  end

  private

  def update_conversation_timestamp
    conversation.touch_last_message!
  end

  def increment_conversation_unread
    conversation.increment_unread!
  end

  def update_crm_status
    return unless user

    # Первое сообщение от пользователя: new_lead -> contacted
    if user.new_lead? && user.messages.where(direction: :incoming).count == 1
      user.contacted!
      broadcast_crm_update(user)
    end
  end

  def broadcast_crm_update(user)
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
