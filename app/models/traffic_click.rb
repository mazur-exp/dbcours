class TrafficClick < ApplicationRecord
  belongs_to :traffic_source
  belongs_to :user, optional: true

  # Callbacks
  after_create :increment_source_clicks

  # Scopes
  scope :recent, -> { order(clicked_at: :desc) }
  scope :converted, -> { joins(:user).where(users: { paid: true }) }

  private

  def increment_source_clicks
    traffic_source.increment!(:clicks_count)
  end
end
