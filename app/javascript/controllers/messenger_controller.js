import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

export default class extends Controller {
  static targets = [
    "messages",
    "input",
    "conversationsList",
    // AI Qualification targets
    "aiQualificationSection",
    "aiQualificationContent",
    "aiRealNameContainer",
    "aiRealName",
    "aiBackgroundContainer",
    "aiBackground",
    "aiQueryContainer",
    "aiQuery",
    "aiReadyScoreContainer",
    "aiReadyBadge",
    "aiReadyScore",
    // Statistics targets
    "totalMessages",
    "incomingMessages",
    "outgoingMessages"
  ]

  connect() {
    // Ищем именно элемент main с активным conversation-id, а не первый попавшийся
    this.activeConversationId = this.element.querySelector('main[data-conversation-id]')?.dataset.conversationId
    console.log('Active conversation ID:', this.activeConversationId)
    this.subscribeToChannel()
    this.scrollToBottom()
  }

  disconnect() {
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
  }

  subscribeToChannel() {
    this.subscription = consumer.subscriptions.create("MessengerChannel", {
      connected: () => {
        console.log("Connected to MessengerChannel")
      },

      disconnected: () => {
        console.log("Disconnected from MessengerChannel")
      },

      received: (data) => {
        console.log("Received from MessengerChannel:", data)

        if (data.type === "new_message") {
          this.handleNewMessage(data)
        }
      }
    })
  }

  handleNewMessage(data) {
    const conversationId = data.conversation_id
    const message = data.message
    const conversation = data.conversation

    console.log('New message for conversation:', conversationId, 'Active conversation:', this.activeConversationId)

    // Используем строгое сравнение и приводим к строке для надежности
    // Если это сообщение для активной беседы - добавляем в переписку
    if (String(conversationId) === String(this.activeConversationId)) {
      console.log('Adding message to active conversation')
      this.appendMessage(message)
      this.scrollToBottom()

      // Отмечаем как прочитанное
      if (message.direction === 'incoming') {
        this.markAsRead(conversationId)
      }
    } else {
      console.log('Message is for different conversation, not adding to chat')
    }

    // Обновляем список чатов
    if (conversation) {
      this.updateConversationsList(conversationId, conversation)
    }

    // Обновляем правую панель если это активная беседа
    if (String(conversationId) === String(this.activeConversationId) && conversation) {
      this.updateSidebar(conversation)
    }
  }

  updateSidebar(conversationData) {
    // Обновляем AI Qualification
    if (conversationData.ai_qualification) {
      this.updateAIQualification(conversationData.ai_qualification)
    }

    // Обновляем статистику
    if (conversationData.statistics) {
      this.updateStatistics(conversationData.statistics)
    }
  }

  updateAIQualification(aiData) {
    const { real_name, background, query, ready_score } = aiData

    // Обновляем Real Name
    if (real_name && this.hasAiRealNameTarget) {
      this.aiRealNameTarget.textContent = real_name
      // Показываем контейнер если был скрыт
      if (this.hasAiRealNameContainerTarget) {
        this.aiRealNameContainerTarget.style.display = 'block'
      }
    }

    // Обновляем Background
    if (background && this.hasAiBackgroundTarget) {
      this.aiBackgroundTarget.textContent = background
      if (this.hasAiBackgroundContainerTarget) {
        this.aiBackgroundContainerTarget.style.display = 'block'
      }
    }

    // Обновляем Query
    if (query && this.hasAiQueryTarget) {
      this.aiQueryTarget.textContent = query
      if (this.hasAiQueryContainerTarget) {
        this.aiQueryContainerTarget.style.display = 'block'
      }
    }

    // Обновляем Ready Score с цветовым badge
    if (ready_score !== null && ready_score !== undefined) {
      const score = parseInt(ready_score)

      if (this.hasAiReadyScoreTarget) {
        this.aiReadyScoreTarget.textContent = `${score}/10`
      }

      if (this.hasAiReadyBadgeTarget) {
        // Определяем цвет и лейбл
        let badgeClass, label
        if (score >= 8) {
          badgeClass = "bg-green-100 text-green-800 border-green-200"
          label = "🟢 Горячий лид"
        } else if (score >= 4) {
          badgeClass = "bg-yellow-100 text-yellow-800 border-yellow-200"
          label = "🟡 Тёплый лид"
        } else {
          badgeClass = "bg-red-100 text-red-800 border-red-200"
          label = "🔴 Холодный лид"
        }

        // Обновляем классы и текст
        this.aiReadyBadgeTarget.className = `inline-flex items-center px-3 py-1.5 text-sm font-semibold rounded-full border ${badgeClass}`
        this.aiReadyBadgeTarget.textContent = label
      }

      // Показываем контейнер
      if (this.hasAiReadyScoreContainerTarget) {
        this.aiReadyScoreContainerTarget.style.display = 'block'
      }
    }

    // Показываем секцию AI Qualification если есть хотя бы одно поле
    if ((real_name || background || query || ready_score) && this.hasAiQualificationSectionTarget) {
      this.aiQualificationSectionTarget.style.display = 'block'
    }
  }

