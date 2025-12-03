class Client < ApplicationRecord
  validates :name, presence: true

  scope :active, -> { where(status: "active") }
  scope :ordered, -> { order(:name) }

  STATUSES = %w[active paused churned].freeze

  def active?
    status == "active"
  end
end
