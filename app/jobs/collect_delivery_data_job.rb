# frozen_string_literal: true

require "open3"

class CollectDeliveryDataJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info "[Collection] Starting data collection from Grab/GoJek APIs"

    script_path = Rails.root.join("lib", "delivery_collector")

    # Prepare credentials for all active clients
    restaurants_data = prepare_restaurants_credentials

    # Run Node.js collection script
    success = run_collection_script(script_path, restaurants_data)

    if success
      Rails.logger.info "[Collection] ✓ Data collection completed successfully"
    else
      Rails.logger.error "[Collection] ✗ Data collection failed"
      raise "Collection script failed"
    end
  end

  private

  def prepare_restaurants_credentials
    # Get all active clients with their API credentials
    clients = Client.active

    restaurants = clients.map do |client|
      {
        name: client.name,
        gojek_merchant_id: client.gojek_merchant_id,
        gojek_client_id: client.gojek_client_id || "YEZympJ5WqYRh7Hs",
        gojek_refresh_token: client.gojek_refresh_token,
        gojek_access_token: client.gojek_access_token,
        grab_token: client.grab_token,
        grab_user_id: client.grab_user_id,
        grab_store_id: client.grab_store_id,
        grab_merchant_id: client.grab_merchant_id,
        grab_advertiser_id: client.grab_advertiser_id,
        grab_food_entity_id: client.grab_food_entity_id
      }.compact  # Remove nil values
    end

    Rails.logger.info "[Collection] Prepared credentials for #{restaurants.count} clients"
    restaurants.to_json
  end

  def run_collection_script(script_path, restaurants_data)
    # Environment variables for Node.js script
    env = {
      "RAILS_ENV" => Rails.env.to_s,
      "RESTAURANTS_DATA" => restaurants_data,
      "NODE_ENV" => "production"
    }

    # Run Node.js script with timeout
    command = "node start.js both"

    Rails.logger.info "[Collection] Running: #{command}"
    Rails.logger.info "[Collection] Working directory: #{script_path}"

    stdout, stderr, status = Open3.capture3(
      env,
      command,
      chdir: script_path.to_s
    )

    # Log output
    if stdout.present?
      Rails.logger.info "[Collection] Output (first 20 lines):"
      stdout.lines.first(20).each { |line| Rails.logger.info "  #{line.chomp}" }
    end

    if stderr.present?
      Rails.logger.error "[Collection] Errors:"
      stderr.lines.first(20).each { |line| Rails.logger.error "  #{line.chomp}" }
    end

    Rails.logger.info "[Collection] Exit status: #{status.exitstatus}"

    status.success?
  rescue StandardError => e
    Rails.logger.error "[Collection] ✗ Exception: #{e.class}: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    false
  end
end
