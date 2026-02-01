class RefactorClientsToRestaurantsAndOwners < ActiveRecord::Migration[8.0]
  def up
    # ===================================================================
    # STEP 1: Rename old "clients" table to "restaurants"
    # ===================================================================
    # This preserves all 127 restaurant records
    rename_table :clients, :restaurants
    rename_table :client_stats, :restaurant_stats
    rename_column :restaurant_stats, :client_id, :restaurant_id

    # ===================================================================
    # STEP 2: Create NEW "clients" table for restaurant owners
    # ===================================================================
    create_table :clients do |t|
      # Basic info
      t.string :name, null: false
      t.string :contact_name
      t.string :contact_phone
      t.string :contact_email
      t.string :contact_telegram

      # Financial fields
      t.decimal :monthly_fee, precision: 12, scale: 2
      t.decimal :commission_percent, precision: 5, scale: 2
      t.decimal :commission_amount, precision: 12, scale: 2, default: 0

      # Management
      t.references :manager, foreign_key: { to_table: :users }, null: true
      t.string :status, default: "active"

      # Chat integration (Telegram/WhatsApp)
      t.bigint :telegram_chat_id
      t.string :whatsapp_chat_id
      t.string :channel_type  # "telegram" or "whatsapp"

      # Additional fields
      t.date :start_date
      t.text :goals
      t.text :notes

      t.timestamps
    end

    add_index :clients, :name
    add_index :clients, :telegram_chat_id
    add_index :clients, :status

    # ===================================================================
    # STEP 3: Link restaurants to their owners
    # ===================================================================
    add_reference :restaurants, :client, foreign_key: true, null: true

    # ===================================================================
    # STEP 4: Make conversations polymorphic (User OR Client)
    # ===================================================================
    add_column :conversations, :conversable_type, :string
    add_column :conversations, :conversable_id, :integer
    add_column :conversations, :channel_type, :string, default: 'telegram'

    # Migrate existing User conversations to polymorphic format
    Conversation.reset_column_information
    Conversation.update_all(conversable_type: 'User')
    Conversation.find_each do |conv|
      conv.update_column(:conversable_id, conv.user_id) if conv.user_id.present?
    end

    add_index :conversations, [:conversable_type, :conversable_id]

    # Keep user_id for backward compatibility
  end

  def down
    # Reverse polymorphic conversations
    remove_index :conversations, [:conversable_type, :conversable_id]
    remove_column :conversations, :conversable_type
    remove_column :conversations, :conversable_id
    remove_column :conversations, :channel_type

    # Remove client_id from restaurants
    remove_reference :restaurants, :client

    # Drop new clients table
    drop_table :clients

    # Restore original clients table
    rename_column :restaurant_stats, :restaurant_id, :client_id
    rename_table :restaurant_stats, :client_stats
    rename_table :restaurants, :clients
  end
end
