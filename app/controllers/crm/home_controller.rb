# frozen_string_literal: true

module Crm
  class HomeController < ApplicationController
    # Landing page - does NOT inherit from BaseController
    # Available to all users (for login page)
    layout "crm_landing"

    def index
      if @current_user&.admin?
        redirect_to crm_dashboard_path
      end
      # Otherwise show landing page with Telegram login
    end
  end
end