  updateStatistics(stats) {
    if (this.hasTotalMessagesTarget) {
      this.totalMessagesTarget.textContent = stats.total_messages
    }

    if (this.hasIncomingMessagesTarget) {
      this.incomingMessagesTarget.textContent = stats.incoming_count
    }

    if (this.hasOutgoingMessagesTarget) {
      this.outgoingMessagesTarget.textContent = stats.outgoing_count
    }
  }

  appendMessage(message) {
    const container = this.messagesTarget
    const messageElement = this.createMessageElement(message)
    container.insertAdjacentHTML('beforeend', messageElement)
  }

  createMessageElement(message) {
    // direction приходит как строка "incoming"/"outgoing" в JSON
    const isIncoming = message.direction === 'incoming'
    const time = new Date(message.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    const userName = message.user ? (message.user.first_name || 'U') : 'A'
    const userLetter = userName[0].toUpperCase()
    const avatarUrl = message.user?.avatar_url

    if (isIncoming) {
      // Создаём HTML для аватарки (либо изображение, либо инициалы)
      const avatarHtml = avatarUrl
        ? `<img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="${userName}" loading="lazy">`
        : `<div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-xs flex-shrink-0">${userLetter}</div>`

      return `
        <div class="flex justify-start" data-message-id="${message.id}">
          <div class="max-w-xl">
            <div class="flex items-start gap-2">
              ${avatarHtml}
              <div class="flex-1">
                <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <p class="text-gray-900 whitespace-pre-wrap break-words">${this.escapeHtml(message.body)}</p>
                </div>
                <p class="text-xs text-gray-500 mt-1 ml-2">${time}</p>
              </div>
            </div>
          </div>
        </div>
      `
    } else {
      return `
        <div class="flex justify-end" data-message-id="${message.id}">
          <div class="max-w-xl">
            <div class="flex flex-col items-end">
              <div class="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                <p class="whitespace-pre-wrap break-words">${this.escapeHtml(message.body)}</p>
              </div>
              <p class="text-xs text-gray-500 mt-1 mr-2">${time}</p>
            </div>
          </div>
        </div>
      `
    }
  }

  updateConversationsList(conversationId, conversationData) {
    if (!this.hasConversationsListTarget) {
      console.log('Conversations list target not found')
      return
    }

    // Ищем элемент беседы в списке
    const conversationElement = this.conversationsListTarget.querySelector(
      `[data-conversation-id="${conversationId}"]`
    )

    if (conversationElement) {
      // Обновляем существующий элемент
      this.updateConversationElement(conversationElement, conversationData)

      // Перемещаем наверх списка
      this.conversationsListTarget.prepend(conversationElement)
    } else {
      // Если беседа не найдена (новый пользователь), создаем новый элемент
      this.createConversationElement(conversationData)
    }
  }

  updateConversationElement(element, data) {
    const { user, last_message, unread_count } = data

    // Обновляем аватарку если она есть
    if (user && user.avatar_url) {
      const avatarContainer = element.querySelector('.flex-shrink-0')
      if (avatarContainer) {
        // Проверяем, есть ли уже img или div с инициалами
        const existingAvatar = avatarContainer.querySelector('img, div')
        if (existingAvatar) {
          // Если уже есть изображение, обновляем src
          if (existingAvatar.tagName === 'IMG') {
            existingAvatar.src = user.avatar_url
          } else {
            // Если был div с инициалами, заменяем на img
            const userName = user.first_name || 'U'
            const img = document.createElement('img')
            img.src = user.avatar_url
            img.alt = userName
            img.className = 'w-12 h-12 rounded-full object-cover'
            img.loading = 'lazy'
            existingAvatar.replaceWith(img)
          }
        }
      }
    }

    // Обновляем текст последнего сообщения
    // Ищем оба варианта: с сообщением (.text-gray-600) и без ("Нет сообщений" .text-gray-400)
    let messageTextElement = element.querySelector('.text-sm.text-gray-600')
    if (!messageTextElement) {
      messageTextElement = element.querySelector('.text-sm.text-gray-400')
    }

    if (messageTextElement && last_message) {
      // Обновляем классы на нормальные (убираем italic и gray-400)
      messageTextElement.className = 'text-sm text-gray-600 truncate'
      const prefix = last_message.direction === 'outgoing' ? '📤 Вы: ' : ''
      messageTextElement.textContent = prefix + last_message.body
    }

    // Обновляем время
    const timeElement = element.querySelector('.text-xs.text-gray-500')
    if (timeElement && last_message) {
      timeElement.textContent = this.timeAgo(new Date(last_message.created_at)) + ' назад'
    }

    // Обновляем счетчик непрочитанных
    let unreadBadge = element.querySelector('.bg-blue-500.text-white.rounded-full')

    // Если это активная беседа - не показываем непрочитанные
    const isActive = String(element.dataset.conversationId) === String(this.activeConversationId)

    if (!isActive && unread_count > 0) {
      if (unreadBadge) {
        // Обновляем существующий badge
        unreadBadge.textContent = unread_count
      } else {
        // Создаем новый badge
        const badgeContainer = element.querySelector('.flex-1.min-w-0')
        if (badgeContainer) {
          const newBadge = document.createElement('span')
          newBadge.className = 'inline-block mt-2 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full'
          newBadge.textContent = unread_count
          badgeContainer.appendChild(newBadge)
        }
      }
    } else if (unreadBadge) {
      // Убираем badge если нет непрочитанных или это активная беседа
      unreadBadge.remove()
    }
  }

  createConversationElement(data) {
    console.log('Creating new conversation element:', data)

    const { id, user, last_message, unread_count, last_message_at } = data

    // Создаём аватарку или инициалы
    const userLetter = (user.first_name || 'U')[0].toUpperCase()
    const avatarHtml = user.avatar_url
      ? `<img src="${user.avatar_url}" class="w-12 h-12 rounded-full object-cover" alt="${user.first_name}" loading="lazy">`
      : `<div class="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-base">${userLetter}</div>`

    // Форматируем время
    const timeAgoText = last_message ? this.timeAgo(new Date(last_message.created_at)) + ' назад' : ''

    // Форматируем текст последнего сообщения
    const messagePrefix = last_message && last_message.direction === 'outgoing' ? '📤 Вы: ' : ''
    const messageText = last_message
      ? `<p class="text-sm text-gray-600 truncate">${messagePrefix}${this.escapeHtml(last_message.body)}</p>`
      : `<p class="text-sm text-gray-400 italic">Нет сообщений</p>`

    // Создаём HTML элемента
    const conversationHtml = `
      <div
        class="hover:bg-gray-50 border-l-4 border-transparent cursor-pointer transition-colors"
        data-conversation-id="${id}"
        data-action="click->messenger#selectConversation"
      >
        <div class="p-4">
          <div class="flex items-start gap-3">
            <!-- Аватарка -->
            <div class="flex-shrink-0">
              ${avatarHtml}
            </div>

            <!-- Информация о чате -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between mb-1">
                <h4 class="font-semibold text-gray-900 truncate">${this.escapeHtml(user.first_name + (user.last_name ? ' ' + user.last_name : ''))}</h4>
                ${timeAgoText ? `<span class="text-xs text-gray-500 flex-shrink-0 ml-2">${timeAgoText}</span>` : ''}
              </div>

              ${messageText}

              ${unread_count > 0 ? `<span class="inline-block mt-2 px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">${unread_count}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `

    // Вставляем в начало списка
    this.conversationsListTarget.insertAdjacentHTML('afterbegin', conversationHtml)

    console.log('New conversation element created and added to the list')
  }

  timeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000)

    const intervals = {
      'год': 31536000,
      'месяц': 2592000,
      'неделю': 604800,
      'день': 86400,
      'час': 3600,
      'минуту': 60
    }

    for (const [name, secondsInInterval] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInInterval)
      if (interval >= 1) {
        return `${interval} ${name}${this.pluralize(interval, name)}`
      }
    }

    return 'менее минуты'
  }

  pluralize(number, word) {
    const cases = {
      'год': ['', 'а', 'лет'],
      'месяц': ['', 'а', 'ев'],
      'неделю': ['', 'и', ''],
      'день': ['', 'дня', 'дней'],
      'час': ['', 'а', 'ов'],
      'минуту': ['', 'ы', '']
    }

    const wordCases = cases[word] || ['', 'а', 'ов']
    const lastDigit = number % 10
    const lastTwoDigits = number % 100

    if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
      return wordCases[2]
    }

    if (lastDigit === 1) {
      return wordCases[0]
    }

    if (lastDigit >= 2 && lastDigit <= 4) {
      return wordCases[1]
    }

    return wordCases[2]
  }

  async sendMessage(event) {
    event.preventDefault()

    const body = this.inputTarget.value.trim()
    if (!body) return

    if (!this.activeConversationId) {
      alert('Выберите чат')
      return
    }

    // Очищаем input сразу
    this.inputTarget.value = ''
    this.inputTarget.style.height = 'auto'

    try {
      const response = await fetch(`/messenger/conversations/${this.activeConversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        },
        body: JSON.stringify({ body: body })
      })

