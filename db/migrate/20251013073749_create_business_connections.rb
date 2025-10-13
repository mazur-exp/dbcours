class CreateBusinessConnections < ActiveRecord::Migration[8.0]
  def change
    create_table :business_connections do |t|
      t.string :business_connection_id, null: false
      t.references :user, null: false, foreign_key: true
      t.bigint :user_chat_id, null: false
      t.boolean :can_reply, default: false, null: false
      t.boolean :is_enabled, default: true, null: false
      t.datetime :connected_at, null: false
      t.datetime :disconnected_at
      t.integer :status, default: 0, null: false  # enum: active=0, disconnected=1

      t.timestamps
    end

    add_index :business_connections, :business_connection_id, unique: true
    add_index :business_connections, [:user_id, :status]
  end
end
