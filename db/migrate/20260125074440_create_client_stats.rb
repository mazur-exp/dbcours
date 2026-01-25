# frozen_string_literal: true

class CreateClientStats < ActiveRecord::Migration[8.0]
  def change
    create_table :client_stats do |t|
      t.references :client, null: false, foreign_key: true
      t.date :stat_date, null: false

      # Grab metrics
      t.decimal :grab_sales, precision: 12, scale: 2, default: 0
      t.integer :grab_orders, default: 0
      t.decimal :grab_ads_spend, precision: 12, scale: 2, default: 0
      t.decimal :grab_ads_sales, precision: 12, scale: 2, default: 0
      t.integer :grab_new_customers, default: 0
      t.integer :grab_repeated_customers, default: 0
      t.integer :grab_fake_orders, default: 0

      # GoJek metrics
      t.decimal :gojek_sales, precision: 12, scale: 2, default: 0
      t.integer :gojek_orders, default: 0
      t.decimal :gojek_ads_spend, precision: 12, scale: 2, default: 0
      t.decimal :gojek_ads_sales, precision: 12, scale: 2, default: 0
      t.integer :gojek_new_customers, default: 0
      t.integer :gojek_returned_customers, default: 0
      t.integer :gojek_fake_orders, default: 0

      # Aggregated totals
      t.decimal :total_sales, precision: 12, scale: 2, default: 0
      t.integer :total_orders, default: 0

      # Sync metadata
      t.datetime :synced_at

      t.timestamps
    end

    add_index :client_stats, [:client_id, :stat_date], unique: true, name: "index_client_stats_on_client_and_date"
    add_index :client_stats, :stat_date
    add_index :client_stats, :total_sales
    add_index :client_stats, :synced_at
  end
end
