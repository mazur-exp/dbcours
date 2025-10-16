# Component Library

## Overview

This document catalogs all reusable UI components in the Bali Food Delivery Master platform, including implementation details, usage guidelines, and visual specifications.

---

## Navigation Components

### Top Navigation Bar

**Location:** `app/views/layouts/application.html.erb` (or similar layout file)

**Structure:**
```html
<nav class="sticky top-0 z-50 bg-white shadow-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <!-- Logo -->
      <div class="flex-shrink-0">
        <a href="/" class="text-2xl font-bold text-green-600">
          Bali Delivery Master
        </a>
      </div>

      <!-- Auth Button (dynamic) -->
      <div>
        <%= render 'shared/auth_button' %>
      </div>
    </div>
  </div>
</nav>
```

**Characteristics:**
- **Sticky positioning:** Stays at top on scroll
- **Z-index:** 50 (above content, below modals)
- **Responsive padding:** Adjusts on mobile vs. desktop
- **Shadow:** Subtle shadow for depth

**States:**
- Default: White background, minimal shadow
- Scrolled: (No change currently, could add shadow-lg on scroll)

---

### Breadcrumb Navigation

**Usage:** Lesson pages, nested content

**Desktop Layout:**
```html
<nav class="bg-gray-50 py-3 px-4 sm:px-6 lg:px-8">
  <div class="max-w-7xl mx-auto">
    <ol class="flex items-center space-x-2 text-sm text-gray-600">
      <li>
        <a href="/" class="hover:text-green-600">Home</a>
      </li>
      <li><span class="text-gray-400">/</span></li>
      <li>
        <a href="/freecontent" class="hover:text-green-600">Free Content</a>
      </li>
      <li><span class="text-gray-400">/</span></li>
      <li class="text-gray-900 font-medium">Lesson 01</li>
    </ol>
  </div>
</nav>
```

**Mobile Truncation:**
- Full breadcrumb on desktop
- Truncated on mobile: "... / Free Content / Lesson 01"
- Classes: `hidden sm:inline` on earlier items

**Interactive:**
- Links: Hover changes to green-600
- Current page: No link, bold text

---

### Sidebar Navigation (Lesson List)

**Location:** Lesson pages (desktop only)

**Structure:**
```html
<aside class="hidden lg:block lg:w-64 lg:fixed lg:h-full lg:overflow-y-auto border-r border-gray-200 bg-white">
  <div class="p-6">
    <h3 class="text-lg font-bold text-gray-900 mb-4">Free Mini-Course</h3>

    <nav class="space-y-2">
      <!-- Lesson 01 (Current) -->
      <a href="/free_content/lessons/01-..." class="block p-3 rounded-lg bg-green-50 border-2 border-green-500">
        <div class="flex items-start gap-3">
          <span class="flex-shrink-0 text-2xl">🎯</span>
          <div>
            <div class="text-xs text-green-700 font-medium">Lesson 01</div>
            <div class="text-sm font-semibold text-gray-900">Introduction</div>
          </div>
        </div>
      </a>

      <!-- Lesson 02 (Not current) -->
      <a href="/free_content/lessons/02-..." class="block p-3 rounded-lg hover:bg-gray-50 transition-colors">
        <div class="flex items-start gap-3">
          <span class="flex-shrink-0 text-2xl">📊</span>
          <div>
            <div class="text-xs text-gray-500 font-medium">Lesson 02</div>
            <div class="text-sm font-medium text-gray-700">Bali Market</div>
          </div>
        </div>
      </a>

      <!-- Repeat for all 12 lessons -->
    </nav>

    <div class="mt-6 p-4 bg-blue-50 rounded-lg">
      <p class="text-sm text-blue-900">
        <strong>Progress:</strong> Lesson 1 of 12
      </p>
    </div>
  </div>
</aside>
```

**Characteristics:**
- **Desktop only:** `hidden lg:block` (hidden on mobile/tablet)
- **Fixed position:** Stays in place on scroll
- **Scrollable:** If lesson list exceeds viewport height
- **Current lesson:** Green background + border
- **Hover effect:** Gray background on non-current lessons

**Mobile Alternative:** See Collapsible Lesson Dropdown below

---

### Collapsible Lesson Dropdown (Mobile)

