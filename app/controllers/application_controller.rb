class ApplicationController < ActionController::Base
  # Allow browsers with reasonable version requirements
  # Safari 15+ (iOS 15+, September 2021)
  # Chrome 100+ (March 2022)
  # Firefox 100+ (May 2022)
  allow_browser versions: { safari: 15, chrome: 100, firefox: 100 }

  before_action :set_current_user

  private

  def set_current_user
    if session[:user_id]
      @current_user = User.find_by(id: session[:user_id], authenticated: true)
    end
  end
end
