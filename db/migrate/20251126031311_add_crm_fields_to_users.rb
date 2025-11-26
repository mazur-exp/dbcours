class AddCrmFieldsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :crm_status, :integer, default: 0, null: false
    add_column :users, :crm_position, :integer

    add_index :users, :crm_status
    add_index :users, [:crm_status, :crm_position]
  end
end
