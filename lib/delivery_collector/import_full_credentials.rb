# Import FULL credentials (tokens + usernames/passwords) from restaurants.json
# All sensitive data will be encrypted by Rails

require 'json'

json_path = Rails.root.join("lib", "delivery_collector", "restaurants_temp.json")

unless File.exist?(json_path)
  puts "❌ File not found: #{json_path}"
  exit 1
end

restaurants_data = JSON.parse(File.read(json_path))

puts "🔐 Importing FULL credentials (tokens + usernames/passwords)..."
puts "Total restaurants in file: #{restaurants_data.length}"
puts

imported = 0
skipped = 0
errors = 0

restaurants_data.each do |rest|
  name = rest["name"]
  client = Client.find_by(name: name)

  unless client
    skipped += 1
    next
  end

  begin
    client.update!(
      # Grab
      grab_token: rest["grab_token"],
      grab_user_id: rest["grab_user_id"],
      grab_store_id: rest["grab_store_id"],
      grab_merchant_id: rest["grab_merchant_id"],
      grab_advertiser_id: rest["grab_advertiser_id"],
      grab_food_entity_id: rest["grab_food_entity_id"],
      grab_username: rest.dig("grab", "username"),
      grab_password: rest.dig("grab", "password"),
      # GoJek
      gojek_merchant_id: rest["gojek_merchant_id"],
      gojek_client_id: rest["gojek_client_id"] || "YEZympJ5WqYRh7Hs",
      gojek_refresh_token: rest["gojek_refresh_token"],
      gojek_access_token: rest["gojek_access_token"],
      gojek_username: rest.dig("gojek", "username"),
      gojek_password: rest.dig("gojek", "password")
    )

    puts "✅ #{name}"
    imported += 1

  rescue => e
    puts "❌ #{name}: #{e.message}"
    errors += 1
  end
end

puts
puts "=" * 70
puts "📊 Import Summary:"
puts "  ✅ Imported: #{imported}"
puts "  ⏭️  Skipped: #{skipped} (not found in Rails)"
puts "  ❌ Errors: #{errors}"
puts "=" * 70
puts
puts "🔐 All sensitive data encrypted in database!"
puts "Ready for production deployment!"
