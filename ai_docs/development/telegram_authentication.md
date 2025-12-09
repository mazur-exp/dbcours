# Telegram Authentication - Technical Specification

## Complete Authentication Flow

This document provides the technical implementation details for Telegram OAuth authentication, including all three environment variations (desktop, Telegram WebView, mobile browser).

---

## Environment Variables

### Required Configuration

```bash
# .env or Rails credentials
TELEGRAM_BOT_TOKEN=8414411793:AAE_Onhi-g_9zxp_krmkApdnj9TI6tSm8Qg
TELEGRAM_BOT_USERNAME=dbcourse_auth_bot
TELEGRAM_WEBHOOK_URL=https://karri-unexpunged-becomingly.ngrok-free.dev/auth/telegram/webhook
```

**Bot Token:** Obtained from @BotFather on Telegram
**Bot Username:** Must match bot created in @BotFather
**Webhook URL:** Public HTTPS endpoint to receive Telegram callbacks

---

## Routes Configuration

**File:** `config/routes.rb`

```ruby
# Telegram Authentication Routes
post '/auth/telegram/start', to: 'auth#telegram_start'
post '/auth/telegram/webhook', to: 'auth#telegram_webhook'
get '/auth/status', to: 'auth#status'
get '/auth/check_token', to: 'auth#check_token'
delete '/auth/logout', to: 'auth#logout'
```

---

## Backend Implementation

### AuthController

**File:** `app/controllers/auth_controller.rb`

```ruby
class AuthController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:webhook, :start]

  # POST /auth/telegram/start
  def telegram_start
    session_token = SecureRandom.hex(16)
    session[:auth_token] = session_token
    session[:auth_started_at] = Time.now

    deep_link = "https://t.me/#{ENV['TELEGRAM_BOT_USERNAME']}?start=#{session_token}"

    render json: {
      success: true,
      deep_link: deep_link,
      session_token: session_token
    }
  end

  # GET /auth/status
  def status
    if session[:user_id]
      user = User.find_by(id: session[:user_id])
      render json: {
        authenticated: true,
        user: {
          username: user.username,
          first_name: user.first_name,
          last_name: user.last_name
        }
      }
    else
      render json: { authenticated: false }
    end
  end

  # GET /auth/check_token?session_token=xxx
  def check_token
    user = User.find_by(
      session_token: params[:session_token],
      authenticated: true
    )

    if user && session[:auth_token] == params[:session_token]
      session[:user_id] = user.id
      render json: {
        authenticated: true,
        user_id: user.id,
        user: {
          username: user.username,
          first_name: user.first_name
        }
      }
    else
      render json: { authenticated: false }
    end
  end

  # DELETE /auth/logout
  def logout
    session[:user_id] = nil
    session[:auth_token] = nil
    redirect_to freecontent_path, notice: "Logged out successfully"
  end

  # POST /auth/telegram/webhook (receives Telegram bot callbacks)
  def telegram_webhook
    # Telegram sends POST with update data
    update = params[:message] || params[:callback_query]

    if params[:message]
      handle_start_command(params[:message])
    elsif params[:callback_query]
      handle_callback_query(params[:callback_query])
    end

    head :ok
  end

  private

  def handle_start_command(message)
    telegram_id = message[:from][:id]
    session_token = message[:text].split(' ').last

    user = User.find_or_create_by(telegram_id: telegram_id) do |u|
      u.username = message[:from][:username]
      u.first_name = message[:from][:first_name]
      u.last_name = message[:from][:last_name]
    end

    # Send inline button to user
    send_telegram_message(
      chat_id: message[:chat][:id],
      text: "Добро пожаловать! Нажмите кнопку ниже, чтобы авторизоваться.",
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Войти в систему", callback_data: "auth:#{session_token}" }
        ]]
      }
    )
  end

  def handle_callback_query(callback_query)
    telegram_id = callback_query[:from][:id]
    callback_data = callback_query[:data]

    return unless callback_data.start_with?('auth:')

    session_token = callback_data.split(':').last

    user = User.find_or_create_by(telegram_id: telegram_id) do |u|
      u.username = callback_query[:from][:username]
      u.first_name = callback_query[:from][:first_name]
      u.last_name = callback_query[:from][:last_name]
    end

    user.update(session_token: session_token, authenticated: true)

    # Broadcast to ActionCable
    ActionCable.server.broadcast(
      "auth_channel_#{session_token}",
      {
        type: 'authentication_success',
        user_id: user.id,
        username: user.username,
        first_name: user.first_name
      }
    )

    # Answer callback query (removes loading state in Telegram)
    answer_callback_query(callback_query[:id], "Успешно авторизован!")

    # Send confirmation message
    send_telegram_message(
      chat_id: callback_query[:message][:chat][:id],
      text: "✅ Вы успешно авторизованы! Вернитесь в браузер для продолжения."
    )
  end

  def send_telegram_message(chat_id:, text:, reply_markup: nil)
    uri = URI("https://api.telegram.org/bot#{ENV['TELEGRAM_BOT_TOKEN']}/sendMessage")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request.body = {
      chat_id: chat_id,
      text: text,
      reply_markup: reply_markup
    }.to_json

    http.request(request)
  end

  def answer_callback_query(callback_query_id, text)
    uri = URI("https://api.telegram.org/bot#{ENV['TELEGRAM_BOT_TOKEN']}/answerCallbackQuery")
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = true

    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = 'application/json'
    request.body = {
      callback_query_id: callback_query_id,
      text: text
    }.to_json

    http.request(request)
  end
end
```

