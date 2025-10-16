class DashboardController < ApplicationController
  before_action :require_dashboard_access

  def index
    # Используем реального пользователя
    @user = @current_user
    @enrolled_date = @user.created_at.to_date
    @tier = @user.admin? ? "VIP (Admin)" : "Basic"

    @progress = {
      overall: 35,
      modules_completed: 2,
      total_modules: 5,
      hours_watched: 4.5,
      total_hours: 8
    }

    @modules = [
      {
        number: 1,
        title: "Экономика платформ и расчет прибыльности",
        duration: "2 часа",
        progress: 100,
        status: "completed",
        lessons: 6,
        completed_lessons: 6
      },
      {
        number: 2,
        title: "Реклама и ROI Framework",
        duration: "2 часа",
        progress: 100,
        status: "completed",
        lessons: 5,
        completed_lessons: 5
      },
      {
        number: 3,
        title: "Секреты видимости и ранжирования",
        duration: "1.5 часа",
        progress: 40,
        status: "in_progress",
        lessons: 4,
        completed_lessons: 2
      },
      {
        number: 4,
        title: "Операционное совершенство",
        duration: "1.5 часа",
        progress: 0,
        status: "locked",
        lessons: 4,
        completed_lessons: 0
      },
      {
        number: 5,
        title: "Настройка и оптимизация",
        duration: "1 час",
        progress: 0,
        status: "locked",
        lessons: 3,
        completed_lessons: 0
      }
    ]

    @next_lesson = {
      module: 3,
      title: "Как оптимизировать названия блюд для поиска",
      duration: "18 минут"
    }

    @upcoming_sessions = [
      {
        title: "Групповой воркшоп: Разбор рекламных кампаний",
        date: Date.today + 3,
        time: "19:00 MSK",
        type: "zoom"
      },
      {
        title: "Q&A сессия с инструктором",
        date: Date.today + 7,
        time: "20:00 MSK",
        type: "zoom"
      }
    ]

    @resources = [
      { name: "Калькулятор прибыльности.xlsx", size: "245 KB", downloaded: true },
      { name: "Шаблоны меню.pdf", size: "1.2 MB", downloaded: false },
      { name: "Чек-лист настройки.pdf", size: "890 KB", downloaded: true },
      { name: "Скрипты переговоров.docx", size: "156 KB", downloaded: false }
    ]
  end

  private

  def require_dashboard_access
    unless @current_user&.has_dashboard_access?
      redirect_to freecontent_path, alert: "Доступ к курсу доступен только после оплаты"
    end
  end
end
