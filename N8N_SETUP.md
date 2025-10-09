# N8N Integration Setup

## Шаг 1: Добавьте credentials в Rails

Откройте зашифрованный файл credentials:

```bash
EDITOR="code --wait" bin/rails credentials:edit
```

Добавьте следующую структуру в файл:

```yaml
n8n:
  api_token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZTI5YzViNy03ZTYzLTRjODAtYmE4Ny03ZDYxYjJlNzliMzQiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzU5OTgwNzQxfQ.aS0WPHf3yZ0mWuqDf146Gbsg-pKi8z1YpXpAwixJ7aM
  webhook_url:
    test: https://n8n.aidelivery.tech/webhook-test/6d426ce1-6e61-42dd-96e3-ca96969f4c51
    production: https://n8n.aidelivery.tech/webhook/6d426ce1-6e61-42dd-96e3-ca96969f4c51
```

**Важно:** Сохраните файл (Ctrl+S или Cmd+S) и закройте редактор. Credentials будут автоматически зашифрованы.

---

## Шаг 2: Проверьте конфигурацию

Запустите Rails console:

```bash
bin/rails console
```

Проверьте что credentials загружены:

```ruby
N8N_API_TOKEN
# => "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

N8N_WEBHOOK_URL
# => "https://n8n.aidelivery.tech/webhook-test/..." (в development)
# => "https://n8n.aidelivery.tech/webhook/..." (в production)
```

---

## Шаг 3: Использование в коде

### Отправка webhook в N8N

```ruby
require 'net/http'
require 'json'

uri = URI(N8N_WEBHOOK_URL)
http = Net::HTTP.new(uri.host, uri.port)
http.use_ssl = true

request = Net::HTTP::Post.new(uri.path)
request['Authorization'] = "Bearer #{N8N_API_TOKEN}"
request['Content-Type'] = 'application/json'
request.body = {
  event: 'user_registered',
  user_id: user.id,
  telegram_id: user.telegram_id,
  username: user.username
}.to_json

response = http.request(request)
```

### Или с HTTParty gem

```ruby
HTTParty.post(
  N8N_WEBHOOK_URL,
  headers: {
    'Authorization' => "Bearer #{N8N_API_TOKEN}",
    'Content-Type' => 'application/json'
  },
  body: {
    event: 'user_registered',
    user_id: user.id
  }.to_json
)
```

---

## Доступные константы

После добавления credentials в приложении доступны:

- `N8N_API_TOKEN` - JWT токен для авторизации
- `N8N_WEBHOOK_URL` - URL webhook (автоматически выбирается test/production в зависимости от окружения)

---

## Production Deployment

При деплое на production убедитесь что master.key находится на сервере:

```bash
# В config/deploy.yml для Kamal уже настроено копирование секретов
# Или вручную скопируйте master.key на сервер
```

Credentials автоматически расшифруются используя master.key при запуске приложения.

---

## Troubleshooting

### Ошибка: "WARNING: N8N_API_TOKEN is not configured"

Убедитесь что вы:
1. Добавили `n8n:` секцию в credentials
2. Сохранили и закрыли файл credentials
3. Перезапустили Rails сервер

### Проверка credentials

```bash
bin/rails credentials:show
```

Должна быть видна секция:
```yaml
n8n:
  api_token: ...
  webhook_url:
    test: ...
    production: ...
```
