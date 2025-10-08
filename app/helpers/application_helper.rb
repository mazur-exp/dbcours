module ApplicationHelper
  def user_avatar(user, css_classes = "", size_classes = "w-10 h-10")
    if user&.avatar_url.present?
      # Если есть аватарка - показываем её
      image_tag(user.avatar_url,
        class: "#{css_classes} #{size_classes} rounded-full object-cover",
        alt: user.full_name,
        loading: "lazy"
      )
    else
      # Fallback на инициалы в цветном круге
      content_tag :div,
        class: "#{css_classes} #{size_classes} bg-blue-500 rounded-full flex items-center justify-center text-white font-bold" do
        (user&.first_name || 'U')[0].upcase
      end
    end
  end

  def user_avatar_or_initials(user, css_classes: "", size_classes: "w-10 h-10", text_size: "text-base")
    if user&.avatar_url.present?
      # Если есть аватарка - показываем её
      image_tag(user.avatar_url,
        class: "#{css_classes} #{size_classes} rounded-full object-cover",
        alt: user.full_name,
        loading: "lazy"
      )
    else
      # Fallback на инициалы в цветном круге
      content_tag :div,
        class: "#{css_classes} #{size_classes} bg-blue-500 rounded-full flex items-center justify-center text-white font-bold #{text_size}" do
        (user&.first_name || 'U')[0].upcase
      end
    end
  end
end
