# frozen_string_literal: true

module Analytics
  class RestaurantStatsService
    attr_reader :restaurant, :start_date, :end_date

    def initialize(restaurant, start_date: nil, end_date: nil)
      @restaurant = restaurant
      # Default to last 30 days (excluding today)
      @end_date = end_date || (Date.today - 1.day)
      @start_date = start_date || (@end_date - 30.days)
    end

    # Get complete analytics data for the dashboard
    def call
      # Read from LOCAL database instead of HTTP API!
      stats = restaurant.restaurant_stats.for_period(start_date, end_date).ordered_by_date

      if stats.empty?
        return placeholder_data
      end

      {
        summary: summary_stats(stats),
        charts: chart_data(stats),
        platforms: platform_breakdown(stats),
        commission: commission_info,
        has_data: true
      }
    rescue StandardError => e
      Rails.logger.error "Analytics Service Error: #{e.class}: #{e.message}"
      Rails.logger.error e.backtrace.first(10).join("\n")
      placeholder_data
    end

    private

    def summary_stats(stats)
      {
        total_orders: stats.sum(&:total_orders),
        total_sales: format_currency(stats.sum(&:total_sales)),
        total_customers: stats.sum { |s| (s.grab_new_customers || 0) + (s.gojek_new_customers || 0) },
        avg_rating: 4.7, # Placeholder for now
        period_days: stats.count
      }
    end

    def chart_data(stats)
      dates = stats.map { |s| s.stat_date.strftime("%d %b") }

      {
        orders: {
          labels: dates,
          data: stats.map(&:total_orders)
        },
        revenue: {
          labels: dates,
          data: stats.map { |s| s.total_sales.to_f }
        },
        customers: {
          labels: dates,
          data: stats.map { |s| (s.grab_new_customers || 0) + (s.gojek_new_customers || 0) }
        },
        rating: {
          labels: dates,
          data: stats.map { |_s| 4.5 } # Placeholder
        }
      }
    end

    def platform_breakdown(stats)
      grab_sales = stats.sum { |s| s.grab_sales.to_f }
      grab_orders = stats.sum(&:grab_orders)
      grab_ads_spend = stats.sum { |s| s.grab_ads_spend.to_f }
      grab_ads_sales = stats.sum { |s| s.grab_ads_sales.to_f }
      grab_new_customers = stats.sum(&:grab_new_customers)
      grab_repeated_customers = stats.sum(&:grab_repeated_customers)
      grab_fake_orders = stats.sum(&:grab_fake_orders)

      gojek_sales = stats.sum { |s| s.gojek_sales.to_f }
      gojek_orders = stats.sum(&:gojek_orders)
      gojek_ads_spend = stats.sum { |s| s.gojek_ads_spend.to_f }
      gojek_ads_sales = stats.sum { |s| s.gojek_ads_sales.to_f }
      gojek_new_customers = stats.sum(&:gojek_new_customers)
      gojek_returned_customers = stats.sum(&:gojek_returned_customers)
      gojek_fake_orders = stats.sum(&:gojek_fake_orders)

      {
        grab: {
          sales: grab_sales,
          formatted_sales: format_currency(grab_sales),
          orders: grab_orders,
          avg_check: grab_orders > 0 ? (grab_sales / grab_orders).round(0) : 0,
          formatted_avg_check: grab_orders > 0 ? format_currency(grab_sales / grab_orders) : "Rp 0",
          ads_spend: grab_ads_spend,
          formatted_ads_spend: format_currency(grab_ads_spend),
          ads_sales: grab_ads_sales,
          roi: grab_ads_spend > 0 ? ((grab_ads_sales / grab_ads_spend) * 100).round(1) : 0,
          new_customers: grab_new_customers,
          repeated_customers: grab_repeated_customers,
          fake_orders: grab_fake_orders
        },
        gojek: {
          sales: gojek_sales,
          formatted_sales: format_currency(gojek_sales),
          orders: gojek_orders,
          avg_check: gojek_orders > 0 ? (gojek_sales / gojek_orders).round(0) : 0,
          formatted_avg_check: gojek_orders > 0 ? format_currency(gojek_sales / gojek_orders) : "Rp 0",
          ads_spend: gojek_ads_spend,
          formatted_ads_spend: format_currency(gojek_ads_spend),
          ads_sales: gojek_ads_sales,
          roi: gojek_ads_spend > 0 ? ((gojek_ads_sales / gojek_ads_spend) * 100).round(1) : 0,
          new_customers: gojek_new_customers,
          returned_customers: gojek_returned_customers,
          fake_orders: gojek_fake_orders
        }
      }
    end

    def commission_info
      # Still fetch from API (rarely changes, small request)
      Rails.cache.fetch(cache_key("commission_settings"), expires_in: 24.hours) do
        result = DeliveryStatsClient.get_restaurant_stats(
          restaurant_name: restaurant.name,
          source: "commission_settings"
        )

        return nil if result[:error] || result[:data].nil? || result[:data].empty?

        settings = result[:data].first
        {
          type: settings[:commission_type],
          percent: settings[:percent],
          fixed_amount: settings[:fixed_amount],
          platform: format_platform(settings[:platform])
        }
      end
    end

    def format_currency(amount)
      return "Rp 0" if amount.nil? || amount.zero?

      if amount >= 1_000_000
        "Rp #{(amount / 1_000_000.0).round(1)}M"
      elsif amount >= 1_000
        "Rp #{(amount / 1_000.0).round(1)}K"
      else
        "Rp #{amount.round(0)}"
      end
    end

    def format_platform(platform)
      case platform
      when "both" then "Grab + GoJek"
      when "grab" then "Grab"
      when "gojek" then "GoJek"
      else platform
      end
    end

    def cache_key(suffix)
      "restaurant_#{restaurant.id}_#{start_date}_#{end_date}_#{suffix}"
    end

    def placeholder_data
      {
        summary: default_summary,
        charts: default_charts,
        platforms: default_platforms,
        commission: nil,
        has_data: false
      }
    end

    def default_summary
      {
        total_orders: 0,
        total_sales: "$0",
        total_customers: 0,
        avg_rating: 0.0,
        period_days: 0
      }
    end

    def default_charts
      labels = []
      {
        orders: { labels: labels, data: [] },
        revenue: { labels: labels, data: [] },
        customers: { labels: labels, data: [] },
        rating: { labels: labels, data: [] }
      }
    end

    def default_platforms
      {
        grab: {
          sales: 0, formatted_sales: "Rp 0", orders: 0, avg_check: 0, formatted_avg_check: "Rp 0",
          ads_spend: 0, formatted_ads_spend: "Rp 0", ads_sales: 0, roi: 0,
          new_customers: 0, repeated_customers: 0, fake_orders: 0
        },
        gojek: {
          sales: 0, formatted_sales: "Rp 0", orders: 0, avg_check: 0, formatted_avg_check: "Rp 0",
          ads_spend: 0, formatted_ads_spend: "Rp 0", ads_sales: 0, roi: 0,
          new_customers: 0, returned_customers: 0, fake_orders: 0
        }
      }
    end
  end
end
