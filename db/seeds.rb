# frozen_string_literal: true

# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

puts "🌱 Seeding database..."

# Import ALL restaurants from deliverybooster_api MySQL database as Clients
# Source: /Users/mzr/Developments/delivery_booster_gojek_grab_DB_MAC/restaurants.js
restaurant_names = [
  "12 Urban Cafe (Canggu)", "9 Spice (Canggu)", "Accent", "Ame",
  "Arctic Restaurant (Ubud)", "Asai Cafe (Jimbaran)", "BBQing (Canggu)", "Balagan",
  "Bali Babe (Uluwatu)", "Bazar (Canggu)", "Bread Shop (Uluwatu)",
  "Bread and Breakfast (Canggu)", "Bread and Breakfast (Nusa Dua)", "Bread and Breakfast (Seminyak)",
  "Brie", "Bright (Canggu)", "Buba Tea (Canggu)", "Chopped Salads Bowls (Canggu)",
  "Cosmo Burger (Canggu)", "Cosmo Burger (Ubud)", "Crave Cookies (Canggu)", "CreamSoda (Ubud)",
  "DOM ITALIAN RESTAURANT (Canggu)", "Dodo (Canggu)", "Double smash burger (Canggu)", "Ducat",
  "EGGSPOT (Canggu)", "Eggspot (Uluwatu)", "Eggspress (Canggu)", "Ele",
  "Enjoy Your Meal (Phuket)", "Flour Cafe (Jimbaran)", "Frangi (Kerobokan)",
  "G-Sushi (Canggu)", "G-Sushi (Uluwatu)", "George`s BBQ House (Canggu)",
  "Healhy Fit (Uluwatu)", "Healthy Fit (Canggu)", "Healthy Tribes",
  "Healthy balanced food (Canggu)", "Healthy balanced food (Nusa Dua)", "Healthy balanced food (Seminyak)",
  "Hey Italia (CANGGU)", "Home Sweet Home (Canggu)", "Home Sweet Home (Nusa Dua)",
  "Home Sweet Home (Seminyak)", "Honey Murena (Canggu)", "HoneyFit", "Honeycomb",
  "Hot Doggy Style (Uluwatu)", "Ika Canggu", "Ika Kero", "Ika Ubud", "Ika Uluwatu",
  "Immigrant (Canggu)", "Immigrant (Nusa Dua)", "Immigrant (Seminyak)",
  "Jolies (Canggu)", "Juice Box (Canggu)", "Jungle flower (Ubud)", "Kuniroll Sushi (Ubud)",
  "Lit pizza (Uluwatu)", "Love U Pizza (CANGGU)", "Lucky slice (Canggu)", "Mavammy (Canggu)",
  "Mela", "Monsta pizza", "Mur Mur", "My Place (Canggu)", "My Place (Seminyak)",
  "My place (Nusa Dua)", "My place 2 (Nusa Dua)", "Nami Sushi Bar (Canggu)",
  "Napoletana Pizza & Pasta (Uluwatu)", "Nautilus", "Nena Cafe (Berawa)",
  "Nena Cafe (Pererenan)", "Nena Cafe (Ubud)", "Ninja Sushi (Canggu)",
  "Ninja Sushi (Kero)", "Ninja Sushi (Ubud)", "Ninja Sushi (Uluwatu)",
  "Nutria (Uluwatu)", "Only Eggs", "Only Eggs (Uluwatu)", "Only Kebab",
  "Originals (Canggu)", "Panda Bali Express (Canggu)", "Pasta Box (Canggu)",
  "Pasta Box (Ubud)", "Pink man 2 (Berawa)", "Pinkman", "Pinkman (Ubud)",
  "Plant Theory (Canggu)", "Plant Theory (Ubud)", "Prana", "Protein Kitchen",
  "Protein Waffle Bar (Canggu)", "Quick and Tasty", "Rasgulai (Uluwatu)", "Ropana",
  "See You", "Sexy Fish Sushi", "Sexy Fish Sushi (Ubud)", "Shaffa Gastro Bar (Uluwatu)",
  "Signa", "Signa Pizza (Bukit)", "Smoothie Shop (ULUWATU)", "Soda Cafe (Uluwatu)",
  "Soul Kitchen", "Sushi Sora (Canggu)", "Tea Duck (Uluwatu)", "Teamo",
  "The Roof (Sanur)", "The Room", "The Room (Uluwatu)", "To The Moon (Umalas)",
  "To The Moon Sushi (Umalas)", "Unit Cafe (Canggu)", "WOK (Canggu)", "WOK (Ungasan)",
  "Yes Shawarma (Uluwatu)", "Yoza Pizza (Kerobokan)", "Zaytun (Canggu)",
  "Zaytun (Ubud)", "Zaytun (Uluwatu)"
]

created = 0
skipped = 0

restaurant_names.each do |name|
  client = Client.find_or_initialize_by(name: name)

  if client.new_record?
    client.status = "active"
    client.save!
    created += 1
  else
    skipped += 1
  end
end

puts "\n✅ Import complete!"
puts "Created: #{created} new clients"
puts "Skipped: #{skipped} existing clients"
puts "📊 Total clients: #{Client.count}"
puts "👤 Total users (Telegram leads): #{User.count}"
puts "\n💡 Clients and Users are SEPARATE tables:"
puts "   • Clients = Restaurants (for analytics)"
puts "   • Users = Telegram leads (for CRM)"

