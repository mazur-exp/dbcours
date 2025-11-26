class CreateTrafficClicks < ActiveRecord::Migration[8.0]
  def change
    create_table :traffic_clicks do |t|
      t.references :traffic_source, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.string :ip_address
      t.string :user_agent
      t.datetime :clicked_at

      t.timestamps
    end
  end
end
