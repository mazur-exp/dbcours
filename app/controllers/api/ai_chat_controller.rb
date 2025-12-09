# frozen_string_literal: true

require "net/http"
require "uri"
require "json"

module Api
  class AiChatController < ApplicationController
    skip_before_action :verify_authenticity_token
    before_action :require_admin

    # POST /api/ai_chat/analyze
    # Отправляет вопрос в N8N workflow для AI-анализа
    def analyze
      question = params[:question]
      client_id = params[:client_id]

      unless question.present?
        return render json: { error: "Вопрос не может быть пустым" }, status: :unprocessable_entity
      end

      # Запускаем job в фоне (обходим 30-сек timeout kamal-proxy)
      AiChatAnalysisJob.perform_later(
        session.id.to_s,
        question,
        client_id,
        @current_user&.id
      )

      # Сразу возвращаем success (результат придёт через ActionCable)
      render json: {
        success: true,
        session_id: session.id.to_s,
        message: "Запрос принят. Ожидайте результат..."
      }
    end

    private

    def require_admin
      unless @current_user&.admin?
        render json: { error: "Доступ запрещен" }, status: :forbidden
      end
    end
  end
end
