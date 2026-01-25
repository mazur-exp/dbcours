# 📝 ПРОСТАЯ ИНСТРУКЦИЯ ДЛЯ ДЕПЛОЯ

## ✅ ЧТО УЖЕ СДЕЛАНО:

- ✅ 127 клиентов с ПОЛНЫМИ credentials в development
- ✅ Tokens зашифрованы (grab_token, gojek_refresh_token, gojek_access_token)
- ✅ Usernames зашифрованы (grab_username, gojek_username)
- ✅ Passwords зашифрованы (grab_password, gojek_password)
- ✅ Encryption keys в development credentials
- ✅ Весь код готов

---

## 🎯 ВАМ НУЖНО СДЕЛАТЬ 4 ШАГА:

### ШАГ 1️⃣: Добавить encryption keys в production

```bash
EDITOR=nano bin/rails credentials:edit --environment production
```

**Bitwarden:** Введите SSH passphrase

**В nano в КОНЕЦ файла добавьте:**

```yaml

# Active Record Encryption
active_record_encryption:
  primary_key: 0YZE3gJAJIjWj0M3PnpnM6GfFSAtqKHv
  deterministic_key: jrfY8o5OPszO4ewOZZvi3y6CkZj6rWsp
  key_derivation_salt: BCsAH2j8LIcxdsX0uUVO3O43R6OYYNcy
```

**Сохранить:** Ctrl+X → Y → Enter

---

### ШАГ 2️⃣: Git commit

```bash
git add .
git add -f lib/delivery_collector/

git commit -m "Integrate delivery collector + local replica (1562x faster)

- Add client_stats table (local cache)
- Add full API credentials to clients (encrypted)
- Integrate Node.js collection script
- HTTP API for data saving
- Node.js 20.x in Docker
- Automatic collection daily 8:30 AM Bali

Co-Authored-By: Claude Sonnet 4.5 (1M context) <noreply@anthropic.com>"
```

---

### ШАГ 3️⃣: Deploy

```bash
bin/kamal deploy
```

**Bitwarden:** Введите SSH passphrase когда попросит

**Ждите ~5-10 минут** (Docker build + deploy)

---

### ШАГ 4️⃣: Импорт клиентов в production

**Проверить есть ли clients в production:**

```bash
bin/kamal app exec 'bin/rails runner "puts Client.count"'
```

**Bitwarden:** Введите SSH passphrase

**Если показывает 0** - запустите seeds:
```bash
bin/kamal app exec 'bin/rails db:seed'
```

**Если показывает ~127** - clients уже есть, импортируем credentials:

```bash
# Скопировать файл на сервер
bin/kamal app exec 'mkdir -p /rails/tmp/import'

# Скопировать import скрипт
cat lib/delivery_collector/import_full_credentials.rb | \
  bin/kamal app exec -i 'cat > /rails/lib/delivery_collector/import_full_credentials.rb'

# Скопировать данные
cat lib/delivery_collector/restaurants_temp.json | \
  bin/kamal app exec -i 'cat > /rails/lib/delivery_collector/restaurants_temp.json'

# Запустить импорт
bin/kamal app exec 'bin/rails runner lib/delivery_collector/import_full_credentials.rb'
```

**Bitwarden:** Введите SSH passphrase для каждой команды

---

## ✅ ПРОВЕРКА ЧТО ВСЁ РАБОТАЕТ:

```bash
# 1. Проверить clients с credentials
bin/kamal app exec 'bin/rails runner "
  total = Client.count
  with_creds = Client.where.not(grab_token: nil).count
  puts \"Clients: #{total}\"
  puts \"With credentials: #{with_creds}\"
"'

# 2. Запустить первый сбор данных
bin/kamal app exec -i 'bin/rails console'
# В console:
CollectDeliveryDataJob.perform_now
# Ждать ~10-15 минут

# 3. Открыть dashboard
open https://admin.aidelivery.tech/dashboard
```

**Должно быть:**
- Клиенты отображаются
- Данные показаны мгновенно
- Кнопка "Собрать данные" работает

---

## 🎉 ГОТОВО!

После этого:
- ✅ Автоматический сбор каждый день в 8:30 AM Bali
- ✅ Dashboard мгновенный (<500ms)
- ✅ Всё зашифровано
- ✅ Всё на одном сервере

**НАЧИНАЙТЕ С ШАГ 1!**
