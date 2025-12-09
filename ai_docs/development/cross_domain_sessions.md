# Cross-Domain Sessions & Authentication

## Обзор

Документ описывает как работают сессии между субдоменами `course.aidelivery.tech` и `crm.aidelivery.tech`, включая авторизацию, logout и типичные проблемы.

---

## Как работает Single Sign-On

### Принцип работы

1. **Общий cookie домен**: `domain=.aidelivery.tech`
2. **Один session store**: Rails cookie_store с общим ключом
3. **Авторизация на любом домене** → сессия доступна на всех субдоменах

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER                                 │
│                                                                 │
│  Cookie: _dbcours_session=xxx; domain=.aidelivery.tech         │
│                                                                 │
│     ┌──────────────┐              ┌──────────────┐             │
│     │   course.    │              │    crm.      │             │
│     │ aidelivery   │◄────────────►│ aidelivery   │             │
│     │   .tech      │   SHARED     │   .tech      │             │
│     │              │   SESSION    │              │             │
│     └──────────────┘              └──────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Конфигурация

### Session Store

**Файл:** `config/initializers/session_store.rb`

```ruby
Rails.application.config.session_store :cookie_store,
  key: "_dbcours_session",
  domain: Rails.env.development? ? nil : :all,  # nil для ngrok в development
  tld_length: Rails.env.development? ? nil : 2,  # КРИТИЧНО для .tech доменов!
  secure: Rails.env.production?,
  httponly: true,
  same_site: :lax
```

**Важно для development:**
- `domain: nil` позволяет cookies работать на ngrok домене
- ngrok URL вида `xxx-yyy-zzz.ngrok-free.dev` имеет 4 части (не 2!)
- `tld_length: 2` рассчитан только для production (`*.aidelivery.tech`)

### Параметры cookie

| Параметр | Значение | Описание |
|----------|----------|----------|
| `key` | `_dbcours_session` | Имя cookie |
| `domain` | `:all` | Использовать общий домен |
| `tld_length` | `2` | Количество частей в TLD |
| `secure` | `true` (prod) | Только HTTPS |
| `httponly` | `true` | Недоступен из JavaScript |
| `same_site` | `:lax` | Защита от CSRF |

---

## Token-Based Auth Completion

### Проблема

При авторизации через Telegram, браузер может блокировать установку cookies:
- Incognito mode
- Strict cookie policies
- Cross-origin restrictions

### Решение: /auth/complete endpoint

Вместо установки сессии через AJAX, используется redirect:

```
1. WebSocket получает 'authenticated' event
2. JavaScript делает redirect: /auth/complete?token=xxx&redirect_to=/dashboard
3. Сервер устанавливает session[:user_id] через обычный HTTP response
4. Redirect на целевую страницу с установленной сессией
```

### Код endpoint'а

```ruby
# app/controllers/auth_controller.rb
def complete
  token = params[:token]
  redirect_to_path = params[:redirect_to] || root_path

  user = User.find_by(session_token: token, authenticated: true)

  if user
    session[:user_id] = user.id
    redirect_to redirect_to_path, notice: "Успешная авторизация!"
  else
    redirect_to redirect_to_path, alert: "Ошибка авторизации"
  end
end
```

### Frontend код

```javascript
// app/views/shared/_auth_script.html.erb
async function handleAuthSuccess(data) {
  const token = data.session_token || sessionToken
  const currentPath = window.location.pathname

  // Redirect вместо fetch для установки сессии
  window.location.href = `/auth/complete?token=${token}&redirect_to=${encodeURIComponent(currentPath)}`
}
```

---

## Logout

### Реализация

```ruby
# app/controllers/auth_controller.rb
def logout
  session[:user_id] = nil
  session[:auth_token] = nil

  # Redirect с очисткой Turbo cache
  redirect_to root_path, notice: "Вы вышли из системы"
end
```

### Форма logout (важно!)

```erb
<form action="/auth/logout" method="post" data-turbo="false">
  <input type="hidden" name="_method" value="delete">
  <input type="hidden" name="authenticity_token" value="<%= form_authenticity_token %>">
  <button type="submit">Выйти</button>
</form>
```

**Критично: `data-turbo="false"`**

Без этого атрибута:
1. Turbo перехватывает submit
2. Делает AJAX запрос
3. Turbo cache НЕ очищается
4. При нажатии "Назад" показывается кешированная страница с авторизацией

С `data-turbo="false"`:
1. Обычный HTTP POST
2. Полная перезагрузка страницы
3. Turbo cache очищается
4. Корректный logout на всех доменах

---

## Проверка статуса авторизации

### Endpoint

```ruby
# GET /auth/status
def status
  if current_user
    render json: {
      authenticated: true,
      user: {
        id: current_user.id,
        username: current_user.username,
        first_name: current_user.first_name,
        last_name: current_user.last_name,
        admin: current_user.admin?
      }
    }
  else
    render json: { authenticated: false }
  end
end
```

### Frontend проверка

```javascript
async function checkAuthStatus(button) {
  try {
    const response = await fetch('/auth/status', {
      credentials: 'include'  // ВАЖНО для cross-origin!
    })
    const data = await response.json()

    if (data.authenticated && data.user) {
      updateButtonAsAuthenticated(button, data.user)
      return true
    }
    return false
  } catch (error) {
    console.error('Auth status check failed:', error)
    return false
  }
}
```

---

## Отладка

### Проверка cookie в браузере

```javascript
// Console
document.cookie  // Пустой для httponly cookies!

// Network tab → Headers → Cookie
// Должен быть: _dbcours_session=...
```

### Проверка на сервере

```ruby
# rails console
session = ActionDispatch::Request.new(env).session
session[:user_id]  # ID авторизованного пользователя
```

### Логи авторизации

```ruby
# app/controllers/auth_controller.rb
def complete
  Rails.logger.info "AUTH COMPLETE: token=#{params[:token]}, user_agent=#{request.user_agent}"
  # ...
end
```

---

## Типичные ошибки

### 1. Cookie не шарится между доменами

**Причина:** Неправильный `tld_length`

**Проверка:**
```bash
# Response header должен содержать:
set-cookie: _dbcours_session=...; domain=.aidelivery.tech
# А НЕ:
set-cookie: _dbcours_session=...; domain=tech
```

**Решение:** `tld_length: 2` для `.tech` доменов

### 2. AJAX не отправляет cookies

**Причина:** Отсутствует `credentials: 'include'`

**Решение:**
```javascript
fetch('/auth/status', { credentials: 'include' })
```

### 3. Logout не работает

**Причина:** Turbo кеширует страницы

**Решение:** `data-turbo="false"` на форме logout

### 4. Авторизация "застревает"

**Причина:** Старые cookies с неправильным доменом

**Решение:** Очистить cookies в браузере, передеплоить

---

## См. также

- [Multi-Domain Architecture](./multi_domain_architecture.md)
- [Telegram Authentication](./telegram_authentication.md)
- [Known Issues #12](./known_issues_and_solutions.md#issue-12)
