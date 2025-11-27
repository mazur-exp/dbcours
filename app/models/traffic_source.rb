class TrafficSource < ApplicationRecord
  has_many :users, dependent: :nullify
  has_many :traffic_clicks, dependent: :destroy

  # Конфигурация продуктов
  # Каждый продукт ведёт на свой сайт, но бот один для всех
  # В bot ссылке передаётся product для триггера разной коммуникации
  PRODUCT_CONFIG = {
    course: {
      name: "Курс",
      emoji: "📚",
      base_url: "https://course.aidelivery.tech"
    },
    tracker: {
      name: "Трекер",
      emoji: "📍",
      base_url: "https://tracker.aidelivery.tech"
    },
    consulting: {
      name: "Консалтинг",
      emoji: "💼",
      base_url: "https://booster.delivery"
    }
  }.freeze

  # Бот один для всех продуктов, зависит от среды
  # Development: @dbcourse_auth_bot
  # Production: @ai_delivery_tech_assistent_bot
  def self.bot_username
    Rails.application.credentials.dig(:telegram, :bot_username) ||
      (Rails.env.production? ? "ai_delivery_tech_assistent_bot" : "dbcourse_auth_bot")
  end

  # Enums
  enum :link_type, {
    site: 0,
    bot: 1
  }

  enum :product, {
    course: 0,
    tracker: 1,
    consulting: 2  # было landing
  }

  # Validations
  validates :name, presence: true
  validates :utm_source, presence: true
  validates :short_code, presence: true, uniqueness: true, format: { with: /\A[a-z0-9_-]+\z/i }
  validates :product, presence: true

  # Callbacks
  before_validation :generate_short_code, on: :create, unless: :short_code?

  # Получение конфига текущего продукта
  def product_config
    PRODUCT_CONFIG[product.to_sym] || PRODUCT_CONFIG[:course]
  end

  # Название продукта для отображения
  def product_display_name
    "#{product_config[:emoji]} #{product_config[:name]}"
  end

  # Генерация полной короткой ссылки
  def short_url
    "#{base_url}/s/#{short_code}"
  end

  # Генерация полной ссылки с UTM параметрами
  def full_url
    if site?
      # Для site: UTM + ref параметр для передачи на сайт продукта
      # ref в формате PRODUCT_SHORTCODE — сайт читает его и передаёт в бота как ref_PRODUCT_SHORTCODE
      params = {
        utm_source: utm_source,
        utm_medium: utm_medium,
        utm_campaign: utm_campaign,
        ref: "#{product}_#{short_code}"
      }.compact

      base = target_url.presence || product_base_url
      "#{base}?#{params.to_query}"
    elsif bot?
      # Формат: ref_PRODUCT_SHORTCODE (например: ref_tracker_abc123)
      # Бот парсит это и понимает какой продукт интересует пользователя
      ref_code = "ref_#{product}_#{short_code}"
      "https://t.me/#{self.class.bot_username}?start=#{ref_code}"
    end
  end

  # Конверсия в %
  def conversion_rate
    return 0 if leads_count.zero?
    (conversions_count.to_f / leads_count * 100).round(1)
  end

  # CTR (click-through rate)
  def ctr
    return 0 if clicks_count.zero?
    (leads_count.to_f / clicks_count * 100).round(1)
  end

  # Средний ai_ready_score лидов с этого источника
  def average_ready_score
    scores = users.joins(:conversations).where.not(conversations: { ai_ready_score: nil }).pluck('conversations.ai_ready_score')
    return nil if scores.empty?
    (scores.sum.to_f / scores.size).round(1)
  end

  private

  def generate_short_code
    loop do
      self.short_code = SecureRandom.alphanumeric(6).downcase
      break unless TrafficSource.exists?(short_code: short_code)
    end
  end

  # Base URL для короткой ссылки (всегда course, т.к. редирект обрабатывается здесь)
  def base_url
    Rails.application.credentials.dig(:telegram, :api_base_url) || "https://course.aidelivery.tech"
  end

  # Base URL продукта (куда редиректим)
  def product_base_url
    product_config[:base_url]
  end
end
