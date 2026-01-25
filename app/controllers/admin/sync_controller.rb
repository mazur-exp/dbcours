# frozen_string_literal: true

module Admin
  class SyncController < BaseController
    # POST /admin/collect_data - Collect data from Grab/GoJek and save to Rails DB
    def collect_data
      # Run collection job on THIS server (saves directly to Rails SQLite)
      CollectDeliveryDataJob.perform_later

      flash[:notice] = "Сбор данных запущен. Данные будут доступны через ~15 минут."
      redirect_to admin_dashboard_path
    rescue StandardError => e
      flash[:alert] = "Ошибка: #{e.message}"
      redirect_to admin_dashboard_path
    end

    # GET /admin/sync_status - Get collection status (JSON)
    def status
      last_sync = ClientStat.maximum(:synced_at)
      total_records = ClientStat.count
      date_range = ClientStat.where.not(stat_date: nil).pluck("MIN(stat_date)", "MAX(stat_date)").first || [nil, nil]

      render json: {
        last_sync: last_sync,
        total_records: total_records,
        earliest_date: date_range[0],
        latest_date: date_range[1],
        clients_count: Client.joins(:client_stats).distinct.count
      }
    end
  end
end
