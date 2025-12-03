# frozen_string_literal: true

module Admin
  class HomeController < ApplicationController
    # Landing page - does NOT inherit from BaseController
    # Available to all users (for login page)
    layout "admin_landing"

    def index
      if @current_user&.admin?
        redirect_to admin_dashboard_path
      end
      # Otherwise show landing page with Telegram login
    end
  end
end
