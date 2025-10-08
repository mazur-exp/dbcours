class CreateConversations < ActiveRecord::Migration[8.0]
  def change
    create_table :conversations do |t|
      t.references :user, null: false, foreign_key: true
      t.datetime :last_message_at
      t.integer :unread_count, default: 0

      t.timestamps
    end

    add_index :conversations, :last_message_at
  end
end
