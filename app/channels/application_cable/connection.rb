module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
      Rails.logger.info "ActionCable connected: user_id=#{current_user&.id}"
    end

    private

    def find_verified_user
      # Получаем session через cookies
      session_id = cookies.encrypted[Rails.application.config.session_options[:key]]
      return nil unless session_id

      # Загружаем сессию
      session_data = Rails.application.config.session_store.new({}).send(:load_session, session_id)
      return nil unless session_data

      user_id = session_data[1]["user_id"] rescue nil
      User.find_by(id: user_id) if user_id
    rescue => e
      Rails.logger.error "ActionCable connection error: #{e.message}"
      nil
    end
  end
end