**Location:** Lesson pages (mobile/tablet only)

**Structure:**
```html
<details class="lg:hidden border-b border-gray-200 bg-white">
  <summary class="p-4 cursor-pointer flex justify-between items-center">
    <span class="font-semibold text-gray-900">
      All Lessons (Lesson 1 of 12)
    </span>
    <svg class="w-5 h-5 text-gray-500 transition-transform" aria-hidden="true">
      <!-- Chevron icon -->
    </svg>
  </summary>

  <div class="p-4 bg-gray-50 space-y-2">
    <!-- Same lesson list as sidebar -->
  </div>
</details>
```

**Interaction:**
- Closed by default
- Click to expand/collapse
- Chevron rotates when open
- List scrolls if too long

---

## Authentication Components

### Auth Button with Dropdown Menu (Dynamic Server-Rendered)

**Location:** `app/views/shared/_auth_button.html.erb`

**Updated:** 2025-10-16 - Changed from inline buttons to dropdown menu structure

**Non-Authenticated State:**
```html
<button
  id="auth-button"
  data-authenticated="false"
  class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-all shadow-md hover:shadow-lg"
>
  <span class="flex items-center gap-2">
    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <!-- Checkmark icon -->
    </svg>
    Авторизация
  </span>
</button>
```

**Authenticated State (Dropdown Menu):**
```html
<div class="relative" data-authenticated="true" data-controller="dropdown">
  <!-- Trigger Button -->
  <button
    data-action="click->dropdown#toggle"
    class="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-1.5 px-3 rounded-lg transition-all flex items-center gap-2 text-sm"
  >
    <!-- Avatar -->
    <div class="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-xs font-bold">
      JD <!-- User initials -->
    </div>
    <span>John</span> <!-- User's first_name -->
    <svg class="w-3.5 h-3.5 transition-transform text-gray-500" data-dropdown-target="chevron">
      <!-- Chevron down icon -->
    </svg>
  </button>

  <!-- Dropdown Menu -->
  <div data-dropdown-target="menu" class="hidden absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden z-50">
    <!-- Profile Header -->
    <div class="px-4 py-3 bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
      <div class="flex items-center gap-3">
        <!-- Avatar (larger) -->
        <div class="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white text-sm font-bold">
          JD
        </div>
        <div>
          <div class="font-bold text-gray-900">John Doe</div>
          <div class="text-sm text-gray-600">@johndoe</div>
        </div>
      </div>
    </div>

    <!-- Menu Items -->
    <div class="py-2">
      <a href="/" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-gray-700">
        <svg class="w-5 h-5 text-gray-500"><!-- Home icon --></svg>
        <span>Главная</span>
      </a>

      <a href="/dashboard" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-gray-700">
        <svg class="w-5 h-5 text-gray-500"><!-- Book icon --></svg>
        <span>Курс</span>
      </a>

      <a href="/freecontent" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-gray-700">
        <svg class="w-5 h-5 text-gray-500"><!-- Book icon --></svg>
        <span>Мини-Курс</span>
      </a>

      <!-- Admin-Only Links -->
      <% if @current_user.admin? %>
        <a href="/messenger" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-gray-700">
          <svg class="w-5 h-5 text-gray-500"><!-- Message icon --></svg>
          <span>Messenger</span>
        </a>

        <a href="/crm" class="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 transition-colors text-gray-700">
          <svg class="w-5 h-5 text-gray-500"><!-- Chart icon --></svg>
          <span>CRM</span>
        </a>
      <% end %>

      <div class="border-t border-gray-200 my-2"></div>

      <!-- Logout -->
      <form action="/auth/logout" method="delete" data-turbo="false">
        <button type="submit" class="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-red-600">
          <svg class="w-5 h-5"><!-- Logout icon --></svg>
          <span>Выйти</span>
        </button>
      </form>
    </div>
  </div>
</div>
```

**Menu Order (as of 2025-10-16):**
1. Главная → `/` (Home)
2. Курс → `/dashboard` (Paid course - requires paid OR admin)
3. Мини-Курс → `/freecontent` (Free mini-course)
4. Messenger → `/messenger` (Admin only)
5. CRM → `/crm` (Admin only)
6. Выйти → Logout

