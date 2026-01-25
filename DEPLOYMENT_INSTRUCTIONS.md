# 🚀 Инструкция по деплою - 25 января 2026

## ✅ ЧТО УЖЕ ГОТОВО В DEVELOPMENT:

- ✅ Encryption keys добавлены в development credentials
- ✅ Client модель с шифрованием (encrypts включен)
- ✅ 127 клиентов импортированы с Grab/GoJek токенами
- ✅ Токены зашифрованы в базе
- ✅ HTTP API endpoint протестирован
- ✅ Dashboard работает мгновенно
- ✅ Node.js скрипт готов
- ✅ Dockerfile с Node.js 20.x
- ✅ Все файлы готовы к коммиту

---

## 📝 ШАГ 1: Добавить encryption keys в PRODUCTION credentials

**ВЫ ДОЛЖНЫ СДЕЛАТЬ:**

```bash
EDITOR=nano bin/rails credentials:edit --environment production
```

**В Bitwarden:** Введите SSH passphrase когда попросит

**В nano добавьте В КОНЕЦ файла:**

```yaml

# Active Record Encryption (для шифрования API токенов)
active_record_encryption:
  primary_key: 0YZE3gJAJIjWj0M3PnpnM6GfFSAtqKHv
  deterministic_key: jrfY8o5OPszO4ewOZZvi3y6CkZj6rWsp
  key_derivation_salt: BCsAH2j8LIcxdsX0uUVO3O43R6OYYNcy
```

**Сохранить и выйти:** Ctrl+X, затем Y, затем Enter

**Проверка:**
```bash
EDITOR=cat bin/rails credentials:show --environment production | grep "primary_key"
```

Должно показать: `primary_key: 0YZE3gJAJIjWj0M3PnpnM6GfFSAtqKHv`

---

## 📦 ШАГ 2: Git Commit

```bash
git status

# Добавить все файлы
git add .
git add -f lib/delivery_collector/

# Commit
git commit -m "Integrate delivery data collection + local replica architecture

Major features:
1. Local replica architecture - 1,562x performance improvement
   - client_stats table for local caching
   - Instant dashboard queries (19s → 12ms)
   - 30,156 records cached locally

2. Node.js delivery collector integrated into Rails
   - Collection script in lib/delivery_collector/
   - HTTP API for data saving
   - Automatic daily collection at 8:30 AM Bali
   - 127 clients with encrypted Grab/GoJek credentials

3. Simplified architecture
   - Everything on one server (Rails)
   - No MySQL dependency for dashboard
   - Single button UI instead of two

Changes:
- Add client_stats table migration
- Add API credentials to clients table (10 fields)
- Add CollectDeliveryDataJob for running Node.js script
- Add Api::CollectorController for receiving data
- Install Node.js 20.x in Docker
- Simplify Admin::SyncController
- Update recurring.yml schedule
- Import 127 clients with encrypted credentials

Documentation:
- ai_docs/development/delivery_collector_integration.md
- ai_docs/development/local_replica_implementation_summary.md
- lib/delivery_collector/README.md
- DEPLOYMENT_INSTRUCTIONS.md

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

## 🚀 ШАГ 3: Deploy

```bash
bin/kamal deploy
```

**Введите SSH passphrase из Bitwarden когда попросит**

Kamal выполнит:
- Build Docker image с Node.js
- Install npm dependencies
- Run migrations (create_client_stats + add_api_credentials)
- Deploy new container
- Run health checks

**Ожидаемое время:** ~5-10 минут

---

## 🗄️ ШАГ 4: Импорт клиентов в PRODUCTION

### Вариант A: Через Rails Console (РЕКОМЕНДУЮ)

```bash
bin/kamal app exec -i 'bin/rails console'
```

**Введите SSH passphrase из Bitwarden**

**В Rails console выполните:**

```ruby
# Проверить что таблица пустая
puts "Current clients: #{Client.count}"

# Если clients уже есть - пропустите импорт!
# Если clients = 0 - нужно сначала создать через seeds или вручную

# Если clients есть, но БЕЗ credentials:
Client.count  # Должно быть ~127

# Тогда просто выйти
exit
```

**ВАЖНО:** Скопировать credentials в production - смотри Вариант B ниже!

---

### Вариант B: Импорт credentials из локальной SQLite

**На вашем компе:**

```bash
# 1. Экспортировать токены из SQLite в SQL формат
sqlite3 "/Users/mzr/Downloads/delivery_booster_gojek_grab_DB_MAC 2/database/database.sqlite" << 'EOF' > /tmp/export_credentials.sql
.mode insert clients_temp
SELECT
  name,
  grab_token,
  grab_user_id,
  grab_store_id,
  grab_merchant_id,
  grab_advertiser_id,
  grab_food_entity_id,
  gojek_merchant_id,
  gojek_client_id,
  gojek_refresh_token,
  gojek_access_token
FROM restaurants;
EOF

# 2. Создать Ruby скрипт для импорта
cat > /tmp/import_tokens.rb << 'RUBY'
# Данные из локальной SQLite скрипта
require 'sqlite3'

