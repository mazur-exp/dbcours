class AddApiCredentialsToClients < ActiveRecord::Migration[8.0]
  def change
    add_column :clients, :grab_token, :text
    add_column :clients, :grab_user_id, :string
    add_column :clients, :grab_store_id, :string
    add_column :clients, :grab_merchant_id, :string
    add_column :clients, :grab_advertiser_id, :string
    add_column :clients, :grab_food_entity_id, :string
    add_column :clients, :gojek_merchant_id, :string
    add_column :clients, :gojek_client_id, :string
    add_column :clients, :gojek_refresh_token, :text
    add_column :clients, :gojek_access_token, :text
  end
end
