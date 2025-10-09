class AddAiQualificationToConversations < ActiveRecord::Migration[8.0]
  def change
    add_column :conversations, :ai_real_name, :string
    add_column :conversations, :ai_background, :text
    add_column :conversations, :ai_query, :text
    add_column :conversations, :ai_ready_score, :integer
  end
end
