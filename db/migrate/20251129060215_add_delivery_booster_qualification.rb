class AddDeliveryBoosterQualification < ActiveRecord::Migration[8.0]
  def change
    # DeliveryBooster qualification fields
    add_column :conversations, :ai_restaurant_name, :string
    add_column :conversations, :ai_platform, :string           # gojek/grab/both
    add_column :conversations, :ai_orders_per_day, :integer
    add_column :conversations, :ai_rating, :decimal, precision: 2, scale: 1
    add_column :conversations, :ai_uses_ads, :boolean
    add_column :conversations, :ai_main_problem, :text
    add_column :conversations, :ai_urgency, :string            # high/medium/low
    add_column :conversations, :ai_is_new_brand, :boolean
    add_column :conversations, :ai_location, :string

    # PQL and escalation fields
    add_column :conversations, :ai_is_pql, :boolean, default: false
    add_column :conversations, :ai_action, :string, default: 'none'  # none/escalate/schedule_call
    add_column :conversations, :ai_red_flags, :json             # array of strings
    add_column :conversations, :ai_pql_signals, :json           # array of detected signals
  end
end
