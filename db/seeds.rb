# frozen_string_literal: true

# Import clients from JSON export (development → production)
# This file imports full client records including API credentials

require "json"

puts "🌱 Seeding production database with clients from development..."
puts

# Load JSON data from db/clients_production.json
json_file = Rails.root.join("db", "clients_production.json")

unless File.exist?(json_file)
  puts "❌ File not found: #{json_file}"
  puts "This file should contain exported client data from development."
  exit 1
end

data = JSON.parse(File.read(json_file))
puts "📦 Found #{data.length} clients in export"
puts

imported = 0
updated = 0
skipped = 0
errors = 0

data.each do |attrs|
  name = attrs["name"]

  # Find or initialize client by name
  client = Client.find_or_initialize_by(name: name)

  if client.new_record?
    # New client - create with all attributes
    begin
      client.assign_attributes(attrs.except("id", "created_at", "updated_at"))
      client.save!
      puts "✅ Created: #{name}"
      imported += 1
    rescue StandardError => e
      puts "❌ Error creating #{name}: #{e.message}"
      errors += 1
    end
  elsif client.grab_token.blank? && attrs["grab_token"].present?
    # Existing client but missing credentials - update
    begin
      client.assign_attributes(attrs.except("id", "name", "status", "created_at", "updated_at"))
      client.save!
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
puts "  ✅ Created: #{imported} new clients"
puts "  🔄 Updated: #{updated} clients with credentials"
puts "  ⏭️  Skipped: #{skipped} existing clients"
puts "  ❌ Errors: #{errors}"
puts "  📋 Total in database: #{Client.count}"
puts "=" * 70
puts
puts "🎉 Clients seeding completed!"
puts
puts "💡 Next steps:"
puts "   • Verify clients: bin/rails console"
puts "   • Check credentials: Client.where.not(grab_token: nil).count"

# ============================================================================
# Import ClientStats (Delivery Data History)
# ============================================================================
puts
puts "=" * 70
puts "📊 Importing ClientStats (delivery data history)..."
puts "=" * 70
puts

stats_file = Rails.root.join("db", "client_stats_export.json")

unless File.exist?(stats_file)
  puts "⚠️  ClientStats file not found: #{stats_file}"
  puts "   Skipping ClientStats import (dashboard will be empty until data collection runs)"
else
  stats_data = JSON.parse(File.read(stats_file))
  puts "📦 Found #{stats_data.length} ClientStat records in export"
  puts

  stats_imported = 0
  stats_errors = 0

  stats_data.each_with_index do |attrs, index|
    begin
      ClientStat.upsert(
        attrs,
        unique_by: [:client_id, :stat_date]
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
  puts "📊 ClientStats Import Summary:"
  puts "  ✅ Imported: #{stats_imported} records"
  puts "  ❌ Errors: #{stats_errors}"
  if ClientStat.any?
    puts "  📅 Date range: #{ClientStat.minimum(:stat_date)} to #{ClientStat.maximum(:stat_date)}"
    puts "  🏪 Clients with data: #{Client.joins(:client_stats).distinct.count}"
  end
  puts "=" * 70
  puts
  puts "🎉 Full seeding completed!"
end
