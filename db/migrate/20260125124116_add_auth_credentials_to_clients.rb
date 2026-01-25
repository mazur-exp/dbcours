class AddAuthCredentialsToClients < ActiveRecord::Migration[8.0]
  def change
    add_column :clients, :grab_username, :string
    add_column :clients, :grab_password, :string
    add_column :clients, :gojek_username, :string
    add_column :clients, :gojek_password, :string
  end
end
