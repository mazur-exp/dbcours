import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

export default class extends Controller {
  static targets = ["column", "card"]
  static values = {
    updateUrl: String
  }

  connect() {
    console.log("Kanban controller connected")
    this.initializeDragAndDrop()
    this.subscribeToChannel()
  }

  disconnect() {
    console.log("Kanban controller disconnected")
    if (this.subscription) {
      this.subscription.unsubscribe()
    }
  }

  initializeDragAndDrop() {
    // Настраиваем колонки как drop zones
    this.columnTargets.forEach(column => {
      column.addEventListener('dragover', (e) => this.handleDragOver(e))
      column.addEventListener('drop', (e) => this.handleDrop(e))
      column.addEventListener('dragenter', (e) => this.handleDragEnter(e))
      column.addEventListener('dragleave', (e) => this.handleDragLeave(e))
    })

    console.log("Drag and drop initialized on", this.cardTargets.length, "cards")
  }

  openMessenger(e) {
    // Не открываем мессенджер если идет drag-and-drop
    if (this.isDragging) {
      this.isDragging = false
      return
    }

    const conversationId = e.currentTarget.dataset.conversationId
    if (conversationId) {
      // Используем Turbo для более плавного перехода
      Turbo.visit(`/messenger?conversation_id=${conversationId}`)
    } else {
      Turbo.visit('/messenger')
    }
  }

  handleDragStart(e) {
    this.isDragging = true
    e.target.style.opacity = '0.5'
    e.target.style.cursor = 'grabbing'
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', e.target.innerHTML)
    e.dataTransfer.setData('userId', e.target.dataset.userId)
  }

  handleDragEnd(e) {
    e.target.style.opacity = '1'
    e.target.style.cursor = 'grab'
    // Сбрасываем флаг через небольшую задержку, чтобы клик после drag не срабатывал
    setTimeout(() => {
      this.isDragging = false
    }, 100)
  }

  handleDragOver(e) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    return false
  }

  handleDragEnter(e) {
    if (e.target.classList.contains('kanban-column')) {
      e.target.classList.add('bg-green-100')
    }
  }

  handleDragLeave(e) {
    if (e.target.classList.contains('kanban-column')) {
      e.target.classList.remove('bg-green-100')
    }
  }

  handleDrop(e) {
    e.preventDefault()
    e.stopPropagation()

    const column = e.target.closest('[data-kanban-target="column"]')
    if (!column) return

    column.classList.remove('bg-green-100')

    const userId = e.dataTransfer.getData('userId')
    const newStatus = column.dataset.status
    const cardElement = this.element.querySelector(`[data-user-id="${userId}"]`)

    if (cardElement) {
      // Добавляем карточку в новую колонку
      column.appendChild(cardElement)

      // Пересортировываем по ai_ready_score
      this.reorderColumn(column)

      // Обновляем статус на сервере
      this.updateCardStatus(userId, newStatus, 0)
    }

    return false
  }

  reorderColumn(column) {
    const cards = Array.from(column.querySelectorAll('[data-kanban-target="card"]'))

    // Сортируем по data-ready-score (DESC)
    cards.sort((a, b) => {
      const scoreA = parseInt(a.dataset.readyScore) || 0
      const scoreB = parseInt(b.dataset.readyScore) || 0
      return scoreB - scoreA // Горячие лиды наверх
    })

    // Переставляем элементы в DOM
    cards.forEach(card => column.appendChild(card))
  }

  async updateCardStatus(userId, newStatus, newPosition) {
    const url = this.updateUrlValue.replace(':id', userId)
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/vnd.turbo-stream.html',
          'X-CSRF-Token': csrfToken
        },
        body: JSON.stringify({
          crm_status: newStatus,
          crm_position: newPosition
        })
      })

      if (response.ok) {
        const turboStream = await response.text()
        Turbo.renderStreamMessage(turboStream)
        console.log("Card updated via Turbo Stream")
        this.updateColumnCounts()
      } else {
        console.error("Failed to update card status")
        window.location.reload()
      }
    } catch (error) {
      console.error("Error updating card status:", error)
      window.location.reload()
    }
  }

  subscribeToChannel() {
    this.subscription = consumer.subscriptions.create("CrmChannel", {
      connected: () => {
        console.log("Connected to CRM channel")
      },

      disconnected: () => {
        console.log("Disconnected from CRM channel")
      },

      received: (data) => {
        console.log("Received broadcast:", data)

        if (data.type === "card_moved" || data.type === "card_updated") {
          this.handleBroadcastCardMoved(data)
        }
      }
    })
  }

  handleBroadcastCardMoved(data) {
    console.log("Broadcast received, card already updated via Turbo Stream")
    // Карточка уже обновлена через Turbo Stream при drag-and-drop
    // Этот broadcast нужен только для синхронизации с другими клиентами
    // Обновляем счетчики на всякий случай
    this.updateColumnCounts()
  }

  updateColumnCounts() {
    this.columnTargets.forEach(column => {
      const count = column.querySelectorAll('[data-kanban-target="card"]').length
      const countElement = column.closest('[data-column-wrapper]')?.querySelector('[data-column-count]')
      if (countElement) {
        countElement.textContent = count
      }
    })
  }
}
