# Content Management System

## Overview

The application uses a file-based content management system for lesson storage. Lessons are written in Markdown with YAML frontmatter and stored in the filesystem, not the database.

---

## Content Structure

### Lesson Files

**Location:** `app/content/free_lessons/`

**Naming Convention:**
```
01-introduction-why-delivery.md
02-bali-market-volumes-players-trends.md
03-target-audience-seasonality.md
...
12-faq-practical-cases.md
```

**Format:** Number prefix (01-12) + slug + `.md` extension

---

### Markdown with Frontmatter

**Example File:** `app/content/free_lessons/01-introduction-why-delivery.md`

```markdown
---
title: "Introduction: Why Delivery and How We Got Here"
---

# Why Food Delivery Exploded in Bali

In 2019, food delivery barely existed on Bali. By 2025, it's the primary revenue channel for many F&B operators. Here's how we got here...

## The Turning Point

COVID-19 forced restaurants to adapt. GoFood and GrabFood became essential, not optional.

### Key Statistics

- 300% increase in delivery orders (2020-2023)
- 40% of F&B revenue now from delivery (up from 10%)
- 85% of Bali tourists use delivery apps

## What This Means for Operators

Traditional restaurant marketing (foot traffic, Instagram) is no longer enough. You must master delivery platforms or lose to competitors who do.

---

**Key Takeaways:**

✓ Delivery is now table stakes, not optional
✓ GoFood and GrabFood control customer access
✓ Platform mastery = competitive advantage
```

---

## Rendering Pipeline

### Loading Lessons

**Controller:** `app/controllers/free_lessons_controller.rb`

```ruby
class FreeLessonsController < ApplicationController
  def index
    @lessons = load_all_lessons
  end

  def show
    @lesson_slug = params[:slug]
    @lesson = load_lesson(@lesson_slug)
    @all_lessons = load_all_lessons
    
    redirect_to freecontent_path, alert: "Lesson not found" if @lesson.nil?
  end

  private

  def load_all_lessons
    Dir.glob(Rails.root.join('app/content/free_lessons/*.md'))
       .sort
       .map { |path| parse_lesson_file(path) }
  end

  def load_lesson(slug)
    path = Dir.glob(Rails.root.join("app/content/free_lessons/*#{slug}.md")).first
    return nil unless path
    parse_lesson_file(path)
  end

  def parse_lesson_file(path)
    content = File.read(path)
    
    # Extract frontmatter
    if content =~ /\A---\s*\n(.*?)\n---\s*\n(.*)/m
      frontmatter = YAML.safe_load($1)
      markdown_content = $2
    else
      frontmatter = {}
      markdown_content = content
    end

    {
      path: path,
      slug: File.basename(path, '.md'),
      title: frontmatter['title'] || 'Untitled',
      content: markdown_content
    }
  end
end
```

---

### Markdown Rendering

**Helper:** `app/helpers/free_content_helper.rb`

```ruby
module FreeContentHelper
  def markdown_to_html(text)
    return '' unless text

    renderer = Redcarpet::Render::HTML.new(
      filter_html: false,
      hard_wrap: true,
      link_attributes: { target: '_blank' }
    )

    markdown = Redcarpet::Markdown.new(renderer,
      autolink: true,
      tables: true,
      fenced_code_blocks: true,
      strikethrough: true,
      no_intra_emphasis: true
    )

    # Replace image paths
    text = text.gsub(/!\[(.*?)\]\(assets\/(.*?)\)/, '![\\1](/free_content/assets/\\2)')

    markdown.render(text).html_safe
  end
end
```

**Features:**
- **Autolink:** URLs become clickable automatically
- **Tables:** GitHub-flavored Markdown tables
- **Fenced Code Blocks:** Syntax highlighting support
- **Strikethrough:** `~~deleted text~~`
- **Image Path Rewriting:** `assets/image.jpg` → `/free_content/assets/image.jpg`

---

## Asset Management

### Images

**Storage:** `public/free_content/assets/`

**Reference in Markdown:**
```markdown
![Alt text](assets/image-name.jpg)
```

**Rendered:**
```html
<img src="/free_content/assets/image-name.jpg" alt="Alt text">
```

---

### Video Embeds

**Markdown:**
```markdown
[Watch Video](https://vimeo.com/123456789)
```

**Enhanced (Future):**
```html
<div class="video-embed">
  <iframe src="https://player.vimeo.com/video/123456789"></iframe>
</div>
```

---

## Lesson Navigation

### Prev/Next Links

```ruby
def next_lesson(current_slug)
  lessons = load_all_lessons
  current_index = lessons.index { |l| l[:slug] == current_slug }
  return nil unless current_index
  lessons[current_index + 1]
end

def prev_lesson(current_slug)
  lessons = load_all_lessons
  current_index = lessons.index { |l| l[:slug] == current_slug }
  return nil unless current_index || current_index == 0
  lessons[current_index - 1]
end
```

**View:**
```erb
<% if prev_lesson(@lesson_slug) %>
  <%= link_to "← #{prev_lesson(@lesson_slug)[:title]}", free_content_lesson_path(prev_lesson(@lesson_slug)[:slug]) %>
<% end %>

<% if next_lesson(@lesson_slug) %>
  <%= link_to "#{next_lesson(@lesson_slug)[:title]} →", free_content_lesson_path(next_lesson(@lesson_slug)[:slug]) %>
<% end %>
```

---

## Content Versioning

### Git-Based Versioning

**Benefits:**
- Track all content changes in Git
- Revert to previous versions if needed
- See who changed what and when
- Collaborate on content via pull requests

