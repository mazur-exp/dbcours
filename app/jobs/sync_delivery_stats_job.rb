# frozen_string_literal: true

class SyncDeliveryStatsJob < ApplicationJob
  queue_as :default

  def perform(days_back: 365, restaurant_ids: nil)
    start_date = Date.today - days_back.days
    end_date = Date.today - 1.day

    Rails.logger.info "Starting delivery stats sync for #{days_back} days (#{start_date} to #{end_date})"

    restaurants = restaurant_ids ? Restaurant.where(id: restaurant_ids) : Restaurant.active
    synced_count = 0
    error_count = 0

    restaurants.find_each do |restaurant|
      begin
        sync_restaurant_stats(restaurant, start_date, end_date)
        synced_count += 1
        Rails.logger.info "✓ Synced #{restaurant.name}"
      rescue StandardError => e
        error_count += 1
        Rails.logger.error "✗ Failed to sync #{restaurant.name}: #{e.message}"
      end
    end

    Rails.logger.info "Sync completed: #{synced_count} restaurants synced, #{error_count} errors"
  end

  private

  def sync_restaurant_stats(restaurant, start_date, end_date)
    result = DeliveryStatsClient.get_restaurant_stats(
      restaurant_name: restaurant.name,
      source: "looker_summary",
      start_date: start_date,
      end_date: end_date
    )

    return if result[:error] || result[:data].nil? || result[:data].empty?

    result[:data].each do |day_data|
      RestaurantStat.upsert(
        {
          restaurant_id: restaurant.id,
          stat_date: Date.parse(day_data[:stat_date]),
          grab_sales: day_data[:grab_sales].to_f,
          grab_orders: day_data[:grab_orders] || 0,
          grab_ads_spend: day_data[:grab_ads_spend].to_f,
          grab_ads_sales: day_data[:grab_ads_sales].to_f,
          grab_new_customers: day_data[:grab_new_customers] || 0,
          grab_repeated_customers: day_data[:grab_repeated_customers] || 0,
          grab_fake_orders: day_data[:grab_fake_orders_count] || 0,
          gojek_sales: day_data[:gojek_sales].to_f,
          gojek_orders: day_data[:gojek_orders] || 0,
          gojek_ads_spend: day_data[:gojek_ads_spend].to_f,
          gojek_ads_sales: day_data[:gojek_ads_sales].to_f,
          gojek_new_customers: day_data[:gojek_new_client] || 0,
          gojek_returned_customers: day_data[:gojek_returned_client] || 0,
          gojek_fake_orders: day_data[:gojek_fake_orders_count] || 0,
          total_sales: day_data[:grab_sales].to_f + day_data[:gojek_sales].to_f,
          total_orders: (day_data[:grab_orders] || 0) + (day_data[:gojek_orders] || 0),
          synced_at: Time.current
        },
        unique_by: [:restaurant_id, :stat_date]
      )
    end
  end
end
