class Message < ApplicationRecord
  belongs_to :conversation
  belongs_to :user, optional: true # nullable для админских сообщений

  # Enum для направления сообщения
  enum :direction, { incoming: 0, outgoing: 1 }

  # Validations
  validates :body, presence: true
  validates :direction, presence: true

  # Scopes
  scope :unread, -> { where(read: false) }
  scope :by_time, -> { order(created_at: :asc) }

  # Callbacks
  after_create :update_conversation_timestamp
  after_create :increment_conversation_unread, if: :incoming?

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
end
