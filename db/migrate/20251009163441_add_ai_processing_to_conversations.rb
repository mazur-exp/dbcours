class AddAiProcessingToConversations < ActiveRecord::Migration[8.0]
  def change
    add_column :conversations, :ai_processing, :boolean, default: false
  end
end
