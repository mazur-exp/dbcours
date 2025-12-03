import { Controller } from "@hotwired/stimulus"

// Admin Clients controller for filtering client list
// Provides real-time search/filter functionality in the sidebar
export default class extends Controller {
  static targets = ["search", "list"]

  filter() {
    const query = this.searchTarget.value.toLowerCase().trim()
    const items = this.listTarget.querySelectorAll("[data-client-name]")

    items.forEach(item => {
      const name = item.dataset.clientName || ""
      if (name.includes(query)) {
        item.classList.remove("hidden")
      } else {
        item.classList.add("hidden")
      }
    })
  }
}
