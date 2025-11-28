# frozen_string_literal: true

module Crm
  class BaseController < ApplicationController
    before_action :require_admin

    layout "crm"

    private

    def require_admin
      unless @current_user&.admin?
        redirect_to crm_root_path, alert: "Доступ запрещен"
      end
    end
  end
end
