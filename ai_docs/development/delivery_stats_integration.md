# Delivery Stats Integration Architecture

## Обзор

Интеграция внешней MySQL базы данных **deliverybooster_api** с Rails приложением для отображения реальной аналитики ресторанов на странице Analytics Dashboard.

**Дата интеграции:** 25 января 2026
**Статус:** ✅ Production Ready

---

## Архитектура решения

### Выбранный подход: HTTP API Client

```
┌─────────────────────────────────────────────────────────┐
│           Rails Application (SQLite)                     │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Admin::DashboardController                      │   │
│  │    ↓                                             │   │
│  │  Analytics::ClientStatsService                   │   │
│  │    ↓                                             │   │
│  │  DeliveryStatsClient (HTTP)                      │   │
│  │    ↓ GET /api/v1/getRestaurantStats              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────┼───────────────────────────────┘
                           │ HTTP Request
                           ↓
              ┌────────────────────────────┐
              │   Express.js API Server    │
              │   5.187.7.140:3000         │
              └────────────────────────────┘
                           │
                           ↓
              ┌────────────────────────────┐
              │   MySQL Database           │
              │   5.187.7.140:3306         │
              │   deliverybooster_api      │
              │                            │
              │   • 110 restaurants        │
              │   • 55,000+ stats records  │
              │   • 7 data sources         │
              └────────────────────────────┘
```

### Почему HTTP API, а не прямое подключение MySQL?

**Попытка #1: ActiveRecord + mysql2 gem**
- ❌ Проблемы совместимости MySQL 9.6 vs старая аутентификация сервера
- ❌ Ошибка: "pluggable authentication is not available"
- ❌ Требует установки MySQL клиента локально

**Решение: HTTP API Client**
- ✅ Использует существующий Express API (уже в продакшене)
- ✅ Нет зависимостей от MySQL клиента
- ✅ Легко кешируется
- ✅ Работает из любой среды (dev, prod, Docker)
- ✅ Не требует сетевых настроек (firewall, SSL)

---

## Компоненты

### 1. DeliveryStatsClient (app/services/delivery_stats_client.rb)

HTTP клиент для работы с Express API:

```ruby
class DeliveryStatsClient
  API_BASE_URL = ENV.fetch("DELIVERY_STATS_API_URL", "http://5.187.7.140:3000")

  def self.get_restaurant_stats(restaurant_name:, source:, start_date: nil, end_date: nil)
    # GET /api/v1/getRestaurantStats
    # Returns: { restaurant_name, source, period, records_count, data: [...] }
  end
end
```

**Источники данных (source):**
- `looker_summary` - Готовая сводка Grab + GoJek + накрутка (59 полей)
- `grab` - Grab статистика (35 полей)
- `gojek` - GoJek статистика (38 полей)
- `fake_orders` - История накрутки (12 полей)
- `monthly_commissions` - Месячные комиссии (11 полей)
- `commission_settings` - Настройки комиссий (9 полей)
- `restaurants` - Список ресторанов (8+ полей)

### 2. Analytics::ClientStatsService (app/services/analytics/client_stats_service.rb)

Сервис для подготовки данных для UI:

```ruby
module Analytics
  class ClientStatsService
    def initialize(client, start_date: nil, end_date: nil)
      # Default: October 2025 (where we have real data)
      @end_date = end_date || Date.parse("2025-10-31")
      @start_date = start_date || Date.parse("2025-10-01")
    end

    def call
      {
        summary: summary_stats,      # Агрегированные метрики
        charts: chart_data,           # Данные для графиков
        platforms: platform_breakdown, # Детальная разбивка по платформам
        commission: commission_info,   # Настройки комиссии
        has_data: true
      }
    end
  end
end
```

**Возвращаемые данные:**

```ruby
{
  summary: {
    total_orders: 279,
    total_sales: "Rp 85.3M",
    total_customers: 156,
    avg_rating: 4.78,
    period_days: 31
  },
  charts: {
    orders: { labels: ["01 Oct", ...], data: [2, 5, 4, ...] },
    revenue: { labels: [...], data: [...] },
    customers: { labels: [...], data: [...] },
    rating: { labels: [...], data: [...] }
  },
  platforms: {
    grab: {
      sales: 62100000, formatted_sales: "Rp 62.1M",
      orders: 191, avg_check: 325000, formatted_avg_check: "Rp 325.0K",
      ads_spend: 3700000, roi: 1407.4,
      new_customers: 140, repeated_customers: 37, fake_orders: 8
    },
    gojek: { ... }
  },
  commission: {
    type: "PERCENT_DELTA",
    percent: 10.0,
    platform: "Grab + GoJek"
  },
  has_data: true
}
```

