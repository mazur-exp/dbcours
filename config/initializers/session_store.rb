Rails.application.config.session_store :cookie_store,
  key: '_dbcours_session',
  domain: Rails.env.production? ? '.aidelivery.tech' : :all,
  same_site: :lax,
  secure: Rails.env.production?,
  httponly: true
