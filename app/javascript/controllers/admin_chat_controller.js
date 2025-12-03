import { Controller } from "@hotwired/stimulus"

// AI Chat controller for admin dashboard
// Handles message sending with Enter key and button click
// Currently uses placeholder responses (AI integration planned for future)
export default class extends Controller {
  static targets = ["input", "messages"]

  handleKeydown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      this.send()
    }
  }

  send() {
    const message = this.inputTarget.value.trim()
    if (!message) return

    // Add user message to UI
    this.appendMessage("user", message)
    this.inputTarget.value = ""

    // TODO: Send to server for AI processing
    // fetch("/admin/chat/message", {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content
    //   },
    //   body: JSON.stringify({ message })
    // })

    // Placeholder response
    setTimeout(() => {
      this.appendMessage("ai", "Функция AI-анализа будет добавлена в следующей версии. Сейчас вы можете просматривать статистику и графики выбранного клиента.")
    }, 500)
  }

  appendMessage(role, text) {
    const div = document.createElement("div")
    div.className = role === "user"
      ? "flex justify-end"
      : "flex justify-start"

    const bgClass = role === "user"
      ? "bg-green-500 text-white"
      : "bg-gray-100 text-gray-800"

    div.innerHTML = `
      <div class="${bgClass} rounded-lg px-4 py-2 max-w-md text-sm">
        ${this.escapeHtml(text)}
      </div>
    `

    this.messagesTarget.appendChild(div)
    this.messagesTarget.scrollTop = this.messagesTarget.scrollHeight
  }

  escapeHtml(text) {
    const div = document.createElement("div")
    div.textContent = text
    return div.innerHTML
  }
}
