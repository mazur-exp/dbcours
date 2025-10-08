class FreeLessonsController < ApplicationController
  helper FreeContentHelper

  LESSONS_PATH = Rails.root.join("app", "content", "free_lessons")

  def index
    @lessons = load_all_lessons
  end

  def show
    lesson_id = params[:id]
    file_path = LESSONS_PATH.join("#{lesson_id}.md")

    unless File.exist?(file_path)
      redirect_to freecontent_path, alert: "Урок не найден"
      return
    end

    @content = File.read(file_path)
    @frontmatter = helpers.extract_frontmatter(@content)
    @title = @frontmatter[:title] || lesson_id
    @lessons = load_all_lessons
    @current_lesson_id = lesson_id

    # Определяем предыдущий и следующий урок
    current_index = @lessons.index { |l| l[:id] == lesson_id }
    if current_index
      @prev_lesson = @lessons[current_index - 1] if current_index > 0
      @next_lesson = @lessons[current_index + 1] if current_index < @lessons.length - 1
    end
  end

  private

  def load_all_lessons
    Dir.glob(LESSONS_PATH.join("*.md"))
      .reject { |f| f.include?("README") }
      .sort
      .map do |file_path|
        id = File.basename(file_path, ".md")
        content = File.read(file_path)
        frontmatter = helpers.extract_frontmatter(content)

        {
          id: id,
          title: frontmatter[:title] || id,
          number: id.split("-").first.to_i,
          path: freecontent_lesson_path(id)
        }
      end
      .sort_by { |lesson| lesson[:number] }
  end
end
