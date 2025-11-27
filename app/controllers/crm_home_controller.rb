class CrmHomeController < ApplicationController
  def index
    # Если пользователь админ - сразу редирект на CRM
    if @current_user&.admin?
      redirect_to crm_path
    end

    # Иначе показываем страницу авторизации
  end
end
