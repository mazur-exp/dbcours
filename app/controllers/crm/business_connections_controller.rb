# frozen_string_literal: true

module Crm
  class BusinessConnectionsController < BaseController
    def index
      @business_connections = BusinessConnection.includes(:user)
                                                .recent
                                                .all

      @active_connections = @business_connections.active_connections
      @disconnected_connections = @business_connections.where(status: :disconnected)
    end
  end
end
