# frozen_string_literal: true

module Admin
  class DashboardController < BaseController
    def index
      # Date range for analytics (default: last 30 days, excluding today)
      @end_date = params[:end_date]&.to_date || (Date.today - 1.day)
      @start_date = params[:start_date]&.to_date || (@end_date - 30.days)

      # FAST query with local data - sorted by sales!
      @restaurants = Restaurant.active
        .joins(:restaurant_stats)
        .where(restaurant_stats: { stat_date: @start_date..@end_date })
        .select("restaurants.*, SUM(restaurant_stats.total_sales) as period_sales")
        .group("restaurants.id")
        .order("period_sales DESC")

      @selected_restaurant = @restaurants.find { |r| r.id == params[:restaurant_id]&.to_i } || @restaurants.first

      # Get last sync time for UI
      @last_sync = RestaurantStat.maximum(:synced_at)

      # Get analytics data using service
      if @selected_restaurant
        stats_service = Analytics::RestaurantStatsService.new(
          @selected_restaurant,
          start_date: @start_date,
          end_date: @end_date
        )
        @analytics = stats_service.call
      else
        @analytics = default_analytics
      end
    end

    private

    def default_analytics
      {
        summary: {
          total_orders: 0,
          total_sales: "$0",
          total_customers: 0,
          avg_rating: 0.0,
          period_days: 0
        },
        charts: {
          orders: { labels: [], data: [] },
          revenue: { labels: [], data: [] },
          customers: { labels: [], data: [] },
          rating: { labels: [], data: [] }
        },
        commission: nil,
        has_data: false
      }
    end
  end
end
