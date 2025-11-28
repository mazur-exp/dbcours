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
  post "auth/set_session", to: "auth#set_session"
  delete "auth/logout", to: "auth#logout", as: :auth_logout

  # N8N API
  post "api/n8n/send_message", to: "n8n#send_message", as: :n8n_send_message

  if Rails.env.production?
    # ===== COURSE DOMAIN (course.aidelivery.tech) =====
    constraints(host: "course.aidelivery.tech") do
      root "home#index", as: :course_root
      get "dashboard", to: "dashboard#index", as: :course_dashboard
      get "freecontent", to: "free_lessons#index", as: :course_freecontent
      get "freecontent/:id", to: "free_lessons#show", as: :course_freecontent_lesson
    end

    # ===== CRM DOMAIN (crm.aidelivery.tech) =====
    constraints(host: "crm.aidelivery.tech") do
      # CRM landing page (login)
      root "crm/home#index", as: :crm_root

      # Short links - public, no auth required
      get "s/:code", to: "short_links#redirect", as: :short_link

      # CRM namespace - all admin-only routes
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
    # ===== DEVELOPMENT (no domain constraint) =====
    # Course domain routes (default)
    root "home#index"
    get "dashboard", to: "dashboard#index"
    get "freecontent", to: "free_lessons#index", as: :freecontent
    get "freecontent/:id", to: "free_lessons#show", as: :freecontent_lesson

    # Short links - public
    get "s/:code", to: "short_links#redirect", as: :short_link

    # CRM root (landing page) - accessible in development
    get "crm_login", to: "crm/home#index", as: :crm_root

    # CRM namespace routes for development
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