      const data = await response.json()

      if (data.success) {
        // Сообщение добавится автоматически через ActionCable
        console.log('Message sent successfully')
      } else {
        alert('Не удалось отправить сообщение')
        // Возвращаем текст в input
        this.inputTarget.value = body
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      alert('Ошибка отправки сообщения')
      this.inputTarget.value = body
    }
  }

  handleKeydown(event) {
    // Enter без Shift - отправка
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      this.sendMessage(event)
    }

    // Auto-resize textarea
    event.target.style.height = 'auto'
    event.target.style.height = Math.min(event.target.scrollHeight, 120) + 'px'
  }

  selectConversation(event) {
    const item = event.currentTarget
    const conversationId = item.dataset.conversationId

    // Используем Turbo для навигации (сохраняет JavaScript состояние)
    if (typeof Turbo !== 'undefined') {
      Turbo.visit(`/messenger?conversation_id=${conversationId}`)
    } else {
      // Fallback на обычную навигацию
      window.location.href = `/messenger?conversation_id=${conversationId}`
    }
  }

  async markAsRead(conversationId) {
    try {
      await fetch(`/messenger/conversations/${conversationId}/mark_read`, {
        method: 'PATCH',
        headers: {
          'X-CSRF-Token': document.querySelector('[name="csrf-token"]').content
        }
      })
    } catch (error) {
      console.error('Failed to mark as read:', error)
    }
  }

  scrollToBottom() {
    if (this.hasMessagesTarget) {
      this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}