**Visual States:**
- **Not authenticated:** Green button with "Авторизация" text
- **Authenticated:** Gray button showing avatar + first name + chevron
- **Dropdown open:** Menu slides down, chevron rotates
- **Menu item hover:** Gray background on hover

**JavaScript Controller:**
- Uses Stimulus `dropdown` controller
- Toggle dropdown on button click
- Close dropdown when clicking outside (body click listener)
- Chevron rotation animation

**Rendering Logic (Server):**
```erb
<% if @current_user %>
  <!-- Dropdown menu with conditional admin links -->
<% else %>
  <!-- Simple auth button -->
<% end %>
```

---

### Authentication Modal

**ID:** `auth-modal`

**Structure:**
```html
<!-- Overlay -->
<div id="auth-modal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/30 hidden">
  <!-- Modal Card -->
  <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 relative">
    <!-- Close Button -->
    <a
      href="/freecontent"
      class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
      aria-label="Close"
    >
      <svg class="w-6 h-6"><!-- X icon --></svg>
    </a>

    <!-- Icon -->
    <div class="text-center mb-6">
      <span class="text-6xl">🔒</span>
    </div>

    <!-- Heading -->
    <h3 class="text-2xl font-bold text-gray-900 text-center mb-4">
      Авторизуйтесь через Telegram
    </h3>

    <!-- Body Text -->
    <p class="text-gray-600 text-center mb-6 leading-relaxed">
      Для доступа к бесплатным урокам необходимо авторизоваться через Telegram. Это быстро и безопасно.
    </p>

    <!-- CTA Button -->
    <button
      id="telegram-auth-button"
      data-controller="auth"
      data-action="click->auth#startAuth"
      class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
    >
      <span>🔐</span>
      <span>Войти через Telegram</span>
    </button>

    <!-- Why Section -->
    <div class="mt-6 pt-6 border-t border-gray-200">
      <p class="text-sm font-semibold text-gray-700 mb-2">Зачем это нужно?</p>
      <ul class="text-sm text-gray-600 space-y-1">
        <li>• Защита контента</li>
        <li>• Персонализация обучения</li>
        <li>• Доступ к сообществу</li>
      </ul>
    </div>
  </div>
</div>
```

**Visibility Control (JavaScript):**
```javascript
// Show modal
document.getElementById('auth-modal').classList.remove('hidden');

// Hide modal
document.getElementById('auth-modal').classList.add('hidden');
```

**Behavior:**
- **Appears when:** User clicks lesson link while unauthenticated
- **Closes when:** User clicks X button (redirects to /freecontent)
- **Z-index:** 50 (above all content, including sticky nav)
- **Overlay:** 30% black, allows seeing blurred content behind

---

## Content Cards

### Lesson Card (Grid View)

**Usage:** `/freecontent` lesson list page

**Structure:**
```html
<a
  href="/free_content/lessons/01-introduction"
  class="block bg-white rounded-2xl shadow hover:shadow-2xl transition-shadow duration-300 p-6 border border-transparent hover:border-green-300"
>
  <!-- Number Badge -->
  <div class="flex items-center justify-between mb-4">
    <span class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-xl">
      01
    </span>
    <span class="text-4xl">🎯</span>
  </div>

  <!-- Title -->
  <h3 class="text-xl font-bold text-gray-900 mb-3">
    Introduction: Why Delivery and How We Got Here
  </h3>

  <!-- Description -->
  <p class="text-gray-600 text-sm leading-relaxed mb-4">
    Understand the explosion of food delivery in Bali and why traditional restaurant marketing is dead.
  </p>

  <!-- CTA -->
  <div class="flex items-center text-green-600 font-medium text-sm">
    <span>View Lesson</span>
    <svg class="w-4 h-4 ml-1"><!-- Arrow icon --></svg>
  </div>
</a>
```

