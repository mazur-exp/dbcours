class DomainConstraint
  def initialize(subdomain)
    @subdomain = subdomain
  end

  def matches?(request)
    # Production: проверка по subdomain
    if Rails.env.production?
      request.subdomain == @subdomain
    # Development: проверка по параметру ?domain= для тестирования
    else
      request.params[:domain] == @subdomain ||
        request.path.start_with?("/#{@subdomain}")
    end
  end
end
