class BusinessConnection < ApplicationRecord
  belongs_to :user

  # Enum для статуса connection
  enum :status, { active: 0, disconnected: 1 }

  # Scopes
  scope :active_connections, -> { where(status: :active) }
  scope :recent, -> { order(connected_at: :desc) }

  # Validations
  validates :business_connection_id, presence: true, uniqueness: true
  validates :user_chat_id, presence: true
  validates :connected_at, presence: true

  # Проверка может ли бот отвечать
  def can_send_messages?
    active? && can_reply && is_enabled
  end

  # Деактивация connection
  def disconnect!
    update!(
      status: :disconnected,
      disconnected_at: Time.current,
      is_enabled: false
    )
  end
end
