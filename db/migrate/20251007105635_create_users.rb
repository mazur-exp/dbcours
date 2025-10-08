class CreateUsers < ActiveRecord::Migration[8.0]
  def change
    create_table :users do |t|
      t.bigint :telegram_id, null: false
      t.string :username
      t.string :first_name
      t.string :last_name
      t.string :session_token
      t.boolean :authenticated, default: false

      t.timestamps
    end

    add_index :users, :telegram_id, unique: true
    add_index :users, :session_token, unique: true
  end
end
