# frozen_string_literal: true

require "net/http"
require "json"

class DeliveryStatsClient
  API_BASE_URL = ENV.fetch("DELIVERY_STATS_API_URL", "http://5.187.7.140:3000")
  API_VERSION = "v1"

  class << self
    # Get restaurant statistics
    def get_restaurant_stats(restaurant_name:, source:, start_date: nil, end_date: nil)
      params = {
        restaurant_name: restaurant_name,
        source: source
      }
      params[:start_date] = start_date.to_s if start_date
      params[:end_date] = end_date.to_s if end_date

      response = get_request("/api/#{API_VERSION}/getRestaurantStats", params)
      parse_response(response)
    end

    # Get fields info for a source
    def get_fields_info(source:)
      response = get_request("/api/#{API_VERSION}/getFieldsInfo", { source: source })
      parse_response(response)
    end

    # Trigger data collection on the server
    def trigger_collection
      response = post_request("/api/#{API_VERSION}/triggerCollection")
      parse_response(response)
    end

    private

    def get_request(path, params = {})
      uri = URI("#{API_BASE_URL}#{path}")
      uri.query = URI.encode_www_form(params) if params.any?

      request = Net::HTTP::Get.new(uri)
      request["Accept"] = "application/json"

      http = Net::HTTP.new(uri.host, uri.port)
      http.read_timeout = 30
      http.open_timeout = 10

      http.request(request)
    rescue StandardError => e
      Rails.logger.error "Delivery Stats API Error: #{e.message}"
      nil
    end

    def post_request(path, body = {})
      uri = URI("#{API_BASE_URL}#{path}")

      request = Net::HTTP::Post.new(uri)
      request["Content-Type"] = "application/json"
      request["Accept"] = "application/json"
      request.body = body.to_json

      http = Net::HTTP.new(uri.host, uri.port)
      http.read_timeout = 900 # 15 minutes for collection
      http.open_timeout = 10

      http.request(request)
    rescue StandardError => e
      Rails.logger.error "Delivery Stats API Error: #{e.message}"
      nil
    end

    def parse_response(response)
      return { error: "No response" } unless response

      case response.code.to_i
      when 200
        JSON.parse(response.body, symbolize_names: true)
      when 404
        { error: "Not found" }
      when 500
        { error: "Server error" }
      else
        { error: "Unknown error: #{response.code}" }
      end
    rescue JSON::ParserError => e
      Rails.logger.error "JSON Parse Error: #{e.message}"
      { error: "Invalid JSON response" }
    end
  end
end
