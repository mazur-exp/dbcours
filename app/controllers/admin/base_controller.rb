# frozen_string_literal: true

module Admin
  class BaseController < ApplicationController
    before_action :require_admin

    layout "admin"

    private

    def require_admin
      unless @current_user&.admin?
        redirect_to admin_root_path, alert: "Доступ запрещен"
      end
    end

    def admin_base
      Rails.env.production? ? "https://admin.aidelivery.tech" : "/admin"
    end
    helper_method :admin_base
  end
end
