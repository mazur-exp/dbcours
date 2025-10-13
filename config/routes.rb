Rails.application.routes.draw do
  # Define your application routes per the DSL in https://guides.rubyonrails.org/routing.html

  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  # Can be used by load balancers and uptime monitors to verify that the app is live.
  get "up" => "rails/health#show", as: :rails_health_check

  # Render dynamic PWA files from app/views/pwa/* (remember to link manifest in application.html.erb)
  get "manifest" => "rails/pwa#manifest", as: :pwa_manifest
  get "service-worker" => "rails/pwa#service_worker", as: :pwa_service_worker

  # Defines the root path route ("/")
  root "home#index"

  # Dashboard route
  get "dashboard", to: "dashboard#index"

  # Messenger routes
  get "messenger", to: "messenger#index", as: :messenger
  get "messenger/conversations/:id/messages", to: "messenger#messages", as: :messenger_conversation_messages
  post "messenger/conversations/:id/messages", to: "messenger#send_message", as: :messenger_send_message
  patch "messenger/conversations/:id/mark_read", to: "messenger#mark_read", as: :messenger_mark_read
  delete "messenger/users/:id", to: "messenger#delete_user", as: :messenger_delete_user

  # Business Connections (Admin only)
  get "messenger/business_connections", to: "business_connections#index", as: :messenger_business_connections

  # Free content routes
  get "freecontent", to: "free_lessons#index", as: :freecontent
  get "freecontent/:id", to: "free_lessons#show", as: :freecontent_lesson

  # Authentication routes
  post "auth/telegram/start", to: "auth#start"
  post "auth/telegram/webhook", to: "auth#webhook"
  get "auth/status", to: "auth#status"
  get "auth/check_token", to: "auth#check_token"
  post "auth/set_session", to: "auth#set_session"
  delete "auth/logout", to: "auth#logout", as: :auth_logout

  # N8N API routes
  post "api/n8n/send_message", to: "n8n#send_message", as: :n8n_send_message
end
