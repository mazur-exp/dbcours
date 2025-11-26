class ShortLinksController < ApplicationController
  skip_before_action :set_current_user

  def redirect
    short_code = params[:code]
    source = TrafficSource.find_by(short_code: short_code)

    unless source
      redirect_to root_path, alert: "Ссылка не найдена"
      return
    end

    # Сохраняем клик
    TrafficClick.create!(
      traffic_source: source,
      ip_address: request.remote_ip,
      user_agent: request.user_agent,
      clicked_at: Time.current
    )

    # Сохраняем UTM в session для последующей привязки к пользователю
    session[:utm_params] = {
      source_id: source.id,
      utm_source: source.utm_source,
      utm_medium: source.utm_medium,
      utm_campaign: source.utm_campaign,
      short_code: source.short_code
    }

    # Редиректим в зависимости от типа ссылки
    if source.site?
      # Редирект на главную или target_url с UTM параметрами
      redirect_to source.full_url, allow_other_host: true
    elsif source.bot?
      # Редирект на Telegram бота с реферальным кодом
      redirect_to source.full_url, allow_other_host: true
    end
  end
end
