import { Controller } from "@hotwired/stimulus"

// AI Chat controller for admin dashboard
// Sends questions to N8N webhook for Claude analysis
export default class extends Controller {
  static targets = ["input", "messages", "sendButton"]
  static values = { clientId: Number }

  handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.send()
    }
  }

  async send() {
    const message = this.inputTarget.value.trim()
    if (!message) return

    // Disable input while processing
    this.setLoading(true)

    // Add user message to UI
    this.appendMessage("user", message)
    this.inputTarget.value = ""

    // Show typing indicator
    const loadingEl = this.showTypingIndicator()

    try {
      const response = await fetch("/api/ai_chat/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
          question: message,
          client_id: this.clientIdValue || null
        })
      })

      const data = await response.json()

      // Remove typing indicator
      this.removeTypingIndicator(loadingEl)

      if (data.success) {
        this.appendMessage("ai", data.analysis)
      } else {
        this.appendMessage("error", data.error || "Произошла ошибка")
      }
    } catch (error) {
      console.error("AI Chat error:", error)
      this.removeTypingIndicator(loadingEl)
      this.appendMessage("error", "Ошибка соединения. Попробуйте снова.")
    } finally {
      this.setLoading(false)
    }
  }

  setLoading(isLoading) {
    this.inputTarget.disabled = isLoading
    if (this.hasSendButtonTarget) {
      this.sendButtonTarget.disabled = isLoading
    }
  }

  showTypingIndicator() {
    const div = document.createElement("div")
    div.className = "flex justify-start typing-indicator"
    div.innerHTML = `
      <div class="bg-gray-100 text-gray-600 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
        <div class="flex gap-1">
          <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
          <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
          <span class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
        </div>
        <span>Анализирую...</span>
      </div>
    `
    this.messagesTarget.appendChild(div)
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
    return div
  }

  removeTypingIndicator(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element)
    }
  }

  appendMessage(role, text) {
    const div = document.createElement("div")

    if (role === "user") {
      div.className = "flex justify-end"
      div.innerHTML = `
        <div class="bg-green-500 text-white rounded-lg px-4 py-2 max-w-md text-sm">
          ${this.escapeHtml(text)}
        </div>
      `
    } else if (role === "error") {
      div.className = "flex justify-start"
      div.innerHTML = `
        <div class="bg-red-100 text-red-700 rounded-lg px-4 py-2 max-w-md text-sm border border-red-200">
          ${this.escapeHtml(text)}
        </div>
      `
    } else {
      // AI response - supports basic formatting
      div.className = "flex justify-start"
      div.innerHTML = `
        <div class="bg-gray-100 text-gray-800 rounded-lg px-4 py-2 max-w-md text-sm whitespace-pre-wrap">
          ${this.formatAIResponse(text)}
        </div>
      `
    }

    this.messagesTarget.appendChild(div)
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  formatAIResponse(text) {
    // Escape HTML first
    let formatted = this.escapeHtml(text)

    // Convert **bold** to <strong>
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

    // Convert *italic* to <em>
    formatted = formatted.replace(/\*(.+?)\*/g, '<em>$1</em>')

    // Convert `code` to <code>
    formatted = formatted.replace(/`(.+?)`/g, '<code class="bg-gray-200 px-1 rounded">$1</code>')

    return formatted
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}
