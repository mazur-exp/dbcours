class CreateTrafficSources < ActiveRecord::Migration[8.0]
  def change
    create_table :traffic_sources do |t|
      t.string :name, null: false
      t.string :utm_source, null: false
      t.string :utm_medium
      t.string :utm_campaign
      t.string :short_code, null: false
      t.integer :link_type, null: false, default: 0
      t.string :target_url
      t.integer :clicks_count, default: 0, null: false
      t.integer :leads_count, default: 0, null: false
      t.integer :conversions_count, default: 0, null: false

      t.timestamps
    end
    add_index :traffic_sources, :short_code, unique: true
  end
end
