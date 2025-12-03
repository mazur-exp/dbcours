class CreateClients < ActiveRecord::Migration[8.0]
  def change
    create_table :clients do |t|
      t.string :name, null: false
      t.date :start_date
      t.text :goals
      t.text :notes
      t.string :contact_name
      t.string :contact_phone
      t.string :contact_telegram
      t.string :status, default: "active"

      t.timestamps
    end

    add_index :clients, :name
    add_index :clients, :status
  end
end
