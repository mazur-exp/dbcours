class TrafficSource < ApplicationRecord
  has_many :users, dependent: :nullify
  has_many :traffic_clicks, dependent: :destroy

  # Enums
  enum :link_type, {
    site: 0,
    bot: 1
  }

  # Validations
  validates :name, presence: true
  validates :utm_source, presence: true
  validates :short_code, presence: true, uniqueness: true, format: { with: /\A[a-z0-9_-]+\z/i }

  # Callbacks
  before_validation :generate_short_code, on: :create, unless: :short_code?

  # Генерация полной короткой ссылки
  def short_url
    "#{base_url}/s/#{short_code}"
  end

  # Генерация полной ссылки с UTM параметрами
  def full_url
    params = {
      utm_source: utm_source,
      utm_medium: utm_medium,
      utm_campaign: utm_campaign
    }.compact

    if site?
      "#{target_url || base_url}?#{params.to_query}"
    elsif bot?
      bot_username = Rails.application.credentials.dig(:telegram, :bot_username)
      ref_code = "ref_#{short_code}"
      "https://t.me/#{bot_username}?start=#{ref_code}"
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

  def base_url
    Rails.application.credentials.dig(:telegram, :api_base_url) || "https://crm.aidelivery.tech"
  end
end
