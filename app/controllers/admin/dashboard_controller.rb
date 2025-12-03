# frozen_string_literal: true

module Admin
  class DashboardController < BaseController
    def index
      @clients = Client.active.ordered
      @selected_client = @clients.find_by(id: params[:client_id]) || @clients.first

      # Placeholder analytics data for charts
      @analytics = {
        orders: generate_placeholder_data,
        revenue: generate_placeholder_data,
        customers: generate_placeholder_data,
        rating: generate_placeholder_data
      }
    end

    private

    def generate_placeholder_data
      labels = %w[Янв Фев Мар Апр Май Июн]
      data = Array.new(6, 0)
      { labels: labels, data: data }
    end
  end
end
