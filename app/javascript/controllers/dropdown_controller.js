import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["menu", "chevron"]

  connect() {
    // Обработчик для закрытия при клике вне dropdown
    this.closeOnOutsideClick = this.closeOnOutsideClick.bind(this)
    // Обработчик для закрытия по ESC
    this.closeOnEscape = this.closeOnEscape.bind(this)
  }

  toggle(event) {
    event.stopPropagation()

    if (this.hasMenuTarget) {
      this.menuTarget.classList.toggle('hidden')

      // Вращаем chevron если есть
      if (this.hasChevronTarget) {
        this.chevronTarget.classList.toggle('rotate-180')
      }

      // Если открыли dropdown - добавляем обработчики
      if (!this.menuTarget.classList.contains('hidden')) {
        // Небольшая задержка перед добавлением обработчика клика,
        // чтобы текущий клик не закрыл dropdown сразу
        setTimeout(() => {
          document.addEventListener('click', this.closeOnOutsideClick)
          document.addEventListener('keydown', this.closeOnEscape)
        }, 10)
      } else {
        // Если закрыли - убираем обработчики
        this.removeEventListeners()
      }
    }
  }

  close() {
    if (this.hasMenuTarget && !this.menuTarget.classList.contains('hidden')) {
      this.menuTarget.classList.add('hidden')

      if (this.hasChevronTarget) {
        this.chevronTarget.classList.remove('rotate-180')
      }

      this.removeEventListeners()
    }
  }

  closeOnOutsideClick(event) {
    // Закрываем dropdown если клик был вне его элементов
    if (!this.element.contains(event.target)) {
      this.close()
    }
  }

  closeOnEscape(event) {
    if (event.key === 'Escape') {
      this.close()
    }
  }

  removeEventListeners() {
    document.removeEventListener('click', this.closeOnOutsideClick)
    document.removeEventListener('keydown', this.closeOnEscape)
  }

  disconnect() {
    // Очищаем обработчики при отключении контроллера
    this.removeEventListeners()
  }
}
