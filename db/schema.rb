# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_01_25_124116) do
  create_table "business_connections", force: :cascade do |t|
    t.string "business_connection_id", null: false
    t.integer "user_id", null: false
    t.bigint "user_chat_id", null: false
    t.boolean "can_reply", default: false, null: false
    t.boolean "is_enabled", default: true, null: false
    t.datetime "connected_at", null: false
    t.datetime "disconnected_at"
    t.integer "status", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["business_connection_id"], name: "index_business_connections_on_business_connection_id", unique: true
    t.index ["user_id", "status"], name: "index_business_connections_on_user_id_and_status"
    t.index ["user_id"], name: "index_business_connections_on_user_id"
  end

  create_table "client_stats", force: :cascade do |t|
    t.integer "client_id", null: false
    t.date "stat_date", null: false
    t.decimal "grab_sales", precision: 12, scale: 2, default: "0.0"
    t.integer "grab_orders", default: 0
    t.decimal "grab_ads_spend", precision: 12, scale: 2, default: "0.0"
    t.decimal "grab_ads_sales", precision: 12, scale: 2, default: "0.0"
    t.integer "grab_new_customers", default: 0
    t.integer "grab_repeated_customers", default: 0
    t.integer "grab_fake_orders", default: 0
    t.decimal "gojek_sales", precision: 12, scale: 2, default: "0.0"
    t.integer "gojek_orders", default: 0
    t.decimal "gojek_ads_spend", precision: 12, scale: 2, default: "0.0"
    t.decimal "gojek_ads_sales", precision: 12, scale: 2, default: "0.0"
    t.integer "gojek_new_customers", default: 0
    t.integer "gojek_returned_customers", default: 0
    t.integer "gojek_fake_orders", default: 0
    t.decimal "total_sales", precision: 12, scale: 2, default: "0.0"
    t.integer "total_orders", default: 0
    t.datetime "synced_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["client_id", "stat_date"], name: "index_client_stats_on_client_and_date", unique: true
    t.index ["client_id"], name: "index_client_stats_on_client_id"
    t.index ["stat_date"], name: "index_client_stats_on_stat_date"
    t.index ["synced_at"], name: "index_client_stats_on_synced_at"
    t.index ["total_sales"], name: "index_client_stats_on_total_sales"
  end

  create_table "clients", force: :cascade do |t|
    t.string "name", null: false
    t.date "start_date"
    t.text "goals"
    t.text "notes"
    t.string "contact_name"
    t.string "contact_phone"
    t.string "contact_telegram"
    t.string "status", default: "active"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "grab_token"
    t.string "grab_user_id"
    t.string "grab_store_id"
    t.string "grab_merchant_id"
    t.string "grab_advertiser_id"
    t.string "grab_food_entity_id"
    t.string "gojek_merchant_id"
    t.string "gojek_client_id"
    t.text "gojek_refresh_token"
    t.text "gojek_access_token"
    t.string "grab_username"
    t.string "grab_password"
    t.string "gojek_username"
    t.string "gojek_password"
    t.index ["name"], name: "index_clients_on_name"
    t.index ["status"], name: "index_clients_on_status"
  end

  create_table "conversations", force: :cascade do |t|
    t.integer "user_id", null: false
    t.datetime "last_message_at"
    t.integer "unread_count", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "ai_real_name"
    t.text "ai_background"
    t.text "ai_query"
    t.integer "ai_ready_score"
    t.boolean "ai_processing", default: false
    t.boolean "ai_paused", default: false, null: false
    t.string "ai_restaurant_name"
    t.string "ai_platform"
    t.integer "ai_orders_per_day"
    t.decimal "ai_rating", precision: 2, scale: 1
    t.boolean "ai_uses_ads"
    t.text "ai_main_problem"
    t.string "ai_urgency"
    t.boolean "ai_is_new_brand"
    t.string "ai_location"
    t.boolean "ai_is_pql", default: false
    t.string "ai_action", default: "none"
    t.json "ai_red_flags"
    t.json "ai_pql_signals"
    t.index ["last_message_at"], name: "index_conversations_on_last_message_at"
    t.index ["user_id"], name: "index_conversations_on_user_id"
  end

  create_table "messages", force: :cascade do |t|
    t.integer "conversation_id", null: false
    t.integer "user_id"
    t.text "body", null: false
    t.integer "direction", default: 0, null: false
    t.bigint "telegram_message_id"
    t.boolean "read", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "source_type", default: 0, null: false
    t.string "business_connection_id"
    t.index ["business_connection_id"], name: "index_messages_on_business_connection_id"
    t.index ["conversation_id", "created_at"], name: "index_messages_on_conversation_id_and_created_at"
    t.index ["conversation_id", "source_type"], name: "index_messages_on_conversation_id_and_source_type"
    t.index ["conversation_id"], name: "index_messages_on_conversation_id"
    t.index ["telegram_message_id"], name: "index_messages_on_telegram_message_id"
    t.index ["user_id"], name: "index_messages_on_user_id"
  end

  create_table "traffic_clicks", force: :cascade do |t|
    t.integer "traffic_source_id", null: false
    t.integer "user_id"
    t.string "ip_address"
    t.string "user_agent"
    t.datetime "clicked_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["traffic_source_id"], name: "index_traffic_clicks_on_traffic_source_id"
    t.index ["user_id"], name: "index_traffic_clicks_on_user_id"
  end

  create_table "traffic_sources", force: :cascade do |t|
    t.string "name", null: false
    t.string "utm_source", null: false
    t.string "utm_medium"
    t.string "utm_campaign"
    t.string "short_code", null: false
    t.integer "link_type", default: 0, null: false
    t.string "target_url"
    t.integer "clicks_count", default: 0, null: false
    t.integer "leads_count", default: 0, null: false
    t.integer "conversions_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "product", default: 0, null: false
    t.index ["short_code"], name: "index_traffic_sources_on_short_code", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.bigint "telegram_id", null: false
    t.string "username"
    t.string "first_name"
    t.string "last_name"
    t.string "session_token"
    t.boolean "authenticated", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "admin", default: false, null: false
    t.string "avatar_url"
    t.boolean "paid", default: false, null: false
    t.integer "crm_status", default: 0, null: false
    t.integer "crm_position"
    t.integer "traffic_source_id"
    t.text "utm_params"
    t.index ["crm_status", "crm_position"], name: "index_users_on_crm_status_and_crm_position"
    t.index ["crm_status"], name: "index_users_on_crm_status"
    t.index ["session_token"], name: "index_users_on_session_token", unique: true
    t.index ["telegram_id"], name: "index_users_on_telegram_id", unique: true
    t.index ["traffic_source_id"], name: "index_users_on_traffic_source_id"
  end

  add_foreign_key "business_connections", "users"
  add_foreign_key "client_stats", "clients"
  add_foreign_key "conversations", "users"
  add_foreign_key "messages", "conversations"
  add_foreign_key "messages", "users"
  add_foreign_key "traffic_clicks", "traffic_sources"
  add_foreign_key "traffic_clicks", "users"
  add_foreign_key "users", "traffic_sources"
end
