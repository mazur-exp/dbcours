# frozen_string_literal: true

module Crm
  class DashboardController < BaseController
    def index
      @users = User.includes(:conversations, :traffic_source).all

      @users_by_status = User.crm_statuses.keys.index_with do |status|
        @users.select { |u| u.crm_status == status }
              .sort_by { |u| [ u.ready_score ? -u.ready_score : 0, u.crm_position || 999 ] }
      end

      @stats = {
        total: @users.count,
        hot_leads: @users.count { |u| u.lead_temperature == :hot },
        paid: @users.count(&:paid?)
      }
    end

    def update_status
      @user = User.find(params[:id])
      new_status = params[:crm_status]
      new_position = params[:crm_position]

      attributes = { crm_status: new_status, crm_position: new_position }
      if new_status == "paid_status"
        attributes[:paid] = true
      elsif @user.paid? && new_status != "paid_status"
        attributes[:paid] = false
      end

      if @user.update(attributes)
        @user.reload

        ActionCable.server.broadcast("crm_channel", {
          type: "card_moved",
          user_id: @user.id,
          user: {
            id: @user.id,
            full_name: @user.full_name,
            avatar_url: @user.avatar_url,
            crm_status: @user.crm_status,
            crm_position: @user.crm_position,
            ready_score: @user.ready_score,
            temperature: @user.lead_temperature.to_s,
            temperature_emoji: @user.temperature_emoji,
            messages_count: @user.messages_count,
            paid: @user.paid
          }
        })

        respond_to do |format|
          format.turbo_stream do
            render turbo_stream: turbo_stream.replace(
              "user_card_#{@user.id}",
              partial: "crm/dashboard/user_card",
              locals: { user: @user }
            )
          end
          format.json do
            render json: { success: true, user: {
              id: @user.id,
              crm_status: @user.crm_status,
              ready_score: @user.ready_score,
              paid: @user.paid
            } }
          end
        end
      else
        render json: { success: false, errors: @user.errors.full_messages }, status: :unprocessable_entity
      end
    end
  end
end
