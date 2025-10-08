class CreateMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :messages do |t|
      t.references :conversation, null: false, foreign_key: true
      t.references :user, null: true, foreign_key: true # nullable для админских сообщений
      t.text :body, null: false
      t.integer :direction, null: false, default: 0 # 0: incoming, 1: outgoing
      t.bigint :telegram_message_id
      t.boolean :read, default: false

      t.timestamps
    end

    add_index :messages, :telegram_message_id
    add_index :messages, [:conversation_id, :created_at]
  end
end
