class BusinessConnectionsController < ApplicationController
  before_action :require_admin

  # GET /messenger/business_connections
  def index
    @business_connections = BusinessConnection.includes(:user)
                                              .recent
                                              .all

    @active_connections = @business_connections.active_connections
    @disconnected_connections = @business_connections.where(status: :disconnected)
  end

  private

  def require_admin
    unless @current_user&.admin?
      redirect_to root_path, alert: 'Access denied'
    end
  end
end
