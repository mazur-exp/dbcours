class AddProductToTrafficSources < ActiveRecord::Migration[8.0]
  def change
    # product: 0 = course (курс/CRM), 1 = tracker (трекер), 2 = landing (лендинг/сайт)
    add_column :traffic_sources, :product, :integer, null: false, default: 0
  end
end