**Example Workflow:**
```bash
# Edit lesson
vim app/content/free_lessons/05-where-orders-come-from.md

# Commit changes
git add app/content/free_lessons/05-where-orders-come-from.md
git commit -m "Update lesson 5: Add 2025 algorithm changes"

# Deploy
bin/kamal deploy
```

---

## Content Translation (Future)

### Multi-Language Support

**Directory Structure:**
```
app/content/
├── free_lessons/
│   ├── en/
│   │   ├── 01-introduction.md
│   │   └── 02-bali-market.md
│   └── ru/
│       ├── 01-introduction.md
│       └── 02-bali-market.md
```

**Locale Detection:**
```ruby
def load_lesson(slug)
  locale = I18n.locale  # :en or :ru
  path = Rails.root.join("app/content/free_lessons/#{locale}/*#{slug}.md")
  # ...
end
```

---

## Search Functionality (Future)

### Full-Text Search

**Index Lessons:**
```ruby
class Lesson
  def self.search(query)
    results = []
    Dir.glob(Rails.root.join('app/content/free_lessons/*.md')).each do |path|
      content = File.read(path)
      if content.downcase.include?(query.downcase)
        results << parse_lesson_file(path)
      end
    end
    results
  end
end
```

**Search Page:**
```erb
<%= form_with url: search_path, method: :get do |f| %>
  <%= f.text_field :q, placeholder: "Search lessons..." %>
  <%= f.submit "Search" %>
<% end %>

<% @results.each do |lesson| %>
  <%= link_to lesson[:title], free_content_lesson_path(lesson[:slug]) %>
<% end %>
```

---

## Content Caching

### Fragment Caching

**Lesson Page:**
```erb
<% cache @lesson do %>
  <%= markdown_to_html(@lesson[:content]) %>
<% end %>
```

**Cache Key:** Based on lesson path modification time

**Benefits:**
- Markdown rendering is expensive (CPU-intensive)
- Cache stores rendered HTML
- Subsequent loads instant

---

## Content Analytics (Future)

### Track Lesson Views

**Model:** `LessonView`

```ruby
class LessonView < ApplicationRecord
  belongs_to :user, optional: true

  def self.track(slug, user)
    create(lesson_slug: slug, user: user, viewed_at: Time.now)
  end
end
```

**Controller:**
```ruby
def show
  # ...
  LessonView.track(@lesson_slug, @current_user) if @current_user
end
```

**Analytics:**
- Most viewed lessons
- Average time on lesson
- Completion rate per lesson

---

## Content Export (Future)

### PDF Export

**Gem:** `wicked_pdf` or `prawn`

```ruby
def export_pdf
  lesson = load_lesson(params[:slug])
  html = markdown_to_html(lesson[:content])

  pdf = WickedPdf.new.pdf_from_string(html)
  
  send_data pdf,
    filename: "#{lesson[:slug]}.pdf",
    type: 'application/pdf',
    disposition: 'attachment'
end
```

---

## Content Editing Workflow

### Local Development

1. **Edit Markdown File:**
   ```bash
   vim app/content/free_lessons/03-target-audience.md
   ```

2. **Refresh Browser:**
   - No restart needed (files loaded on each request in development)
   - See changes immediately

3. **Commit to Git:**
   ```bash
   git add app/content/free_lessons/03-target-audience.md
   git commit -m "Update audience segmentation section"
   ```

4. **Deploy:**
   ```bash
   bin/kamal deploy
   ```

---

### Content Review Process (Team Workflow)

**Pull Request Workflow:**

1. Create branch:
   ```bash
   git checkout -b update-lesson-7
   ```

2. Edit content:
   ```bash
   vim app/content/free_lessons/07-average-check.md
   ```

3. Preview locally:
   ```bash
   bin/dev
   # Visit http://localhost:3000/free_content/lessons/07-average-check
   ```

4. Push branch:
   ```bash
   git push origin update-lesson-7
   ```

5. Create Pull Request on GitHub

6. Review changes (diff shows Markdown edits)

7. Merge to main → Auto-deploy (if CI/CD configured)

---

## Best Practices

### Markdown Style Guide

**Headings:**
```markdown
# H1 - Only for lesson title
## H2 - Major sections
### H3 - Subsections
```

**Lists:**
```markdown
- Unordered lists for features
- Each item starts with lowercase
- Ends without period

1. Ordered lists for steps
2. Each item starts with capital
3. Ends with period.
```

**Code Blocks:**
````markdown
```ruby
# Ruby code example
def method_name
  # ...
end
```
````

**Emphasis:**
```markdown
*Italic* for emphasis
**Bold** for strong emphasis
`code` for inline code
```

---

## Content Validation (Future)

### Automated Checks

**Script:** `bin/validate_content`

```ruby
#!/usr/bin/env ruby

Dir.glob('app/content/free_lessons/*.md').each do |path|
  content = File.read(path)
  
  # Check frontmatter exists
  unless content =~ /\A---/
    puts "ERROR: #{path} missing frontmatter"
  end

  # Check for broken image links
  content.scan(/!\[.*?\]\((.*?)\)/).each do |match|
    image_path = match[0]
    unless File.exist?("public/#{image_path}")
      puts "WARNING: #{path} references missing image #{image_path}"
    end
  end

  # Check lesson length (should be 500-2000 words)
  word_count = content.split.size
  if word_count < 500
    puts "WARNING: #{path} is short (#{word_count} words)"
  elsif word_count > 2000
    puts "WARNING: #{path} is long (#{word_count} words)"
  end
end
```

---

## Conclusion

The file-based content management system is simple, version-controlled, and performant. No database migrations needed for content changes. No admin panel complexity. Content lives alongside code, making it easy to edit, review, and deploy. For a course platform with infrequent content updates, this approach is ideal.
