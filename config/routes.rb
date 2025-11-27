# Domain constraint - проверяет полный host для совместимости с Traefik
class DomainConstraint
  def initialize(subdomain)
    @host = "#{subdomain}.aidelivery.tech"
  end

  def matches?(request)
    if Rails.env.production?
      result = request.host == @host
      Rails.logger.info "🔍 DomainConstraint: host=#{request.host.inspect} expected=#{@host.inspect} match=#{result}"
      result
    else
      # Development fallback
      request.params[:domain] == @host.split('.').first ||
        request.path.start_with?("/#{@host.split('.').first}")
    end
  end
end

Rails.application.routes.draw do
  # Health check и PWA доступны на всех доменах
  get "up" => "rails/health#show", as: :rails_health_check
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Authentication routes - доступны на всех доменах
  post "auth/telegram/start", to: "auth#start"
  post "auth/telegram/webhook", to: "auth#webhook"
  get "auth/status", to: "auth#status"
  get "auth/check_token", to: "auth#check_token"
  post "auth/set_session", to: "auth#set_session"
  delete "auth/logout", to: "auth#logout", as: :auth_logout

  # ========================================
  # COURSE DOMAIN - course.aidelivery.tech
  # ========================================
  constraints(DomainConstraint.new('course')) do
    root "home#index", as: :course_root
    get "dashboard", to: "dashboard#index"
    get "freecontent", to: "free_lessons#index", as: :freecontent
    get "freecontent/:id", to: "free_lessons#show", as: :freecontent_lesson
  end

  # ========================================
  # CRM DOMAIN - crm.aidelivery.tech
  # ========================================
  constraints(DomainConstraint.new('crm')) do
    root "crm_home#index", as: :crm_root

    get "crm", to: "crm#index", as: :crm
    patch "crm/users/:id/update_status", to: "crm#update_status", as: :crm_update_user_status

    get "messenger", to: "messenger#index", as: :messenger
    get "messenger/conversations/:id/messages", to: "messenger#messages", as: :messenger_conversation_messages
    post "messenger/conversations/:id/messages", to: "messenger#send_message", as: :messenger_send_message
    patch "messenger/conversations/:id/mark_read", to: "messenger#mark_read", as: :messenger_mark_read
    patch "messenger/conversations/:id/toggle_ai_pause", to: "messenger#toggle_ai_pause", as: :messenger_toggle_ai_pause
    delete "messenger/users/:id", to: "messenger#delete_user", as: :messenger_delete_user

    get "messenger/business_connections", to: "business_connections#index", as: :messenger_business_connections

    resources :traffic_sources
    get "s/:code", to: "short_links#redirect", as: :short_link

    post "api/n8n/send_message", to: "n8n#send_message", as: :n8n_send_message
  end

  # Development fallback
  unless Rails.env.production?
    scope '/course' do
      get "/", to: "home#index"
      get "dashboard", to: "dashboard#index"
      get "freecontent", to: "free_lessons#index"
    end

    scope '/crm' do
      get "/", to: "crm_home#index"
      get "crm", to: "crm#index"
      get "messenger", to: "messenger#index"
      resources :traffic_sources
    end

    root to: redirect('/course'), as: :dev_root
  end
end