**Grid Layout:**
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Lesson cards -->
</div>
```

**Hover Effects:**
- Shadow grows: `shadow` → `shadow-2xl`
- Border appears: Green border (300 shade)
- Subtle lift feel (no actual transform, just shadow)

**Responsive:**
- Mobile: 1 column (stacked)
- Tablet: 2 columns
- Desktop: 3 columns

---

### Intro Card (Lesson Page)

**Usage:** Top of each lesson page

**Structure:**
```html
<div class="bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 rounded-xl p-6 mb-8 border border-green-200">
  <div class="flex items-start gap-4">
    <!-- Icon -->
    <span class="text-5xl flex-shrink-0">🎯</span>

    <!-- Content -->
    <div>
      <h2 class="text-2xl font-bold text-gray-900 mb-3">
        Lesson Overview
      </h2>
      <p class="text-gray-700 leading-relaxed">
        In this lesson, you'll learn why food delivery exploded in Bali, how it changed F&B economics, and what mistakes to avoid from day one.
      </p>
    </div>
  </div>
</div>
```

**Characteristics:**
- **Gradient background:** Soft green-blue-purple
- **Border:** Light green for definition
- **Icon:** Large emoji (5xl size)
- **Purpose:** Sets expectations for lesson content

---

### Key Takeaways Card

**Usage:** End of each lesson page

**Structure:**
```html
<div class="bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-6 mt-8">
  <h3 class="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
    <span>💡</span>
    <span>Key Takeaways</span>
  </h3>

  <ul class="space-y-3 text-gray-700">
    <li class="flex items-start gap-2">
      <span class="text-green-600 font-bold flex-shrink-0">✓</span>
      <span>Food delivery is now the primary revenue channel for many Bali F&B operators</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-green-600 font-bold flex-shrink-0">✓</span>
      <span>GoFood and GrabFood have different algorithms and user bases</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-green-600 font-bold flex-shrink-0">✓</span>
      <span>Most operators waste $500-1000/month on mistakes in first 6 months</span>
    </li>
  </ul>

  <div class="mt-6 pt-6 border-t border-yellow-200">
    <p class="text-sm font-semibold text-gray-900">Next Steps:</p>
    <p class="text-sm text-gray-700 mt-1">
      Complete the action items above before moving to Lesson 2.
    </p>
  </div>
</div>
```

**Characteristics:**
- **Yellow background:** Highlights importance
- **Left border:** Thick yellow accent (4px)
- **Checkmark bullets:** Green checkmarks for visual consistency
- **Next steps section:** Optional, provides clear action items

---

### Pricing Tier Card

**Usage:** Pricing/enrollment page

**Basic Tier:**
```html
<div class="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
  <!-- Tier Name -->
  <h3 class="text-2xl font-bold text-gray-900 mb-2">Basic</h3>

  <!-- Price -->
  <div class="mb-6">
    <span class="text-5xl font-bold text-gray-900">₽12,000</span>
    <span class="text-gray-600 ml-2">/ $149</span>
  </div>

  <!-- Description -->
  <p class="text-gray-600 mb-6">
    Perfect for self-paced learners who want full curriculum access.
  </p>

  <!-- Feature List -->
  <ul class="space-y-3 mb-8">
    <li class="flex items-start gap-2">
      <span class="text-green-600">✓</span>
      <span class="text-gray-700">5 Core Modules (~8 hours video)</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-green-600">✓</span>
      <span class="text-gray-700">Lifetime Access + Free Updates</span>
    </li>
    <li class="flex items-start gap-2">
      <span class="text-gray-400">✗</span>
      <span class="text-gray-400">Live Workshops</span>
    </li>
  </ul>

  <!-- CTA Button -->
  <button class="w-full bg-gray-700 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200">
    Enroll Now
  </button>
</div>
```

**Accelerator Tier (Most Popular):**
```html
<div class="bg-white rounded-2xl shadow-2xl p-8 border-2 border-green-500 relative">
  <!-- "Most Popular" Badge -->
  <div class="absolute -top-4 left-1/2 transform -translate-x-1/2">
    <span class="bg-amber-500 text-white text-xs font-bold uppercase tracking-wide px-4 py-1.5 rounded-full shadow-lg">
      ⭐ Most Popular
    </span>
  </div>

  <!-- Rest similar to Basic, but with green accents -->
  <h3 class="text-2xl font-bold text-green-600 mb-2 mt-2">Accelerator</h3>
  <!-- ... -->

  <button class="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200">
    Enroll Now
  </button>