### 3. Admin::DashboardController (app/controllers/admin/dashboard_controller.rb)

```ruby
def index
  @clients = Client.active.ordered
  @selected_client = @clients.find_by(id: params[:client_id]) || @clients.first

  # Date range from params or default to October 2025
  @end_date = params[:end_date]&.to_date || Date.parse("2025-10-31")
  @start_date = params[:start_date]&.to_date || Date.parse("2025-10-01")

  # Get analytics data
  if @selected_client
    stats_service = Analytics::ClientStatsService.new(
      @selected_client,
      start_date: @start_date,
      end_date: @end_date
    )
    @analytics = stats_service.call
  end
end
```

### 4. Client Model (app/models/client.rb)

Связь с внешней системой через совпадение имени:

```ruby
class Client < ApplicationRecord
  # Name должно совпадать с restaurants.name в MySQL
  validates :name, presence: true

  # Примеры:
  # - "Bali Babe (Uluwatu)"
  # - "Only Eggs"
  # - "Hot Doggy Style (Uluwatu)"
end
```

---

## UI Features

### 1. Date Picker

Форма для выбора периода аналитики:

```erb
<form action="<%= admin_dashboard_path %>" method="get">
  <input type="hidden" name="client_id" value="<%= selected_client.id %>">
  <input type="date" name="start_date" value="<%= @start_date %>">
  <input type="date" name="end_date" value="<%= @end_date %>">
  <button type="submit">Применить</button>
</form>
```

### 2. Stats Cards

4 основные метрики вверху:
- 📦 Заказов
- 💰 Выручка
- 👤 Клиентов
- ⭐ Рейтинг

### 3. Interactive Charts

4 графика с Chart.js:
- Заказы (line)
- Выручка (line)
- Новые клиенты (bar)
- Рейтинг (line)

### 4. Platform Breakdown Table

Детальная таблица с разбивкой Grab vs GoJek:

| Метрика | Grab | GoJek | Итого |
|---------|------|-------|-------|
| 💰 Продажи | Rp 62.1M | Rp 23.3M | Rp 85.3M |
| 📦 Заказов | 191 | 88 | 279 |
| 💵 Средний чек | Rp 325.0K | Rp 264.3K | Rp 305.9K |
| 💸 Затраты на рекламу | Rp 3.7M | Rp 1.9M | Rp 5.6M |
| 📈 ROI рекламы | 1407.4% | 721.3% | 1176.2% |
| 👤 Новые клиенты | 140 | 16 | 156 |
| 🔄 Повторные клиенты | 37 | 0 | 37 |
| ⚠️ Накрутка заказов | 8 | 5 | 13 |

---

## Кеширование

**Стратегия кеширования через Solid Cache:**

```ruby
# Looker summary - 1 час (часто меняется)
Rails.cache.fetch("client_#{id}_#{start_date}_#{end_date}_looker_summary", expires_in: 1.hour)

# Grab/GoJek stats для рейтинга - 1 час
Rails.cache.fetch("client_#{id}_#{start_date}_#{end_date}_grab_stats_rating", expires_in: 1.hour)

# Commission settings - 24 часа (редко меняется)
Rails.cache.fetch("client_#{id}_commission_settings", expires_in: 24.hours)
```

**Очистка кеша:**
```bash
bin/rails runner 'Rails.cache.clear'
```

---

## Seed Data

Клиенты созданы в `db/seeds.rb` с именами, совпадающими с MySQL:

```ruby
clients_data = [
  {
    name: "Bali Babe (Uluwatu)",
    contact_name: "Julia",
    contact_telegram: "@julia_balibabe",
    status: "active",
    notes: "Premium beach club restaurant",
    goals: "Увеличить повторные заказы, снизить зависимость от скидок",
    start_date: Date.parse("2024-06-01")
  },
  # ... ещё 3 ресторана
]
```

**Запуск:**
```bash
bin/rails db:seed
```

---

## Важные находки при интеграции

### Проблема #1: API возвращает числа как строки

**Симптом:** `TypeError: String can't be coerced into Integer`

**Причина:**
```ruby
grab_sales: "249150.00"  # String, not Float!
```

**Решение:**
```ruby
total_sales = data_records.sum { |r| r[:grab_sales].to_f + r[:gojek_sales].to_f }
# Всегда используем .to_f для конвертации
```

### Проблема #2: Дефолтный период без данных

**Симптом:** Показывает нули на свежей установке

**Причина:** Дефолт был "последние 30 дней" (декабрь 2025 - январь 2026), а данные есть только до октября 2025

