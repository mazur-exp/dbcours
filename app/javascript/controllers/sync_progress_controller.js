import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["collectButton", "syncButton", "status", "progress"]
  static values = {
    statusUrl: String
  }

  connect() {
    this.pollInterval = null
  }

  disconnect() {
    this.stopPolling()
  }

  // Handle collection button click
  async collectData(event) {
    event.preventDefault()

    if (!confirm('Запустить сбор данных с Grab/GoJek API? Займет ~10-15 минут.')) {
      return
    }

    // Disable button and show loading
    this.collectButtonTarget.disabled = true
    this.collectButtonTarget.innerHTML = `
      <svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="ml-2">Собираю данные...</span>
    `

    // Show status message
    this.showStatus('info', '🔄 Сбор данных начат... Это займет ~10-15 минут.')

    try {
      // Submit the form
      const form = event.target.closest('form')
      const response = await fetch(form.action, {
        method: form.method,
        headers: {
          'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content,
          'Accept': 'application/json'
        }
      })

      const data = await response.json()

      if (data.success) {
        this.showStatus('success', '✅ Сбор данных завершен! Теперь запустите синхронизацию.')
        this.resetCollectButton()
      } else {
        this.showStatus('error', `❌ Ошибка: ${data.error}`)
        this.resetCollectButton()
      }
    } catch (error) {
      console.error('Collection error:', error)
      this.showStatus('error', '❌ Ошибка запуска сбора данных')
      this.resetCollectButton()
    }
  }

  // Handle sync button click
  async syncData(event) {
    event.preventDefault()

    const form = event.target.closest('form')
    const daysBack = form.querySelector('select[name="days_back"]').value

    if (!confirm(`Синхронизировать ${daysBack} дней? Это займет несколько минут.`)) {
      return
    }

    // Disable button and show loading
    this.syncButtonTarget.disabled = true
    this.syncButtonTarget.innerHTML = `
      <svg class="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span class="ml-2">Синхронизирую...</span>
    `

    this.showStatus('info', `🔄 Синхронизация запущена (${daysBack} дней)...`)

    // Start polling for status updates
    this.startPolling()

    // Submit form normally
    form.submit()
  }

  startPolling() {
    this.pollInterval = setInterval(() => {
      this.checkSyncStatus()
    }, 10000) // Check every 10 seconds
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  async checkSyncStatus() {
    if (!this.hasStatusUrlValue) return

    try {
      const response = await fetch(this.statusUrlValue)
      const data = await response.json()

      // Update UI with current stats
      if (this.hasProgressTarget) {
        this.progressTarget.textContent = `📊 Записей: ${data.total_records.toLocaleString()}`
      }
    } catch (error) {
      console.error('Status check failed:', error)
    }
  }

  showStatus(type, message) {
    if (!this.hasStatusTarget) return

    const colors = {
      info: 'bg-blue-50 border-blue-200 text-blue-800',
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800'
    }

    this.statusTarget.className = `border rounded-lg p-3 text-sm ${colors[type] || colors.info}`
    this.statusTarget.textContent = message
    this.statusTarget.classList.remove('hidden')
  }

  resetCollectButton() {
    this.collectButtonTarget.disabled = false
    this.collectButtonTarget.innerHTML = 'Собрать данные с API'
  }

  resetSyncButton() {
    this.syncButtonTarget.disabled = false
    this.syncButtonTarget.innerHTML = 'Синхронизировать из MySQL'
  }
}