---

## Frontend Implementation

### Stimulus Controller

**File:** `app/javascript/controllers/auth_controller.js`

```javascript
import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"

export default class extends Controller {
  connect() {
    this.checkAuthStatus()
  }

  checkAuthStatus() {
    const authButton = document.getElementById('auth-button')
    const isAuthenticated = authButton?.dataset.authenticated === 'true'
    
    if (isAuthenticated) {
      this.updateButtonAsAuthenticated()
    }
  }

  async startAuth(event) {
    event.preventDefault()

    try {
      const response = await fetch('/auth/telegram/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        }
      })

      const data = await response.json()

      if (data.success) {
        this.openTelegramBot(data.deep_link, data.session_token)
      }
    } catch (error) {
      console.error('Auth start failed:', error)
    }
  }

  openTelegramBot(deepLink, sessionToken) {
    if (this.isTelegramWebView()) {
      // Telegram WebView: Native link handling
      const link = document.createElement('a')
      link.href = deepLink
      link.click()
      
      // Listen for return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkTokenViaAPI(sessionToken)
        }
      }, { once: true })
    } else if (this.isMobileDevice()) {
      // Mobile browser: Opens Telegram app
      const link = document.createElement('a')
      link.href = deepLink
      link.target = '_blank'
      link.click()

      // Listen for return
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.checkTokenViaAPI(sessionToken)
        }
      }, { once: true })
    } else {
      // Desktop browser: Opens in new window
      window.open(deepLink, '_blank')
      this.subscribeToAuthChannel(sessionToken)
      this.showWaitingMessage()
    }
  }

  async checkTokenViaAPI(sessionToken) {
    try {
      const response = await fetch(`/auth/check_token?session_token=${sessionToken}`)
      const data = await response.json()

      if (data.authenticated) {
        this.handleAuthSuccess(data)
      } else {
        // Fallback to WebSocket
        this.subscribeToAuthChannel(sessionToken)
      }
    } catch (error) {
      console.error('Token check failed:', error)
    }
  }

  subscribeToAuthChannel(sessionToken) {
    this.subscription = consumer.subscriptions.create(
      { channel: "AuthChannel", session_token: sessionToken },
      {
        received: (data) => {
          if (data.type === 'authentication_success') {
            this.handleAuthSuccess(data)
          }
        }
      }
    )
  }

  handleAuthSuccess(data) {
    // Update UI
    const modal = document.getElementById('auth-modal')
    if (modal) {
      modal.innerHTML = '<div class="text-center p-8"><h3 class="text-xl font-bold text-green-600">Успешно авторизован!</h3><p class="mt-2">Перенаправление...</p></div>'
    }

    // Reload page after 1 second
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  updateButtonAsAuthenticated() {
    const authButton = document.getElementById('auth-button')
    if (authButton) {
      authButton.classList.remove('bg-green-500', 'hover:bg-green-600')
      authButton.classList.add('bg-blue-500', 'hover:bg-blue-600')
    }
  }

  showWaitingMessage() {
    const modal = document.getElementById('auth-modal')
    if (modal) {
      modal.innerHTML = '<div class="text-center p-8"><div class="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div><h3 class="text-lg font-semibold">Ожидание авторизации...</h3><p class="text-gray-600 mt-2">Нажмите кнопку в Telegram</p></div>'
    }
  }

  isTelegramWebView() {
    return !!(window.TelegramWebviewProxy || window.Telegram?.WebApp || /telegram/i.test(navigator.userAgent))
  }

  isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  }
}
```

