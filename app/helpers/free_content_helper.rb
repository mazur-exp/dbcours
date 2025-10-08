require 'redcarpet'

module FreeContentHelper
  def render_markdown(text)
    return "" if text.blank?

    # Парсим frontmatter
    content = text.dup
    if content =~ /\A---\s*\n(.*?)\n---\s*\n(.*)\z/m
      content = $2
    end

    # Заменяем пути к изображениям
    content = content.gsub(/!\[([^\]]*)\]\(assets\//, '![\\1](/free_content/assets/')

    renderer = Redcarpet::Render::HTML.new(
      hard_wrap: true,
      link_attributes: { target: "_blank" }
    )

    markdown = Redcarpet::Markdown.new(renderer,
      autolink: true,
      tables: true,
      fenced_code_blocks: true,
      strikethrough: true,
      highlight: true,
      footnotes: true
    )

    markdown.render(content).html_safe
  end

  def extract_frontmatter(text)
    return {} if text.blank?

    if text =~ /\A---\s*\n(.*?)\n---\s*\n/m
      frontmatter = $1
      data = {}
      frontmatter.each_line do |line|
        if line =~ /^(\w+):\s*"?([^"]+)"?$/
          data[$1.to_sym] = $2.strip.gsub(/^"|"$/, '')
        end
      end
      data
    else
      {}
    end
  end
end
