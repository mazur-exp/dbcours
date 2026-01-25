# frozen_string_literal: true

# Helper script to import credentials from old restaurants.js to Rails clients table
#
# Usage:
#   cd /Users/mzr/Developments/dbcours
#   bin/rails runner lib/delivery_collector/import_credentials.rb

require "json"

puts "🔐 Importing credentials from restaurants.js to Rails database..."
puts

# Path to converted JSON file
json_path = Rails.root.join("lib", "delivery_collector", "restaurants_temp.json")

unless File.exist?(json_path)
  puts "❌ File not found: #{json_path}"
  puts "Run: node lib/delivery_collector/convert_to_json.js > lib/delivery_collector/restaurants_temp.json"
  exit 1
end

# Read and parse JSON
begin
  restaurants_data = JSON.parse(File.read(json_path))
rescue JSON::ParserError => e
  puts "❌ Failed to parse JSON: #{e.message}"
  exit 1
end

puts "Found #{restaurants_data.length} restaurants in restaurants.js"
puts

# Import credentials for matching clients
imported_count = 0
skipped_count = 0
error_count = 0

restaurants_data.each do |rest_data|
  name = rest_data["name"]

  # Find matching client in Rails database
  client = Client.find_by(name: name)

  unless client
    puts "⏭️  Skipped: #{name} (not found in Rails clients)"
    skipped_count += 1
    next
  end

  begin
    # Update client with API credentials
    client.update!(
      gojek_merchant_id: rest_data["gojek_merchant_id"],
      gojek_client_id: rest_data["gojek_client_id"] || "YEZympJ5WqYRh7Hs",
      gojek_refresh_token: rest_data["gojek_refresh_token"],
      gojek_access_token: rest_data["gojek_access_token"],
      grab_token: rest_data["grab_token"],
      grab_user_id: rest_data["grab_user_id"],
      grab_store_id: rest_data["grab_store_id"],
      grab_merchant_id: rest_data["grab_merchant_id"],
      grab_advertiser_id: rest_data["grab_advertiser_id"],
      grab_food_entity_id: rest_data["grab_food_entity_id"]
    )

    puts "✅ Imported: #{name} (ID: #{client.id})"
    imported_count += 1

  rescue StandardError => e
    puts "❌ Error importing #{name}: #{e.message}"
    error_count += 1
  end
end

puts
puts "=" * 50
puts "📊 Import Summary:"
puts "  ✅ Imported: #{imported_count}"
puts "  ⏭️  Skipped: #{skipped_count}"
puts "  ❌ Errors: #{error_count}"
puts "=" * 50
puts
puts "🎉 Credentials imported successfully!"
puts "You can now test the collection script."
