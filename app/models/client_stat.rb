# frozen_string_literal: true

class ClientStat < ApplicationRecord
  belongs_to :client

  validates :client_id, :stat_date, presence: true
  validates :stat_date, uniqueness: { scope: :client_id }

  # Scopes
  scope :for_period, ->(start_date, end_date) { where(stat_date: start_date..end_date) }
  scope :recent, ->(days = 90) { where("stat_date >= ?", Date.today - days.days) }
  scope :ordered_by_date, -> { order(:stat_date) }

  # Calculate totals
  def total_sales
    (grab_sales || 0) + (gojek_sales || 0)
  end

  def total_orders
    (grab_orders || 0) + (gojek_orders || 0)
  end

  def total_customers
    (grab_new_customers || 0) + (gojek_new_customers || 0)
  end
end
