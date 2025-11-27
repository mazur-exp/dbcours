require_relative '../lib/constraints/domain_constraint'

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
    root "home#index"

    # Course routes
    get "dashboard", to: "dashboard#index"
    get "freecontent", to: "free_lessons#index", as: :freecontent
    get "freecontent/:id", to: "free_lessons#show", as: :freecontent_lesson
  end

  # ========================================
  # CRM DOMAIN - crm.aidelivery.tech
  # ========================================
  constraints(DomainConstraint.new('crm')) do
    # Root для CRM - сразу показываем CRM канбан
    root "crm#index"

    # CRM routes (Admin only)
    get "crm", to: "crm#index", as: :crm
    patch "crm/users/:id/update_status", to: "crm#update_status", as: :crm_update_user_status

    # Messenger routes (Admin only)
    get "messenger", to: "messenger#index", as: :messenger
    get "messenger/conversations/:id/messages", to: "messenger#messages", as: :messenger_conversation_messages
    post "messenger/conversations/:id/messages", to: "messenger#send_message", as: :messenger_send_message
    patch "messenger/conversations/:id/mark_read", to: "messenger#mark_read", as: :messenger_mark_read
    patch "messenger/conversations/:id/toggle_ai_pause", to: "messenger#toggle_ai_pause", as: :messenger_toggle_ai_pause
    delete "messenger/users/:id", to: "messenger#delete_user", as: :messenger_delete_user

    # Business Connections (Admin only)
    get "messenger/business_connections", to: "business_connections#index", as: :messenger_business_connections

    # Traffic Sources routes (Admin only)
    resources :traffic_sources

    # Short links redirect (используется в traffic sources)
    get "s/:code", to: "short_links#redirect", as: :short_link

    # N8N API routes
    post "api/n8n/send_message", to: "n8n#send_message", as: :n8n_send_message
  end

  # ========================================
  # DEVELOPMENT FALLBACK (без поддоменов)
  # ========================================
  unless Rails.env.production?
    # Для локального тестирования с параметром ?domain=
    scope '/course', defaults: { domain: 'course' } do
      get "/", to: "home#index", as: :dev_course_root
      get "dashboard", to: "dashboard#index", as: :dev_course_dashboard
      get "freecontent", to: "free_lessons#index", as: :dev_freecontent
      get "freecontent/:id", to: "free_lessons#show", as: :dev_freecontent_lesson
    end

    scope '/crm', defaults: { domain: 'crm' } do
      get "/", to: "crm#index", as: :dev_crm_root
      get "crm", to: "crm#index", as: :dev_crm
      get "messenger", to: "messenger#index", as: :dev_messenger
      resources :traffic_sources, as: :dev_traffic_sources
    end

    # По умолчанию в development редиректим на /course
    root to: redirect('/course')
  end
end