</div>
```

**VIP Tier:**
```html
<div class="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl shadow-lg p-8 border-2 border-purple-400">
  <!-- Similar structure but with purple accents -->
  <h3 class="text-2xl font-bold text-purple-600 mb-2">VIP</h3>
  <!-- ... -->

  <button class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200">
    Limited Spots - Enroll Now
  </button>
</div>
```

**Grid Layout:**
```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
  <!-- Three tier cards -->
</div>
```

**Visual Hierarchy:**
- **Accelerator (center):** Largest shadow, green border, "Most Popular" badge
- **Basic (left):** Standard shadow, gray CTA (less emphasis)
- **VIP (right):** Gradient background, purple accents, premium feel

---

## Interactive Elements

### Button Variants

**Primary CTA:**
```html
<button class="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow">
  Start Free Course
</button>
```

**Secondary Button:**
```html
<button class="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md border border-gray-300 transition-colors duration-200">
  Learn More
</button>
```

**Outline Button:**
```html
<button class="border-2 border-green-500 text-green-600 hover:bg-green-50 font-medium py-2 px-4 rounded-lg transition-colors duration-200">
  View Details
</button>
```

**Destructive Button:**
```html
<button class="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200">
  Delete
</button>
```

**Disabled Button:**
```html
<button disabled class="bg-gray-300 text-gray-500 font-medium py-2 px-4 rounded-md cursor-not-allowed">
  Unavailable
</button>
```

**Icon + Text Button:**
```html
<button class="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200">
  <svg class="w-5 h-5"><!-- Icon --></svg>
  <span>Download Template</span>
</button>
```

---

### Lesson Navigation Buttons

**Bottom of Lesson Pages:**
```html
<div class="flex flex-col sm:flex-row justify-between items-center gap-4 mt-12 pt-8 border-t border-gray-200">
  <!-- Previous Lesson -->
  <a
    href="/free_content/lessons/01-..."
    class="flex items-center gap-2 text-gray-600 hover:text-green-600 font-medium transition-colors duration-200"
  >
    <svg class="w-5 h-5"><!-- Left arrow --></svg>
    <span>Previous: Introduction</span>
  </a>

  <!-- Next Lesson -->
  <a
    href="/free_content/lessons/03-..."
    class="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
  >
    <span>Next: Target Audience</span>
    <svg class="w-5 h-5"><!-- Right arrow --></svg>
  </a>
</div>
```

**Responsive:**
- Mobile: Stacked vertically (`flex-col`)
- Desktop: Side-by-side (`sm:flex-row`)

**Visual Hierarchy:**
- Next lesson: Green button (primary action)
- Previous lesson: Text link (secondary action)

---

## Badges & Labels

**Status Badge:**
```html
<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Completed
</span>
```

**Tier Badge (Pricing):**
```html
<span class="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded uppercase tracking-wide">
  VIP
</span>
```

**"New" Badge:**
```html
<span class="bg-blue-500 text-white text-xs font-bold uppercase px-2 py-1 rounded">
  New
</span>
```

**Lesson Number Badge (Circular):**
```html
<span class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-lg shadow">
  01
</span>
```

---

## Forms (Future)

**Input Field:**
```html
<div class="mb-4">
  <label for="email" class="block text-sm font-medium text-gray-700 mb-1">
    Email Address
  </label>
  <input
    type="email"
    id="email"
    name="email"
    class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
    placeholder="you@example.com"
  >
</div>
```

**Textarea:**
```html
<textarea
  rows="4"
  class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
  placeholder="Enter your message..."
></textarea>
```

**Checkbox:**
```html
<label class="flex items-start gap-3 cursor-pointer">
  <input
    type="checkbox"
    class="mt-1 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
  >
  <span class="text-sm text-gray-700">
    I agree to the terms and conditions
  </span>
</label>
```

**Select Dropdown:**
```html
<select class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent">
  <option>Select tier...</option>
  <option>Basic - ₽12,000</option>
  <option>Accelerator - ₽38,000</option>
  <option>VIP - ₽120,000</option>
</select>
```

---

## Loading States

**Spinner (Modal):**
```html
<div class="flex items-center justify-center p-8">
  <svg class="animate-spin h-8 w-8 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
  <span class="ml-3 text-gray-700">Waiting for authorization...</span>
