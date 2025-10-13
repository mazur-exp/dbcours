class AddBusinessFieldsToMessages < ActiveRecord::Migration[8.0]
  def change
    add_column :messages, :source_type, :integer, default: 0, null: false  # enum: bot=0, business=1
    add_column :messages, :business_connection_id, :string

    add_index :messages, :business_connection_id
    add_index :messages, [:conversation_id, :source_type]
  end
end
