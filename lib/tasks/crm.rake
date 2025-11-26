namespace :crm do
  desc "Update CRM statuses for existing users based on their data"
  task update_statuses: :environment do
    puts "Updating CRM statuses for existing users..."

    User.find_each do |user|
      old_status = user.crm_status

      # Определяем правильный статус на основе данных
      new_status = if user.paid?
                    :paid_status
                  elsif user.conversation&.ai_ready_score && user.conversation.ai_ready_score >= 7
                    :interested
                  elsif user.conversation&.ai_ready_score && user.conversation.ai_ready_score >= 4
                    :qualified
                  elsif user.messages.where(direction: :incoming).any?
                    :contacted
                  else
                    :new_lead
                  end

      if user.crm_status != new_status.to_s
        user.update_column(:crm_status, User.crm_statuses[new_status])
        puts "✓ #{user.full_name}: #{old_status} → #{new_status}"
      end
    end

    puts "\nFinished! Summary:"
    User.group(:crm_status).count.each do |status, count|
      puts "  #{status}: #{count}"
    end
  end
end
