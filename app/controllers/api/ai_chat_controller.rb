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

      # Собираем контекст для N8N
      payload = {
        question: question,
        client_id: client_id,
        user: @current_user&.full_name || "Unknown",
        user_id: @current_user&.id,
        session_id: session.id.to_s,
        timestamp: Time.current.iso8601
      }

      begin
        response = send_to_n8n(payload)
        Rails.logger.info "N8N Response: #{response.code} - Body length: #{response.body&.length || 0} bytes"

        if response.is_a?(Net::HTTPSuccess)
          # Handle empty response from N8N
          if response.body.blank?
            render json: {
              success: true,
              analysis: "Запрос получен N8N, но ответ пустой. Проверьте что workflow возвращает данные.",
              metadata: {}
            }
            return
          end

          # Try to parse as JSON, fallback to plain text
          begin
            data = JSON.parse(response.body)

            # N8N может вернуть массив [{"output": "..."}] или объект {"output": "..."}
            data = data.first if data.is_a?(Array) && data.any?

            # Извлекаем analysis из любого возможного ключа
            analysis = data["analysis"] || data["content"] || data["message"] || data["output"] || data.to_s

            metadata = {
              restaurant: data["restaurant"],
              period: data["period"],
              processing_time: data["processing_time"]
            }
          rescue JSON::ParserError
            # N8N returned plain text, not JSON
            analysis = response.body
            metadata = {}
          end

          render json: {
            success: true,
            analysis: analysis,
            metadata: metadata
          }
        else
          Rails.logger.error("N8N Error: #{response.code} - #{response.body}")
          render json: {
            success: false,
            error: "Ошибка AI-анализа. Код: #{response.code}"
          }, status: :bad_gateway
        end
      rescue Net::OpenTimeout, Net::ReadTimeout => e
        Rails.logger.error("N8N Timeout: #{e.message}")
        render json: {
          success: false,
          error: "Таймаут запроса. AI анализирует слишком долго, попробуйте позже."
        }, status: :gateway_timeout
      rescue StandardError => e
        Rails.logger.error("AI Chat Error: #{e.message}")
        render json: {
          success: false,
          error: "Произошла ошибка: #{e.message}"
        }, status: :internal_server_error
      end
    end

    private

    def require_admin
      unless @current_user&.admin?
        render json: { error: "Доступ запрещен" }, status: :forbidden
      end
    end

    def send_to_n8n(payload)
      webhook_url = N8N_AI_CHAT_WEBHOOK_URL

      unless webhook_url.present?
        raise "N8N AI Chat webhook URL не настроен. Добавьте n8n.ai_chat_webhook_url в credentials."
      end

      uri = URI.parse(webhook_url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      http.open_timeout = 30
      http.read_timeout = 120 # Claude может думать до 2 минут

      # Fix CRL check issue in development (certificate verify failed)
      # In production this usually works fine
      if Rails.env.development?
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE
      end

      request = Net::HTTP::Post.new(uri.request_uri)
      request["Content-Type"] = "application/json"
      request["Authorization"] = "Bearer #{N8N_API_TOKEN}" if N8N_API_TOKEN.present?
      request.body = payload.to_json

      http.request(request)
    end
  end
end
