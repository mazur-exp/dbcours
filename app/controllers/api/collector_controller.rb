# frozen_string_literal: true

module Api
  class CollectorController < ApplicationController
    skip_before_action :verify_authenticity_token

    # POST /api/collector/save_stats
    # Receives data from Node.js collection script and saves to restaurant_stats
    def save_stats
      restaurant_name = params[:restaurant_name]
      grab_stats = params[:grab_stats] || []
      gojek_stats = params[:gojek_stats] || []

      restaurant = Restaurant.find_by(name: restaurant_name)

      unless restaurant
        return render json: {
          success: false,
          error: "Restaurant '#{restaurant_name}' not found"
        }, status: 404
      end

      # Group stats by date
      stats_by_date = {}

      # Process Grab stats
      grab_stats.each do |stat|
        date = stat[:stat_date]
        next if date.blank?

        stats_by_date[date] ||= initialize_stat_record(restaurant.id, date)
        stats_by_date[date][:grab_sales] = stat[:sales].to_f
        stats_by_date[date][:grab_orders] = stat[:orders].to_i
        stats_by_date[date][:grab_ads_spend] = stat[:ads_spend].to_f
        stats_by_date[date][:grab_ads_sales] = stat[:ads_sales].to_f
        stats_by_date[date][:grab_new_customers] = stat[:new_customers].to_i
        stats_by_date[date][:grab_repeated_customers] = stat[:repeated_customers].to_i
      end

      # Process GoJek stats
      gojek_stats.each do |stat|
        date = stat[:stat_date]
        next if date.blank?

        stats_by_date[date] ||= initialize_stat_record(restaurant.id, date)
        stats_by_date[date][:gojek_sales] = stat[:sales].to_f
        stats_by_date[date][:gojek_orders] = stat[:orders].to_i
        stats_by_date[date][:gojek_ads_spend] = stat[:ads_spend].to_f
        stats_by_date[date][:gojek_ads_sales] = stat[:ads_sales].to_f
        stats_by_date[date][:gojek_new_customers] = stat[:new_client].to_i
        stats_by_date[date][:gojek_returned_customers] = stat[:returned_client].to_i
      end

      # Save to database
      saved_count = 0
      stats_by_date.each_value do |data|
        data[:total_sales] = data[:grab_sales] + data[:gojek_sales]
        data[:total_orders] = data[:grab_orders] + data[:gojek_orders]

        RestaurantStat.upsert(data, unique_by: [:restaurant_id, :stat_date])
        saved_count += 1
      end

      render json: {
        success: true,
        restaurant_name: restaurant_name,
        restaurant_id: restaurant.id,
        saved_count: saved_count
      }
    rescue StandardError => e
      Rails.logger.error "[Collector API] Error: #{e.class}: #{e.message}"
      Rails.logger.error e.backtrace.first(5).join("\n")

      render json: {
        success: false,
        error: e.message
      }, status: 500
    end

    private

    def initialize_stat_record(restaurant_id, date)
      {
        restaurant_id: restaurant_id,
        stat_date: date,
        grab_sales: 0,
        grab_orders: 0,
        grab_ads_spend: 0,
        grab_ads_sales: 0,
        grab_new_customers: 0,
        grab_repeated_customers: 0,
        grab_fake_orders: 0,
        gojek_sales: 0,
        gojek_orders: 0,
        gojek_ads_spend: 0,
        gojek_ads_sales: 0,
        gojek_new_customers: 0,
        gojek_returned_customers: 0,
        gojek_fake_orders: 0,
        synced_at: Time.current
      }
    end
  end
end
