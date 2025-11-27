class TrafficSourcesController < ApplicationController
  before_action :require_admin
  before_action :set_traffic_source, only: [:show, :edit, :update, :destroy]

  def index
    @traffic_sources = TrafficSource.all.order(created_at: :desc)

    # Общая статистика
    @total_stats = {
      total_clicks: TrafficSource.sum(:clicks_count),
      total_leads: TrafficSource.sum(:leads_count),
      total_conversions: TrafficSource.sum(:conversions_count),
      overall_conversion_rate: calculate_overall_conversion_rate
    }
  end

  def show
    @users_from_source = @traffic_source.users.includes(:conversation).order(created_at: :desc).limit(50)
    @recent_clicks = @traffic_source.traffic_clicks.recent.limit(100)
  end

  def new
    @traffic_source = TrafficSource.new
  end

  def create
    @traffic_source = TrafficSource.new(traffic_source_params)

    if @traffic_source.save
      redirect_to traffic_sources_path, notice: "Источник создан успешно!"
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @traffic_source.update(traffic_source_params)
      redirect_to traffic_sources_path, notice: "Источник обновлен!"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @traffic_source.destroy
    redirect_to traffic_sources_path, notice: "Источник удален"
  end

  private

  def set_traffic_source
    @traffic_source = TrafficSource.find(params[:id])
  end

  def traffic_source_params
    params.require(:traffic_source).permit(
      :name, :product, :utm_source, :utm_medium, :utm_campaign,
      :link_type, :target_url, :short_code
    )
  end

  def require_admin
    unless @current_user&.admin?
      redirect_to root_path, alert: "Доступ запрещен"
    end
  end

  def calculate_overall_conversion_rate
    leads = TrafficSource.sum(:leads_count)
    return 0 if leads.zero?
    conversions = TrafficSource.sum(:conversions_count)
    (conversions.to_f / leads * 100).round(1)
  end
end
