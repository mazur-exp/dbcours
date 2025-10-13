class AddAiPausedToConversations < ActiveRecord::Migration[8.0]
  def change
    add_column :conversations, :ai_paused, :boolean, default: false, null: false
  end
end
