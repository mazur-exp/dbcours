class User < ApplicationRecord
  has_many :conversations, dependent: :destroy
  has_many :messages

  # Scopes
  scope :admins, -> { where(admin: true) }
  scope :authenticated_users, -> { where(authenticated: true) }

  # Получить или создать беседу для этого пользователя
  def conversation
    conversations.first_or_create!
  end

  # Полное имя пользователя
  def full_name
    [first_name, last_name].compact.join(' ').presence || 'Пользователь'
  end

  # Количество отправленных сообщений
  def messages_count
    conversation&.messages&.where(direction: :incoming)&.count || 0
  end
end