</div>
```

**Skeleton Loader (Lesson Cards):**
```html
<div class="bg-white rounded-2xl shadow p-6 animate-pulse">
  <div class="flex items-center justify-between mb-4">
    <div class="w-14 h-14 rounded-full bg-gray-300"></div>
    <div class="w-10 h-10 bg-gray-300 rounded"></div>
  </div>
  <div class="h-6 bg-gray-300 rounded w-3/4 mb-3"></div>
  <div class="h-4 bg-gray-300 rounded w-full mb-2"></div>
  <div class="h-4 bg-gray-300 rounded w-5/6"></div>
</div>
```

**Progress Bar:**
```html
<div class="w-full bg-gray-200 rounded-full h-2">
  <div class="bg-green-600 h-2 rounded-full transition-all duration-300" style="width: 40%"></div>
</div>
<p class="text-sm text-gray-600 mt-1">4 of 10 lessons completed</p>
```

---

## Alerts & Notifications

**Success Alert:**
```html
<div class="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
  <svg class="w-6 h-6 text-green-600 flex-shrink-0"><!-- Check icon --></svg>
  <div>
    <h4 class="font-semibold text-green-900">Successfully authenticated!</h4>
    <p class="text-sm text-green-700 mt-1">You now have access to all free lessons.</p>
  </div>
</div>
```

**Error Alert:**
```html
<div class="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
  <svg class="w-6 h-6 text-red-600 flex-shrink-0"><!-- Error icon --></svg>
  <div>
    <h4 class="font-semibold text-red-900">Authentication failed</h4>
    <p class="text-sm text-red-700 mt-1">Please try again or contact support.</p>
  </div>
</div>
```

**Info Alert:**
```html
<div class="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
  <svg class="w-6 h-6 text-blue-600 flex-shrink-0"><!-- Info icon --></svg>
  <div>
    <h4 class="font-semibold text-blue-900">Platform Update</h4>
    <p class="text-sm text-blue-700 mt-1">New lesson added: GoFood 2025 Algorithm Changes</p>
  </div>
</div>
```

**Warning Alert:**
```html
<div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
  <svg class="w-6 h-6 text-yellow-600 flex-shrink-0"><!-- Warning icon --></svg>
  <div>
    <h4 class="font-semibold text-yellow-900">Action Required</h4>
    <p class="text-sm text-yellow-700 mt-1">Your payment method expires in 7 days.</p>
  </div>
</div>
```

---

## Admin Pages

### CRM Placeholder Page

**Location:** `app/views/crm/index.html.erb`

**Added:** 2025-10-16 - Placeholder page for future CRM functionality

**Access Control:** Admin only (`before_action :require_admin`)

**Layout Structure:**
```html
<div class="min-h-screen bg-gray-50">
  <!-- Top Navigation -->
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16">
        <div class="flex items-center">
          <a href="/" class="text-xl md:text-2xl font-bold text-green-600">
            <span class="hidden sm:inline">📚 Bali Food Delivery Master</span>
            <span class="sm:hidden">📚 BFDM</span>
          </a>
        </div>
        <div class="flex items-center gap-4">
          <%= render 'shared/auth_button' %>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Hero Section -->
    <div class="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-8 text-white mb-8">
      <div class="flex items-center gap-4 mb-4">
        <span class="text-5xl">🎯</span>
        <div>
          <h1 class="text-3xl sm:text-4xl font-bold">CRM System</h1>
          <p class="text-green-100 text-lg mt-2">Управление клиентами и продажами</p>
        </div>
      </div>
    </div>

    <!-- Coming Soon Card -->
    <div class="bg-white rounded-xl shadow-lg p-8 text-center">
      <span class="text-6xl mb-6 block">🚧</span>
      <h2 class="text-2xl font-bold text-gray-900 mb-4">В разработке</h2>
      <p class="text-gray-600 mb-6 leading-relaxed">
        CRM система находится в процессе разработки...
      </p>

      <!-- Planned Features -->
      <div class="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg p-6 border border-green-200 mb-6">
        <h3 class="text-lg font-bold text-gray-900 mb-4">💡 Планируемый функционал</h3>
        <ul class="space-y-3 text-left max-w-lg mx-auto">
          <li>✓ Управление лидами из Telegram</li>
          <li>✓ Автоматическая квалификация через AI</li>
          <li>✓ Трекинг прогресса обучения</li>
          <li>✓ Аналитика продаж и конверсий</li>
          <li>✓ Интеграция с платежными системами</li>
        </ul>
      </div>

      <!-- Back Button -->
      <a href="/" class="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg">
        <svg class="w-5 h-5"><!-- Left arrow --></svg>
        <span>Вернуться на главную</span>
      </a>
    </div>
  </div>
