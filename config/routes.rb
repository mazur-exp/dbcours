# frozen_string_literal: true

Rails.application.routes.draw do
  # Health check & PWA
  get "up" => "rails/health#show", as: :rails_health_check
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Authentication - available on both domains
  post "auth/telegram/start", to: "auth#start"
  post "auth/telegram/webhook", to: "auth#webhook"
  get "auth/status", to: "auth#status"
  get "auth/check_token", to: "auth#check_token"
  get "auth/complete", to: "auth#complete"  # Token-based auth completion via redirect
  post "auth/set_session", to: "auth#set_session"
  delete "auth/logout", to: "auth#logout", as: :auth_logout

  # N8N API
  post "api/n8n/send_message", to: "n8n#send_message", as: :n8n_send_message

  # Short links - public, work on both domains
  get "s/:code", to: "short_links#redirect", as: :short_link

  if Rails.env.production?
    # ===== CRM DOMAIN =====
    constraints(host: "crm.aidelivery.tech") do
      get "/", to: "crm/home#index", as: :crm_root
    end

    # ===== ADMIN DOMAIN =====
    constraints(host: "admin.aidelivery.tech") do
      get "/", to: "admin/home#index", as: :admin_root

      namespace :admin, path: "" do
        get "dashboard", to: "dashboard#index", as: :dashboard
      end
    end

    # ===== COURSE DOMAIN =====
    # Course pages only on course.aidelivery.tech
    constraints(host: "course.aidelivery.tech") do
      root "home#index"
      get "dashboard", to: "dashboard#index", as: :dashboard
      get "freecontent", to: "free_lessons#index", as: :freecontent
      get "freecontent/:id", to: "free_lessons#show", as: :freecontent_lesson
    end
  else
    # ===== DEVELOPMENT (no domain constraints) =====
    root "home#index"
    get "dashboard", to: "dashboard#index", as: :dashboard
    get "freecontent", to: "free_lessons#index", as: :freecontent
    get "freecontent/:id", to: "free_lessons#show", as: :freecontent_lesson

    # Admin development routes
    get "admin_login", to: "admin/home#index", as: :admin_root
    namespace :admin, path: "admin" do
      get "dashboard", to: "dashboard#index", as: :dashboard
    end
  end

  # CRM namespace routes
  if Rails.env.production?
    # Production: CRM routes only on crm.aidelivery.tech
    constraints(host: "crm.aidelivery.tech") do
      namespace :crm, path: "" do
        # Dashboard (Kanban)
        get "crm", to: "dashboard#index", as: :dashboard
        patch "crm/users/:id/update_status", to: "dashboard#update_status", as: :update_user_status

        # Messenger
        get "messenger", to: "messenger#index", as: :messenger
        get "messenger/conversations/:id/messages", to: "messenger#messages", as: :conversation_messages
        post "messenger/conversations/:id/messages", to: "messenger#send_message", as: :send_message
        patch "messenger/conversations/:id/mark_read", to: "messenger#mark_read", as: :mark_read
        patch "messenger/conversations/:id/toggle_ai_pause", to: "messenger#toggle_ai_pause", as: :toggle_ai_pause
        delete "messenger/users/:id", to: "messenger#delete_user", as: :delete_user
        get "messenger/business_connections", to: "business_connections#index", as: :business_connections

        # Traffic Sources
        resources :traffic_sources
      end
    end
  else
    # Development: no domain constraints
    get "crm_login", to: "crm/home#index", as: :crm_root

    namespace :crm, path: "" do
      get "crm", to: "dashboard#index", as: :dashboard
      patch "crm/users/:id/update_status", to: "dashboard#update_status", as: :update_user_status

      get "messenger", to: "messenger#index", as: :messenger
      get "messenger/conversations/:id/messages", to: "messenger#messages", as: :conversation_messages
      post "messenger/conversations/:id/messages", to: "messenger#send_message", as: :send_message
      patch "messenger/conversations/:id/mark_read", to: "messenger#mark_read", as: :mark_read
      patch "messenger/conversations/:id/toggle_ai_pause", to: "messenger#toggle_ai_pause", as: :toggle_ai_pause
      delete "messenger/users/:id", to: "messenger#delete_user", as: :delete_user
      get "messenger/business_connections", to: "business_connections#index", as: :business_connections

      resources :traffic_sources
    end
  end
end
