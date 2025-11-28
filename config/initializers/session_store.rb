# frozen_string_literal: true

# Shared sessions between course.aidelivery.tech and crm.aidelivery.tech
#
# IMPORTANT: tld_length determines how Rails calculates the cookie domain
# For course.aidelivery.tech:
#   - tld_length: 1 → domain="tech" (WRONG!)
#   - tld_length: 2 → domain=".aidelivery.tech" (CORRECT!)
#
# The tld_length counts parts from the RIGHT side of the domain
# aidelivery.tech has 2 parts, so tld_length must be 2
Rails.application.config.session_store :cookie_store,
  key: "_dbcours_session",
  domain: :all,
  tld_length: 2,
  secure: Rails.env.production?,
  httponly: true,
  same_site: :lax
