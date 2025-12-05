class ChangeUserIdNullableInTrafficClicks < ActiveRecord::Migration[8.0]
  def change
    change_column_null :traffic_clicks, :user_id, true
  end
end
