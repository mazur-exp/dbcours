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
puts "🎉 Seeding completed!"
puts
puts "💡 Next steps:"
puts "   • Verify clients: bin/rails console"
puts "   • Check credentials: Client.where.not(grab_token: nil).count"