---

## ActionCable Channel

**File:** `app/channels/auth_channel.rb`

```ruby
class AuthChannel < ApplicationCable::Channel
  def subscribed
    stream_from "auth_channel_#{params[:session_token]}"
  end

  def unsubscribed
    # Cleanup when channel is closed
  end
end
```

**File:** `app/javascript/channels/consumer.js`

```javascript
import { createConsumer } from "@rails/actioncable"

export default createConsumer()
```

---

## Security Considerations

### Session Token Expiry

```ruby
# AuthController - add timeout check
def check_token
  return render(json: { authenticated: false }) if session_expired?
  
  # ... rest of method
end

private

def session_expired?
  return false unless session[:auth_started_at]
  Time.now - session[:auth_started_at] > 10.minutes
end
```

### CSRF Protection

```ruby
# Skip CSRF for webhook (Telegram doesn't send CSRF token)
skip_before_action :verify_authenticity_token, only: [:telegram_webhook]

# Verify webhook authenticity via Telegram signature (advanced)
def verify_telegram_signature
  # Implementation here
end
```

---

## Testing

### Unit Tests

```ruby
# test/controllers/auth_controller_test.rb
class AuthControllerTest < ActionDispatch::IntegrationTest
  test "should create session token on start" do
    post auth_telegram_start_path
    assert_response :success
    assert_not_nil session[:auth_token]
    
    json = JSON.parse(response.body)
    assert json['success']
    assert_includes json['deep_link'], 'https://t.me/'
  end

  test "should authenticate user with valid token" do
    user = users(:valid_user)
    session[:auth_token] = user.session_token

    get auth_check_token_path(session_token: user.session_token)
    assert_response :success
    
    json = JSON.parse(response.body)
    assert json['authenticated']
    assert_equal user.id, json['user_id']
  end
end
```

### Integration Tests

```ruby
# test/system/authentication_test.rb
class AuthenticationTest < ApplicationSystemTestCase
  test "unauthenticated user sees auth modal" do
    visit free_content_lesson_path('01-introduction')
    
    assert_selector '#auth-modal', visible: true
    assert_selector '#lesson-content-blur.blur-md'
  end

  test "authenticated user sees content" do
    # Simulate authenticated session
    login_as(users(:authenticated_user))
    
    visit free_content_lesson_path('01-introduction')
    
    assert_no_selector '#auth-modal'
    assert_no_selector '.blur-md'
  end
end
```

---

## Troubleshooting

### Common Issues

**Issue:** Webhook not receiving callbacks
**Solution:** Check Telegram webhook is set correctly
```bash
curl https://api.telegram.org/bot<TOKEN>/setWebhook \
  -d "url=https://your-domain.com/auth/telegram/webhook"
```

**Issue:** WebSocket not connecting
**Solution:** Check ActionCable configuration in production
```ruby
# config/environments/production.rb
config.action_cable.allowed_request_origins = [
  'https://your-domain.com'
]
```

**Issue:** Session token not found
**Solution:** Verify session[:auth_token] matches user.session_token

---

## Conclusion

The Telegram authentication system provides a passwordless, frictionless authentication experience optimized for three different environments (desktop, Telegram WebView, mobile). The implementation uses a combination of deep links, WebSockets (ActionCable), and API polling to ensure reliable authentication across all scenarios.
