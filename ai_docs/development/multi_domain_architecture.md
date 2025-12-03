# Multi-Domain Architecture

## Обзор

Приложение работает на трёх субдоменах:
- **course.aidelivery.tech** — основной курс для пользователей
- **crm.aidelivery.tech** — CRM панель для администраторов
- **admin.aidelivery.tech** — Analytics Dashboard для управления клиентами

Все домены используют **единую сессию** (Single Sign-On) через shared cookies.

---

## Архитектура доменов

```
┌─────────────────────────────────────────────────────────────────────┐
│                         aidelivery.tech                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   course.    │  │    crm.      │  │   admin.     │               │
│  │ aidelivery   │  │ aidelivery   │  │ aidelivery   │               │
│  │   .tech      │  │   .tech      │  │   .tech      │               │
│  │              │  │              │  │              │               │
│  │ • Главная    │  │ • CRM        │  │ • Analytics  │               │
│  │ • Dashboard  │  │ • Messenger  │  │ • Clients    │               │
│  │ • Free Cont. │  │ • Traffic    │  │ • AI Chat    │               │
│  │ • Уроки      │  │ • Канбан     │  │ • Charts     │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│              ▼ Shared Session Cookie (tld_length: 2) ▼              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Конфигурация сессии

### Файл: `config/initializers/session_store.rb`

```ruby
# frozen_string_literal: true

# Shared sessions between course.aidelivery.tech and crm.aidelivery.tech
#
# IMPORTANT: tld_length determines how Rails calculates the cookie domain
# For course.aidelivery.tech:
#   - tld_length: 1 → domain="tech" (WRONG!)
#   - tld_length: 2 → domain=".aidelivery.tech" (CORRECT!)
#
# The tld_length counts parts from the RIGHT side of the domain
# aidelivery.tech has 2 parts, so tld_length must be 2
Rails.application.config.session_store :cookie_store,
  key: "_dbcours_session",
  domain: :all,
  tld_length: 2,
  secure: Rails.env.production?,
  httponly: true,
  same_site: :lax
```

### Почему `tld_length: 2`?

Rails использует `tld_length` для вычисления домена cookie. Он считает части домена **справа налево**:

| Домен | tld_length | Результат cookie domain |
|-------|------------|------------------------|
| `course.aidelivery.tech` | 1 | `domain=tech` ❌ (НЕПРАВИЛЬНО) |
| `course.aidelivery.tech` | 2 | `domain=.aidelivery.tech` ✅ |
| `example.co.uk` | 2 | `domain=.example.co.uk` ✅ |
| `app.example.com` | 1 | `domain=.example.com` ✅ |

**Важно:** `.tech` — это TLD нового поколения. Для доменов вида `subdomain.name.tech` нужен `tld_length: 2`.

---

## Маршрутизация по доменам

### Файл: `config/routes.rb`

```ruby
Rails.application.routes.draw do
  # Общие маршруты (работают на обоих доменах)
  post "auth/telegram/start", to: "auth#start"
  post "auth/telegram/webhook", to: "auth#webhook"
  get "auth/status", to: "auth#status"
  get "auth/check_token", to: "auth#check_token"
  get "auth/complete", to: "auth#complete"
  post "auth/set_session", to: "auth#set_session"
  delete "auth/logout", to: "auth#logout"

  if Rails.env.production?
    # ===== CRM DOMAIN =====
    constraints(host: "crm.aidelivery.tech") do
      get "/", to: "crm/home#index", as: :crm_root

      namespace :crm, path: "" do
        get "crm", to: "dashboard#index", as: :dashboard
        get "messenger", to: "messenger#index", as: :messenger
        # ... остальные CRM маршруты
      end
    end

    # ===== COURSE DOMAIN =====
    constraints(host: "course.aidelivery.tech") do
      root "home#index"
      get "dashboard", to: "dashboard#index"
      get "freecontent", to: "free_lessons#index"
      get "freecontent/:id", to: "free_lessons#show"
    end
  else
    # Development: без ограничений по доменам
    root "home#index"
    get "crm_login", to: "crm/home#index", as: :crm_root
    # ... все маршруты доступны на localhost
  end
end
```

---

## Авторизация на обоих доменах

### Поток авторизации

```
1. Пользователь на course.aidelivery.tech нажимает "Войти"
2. POST /auth/telegram/start → получает deep_link + session_token
3. Открывается Telegram бот → пользователь нажимает кнопку
4. Telegram webhook → сервер получает telegram_id
5. ActionCable broadcast → браузер получает уведомление
6. Redirect to /auth/complete?token=xxx
7. Сервер устанавливает session[:user_id]
8. Cookie с domain=.aidelivery.tech сохраняется
9. Пользователь авторизован на ОБОИХ доменах!
```

### Ключевые файлы

| Файл | Назначение |
|------|------------|
| `app/controllers/auth_controller.rb` | Backend авторизации |
| `app/views/shared/_auth_script.html.erb` | Frontend JavaScript |
| `app/channels/auth_channel.rb` | WebSocket канал |
| `config/initializers/session_store.rb` | Конфигурация cookie |

---

## Отладка проблем с cookies

### 1. Проверка домена cookie через DevTools

1. Откройте Chrome DevTools → Network
2. Найдите любой HTML запрос (не asset)
3. Посмотрите Response Headers → `set-cookie`
4. Проверьте значение `domain=`

**Правильно:**
```
set-cookie: _dbcours_session=...; domain=.aidelivery.tech; path=/; secure; httponly
```

**Неправильно:**
```
set-cookie: _dbcours_session=...; domain=tech; path=/; secure; httponly
```

### 2. Проверка отправки cookies

```javascript
// В консоли браузера
document.cookie  // Показывает доступные cookies (кроме httponly)

// Проверка через fetch
fetch('/auth/status', { credentials: 'include' })
  .then(r => r.json())
  .then(console.log)
```

### 3. Очистка старых cookies

После исправления `tld_length` нужно очистить старые cookies:

1. Chrome → Settings → Privacy → Cookies
2. Найти `aidelivery.tech`
3. Удалить все cookies для этого домена
4. Обновить страницу

---

## Частые проблемы

### Проблема: Cookie не шарится между доменами

**Симптомы:**
- Авторизация работает на одном домене
- На другом домене `/auth/status` возвращает `authenticated: false`

**Решение:**
- Проверить `tld_length` в `session_store.rb`
- Очистить старые cookies
- Передеплоить если изменения не применены

### Проблема: Cookie не отправляется в AJAX запросах

**Симптомы:**
- Навигационные запросы работают
- `fetch()` запросы не включают cookie

**Решение:**
- Убедиться что `credentials: 'include'` в fetch
- Проверить `SameSite` атрибут cookie

### Проблема: Logout не работает

**Симптомы:**
- Нажатие "Выйти" не разлогинивает
- После refresh пользователь снова авторизован

**Решение:**
- Использовать `data-turbo="false"` на форме logout
- Проверить что сессия очищается на сервере

---

## Deployment

При деплое через Kamal оба домена обслуживаются одним контейнером:

```yaml
# config/deploy.yml
proxy:
  ssl: true
  host: course.aidelivery.tech,crm.aidelivery.tech,admin.aidelivery.tech
```

Kamal-proxy автоматически маршрутизирует запросы на основе Host header.

---

## См. также

- [Telegram Authentication](./telegram_authentication.md) — полный флоу авторизации
- [Known Issues #12](./known_issues_and_solutions.md#issue-12) — проблема с tld_length
- [Deployment](./deployment.md) — настройка Kamal
