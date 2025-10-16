class CrmController < ApplicationController
  before_action :require_admin

  def index
    # CRM страница - пока пустая
  end

  private

  def require_admin
    unless @current_user&.admin?
      redirect_to root_path, alert: "Доступ запрещен"
    end
  end
end
