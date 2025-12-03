# Admin Analytics Dashboard

## Обзор

Админский дашборд аналитики — третий домен приложения, предназначенный для управления клиентами-ресторанами и анализа их метрик.

**URL:** `admin.aidelivery.tech`

---

## Архитектура

```
┌─────────────────────────────────────────────────────────────────────┐
│                         aidelivery.tech                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   course.    │  │    crm.      │  │   admin.     │               │
│  │ aidelivery   │  │ aidelivery   │  │ aidelivery   │               │
│  │   .tech      │  │   .tech      │  │   .tech      │               │
│  │              │  │              │  │              │               │
│  │ • Курс       │  │ • CRM        │  │ • Analytics  │               │
│  │ • Dashboard  │  │ • Messenger  │  │ • Clients    │               │
│  │ • Lessons    │  │ • Traffic    │  │ • AI Chat    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│              ▼ Shared Session Cookie (tld_length: 2) ▼              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Структура файлов

```
app/
├── controllers/
│   └── admin/
│       ├── base_controller.rb      # Базовый контроллер с авторизацией
│       ├── home_controller.rb      # Страница входа
│       └── dashboard_controller.rb # Основной дашборд
├── views/
│   ├── admin/
│   │   ├── home/
│   │   │   └── index.html.erb      # Страница входа (как CRM)
│   │   ├── dashboard/
│   │   │   ├── index.html.erb      # 3-колоночный layout
│   │   │   ├── _clients_sidebar.html.erb
│   │   │   ├── _analytics_center.html.erb
│   │   │   ├── _ai_chat.html.erb
│   │   │   └── _client_info.html.erb
│   │   └── shared/
│   │       └── _header.html.erb    # Хедер с динамическим page_title
│   └── layouts/
│       └── admin.html.erb          # Layout для админки
└── models/
    └── client.rb                   # Модель клиента-ресторана

app/javascript/controllers/
├── chart_controller.js             # Chart.js интеграция
├── admin_chat_controller.js        # AI чат (stub)
└── admin_clients_controller.js     # Управление клиентами
```

---

## Контроллеры

### Admin::BaseController

Базовый контроллер с проверкой прав администратора:

```ruby
# app/controllers/admin/base_controller.rb
module Admin
  class BaseController < ApplicationController
    before_action :require_admin
    layout "admin"

    private

    def require_admin
      unless @current_user&.admin?
        redirect_to admin_root_path, alert: "Доступ запрещен"
      end
    end
  end
end
```

### Admin::HomeController

Страница входа (без авторизации, редирект если уже авторизован):

```ruby
# app/controllers/admin/home_controller.rb
module Admin
  class HomeController < ApplicationController
    layout "admin"

    def index
      if @current_user&.admin?
        redirect_to admin_dashboard_path
      end
    end
  end
end
```

### Admin::DashboardController

Основной дашборд с клиентами и аналитикой:

```ruby
# app/controllers/admin/dashboard_controller.rb
module Admin
  class DashboardController < BaseController
    def index
      @clients = Client.ordered
      @selected_client = params[:client_id] ? Client.find(params[:client_id]) : @clients.first

      @analytics = {
        orders: 0,
        revenue: 0,
        customers: 0,
        rating: 0.0,
        # Placeholder данные для графиков
        orders_chart: { labels: [...], data: [...] },
        revenue_chart: { labels: [...], data: [...] }
      }
    end
  end
end
```

---

## Модель Client

```ruby
# app/models/client.rb
class Client < ApplicationRecord
  validates :name, presence: true

  scope :active, -> { where(status: "active") }
  scope :ordered, -> { order(:name) }

  STATUSES = %w[active paused churned].freeze

  def status_color
    case status
    when "active" then "green"
    when "paused" then "yellow"
    when "churned" then "red"
    else "gray"
    end
  end
end
```

### Миграция

```ruby
# db/migrate/XXX_create_clients.rb
class CreateClients < ActiveRecord::Migration[8.0]
  def change
    create_table :clients do |t|
      t.string :name, null: false
      t.string :contact_name
      t.string :telegram_username
      t.string :status, default: "active"
      t.text :notes
      t.text :goals
      t.date :started_at

      t.timestamps
    end

    add_index :clients, :status
    add_index :clients, :name
  end
end
```

---

## UI Layout

### 3-колоночный дашборд

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Delivery Booster                                    [Aleksei ▼] │
│     Analytics Dashboard                                             │
├─────────────┬───────────────────────────────────┬───────────────────┤
│  КЛИЕНТЫ    │        АНАЛИТИКА КЛИЕНТА          │   INFO КЛИЕНТА    │
│             │                                   │                   │
│ 🔍 Поиск... │  [0] Заказов  [$0] Выручка       │  Test Restaurant  │
│             │  [0] Клиентов [0.0] Рейтинг      │  [Активен]        │
│ ┌─────────┐ │                                   │                   │
│ │ Test    │ │  ┌─────────┐  ┌─────────┐        │  Начало работы:   │
│ │Restaurant│ │  │ Заказы  │  │ Выручка │        │  03 Nov 2025      │
│ └─────────┘ │  │ [chart] │  │ [chart] │        │                   │
│             │  └─────────┘  └─────────┘        │  Цели:            │
│             │                                   │  Increase orders  │
│             │  ┌───────────────────────┐        │                   │
│             │  │ 🤖 AI Ассистент       │        │  Контакт:         │
│             │  │ Привет! Я AI для      │        │  John Doe         │
│             │  │ анализа данных...     │        │  @testrest        │
│ [+ Добавить]│  │ [Введите вопрос...]   │        │  [Редактировать]  │
└─────────────┴───────────────────────────────────┴───────────────────┘
```

