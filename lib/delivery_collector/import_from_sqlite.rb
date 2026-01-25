# Import Grab/GoJek tokens from script's local SQLite database to Rails
require 'sqlite3'

sqlite_path = "/Users/mzr/Downloads/delivery_booster_gojek_grab_DB_MAC 2/database/database.sqlite"

unless File.exist?(sqlite_path)
  puts "❌ SQLite file not found: #{sqlite_path}"
  exit 1
end

puts "🔐 Importing tokens from script's SQLite database..."
puts

db = SQLite3::Database.new(sqlite_path)
db.results_as_hash = true

restaurants = db.execute("SELECT * FROM restaurants")

puts "Found #{restaurants.length} restaurants in SQLite"
puts

imported = 0
skipped = 0

restaurants.each do |row|
  name = row["name"]
  client = Client.find_by(name: name)

  unless client
    puts "⏭️  Skip: #{name} (not in Rails)"
    skipped += 1
    next
  end

  begin
    client.update!(
      grab_token: row["grab_token"],
      grab_user_id: row["grab_user_id"],
      grab_store_id: row["grab_store_id"],
      grab_merchant_id: row["grab_merchant_id"],
      grab_advertiser_id: row["grab_advertiser_id"],
      grab_food_entity_id: row["grab_food_entity_id"],
      gojek_merchant_id: row["gojek_merchant_id"],
      gojek_client_id: row["gojek_client_id"],
      gojek_refresh_token: row["gojek_refresh_token"],
      gojek_access_token: row["gojek_access_token"]
    )

    puts "✅ #{name}"
    imported += 1
  rescue => e
    puts "❌ #{name}: #{e.message}"
  end
end

db.close

puts
puts "=" * 50
puts "📊 Import Summary:"
puts "  ✅ Imported: #{imported}"
puts "  ⏭️  Skipped: #{skipped}"
puts "=" * 50
puts "\n🎉 Tokens imported and encrypted!"
