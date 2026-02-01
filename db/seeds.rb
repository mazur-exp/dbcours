# frozen_string_literal: true

# Import restaurants from JSON export (development → production)
# This file imports full restaurant records including API credentials

require "json"

puts "🌱 Seeding production database with restaurants from development..."
puts

# Load JSON data from db/clients_production.json (old export filename)
json_file = Rails.root.join("db", "clients_production.json")

unless File.exist?(json_file)
  puts "❌ File not found: #{json_file}"
  puts "This file should contain exported restaurant data from development."
  exit 1
end

data = JSON.parse(File.read(json_file))
puts "📦 Found #{data.length} restaurants in export"
puts

imported = 0
updated = 0
skipped = 0
errors = 0

data.each do |attrs|
  name = attrs["name"]

  # Find or initialize restaurant by name
  restaurant = Restaurant.find_or_initialize_by(name: name)

  if restaurant.new_record?
    # New restaurant - create with all attributes
    begin
      restaurant.assign_attributes(attrs.except("id", "created_at", "updated_at"))
      restaurant.save!
      puts "✅ Created: #{name}"
      imported += 1
    rescue StandardError => e
      puts "❌ Error creating #{name}: #{e.message}"
      errors += 1
    end
  elsif restaurant.grab_token.blank? && attrs["grab_token"].present?
    # Existing restaurant but missing credentials - update
    begin
      restaurant.assign_attributes(attrs.except("id", "name", "status", "created_at", "updated_at"))
      restaurant.save!
      puts "🔄 Updated credentials: #{name}"
      updated += 1
    rescue StandardError => e
      puts "❌ Error updating #{name}: #{e.message}"
      errors += 1
    end
  else
    puts "⏭️  Skipped: #{name} (already exists with credentials)"
    skipped += 1
  end
end

puts
puts "=" * 70
puts "📊 Seed Summary:"
puts "  ✅ Created: #{imported} new restaurants"
puts "  🔄 Updated: #{updated} restaurants with credentials"
puts "  ⏭️  Skipped: #{skipped} existing restaurants"
puts "  ❌ Errors: #{errors}"
puts "  📋 Total in database: #{Restaurant.count}"
puts "=" * 70
puts
puts "🎉 Restaurants seeding completed!"
puts
puts "💡 Next steps:"
puts "   • Verify restaurants: bin/rails console"
puts "   • Check credentials: Restaurant.where.not(grab_token: nil).count"

# ============================================================================
# Import RestaurantStats (Delivery Data History)
# ============================================================================
puts
puts "=" * 70
puts "📊 Importing RestaurantStats (delivery data history)..."
puts "=" * 70
puts

stats_file = Rails.root.join("db", "client_stats_export.json")

unless File.exist?(stats_file)
  puts "⚠️  RestaurantStats file not found: #{stats_file}"
  puts "   Skipping RestaurantStats import (dashboard will be empty until data collection runs)"
else
  stats_data = JSON.parse(File.read(stats_file))
  puts "📦 Found #{stats_data.length} RestaurantStat records in export"
  puts

  stats_imported = 0
  stats_errors = 0

  stats_data.each_with_index do |attrs, index|
    begin
      # Rename client_id → restaurant_id for new schema
      attrs["restaurant_id"] = attrs.delete("client_id") if attrs["client_id"]

      RestaurantStat.upsert(
        attrs,
        unique_by: [:restaurant_id, :stat_date]
      )
      stats_imported += 1

      # Progress indicator every 1000 records
      if (index + 1) % 1000 == 0
        puts "   Imported #{index + 1}/#{stats_data.length} records..."
      end
    rescue StandardError => e
      stats_errors += 1
      puts "❌ Error importing stat #{index}: #{e.message}" if stats_errors <= 5
    end
  end

  puts
  puts "=" * 70
  puts "📊 RestaurantStats Import Summary:"
  puts "  ✅ Imported: #{stats_imported} records"
  puts "  ❌ Errors: #{stats_errors}"
  if RestaurantStat.any?
    puts "  📅 Date range: #{RestaurantStat.minimum(:stat_date)} to #{RestaurantStat.maximum(:stat_date)}"
    puts "  🏪 Restaurants with data: #{Restaurant.joins(:restaurant_stats).distinct.count}"
  end
  puts "=" * 70
  puts
  puts "🎉 Full seeding completed!"
end
