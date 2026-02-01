# frozen_string_literal: true

# Client represents a restaurant owner/company that manages one or more restaurants
class Client < ApplicationRecord
  # Associations
  has_many :restaurants, dependent: :nullify
  has_one :conversation, as: :conversable, dependent: :destroy
  belongs_to :manager, class_name: 'User', optional: true

  # Validations
  validates :name, presence: true
  validates :channel_type, inclusion: { in: %w[telegram whatsapp], allow_nil: true }
  validates :status, inclusion: { in: %w[active paused churned] }

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :with_telegram, -> { where.not(telegram_chat_id: nil) }
  scope :with_whatsapp, -> { where.not(whatsapp_chat_id: nil) }
  scope :ordered, -> { order(:name) }

  # Callbacks
  after_create :create_conversation_if_chat_id

  # Calculate total revenue across all restaurants for a period
  def total_revenue_for_period(start_date, end_date)
    RestaurantStat
      .joins(:restaurant)
      .where(restaurants: { client_id: id })
      .where(stat_date: start_date..end_date)
      .sum(:total_sales)
  end

  # Update commission amount based on last month's revenue
  def calculate_commission!
    return unless commission_percent.present?

    last_month_start = 1.month.ago.beginning_of_month.to_date
    last_month_end = 1.month.ago.end_of_month.to_date

    revenue = total_revenue_for_period(last_month_start, last_month_end)
    commission = revenue * (commission_percent / 100.0)

    update(commission_amount: commission)
  end

  # Check if client has any chat configured
  def has_chat?
    telegram_chat_id.present? || whatsapp_chat_id.present?
  end

  # Get active chat channel
  def active_chat_channel
    return :telegram if telegram_chat_id.present?
    return :whatsapp if whatsapp_chat_id.present?
    nil
  end

  private

  def create_conversation_if_chat_id
    return unless has_chat?

    create_conversation!(
      channel_type: channel_type || 'telegram'
    )
  end
end
