class User < ApplicationRecord
  has_many :conversations, dependent: :destroy
  has_many :messages
  has_many :business_connections, dependent: :destroy

  # Enums
  enum :crm_status, {
    new_lead: 0,
    contacted: 1,
    qualified: 2,
    interested: 3,
    payment_pending: 4,
    paid_status: 5,
    inactive: 6
  }

  # Scopes
  scope :admins, -> { where(admin: true) }
  scope :authenticated_users, -> { where(authenticated: true) }
  scope :paid_users, -> { where(paid: true) }
  scope :for_crm, -> {
    includes(:conversation)
      .order(Arel.sql('conversations.ai_ready_score DESC NULLS LAST, users.crm_position ASC NULLS LAST'))
  }

  # Callbacks
  after_save :ensure_admin_is_paid
  after_update :update_crm_on_payment, if: :paid_changed?

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

  # CRM: Получить ai_ready_score из conversation
  def ready_score
    conversation&.ai_ready_score
  end

  # CRM: Определить температуру лида на основе ai_ready_score
  def lead_temperature
    score = ready_score
    return :unknown if score.nil?

    if score >= 7
      :hot
    elsif score >= 4
      :warm
    else
      :cold
    end
  end

  # CRM: Emoji для температуры лида
  def temperature_emoji
    case lead_temperature
    when :hot
      "🔥"
    when :warm
      "🌤️"
    when :cold
      "❄️"
    else
      "❓"
    end
  end

  # CRM: Русское название статуса
  def crm_status_label
    {
      new_lead: "Новый лид",
      contacted: "Связались",
      qualified: "Квалифицирован",
      interested: "Интересуется",
      payment_pending: "Ожидает оплату",
      paid_status: "Оплатил",
      inactive: "Неактивен"
    }[crm_status.to_sym]
  end

  # CRM: Цвет для температуры (для UI)
  def temperature_color
    case lead_temperature
    when :hot
      "red"
    when :warm
      "orange"
    when :cold
      "blue"
    else
      "gray"
    end
  end

  private

  # Автоматически устанавливает paid = true для админов
  def ensure_admin_is_paid
    if admin? && !paid?
      update_column(:paid, true)
    end
  end

  # Автоматически переводит в статус "Оплатил" при оплате
  def update_crm_on_payment
    if paid? && !paid_status?
      update_column(:crm_status, User.crm_statuses[:paid_status])
      broadcast_crm_update
    end
  end

  def broadcast_crm_update
    ActionCable.server.broadcast("crm_channel", {
      type: "card_updated",
      user_id: id,
      user: {
        id: id,
        full_name: full_name,
        avatar_url: avatar_url,
        crm_status: crm_status,
        crm_position: crm_position,
        ready_score: ready_score,
        temperature: lead_temperature.to_s,
        temperature_emoji: temperature_emoji,
        messages_count: messages_count
      }
    })
  end
end
