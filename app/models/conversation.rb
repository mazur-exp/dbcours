class Conversation < ApplicationRecord
  belongs_to :user
  has_many :messages, dependent: :destroy

  # Callbacks
  after_update :update_user_crm_status, if: :ai_ready_score_changed?
  after_update :handle_delivery_booster_escalation, if: :ai_action_changed?

  # Scopes
  scope :recent, -> { order(last_message_at: :desc) }
  scope :with_unread, -> { where('unread_count > 0') }
  scope :needs_escalation, -> { where(ai_action: ['escalate', 'schedule_call']) }
  scope :pql_leads, -> { where(ai_is_pql: true) }

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

  # DeliveryBooster: Обработка эскалации
  def handle_delivery_booster_escalation
    return unless ai_action.present?

    case ai_action
    when 'escalate'
      # Горячий лид - уведомить Милану
      notify_milana_telegram!
      user.interested! if user.may_interested?
      broadcast_crm_update
      Rails.logger.info "[DeliveryBooster] Escalation triggered for conversation #{id}"
    when 'schedule_call'
      # Готов к созвону - уведомить + отправить ссылку
      notify_milana_telegram!
      send_booking_link_to_user!
      user.interested! if user.may_interested?
      broadcast_crm_update
      Rails.logger.info "[DeliveryBooster] Schedule call triggered for conversation #{id}"
    end
  end

  # Уведомление Миланы через Telegram
  def notify_milana_telegram!
    return unless defined?(MILANA_TELEGRAM_ID) && MILANA_TELEGRAM_ID.present?

    bot = Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)

    message = build_escalation_message

    begin
      bot.api.send_message(
        chat_id: MILANA_TELEGRAM_ID,
        text: message,
        parse_mode: 'Markdown'
      )
      Rails.logger.info "[DeliveryBooster] Milana notified about lead #{user.id}"
    rescue => e
      Rails.logger.error "[DeliveryBooster] Failed to notify Milana: #{e.message}"
    end
  end

  # Отправка ссылки на букинг пользователю
  def send_booking_link_to_user!
    return unless defined?(BOOKING_LINK) && BOOKING_LINK.present?

    bot = Telegram::Bot::Client.new(TELEGRAM_BOT_TOKEN)

    begin
      bot.api.send_message(
        chat_id: user.telegram_id,
        text: "Отлично! Вот ссылка для записи на созвон с нашим менеджером Миланой: #{BOOKING_LINK}",
        parse_mode: 'Markdown'
      )
      Rails.logger.info "[DeliveryBooster] Booking link sent to user #{user.id}"
    rescue => e
      Rails.logger.error "[DeliveryBooster] Failed to send booking link: #{e.message}"
    end
  end

  # Формирование сообщения для Миланы
  def build_escalation_message
    emoji = ai_action == 'schedule_call' ? '🔥' : '⚡'
    action_text = ai_action == 'schedule_call' ? 'ГОТОВ К СОЗВОНУ' : 'ГОРЯЧИЙ ЛИД'

    parts = []
    parts << "#{emoji} *#{action_text}* #{emoji}"
    parts << ""
    parts << "*Клиент:* #{ai_real_name || user.first_name || 'Неизвестно'}"
    parts << "*Telegram:* @#{user.username}" if user.username.present?
    parts << "*Ресторан:* #{ai_restaurant_name}" if ai_restaurant_name.present?
    parts << "*Платформа:* #{ai_platform}" if ai_platform.present?
    parts << "*Заказов/день:* #{ai_orders_per_day}" if ai_orders_per_day.present?
    parts << "*Рейтинг:* #{ai_rating}" if ai_rating.present?
    parts << "*Проблема:* #{ai_main_problem}" if ai_main_problem.present?
    parts << "*Срочность:* #{ai_urgency}" if ai_urgency.present?
    parts << "*Локация:* #{ai_location}" if ai_location.present?
    parts << ""
    parts << "*Ready Score:* #{ai_ready_score}/10"
    parts << "*PQL:* #{ai_is_pql ? 'Да ✅' : 'Нет'}"

    if ai_red_flags.present? && ai_red_flags.any?
      parts << ""
      parts << "⚠️ *Red Flags:* #{ai_red_flags.join(', ')}"
    end

    parts.join("\n")
  end
end
