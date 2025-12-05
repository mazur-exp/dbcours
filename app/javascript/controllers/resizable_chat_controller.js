import { Controller } from "@hotwired/stimulus"

// Resizable chat panel controller
// Allows dragging the top border to resize the chat height
export default class extends Controller {
  static targets = ["container"]
  static values = {
    minHeight: { type: Number, default: 150 },
    maxHeight: { type: Number, default: 600 },
    storageKey: { type: String, default: "ai_chat_height" }
  }

  connect() {
    this.isDragging = false
    this.startY = 0
    this.startHeight = 0

    // Restore saved height
    const savedHeight = localStorage.getItem(this.storageKeyValue)
    if (savedHeight) {
      this.containerTarget.style.height = `${savedHeight}px`
    }

    // Bind methods
    this.onMouseMove = this.onMouseMove.bind(this)
    this.onMouseUp = this.onMouseUp.bind(this)
  }

  startResize(event) {
    event.preventDefault()
    this.isDragging = true
    this.startY = event.clientY || event.touches?.[0]?.clientY
    this.startHeight = this.containerTarget.offsetHeight

    document.addEventListener("mousemove", this.onMouseMove)
    document.addEventListener("mouseup", this.onMouseUp)
    document.addEventListener("touchmove", this.onMouseMove)
    document.addEventListener("touchend", this.onMouseUp)

    // Add visual feedback
    document.body.style.cursor = "ns-resize"
    document.body.style.userSelect = "none"
  }

  onMouseMove(event) {
    if (!this.isDragging) return

    const clientY = event.clientY || event.touches?.[0]?.clientY
    // Dragging up increases height, dragging down decreases
    const deltaY = this.startY - clientY
    let newHeight = this.startHeight + deltaY

    // Clamp to min/max
    newHeight = Math.max(this.minHeightValue, Math.min(this.maxHeightValue, newHeight))

    this.containerTarget.style.height = `${newHeight}px`
  }

  onMouseUp() {
    if (!this.isDragging) return

    this.isDragging = false
    document.removeEventListener("mousemove", this.onMouseMove)
    document.removeEventListener("mouseup", this.onMouseUp)
    document.removeEventListener("touchmove", this.onMouseMove)
    document.removeEventListener("touchend", this.onMouseUp)

    // Reset cursor
    document.body.style.cursor = ""
    document.body.style.userSelect = ""

    // Save height to localStorage
    const currentHeight = this.containerTarget.offsetHeight
    localStorage.setItem(this.storageKeyValue, currentHeight)
  }

  // Double-click to toggle between min and expanded
  toggleSize() {
    const currentHeight = this.containerTarget.offsetHeight
    const midPoint = (this.minHeightValue + this.maxHeightValue) / 2

    if (currentHeight < midPoint) {
      // Expand
      this.containerTarget.style.height = `${this.maxHeightValue}px`
    } else {
      // Collapse
      this.containerTarget.style.height = `${this.minHeightValue}px`
    }

    // Save
    localStorage.setItem(this.storageKeyValue, this.containerTarget.offsetHeight)
  }
}