</div>
```

**Design System Alignment:**
- Uses standard green gradient for hero (`from-green-500 to-green-600`)
- Follows card design pattern with rounded corners and shadows
- Responsive layout with Tailwind breakpoints
- Integrates auth button dropdown component

**Future Implementation:**
- Lead management dashboard
- AI qualification display
- Sales analytics charts
- Payment integration status
- Student progress tracking

---

## Content Protection

### Blur Wrapper

**Usage:** Protects lesson content for unauthenticated users

**Structure:**
```html
<div id="lesson-content-blur" class="transition-all duration-300">
  <!-- Intro card -->
  <!-- Markdown content -->
  <!-- Key takeaways -->
</div>
```

**JavaScript Toggle:**
```javascript
// Apply blur (unauthenticated)
document.getElementById('lesson-content-blur').classList.add('blur-md');

// Remove blur (authenticated)
document.getElementById('lesson-content-blur').classList.remove('blur-md');
```

**What Gets Blurred:**
- Lesson intro card
- Main markdown content
- Key takeaways card

**What Stays Clear:**
- Navigation (top nav, breadcrumb, sidebar)
- Page title
- Footer

---

## Responsive Patterns

**Hide on Mobile, Show on Desktop:**
```html
<div class="hidden lg:block">
  <!-- Sidebar content -->
</div>
```

**Show on Mobile, Hide on Desktop:**
```html
<div class="block lg:hidden">
  <!-- Mobile dropdown -->
</div>
```

**Responsive Flex Direction:**
```html
<div class="flex flex-col sm:flex-row gap-4">
  <!-- Stacks on mobile, side-by-side on tablet+ -->
</div>
```

**Responsive Grid:**
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
  <!-- Adaptive column count -->
</div>
```

**Responsive Text Size:**
```html
<h1 class="text-2xl sm:text-3xl lg:text-4xl font-bold">
  Scales with viewport
</h1>
```

---

## Accessibility Components

**Skip to Main Content:**
```html
<a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-green-500 text-white px-4 py-2 rounded-lg">
  Skip to main content
</a>
```

**Screen Reader Only Text:**
```html
<span class="sr-only">
  Loading, please wait
</span>
```

**Focus Visible (Keyboard Navigation):**
```html
<button class="focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded-lg">
  Accessible Button
</button>
```

---

## Component Usage Guidelines

**Do's:**
- ✓ Use components as-is for consistency
- ✓ Apply responsive classes for all layouts
- ✓ Include aria-labels for icon-only buttons
- ✓ Test keyboard navigation (Tab, Enter, Escape)
- ✓ Maintain color contrast ratios (WCAG AA minimum)

**Don'ts:**
- ✗ Don't create custom components without documenting here
- ✗ Don't use inline styles (use Tailwind classes)
- ✗ Don't skip hover/focus states
- ✗ Don't ignore mobile layouts
- ✗ Don't use non-semantic HTML (div instead of button, etc.)

---

## File Locations

**Shared Partials:**
- `/app/views/shared/_auth_button.html.erb`
- (Future) `/app/views/shared/_lesson_card.html.erb`
- (Future) `/app/views/shared/_pricing_card.html.erb`

**Layout Files:**
- `/app/views/layouts/application.html.erb` - Main layout with nav
- (Future) `/app/views/layouts/lesson.html.erb` - Lesson-specific layout with sidebar

**Stimulus Controllers:**
- `/app/javascript/controllers/auth_controller.js` - Auth interactions
- (Future) `/app/javascript/controllers/modal_controller.js` - Generic modal

---

## Conclusion

This component library ensures UI consistency across the platform. When building new features, always check if a component exists here before creating custom markup. If you create a new reusable component, document it in this file for future reference.
