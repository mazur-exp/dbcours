import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

export default class extends Controller {
  static targets = ["button", "modal"]
  static values = { sessionToken: String }

  connect() {
    this.checkAuthStatus()
    this.setupAuthButton()

    // Handle Turbo cache to preserve auth state
    this.handleTurboCache = this.beforeCache.bind(this)
    document.addEventListener('turbo:before-cache', this.handleTurboCache)
  }

  isTelegramWebView() {
    // Проверяем наличие Telegram WebView API
    if (typeof window.TelegramWebviewProxy !== 'undefined') {
      return true;
    }

    // Проверяем Telegram Web App
    if (typeof window.Telegram !== 'undefined' && window.Telegram.WebApp) {
      return true;
    }

    // Запасная проверка через User Agent
    const ua = navigator.userAgent || '';
    return /telegram/i.test(ua);
  }

  isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  disconnect() {
    // Clean up event listener
    document.removeEventListener('turbo:before-cache', this.handleTurboCache)
  }

  beforeCache() {
    // Re-check auth status before page is cached to ensure correct state
    this.checkAuthStatus()
  }

  async checkAuthStatus() {
    try {
      const response = await fetch('/auth/status')
      const data = await response.json()

      if (data.authenticated) {
        this.updateButtonAsAuthenticated(data.user)
      }
    } catch (error) {
      console.error('Failed to check auth status:', error)
    }
  }