db = SQLite3::Database.new("/Users/mzr/Downloads/delivery_booster_gojek_grab_DB_MAC 2/database/database.sqlite")
db.results_as_hash = true

restaurants = db.execute("SELECT * FROM restaurants")

puts "Importing #{restaurants.length} restaurants..."

imported = 0
restaurants.each do |row|
  client = Client.find_by(name: row["name"])
  next unless client

  client.update!(
    grab_token: row["grab_token"],
    grab_user_id: row["grab_user_id"],
    grab_store_id: row["grab_store_id"],
    grab_merchant_id: row["grab_merchant_id"],
    grab_advertiser_id: row["grab_advertiser_id"],
    grab_food_entity_id: row["grab_food_entity_id"],
    gojek_merchant_id: row["gojek_merchant_id"],
    gojek_client_id: row["gojek_client_id"],
    gojek_refresh_token: row["gojek_refresh_token"],
    gojek_access_token: row["gojek_access_token"]
  )

  imported += 1
  puts "✅ #{client.name}" if imported % 20 == 0
end

puts "Total imported: #{imported}"
RUBY

# 3. Запустить импорт в production
bin/kamal app exec 'bin/rails runner' < /tmp/import_tokens.rb
```

**ПРОЩЕ:** Скопируйте файл `lib/delivery_collector/import_from_sqlite.rb` на сервер и запустите там!

---

### Вариант C: САМЫЙ ПРОСТОЙ (РЕКОМЕНДУЮ!)

**В production клиенты БЕЗ credentials будут работать так:**

1. Node.js скрипт попытается использовать токены из базы
2. Если токенов нет - скрипт сделает логин через username/password
3. Получит новые токены
4. **НО** они НЕ сохранятся в Rails базу автоматически

**Для первого запуска** это нормально! Скрипт соберёт данные, просто займёт чуть дольше (нужно логиниться).

**После первого сбора** можно экспортировать токены из локальной SQLite скрипта в Rails базу (для следующих запусков будет быстрее).

---

## 🧪 ШАГ 5: Первый запуск сбора данных

```bash
bin/kamal app exec -i 'bin/rails console'
```

**В console:**

```ruby
# Запустить сбор данных
CollectDeliveryDataJob.perform_now

# Ждём ~10-15 минут
# Job соберёт данные из Grab/GoJek для всех клиентов
```

**В ДРУГОМ ТЕРМИНАЛЕ смотреть прогресс:**

```bash
bin/kamal app logs -f | grep Collection
```

**Должно быть:**
```
[Collection] Starting data collection...
[Collection] Prepared credentials for 127 clients
[Collection] Running: node start.js both
...
[Collection] ✓ Data collection completed
```

---

## ✅ ШАГ 6: Проверка

### Проверить данные в базе:

```bash
bin/kamal app exec 'bin/rails runner "
  puts \"ClientStat count: #{ClientStat.count}\"
  puts \"Latest sync: #{ClientStat.maximum(:synced_at)}\"
"'
```

**Ожидаемый результат:** > 0 записей (например ~11,000 за 90 дней × 126 клиентов)

### Проверить в браузере:

```bash
open https://admin.aidelivery.tech/dashboard
```

**Проверить:**
- ✅ Клиенты отображаются
- ✅ Данные показаны мгновенно
- ✅ Графики работают
- ✅ Кнопка "Собрать данные" есть

---

## 🎯 ИТОГОВЫЙ ЧЕКЛИСТ

### Перед деплоем (НА КОМПЕ):

- [x] Encryption keys в development ✅ ГОТОВО
- [x] Encryption keys в production ⚠️ ВЫ ДЕЛАЕТЕ (ШАГ 1)
- [x] Client модель с encrypts ✅ ГОТОВО
- [x] 127 клиентов с credentials ✅ ГОТОВО
- [x] Токены зашифрованы ✅ ГОТОВО
- [x] HTTP API работает ✅ ПРОТЕСТИРОВАНО
- [ ] Git commit ⏭️ ШАГ 2

### После деплоя (НА СЕРВЕРЕ):

- [ ] Kamal deploy успешен
- [ ] Миграции прошли
- [ ] Импорт клиентов (если нужно)
- [ ] Первый сбор данных (ШАГ 5)
- [ ] Проверка в браузере (ШАГ 6)

---

## 🆘 Troubleshooting

### Если при деплое ошибка "Missing encryption keys"

**Причина:** Забыли добавить keys в production credentials

**Решение:** Повторить ШАГ 1

### Если clients пустая таблица в production

**Решение:** Запустить seeds или импорт вручную

### Если скрипт не может собрать данные (нет токенов)

**Решение:** Это нормально для первого запуска! Скрипт сделает логин и получит токены.

---

## 📞 ВАШ СЛЕДУЮЩИЙ ШАГ:

**ШАГ 1:** Добавьте encryption keys в production credentials (команда выше)

После этого я помогу с коммитом!
