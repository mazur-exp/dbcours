# frozen_string_literal: true

# Shared sessions between course.aidelivery.tech and crm.aidelivery.tech
Rails.application.config.session_store :cookie_store,
  key: "_dbcours_session",
  domain: :all,  # Works with all subdomains of aidelivery.tech
  tld_length: 2,
  secure: Rails.env.production?,
  httponly: true,
  same_site: :lax
