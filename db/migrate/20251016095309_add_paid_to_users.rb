class AddPaidToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :paid, :boolean, default: false, null: false

    # Set all existing admins to paid
    reversible do |dir|
      dir.up do
        execute "UPDATE users SET paid = 1 WHERE admin = 1"
      end
    end
  end
end
