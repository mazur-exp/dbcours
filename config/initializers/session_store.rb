# frozen_string_literal: true

# Shared sessions between course.aidelivery.tech and crm.aidelivery.tech
# tld_length: 1 because .tech is a single-part TLD
# This sets cookie domain to .aidelivery.tech (shared across subdomains)
Rails.application.config.session_store :cookie_store,
  key: "_dbcours_session",
  domain: :all,
  tld_length: 1,
  secure: Rails.env.production?,
  httponly: true,
  same_site: :lax