---

## Chart.js интеграция

### Importmap

```ruby
# config/importmap.rb
pin "chart.js/auto", to: "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/auto/+esm"
```

### Stimulus контроллер

```javascript
// app/javascript/controllers/chart_controller.js
import { Controller } from "@hotwired/stimulus"
import Chart from "chart.js/auto"

export default class extends Controller {
  static values = {
    type: { type: String, default: "line" },
    labels: Array,
    data: Array
  }

  connect() {
    this.renderChart()
  }

  disconnect() {
    if (this.chart) {
      this.chart.destroy()
    }
  }

  renderChart() {
    const ctx = this.element.getContext("2d")

    this.chart = new Chart(ctx, {
      type: this.typeValue,
      data: {
        labels: this.labelsValue,
        datasets: [{
          label: "Данные",
          data: this.dataValue,
          borderColor: "rgb(34, 197, 94)",
          backgroundColor: this.typeValue === "bar"
            ? "rgba(34, 197, 94, 0.5)"
            : "rgba(34, 197, 94, 0.1)",
          fill: this.typeValue === "line",
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        // ...
      }
    })
  }
}
```

### Использование в views

```erb
<canvas
  data-controller="chart"
  data-chart-type-value="line"
  data-chart-labels-value='["Янв", "Фев", "Мар", "Апр", "Май", "Июн"]'
  data-chart-data-value="[0, 0, 0, 0, 0, 0]"
  class="w-full h-48">
</canvas>
```

---

## Маршрутизация

### Production (domain constraints)

```ruby
# config/routes.rb
if Rails.env.production?
  constraints(host: "admin.aidelivery.tech") do
    get "/", to: "admin/home#index", as: :admin_root

    namespace :admin, path: "" do
      get "dashboard", to: "dashboard#index", as: :dashboard
    end
  end
end
```

### Development (prefix routes)

```ruby
# config/routes.rb
else
  # Development routes
  get "admin", to: "admin/home#index", as: :admin_root

  namespace :admin do
    get "dashboard", to: "dashboard#index", as: :dashboard
  end
end
```

---

## Deployment

### Kamal proxy config

```yaml
# config/deploy.yml
proxy:
  ssl: true
  host: course.aidelivery.tech,crm.aidelivery.tech,admin.aidelivery.tech
```

---

## AI Chat (Future)

AI чат реализован как stub с placeholder ответами:

```javascript
// app/javascript/controllers/admin_chat_controller.js
sendMessage() {
  // Добавляем сообщение пользователя
  this.addMessage(message, "user")

  // Stub ответ
  setTimeout(() => {
    this.addMessage(
      "Анализирую данные клиента... (AI интеграция в разработке)",
      "assistant"
    )
  }, 1000)
}
```

**Планы:**
- Интеграция с N8N для AI ответов
- Анализ метрик клиента
- Рекомендации по улучшению показателей

---

## Unified Header Design

### Паттерн Icon Map

Все CRM/Admin страницы используют единый стиль хедера:

```erb
<%# app/views/crm/shared/_header.html.erb %>
<% page_icons = {
  'CRM' => '<path ... />',           # 👥 Люди
  'Messenger' => '<path ... />',     # 💬 Чат
  'Источники трафика' => '<path ... />', # 📈 Тренд
  'Analytics Dashboard' => '<path ... />'  # 📊 Графики
} %>

<div class="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
  <svg class="w-6 h-6 text-white">
    <%= icon_path.html_safe %>
  </svg>
</div>
<div class="ml-3">
  <h1 class="text-lg font-semibold">Delivery Booster</h1>
  <p class="text-xs text-gray-500"><%= page_title %></p>
</div>
```

### Результат

| Страница | Иконка | Подзаголовок |
|----------|--------|--------------|
| CRM | 👥 | CRM |
| Messenger | 💬 | Messenger |
| Источники трафика | 📈 | Источники трафика |
| Analytics Dashboard | 📊 | Analytics Dashboard |

---

## Access Control

| User Type | Admin Dashboard |
|-----------|-----------------|
| Not authenticated | ✗ Redirect to login |
| Authenticated (free) | ✗ Access denied |
| Authenticated (paid) | ✗ Access denied |
| Admin | ✅ Full access |

---

## См. также

- [Multi-Domain Architecture](./multi_domain_architecture.md) — архитектура доменов
- [Cross-Domain Sessions](./cross_domain_sessions.md) — SSO между доменами
- [Frontend Architecture](./frontend_architecture.md) — Stimulus + Hotwire
- [Deployment](./deployment.md) — Kamal конфигурация