**Решение:**
```ruby
# Hardcoded default to October 2025 where we have real data
@end_date = params[:end_date]&.to_date || Date.parse("2025-10-31")
@start_date = params[:start_date]&.to_date || Date.parse("2025-10-01")
```

### Проблема #3: Кеширование пустых результатов

**Причина:** При разработке закешировались placeholder данные

**Решение:** Очистка кеша после каждого изменения:
```bash
bin/rails runner 'Rails.cache.clear'
```

---

## API Endpoints

### GET /api/v1/getRestaurantStats

**Parameters:**
- `restaurant_name` (required) - точное название ресторана
- `source` (required) - источник данных
- `start_date` (optional) - YYYY-MM-DD
- `end_date` (optional) - YYYY-MM-DD

**Response:**
```json
{
  "restaurant_name": "Bali Babe (Uluwatu)",
  "source": "looker_summary",
  "period": "2025-10-01 to 2025-10-31",
  "records_count": 31,
  "data": [
    {
      "stat_date": "2025-10-31T00:00:00.000Z",
      "grab_sales": "249150.00",
      "gojek_sales": "162000.00",
      "grab_orders": 1,
      "gojek_orders": 1,
      "grab_new_customers": 3,
      "gojek_new_client": 0,
      // ... 50+ more fields
    }
  ]
}
```

---

## Database Schema

### External MySQL (deliverybooster_api)

**Основные таблицы:**

```sql
-- 110 ресторанов
restaurants (id, name, TelegramChatID, grab_token, gojek_client_id, ...)

-- 26,922 записей Grab статистики
grab_stats (id, restaurant_id, stat_date, sales, orders, ads_spend, rating, ...)

-- 28,911 записей GoJek статистики
gojek_stats (id, restaurant_id, stat_date, sales, orders, ads_spend, rating, ...)

-- 2,234 записей накрутки
fake_orders (id, restaurant_id, stat_date, platform, fake_orders_count, fake_orders_spend, ...)

-- 30,361 записей готовой сводки
looker_studio_summary (stat_date, restaurant_id, grab_sales, gojek_sales, grab_orders, gojek_orders, ...)

-- 184 месячных комиссии
monthly_commissions (id, restaurant_id, period_month, commission_total, ...)

-- 101 настройка комиссий
commission_settings (id, restaurant_id, platform, commission_type, percent, ...)
```

### Local SQLite (Rails app)

```sql
-- Клиенты в Rails приложении
clients (
  id,
  name,              -- ДОЛЖНО совпадать с restaurants.name
  contact_name,
  contact_telegram,
  status,
  notes,
  goals,
  start_date
)
```

**Связь:** `Client.name` === `DeliveryStats::Restaurant.name` (string match)

---

## Performance Optimizations

### 1. Single API Call Strategy

Вместо 3 запросов (grab + gojek + fake_orders), используем 1:

```ruby
# ❌ Плохо - 3 HTTP запроса
grab_stats = DeliveryStatsClient.get_restaurant_stats(name, "grab", ...)
gojek_stats = DeliveryStatsClient.get_restaurant_stats(name, "gojek", ...)
fake_orders = DeliveryStatsClient.get_restaurant_stats(name, "fake_orders", ...)

# ✅ Хорошо - 1 HTTP запрос
looker_data = DeliveryStatsClient.get_restaurant_stats(name, "looker_summary", ...)
# Внутри уже есть grab_*, gojek_*, *_fake_orders_count
```

### 2. Multi-level Caching

- **Looker summary:** 1 час (основные данные)
- **Rating calculations:** 1 час (grab + gojek отдельно)
- **Commission settings:** 24 часа (редко меняется)

### 3. Graceful Degradation

```ruby
# Если нет данных - показываем placeholder с предупреждением
return placeholder_data if looker_data[:error] || looker_data[:data].empty?
```

---

## UI Layout

### Desktop (1920px)

