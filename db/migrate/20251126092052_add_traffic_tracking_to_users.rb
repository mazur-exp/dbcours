class AddTrafficTrackingToUsers < ActiveRecord::Migration[8.0]
  def change
    add_reference :users, :traffic_source, foreign_key: true
    add_column :users, :utm_params, :text
  end
end
