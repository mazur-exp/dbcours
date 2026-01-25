class Client < ApplicationRecord
  has_many :client_stats, dependent: :destroy

  # Encrypt sensitive API tokens and credentials
  encrypts :grab_token
  encrypts :grab_username
  encrypts :grab_password
  encrypts :gojek_refresh_token
  encrypts :gojek_access_token
  encrypts :gojek_username
  encrypts :gojek_password

  validates :name, presence: true

  scope :active, -> { where(status: "active") }
  scope :ordered, -> { order(:name) }

  STATUSES = %w[active paused churned].freeze

  def active?
    status == "active"
  end

  # Get stats for a period from local cache
  def stats_for_period(start_date, end_date)
    client_stats.for_period(start_date, end_date).ordered_by_date
  end

  # Export credentials for Node.js collection script
  def to_collector_format
    {
      name: name,
      # GoJek
      gojek_merchant_id: gojek_merchant_id,
      gojek_client_id: gojek_client_id || "YEZympJ5WqYRh7Hs",
      gojek_refresh_token: gojek_refresh_token,
      gojek_access_token: gojek_access_token,
      gojek: {
        username: gojek_username,
        password: gojek_password
      },
      # Grab
      grab_token: grab_token,
      grab_user_id: grab_user_id,
      grab_store_id: grab_store_id,
      grab_merchant_id: grab_merchant_id,
      grab_advertiser_id: grab_advertiser_id,
      grab_food_entity_id: grab_food_entity_id,
      grab: {
        username: grab_username,
        password: grab_password
      }
    }
  end
end
