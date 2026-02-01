class AiChatAnalysisJob < ApplicationJob
  queue_as :default

  def perform(session_id, question, restaurant_id, user_id)
    # Отправляем на N8N (может занять 1-2 минуты)
    payload = {
      question: question,
      restaurant_id: restaurant_id,
      user_id: user_id,
      session_id: session_id,
      timestamp: Time.current.iso8601
    }

    begin
      response = send_to_n8n(payload)

      if response.is_a?(Net::HTTPSuccess)
        # Try to parse as JSON, fallback to plain text
        begin
          data = JSON.parse(response.body)
          data = data.first if data.is_a?(Array) && data.any?
          analysis = data["analysis"] || data["content"] || data["message"] || data["output"] || data.to_s
        rescue JSON::ParserError
          # N8N returned plain text/markdown, not JSON
          analysis = response.body
        end

        # Отправляем результат через ActionCable
        ActionCable.server.broadcast(
          "ai_chat_channel_#{session_id}",
          {
            type: "analysis_complete",
            success: true,
            analysis: analysis
          }
        )
      else
        ActionCable.server.broadcast(
          "ai_chat_channel_#{session_id}",
          {
            type: "analysis_complete",
            success: false,
            error: "Ошибка AI-анализа. Код: #{response.code}"
          }
        )
      end
    rescue StandardError => e
      ActionCable.server.broadcast(
        "ai_chat_channel_#{session_id}",
        {
          type: "analysis_complete",
          success: false,
          error: e.message
        }
      )
    end
  end

  private

  def send_to_n8n(payload)
    require "net/http"
    require "uri"

    webhook_url = N8N_AI_CHAT_WEBHOOK_URL
    uri = URI.parse(webhook_url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.open_timeout = 30
    http.read_timeout = 120

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