```
┌────────────────────────────────────────────────────────────────┐
│  📊 Delivery Booster - Analytics Dashboard      [Aleksei M ▼]  │
├──────────┬─────────────────────────────────────┬───────────────┤
│ КЛИЕНТЫ  │       ANALYTICS CENTER              │  CLIENT INFO  │
│          │                                     │               │
│ [Search] │  [Date Picker: 01.10 — 31.10] 🔄    │  Julia        │
│          │                                     │  @julia_...   │
│ ┌──────┐ │  [279]  [85.3M]  [156]  [4.8⭐]     │               │
│ │Bali  │ │                                     │  Goals: ...   │
│ │Babe  │ │  ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐ │               │
│ └──────┘ │  │Orders│ │Revenue│ │Cust. │ │Rate│ │               │
│          │  │[📊]  │ │[📊]  │ │[📊] │ │[📊]│ │               │
│ Hot Dog  │  └──────┘ └──────┘ └──────┘ └────┘ │               │
│ Only Egg │                                     │               │
│          │  ┌──────────────────────────────┐   │               │
│          │  │ Platform Breakdown Table     │   │               │
│          │  │ Grab vs GoJek comparison     │   │               │
│          │  │ • Sales • Orders • ROI       │   │               │
│          │  │ • Customers • Fake orders    │   │               │
│          │  └──────────────────────────────┘   │               │
│          │                                     │               │
│          │  ┌──────────────────────────────┐   │               │
│ [+ Add]  │  │ 🤖 AI Ассистент              │   │               │
└──────────┴──│ [Chat interface...]          │───┴───────────────┘
             └──────────────────────────────┘
```

---

## Environment Variables

### Development (.env.development - optional)

```bash
DELIVERY_STATS_API_URL=http://5.187.7.140:3000
```

### Production (Kamal .env)

```bash
# Delivery Stats API
DELIVERY_STATS_API_URL=http://5.187.7.140:3000
```

**Default fallback:** `http://5.187.7.140:3000` (hardcoded)

---

## Testing

### Manual Testing

```bash
# Test API client
bin/rails runner 'result = DeliveryStatsClient.get_restaurant_stats(
  restaurant_name: "Bali Babe (Uluwatu)",
  source: "looker_summary",
  start_date: Date.parse("2025-10-01"),
  end_date: Date.parse("2025-10-31")
); puts result[:records_count]'

# Test analytics service
bin/rails runner 'client = Client.find_by(name: "Bali Babe (Uluwatu)");
service = Analytics::ClientStatsService.new(client);
result = service.call;
puts "Orders: #{result[:summary][:total_orders]}"'

# Clear cache if needed
bin/rails runner 'Rails.cache.clear'
```

### Browser Testing

1. Запустить сервер: `bin/rails server`
2. Открыть: `http://localhost:3000/admin/dashboard`
3. Выбрать клиента из списка
4. Изменить даты в date picker
5. Проверить метрики и графики

---

## Deployment Considerations

### Kamal Configuration

API endpoint доступен публично, но для production рекомендуется:

**Опция 1:** VPN туннель между серверами
**Опция 2:** API Key authentication
**Опция 3:** Private network (если оба сервера в одном датацентре)

### Docker Image

Нет изменений в Dockerfile - используем стандартный Net::HTTP из Ruby stdlib.

### Health Check

```ruby
# config/routes.rb
get "/health/delivery_stats", to: proc {
  result = DeliveryStatsClient.get_restaurant_stats(
    restaurant_name: "Only Eggs",
    source: "restaurants"
  )

  if result[:error]
    [503, {}, ["Delivery Stats API unavailable"]]
  else
    [200, {}, ["OK"]]
  end
}
```

---

## Troubleshooting

### Problem: "Для этого клиента пока нет данных"

**Причина:** Client.name не совпадает с restaurants.name в MySQL

**Решение:**
1. Проверить точное название: `DeliveryStatsClient.get_restaurant_stats(restaurant_name: "...", source: "restaurants")`
2. Обновить Client.name чтобы точно совпадало

### Problem: Shows zeros for all metrics

**Причина:** Данных нет за выбранный период

**Решение:**
1. Изменить даты на октябрь 2025 (где есть данные)
2. Проверить что API возвращает: `DeliveryStatsClient.get_restaurant_stats(...)`

### Problem: Old/cached data showing

**Решение:**
```bash
bin/rails runner 'Rails.cache.clear'
bin/rails restart
```

---

## Future Enhancements

### Планы на будущее:

1. **Real-time data sync** - WebSocket обновления при изменении данных
2. **Export to PDF** - Экспорт отчетов
3. **Comparison mode** - Сравнение нескольких периодов
4. **Alerts** - Уведомления при падении метрик
5. **More visualizations:**
   - Funnel chart (impressions → visits → cart → orders)
   - Heatmap календарь
   - Conversion rate trends
6. **AI Chat integration** - Интеграция с N8N для автоматического анализа

---

## См. также

- [Admin Analytics Dashboard](./admin_analytics_dashboard.md) - Общая архитектура админки
- [DELIVERY_STATS_MCP_DOCUMENTATION.md](/Users/mzr/Developments/mcp/) - Полная документация MCP
- Express API code: `5.187.7.140:/home/delivery-booster-api/express.js`
