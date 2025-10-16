class User < ApplicationRecord
  has_many :conversations, dependent: :destroy
  has_many :messages
  has_many :business_connections, dependent: :destroy

  # Scopes
  scope :admins, -> { where(admin: true) }
  scope :authenticated_users, -> { where(authenticated: true) }
  scope :paid_users, -> { where(paid: true) }

  # Callbacks
  after_save :ensure_admin_is_paid

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

  # Проверка доступа к платному курсу (Dashboard)
  def has_dashboard_access?
    admin? || paid?
  end

  private

  # Автоматически устанавливает paid = true для админов
  def ensure_admin_is_paid
    if admin? && !paid?
      update_column(:paid, true)
    end
  end
end
