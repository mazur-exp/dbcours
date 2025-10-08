class Conversation < ApplicationRecord
  belongs_to :user
  has_many :messages, dependent: :destroy

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
end