  async startAuth() {
    const button = document.getElementById('auth-button')
    button.disabled = true
    button.classList.add('opacity-75', 'cursor-not-allowed')

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
        this.sessionTokenValue = data.session_token

        // Для Telegram WebView ИЛИ мобильного браузера используем одинаковую логику
        if (this.isTelegramWebView() || this.isMobileDevice()) {
          console.log('>>> TELEGRAM WEBVIEW OR MOBILE - using link click method')
          // Создаём обычную HTML ссылку с HTTPS (не tg://)
          const link = document.createElement('a')
          link.href = data.deep_link // https://t.me/bot?start=xxx

          // ВАЖНО: target="_blank" только для мобильного браузера, НЕ для Telegram WebView
          if (!this.isTelegramWebView() && this.isMobileDevice()) {
            link.target = '_blank'
          }

          link.style.display = 'none'
          document.body.appendChild(link)

          // Программно кликаем - Telegram перехватит и откроет бота нативно
          link.click()
          document.body.removeChild(link)

          // Сбрасываем состояние кнопки
          button.disabled = false
          button.classList.remove('opacity-75', 'cursor-not-allowed')

          // Когда пользователь вернётся из бота - сразу проверяем авторизацию
          const handleReturn = async () => {
            if (!document.hidden) {
              document.removeEventListener('visibilitychange', handleReturn)

              console.log('>>> User returned from bot')
              this.showWaitingStatus()

              // СРАЗУ проверяем авторизацию через API
              try {
                const response = await fetch(`/auth/check_token?session_token=${this.sessionTokenValue}`)
                const result = await response.json()

                console.log('>>> Auth check result:', result)

                if (result.authenticated) {
                  // Авторизация успешна!
                  console.log('>>> Authentication successful!')
                  this.updateButtonAsAuthenticated(result.user)
                  this.showSuccessNotification()

                  // Перезагружаем страницу
                  setTimeout(() => {
                    window.location.reload()
                  }, 1500)
                } else {
                  // Если еще не авторизован - подключаем WebSocket
                  console.log('>>> Not authenticated yet, connecting WebSocket')
                  this.subscribeToAuthChannel(this.sessionTokenValue)
                }
              } catch (error) {
                console.error('>>> Auth check failed:', error)
                // При ошибке - пробуем через WebSocket
                this.subscribeToAuthChannel(this.sessionTokenValue)
              }
            }
          }
          document.addEventListener('visibilitychange', handleReturn)
        } else {
          // В обычном браузере открываем в новой вкладке
          window.open(data.deep_link, '_blank')

          // Подключаемся к WebSocket
          this.subscribeToAuthChannel(data.session_token)

          // Показываем статус ожидания
          this.showWaitingStatus()
        }
      }
    } catch (error) {
      console.error('Auth failed:', error)
      button.disabled = false
      button.classList.remove('opacity-75', 'cursor-not-allowed')
    }
  }

  subscribeToAuthChannel(sessionToken) {
    this.subscription = consumer.subscriptions.create(
      { channel: "AuthChannel", session_token: sessionToken },
      {
        received: (data) => {
          console.log('Received from AuthChannel:', data)
          if (data.type === 'authenticated') {
            this.handleAuthSuccess(data.user)
          }
        }
      }
    )
  }

  handleAuthSuccess(user) {
    console.log('Auth success!', user)

    // Закрываем модальное окно если открыто
    this.hideModal()

    // Обновляем кнопку
    this.updateButtonAsAuthenticated(user)

    // Перезагружаем страницу для отображения контента
    setTimeout(() => {
      window.location.reload()
    }, 1000)
  }

  showWaitingStatus() {
    const button = document.getElementById('auth-button')
    button.innerHTML = `
      <span class="flex items-center gap-2">
        <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Ожидание авторизации...
      </span>
    `
  }

  updateButtonAsAuthenticated(user) {
    const button = document.getElementById('auth-button')
    if (!button) return

    // Заменяем кнопку авторизации на dropdown профиля
    const container = button.parentElement

    const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Пользователь'
    const firstLetter = (user.first_name || 'U')[0].toUpperCase()
    const username = user.username ? `@${user.username}` : ''

    container.innerHTML = `
      <div class="relative" data-authenticated="true">
        <!-- Кнопка-триггер dropdown -->
        <button onclick="toggleUserDropdown()" class="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-1.5 px-3 rounded-lg transition-all flex items-center gap-2 text-sm">
          <div class="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xs">
            ${firstLetter}
          </div>
          <span>${user.first_name || 'Профиль'}</span>
          <svg class="w-3.5 h-3.5 transition-transform text-gray-500" id="dropdown-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        <!-- Dropdown меню -->
        <div id="user-dropdown" class="hidden absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
          <!-- Заголовок профиля -->
          <div class="px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                ${firstLetter}
              </div>
              <div>
                <div class="font-bold text-gray-900">${fullName}</div>
                ${username ? `<div class="text-sm text-gray-600">${username}</div>` : ''}
              </div>
            </div>
          </div>

          <!-- Пункты меню -->
          <div class="py-2">
            <a href="/" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-gray-700">
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              </svg>
              <span>Главная</span>
            </a>

            <a href="/freecontent" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-gray-700">
              <svg class="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
              </svg>
              <span>Курс</span>
            </a>

            <div class="border-t border-gray-200 my-2"></div>

            <form action="/auth/logout" method="post" data-turbo="false">
              <input type="hidden" name="_method" value="delete">
              <input type="hidden" name="authenticity_token" value="${document.querySelector('[name="csrf-token"]')?.content}">
              <button type="submit" class="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-red-600 text-left">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                <span>Выйти</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    `
  }

  setupAuthButton() {
    const button = document.getElementById('auth-button')
    if (button) {
      button.addEventListener('click', () => this.startAuth())
    }
  }

  showSuccessNotification() {
    const notification = document.createElement('div')
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-xl z-50 animate-bounce'
    notification.innerHTML = '✅ Авторизация успешна!'
    document.body.appendChild(notification)

    setTimeout(() => {
      notification.remove()
    }, 2000)
  }

  showModal() {
    const modal = document.getElementById('auth-modal')
    if (modal) {
      modal.classList.remove('hidden')
      // Анимация кнопки авторизации
      this.animateAuthButton()
    }
  }

  hideModal() {
    const modal = document.getElementById('auth-modal')
    if (modal) {
      modal.classList.add('hidden')
    }
  }

  animateAuthButton() {
    const button = document.getElementById('auth-button')
    if (button) {
      button.classList.add('animate-pulse')
      setTimeout(() => {
        button.classList.remove('animate-pulse')
      }, 3000)
    }
  }
}
