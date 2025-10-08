# Design System

## Overview

This design system defines the visual language, component patterns, and design principles for the Bali Food Delivery Master course platform. All UI components should adhere to these standards for consistency and brand cohesion.

---

## Color Palette

### Primary Colors

**Green (Success, CTAs, Brand)**
- `green-50`: `#f0fdf4` - Light backgrounds, subtle highlights
- `green-100`: `#dcfce7` - Hover states, selected items
- `green-500`: `#10b981` - Primary CTAs, brand color, links
- `green-600`: `#059669` - CTA hover states, active states
- `green-700`: `#047857` - Pressed states, dark accents

**Usage:**
- Primary action buttons: `bg-green-500 hover:bg-green-600`
- Success messages: `text-green-600 bg-green-50`
- Lesson number badges: Gradient from green-500 to green-600
- Links: `text-green-600 hover:text-green-700`

### Secondary Colors

**Blue (Authenticated State, Info)**
- `blue-50`: `#eff6ff` - Info backgrounds
- `blue-500`: `#3b82f6` - Authenticated button, info elements
- `blue-600`: `#2563eb` - Blue hover states

**Usage:**
- Authenticated user button: `bg-blue-500 hover:bg-blue-600`
- Info badges: `bg-blue-50 text-blue-700`
- Links (secondary): `text-blue-600`

**Purple (Premium, VIP)**
- `purple-50`: `#faf5ff` - Premium backgrounds
- `purple-500`: `#a855f7` - VIP tier highlights
- `purple-600`: `#9333ea` - Premium hover states

**Usage:**
- VIP tier cards: Border and badge colors
- Premium feature badges: `bg-purple-50 text-purple-700`

**Red (Logout, Warnings, Errors)**
- `red-50`: `#fef2f2` - Error backgrounds
- `red-500`: `#ef4444` - Logout button, error text
- `red-600`: `#dc2626` - Destructive action hover

**Usage:**
- Logout button: `bg-red-500 hover:bg-red-600`
- Error messages: `text-red-600 bg-red-50`
- Form validation errors: `border-red-500 text-red-600`

**Yellow/Amber (Caution, Highlights)**
- `yellow-50`: `#fffbeb` - Warning backgrounds
- `yellow-400`: `#fbbf24` - Warning icons, highlights
- `amber-500`: `#f59e0b` - "Most Popular" badges

**Usage:**
- Warning messages: `bg-yellow-50 text-yellow-700`
- "Most Popular" badge: `bg-amber-500 text-white`
- Highlighted stats: `text-yellow-600`

### Neutral Colors

**Gray (Text, Backgrounds, Borders)**
- `gray-50`: `#f9fafb` - Page backgrounds, subtle containers
- `gray-100`: `#f3f4f6` - Card backgrounds (alternate)
- `gray-200`: `#e5e7eb` - Borders, dividers
- `gray-300`: `#d1d5db` - Disabled states, subtle borders
- `gray-400`: `#9ca3af` - Placeholder text, muted elements
- `gray-500`: `#6b7280` - Secondary text
- `gray-600`: `#4b5563` - Body text
- `gray-700`: `#374151` - Headings, emphasis text
- `gray-800`: `#1f2937` - Dark text, strong contrast
- `gray-900`: `#111827` - Maximum contrast, titles

**Usage:**
- Page background: `bg-gray-50`
- Card backgrounds: `bg-white` or `bg-gray-100`
- Primary text: `text-gray-900` (headings), `text-gray-700` (body)
- Secondary text: `text-gray-600` or `text-gray-500`
- Borders: `border-gray-200` or `border-gray-300`

### Gradients

**Hero Section Background**
- `from-green-50 via-blue-50 to-purple-50`
- Creates soft, professional multi-color gradient
- Usage: Hero sections, premium card backgrounds

**Button Gradients (Optional Enhancement)**
- `from-green-500 to-green-600` - Primary CTA gradient
- `from-blue-500 to-blue-600` - Authenticated state gradient
- Usage: Add visual depth to important buttons

**Lesson Number Badges**
- `bg-gradient-to-br from-green-500 to-green-600`
- Diagonal gradient for visual interest
- White text: `text-white font-bold`

---

## Typography

### Font Family

**Primary Font:** System font stack (no custom fonts)
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
```

**Rationale:**
- Fast loading (no web font download)
- Native feel on each platform
- Excellent readability across devices
- Tailwind default: `font-sans`

### Font Sizes

**Display (Hero Headings)**
- `text-5xl`: 3rem (48px) - Page hero titles
- `text-4xl`: 2.25rem (36px) - Section headings
- `text-3xl`: 1.875rem (30px) - Large headings

**Headings**
- `text-2xl`: 1.5rem (24px) - H1, main titles
- `text-xl`: 1.25rem (20px) - H2, subsection titles
- `text-lg`: 1.125rem (18px) - H3, card titles

**Body**
- `text-base`: 1rem (16px) - Default body text, paragraphs
- `text-sm`: 0.875rem (14px) - Small text, labels, captions
- `text-xs`: 0.75rem (12px) - Fine print, badges, metadata

**Responsive Sizing Example:**
```html
<h1 class="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">
  Master Bali Food Delivery
</h1>
```
- Mobile: 24px
- Small tablet: 30px
- Large tablet/laptop: 36px
- Desktop: 48px

### Font Weights

- `font-light`: 300 - Rarely used, large display text only
- `font-normal`: 400 - Body text, paragraphs
- `font-medium`: 500 - Emphasized text, labels
- `font-semibold`: 600 - Subheadings, button text
- `font-bold`: 700 - Headings, CTAs, strong emphasis

**Hierarchy Example:**
```html
<h2 class="text-2xl font-bold text-gray-900">Section Title</h2>
<p class="text-base font-normal text-gray-700">Body paragraph text...</p>
<span class="text-sm font-medium text-gray-600">Label or caption</span>
```

### Line Height

- `leading-tight`: 1.25 - Headlines, compact text
- `leading-snug`: 1.375 - Subheadings
- `leading-normal`: 1.5 - Body text (default)
- `leading-relaxed`: 1.625 - Long-form content, readability
- `leading-loose`: 2 - Airy layouts, emphasis spacing

**Usage:**
- Headings: `leading-tight` to reduce space between lines
- Body text: `leading-relaxed` for comfortable reading
- Buttons: `leading-snug` to prevent tall buttons

### Letter Spacing

- `tracking-tight`: -0.025em - Large display text
- `tracking-normal`: 0 - Default (most text)
- `tracking-wide`: 0.025em - Uppercase labels, buttons
- `tracking-wider`: 0.05em - All-caps headings

**Usage:**
```html
<button class="uppercase tracking-wide font-semibold">
  ENROLL NOW
</button>
```

---

## Spacing System

### Padding

**Component Padding (Internal Spacing)**
- `p-2`: 0.5rem (8px) - Tight spacing, small badges
- `p-3`: 0.75rem (12px) - Buttons, small cards
- `p-4`: 1rem (16px) - Default card padding, buttons
- `p-6`: 1.5rem (24px) - Medium cards, content sections
- `p-8`: 2rem (32px) - Large cards, feature sections
- `p-12`: 3rem (48px) - Hero sections, page headers

**Responsive Padding Example:**
```html
<div class="p-4 sm:p-6 lg:p-8">
  <!-- Content -->
</div>
```
- Mobile: 16px
- Tablet: 24px
- Desktop: 32px

### Margin

**Component Margin (External Spacing)**
- `mb-2`: 0.5rem (8px) - Tight spacing between related items
- `mb-4`: 1rem (16px) - Paragraph spacing, small sections
- `mb-6`: 1.5rem (24px) - Section spacing, card gaps
- `mb-8`: 2rem (32px) - Major section breaks
- `mb-10`: 2.5rem (40px) - Large section breaks
- `mb-12`: 3rem (48px) - Page section breaks

**Vertical Rhythm Example:**
```html
<h2 class="mb-4">Section Title</h2>
<p class="mb-4">Paragraph one...</p>
<p class="mb-6">Paragraph two...</p>
<h3 class="mb-3">Subsection</h3>
```

### Gap (Flexbox/Grid Spacing)

**Flex/Grid Gaps**
- `gap-2`: 0.5rem (8px) - Tight item spacing
- `gap-3`: 0.75rem (12px) - Button groups, icon + text
- `gap-4`: 1rem (16px) - Card grids, form fields
- `gap-6`: 1.5rem (24px) - Wide grid gaps
- `gap-8`: 2rem (32px) - Spacious layouts

**Grid Example:**
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Lesson cards -->
</div>
```

---

## Border Radius

**Roundness Scale:**
- `rounded`: 0.25rem (4px) - Small elements, inputs
- `rounded-md`: 0.375rem (6px) - Buttons, small cards
- `rounded-lg`: 0.5rem (8px) - Cards, containers
- `rounded-xl`: 0.75rem (12px) - Large cards, feature boxes
- `rounded-2xl`: 1rem (16px) - Hero cards, modals
- `rounded-3xl`: 1.5rem (24px) - Extra-rounded premium elements
- `rounded-full`: 9999px - Pills, avatar images, badges

**Usage:**
- Buttons: `rounded-md` or `rounded-lg`
- Cards: `rounded-xl` or `rounded-2xl`
- Modals: `rounded-2xl`
- Badges: `rounded-full`
- Images: `rounded-lg`

---

## Shadows

**Depth Scale:**
- `shadow-sm`: Subtle, barely visible (input fields)
- `shadow`: Default card shadow (most cards)
- `shadow-md`: Medium depth (elevated cards)
- `shadow-lg`: Large depth (floating elements, dropdowns)
- `shadow-xl`: Extra large (modals, popovers)
- `shadow-2xl`: Maximum depth (dragged items, overlays)

**Hover Effects:**
```html
<div class="shadow hover:shadow-2xl transition-shadow duration-300">
  <!-- Card that gains depth on hover -->
</div>
```

**Usage:**
- Default cards: `shadow`
- Hovered cards: `hover:shadow-2xl`
- Modals: `shadow-2xl`
- Buttons: No shadow (or `shadow-sm` for subtle depth)

---

## Layout & Responsive Design

### Breakpoints

**Tailwind Default Breakpoints:**
- `sm`: 640px - Small tablets, large phones
- `md`: 768px - Tablets
- `lg`: 1024px - Laptops, small desktops
- `xl`: 1280px - Large desktops
- `2xl`: 1536px - Extra-large screens

**Mobile-First Approach:**
- Default classes apply to all sizes
- Prefix classes with breakpoint for larger screens
- Example: `text-sm md:text-base lg:text-lg`

### Container Widths

**Max Widths:**
- `max-w-7xl`: 1280px - Main content container (default)
- `max-w-4xl`: 896px - Article content, forms
- `max-w-2xl`: 672px - Narrow content, modals

**Usage:**
```html
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Page content -->
</div>
```

### Grid Layouts

**Lesson Card Grid:**
```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Cards -->
</div>
```
- Mobile: 1 column
- Small tablet: 2 columns
- Desktop: 3 columns

**Pricing Tiers Grid:**
```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
  <!-- Tier cards -->
</div>
```
- Mobile: Stacked vertically
- Tablet+: Side-by-side comparison

---

## Custom Markdown Styles

**Emoji Bullets:**
- Use emojis as visual bullets for lists
- `✓` for feature lists, benefits
- `✗` for "what's not included" or problems
- `📌` for key points
- `💡` for tips, insights
- `⚠️` for warnings, cautions

**Example:**
```markdown
✓ Lifetime access to all modules
✓ Free updates forever
✓ 14-day money-back guarantee
```

**Markdown Rendering:**
- Headings: Inherit design system (text-2xl font-bold mb-4, etc.)
- Paragraphs: `text-base text-gray-700 leading-relaxed mb-4`
- Lists: Custom styled with emoji bullets or standard bullets
- Links: `text-green-600 hover:text-green-700 underline`
- Code blocks: `bg-gray-100 rounded-lg p-4 font-mono text-sm`
- Blockquotes: `border-l-4 border-green-500 pl-4 italic text-gray-600`

---

## Animation & Transitions

### Transition Durations

- `duration-150`: 150ms - Fast interactions (button hovers)
- `duration-200`: 200ms - Standard transitions (most UI)
- `duration-300`: 300ms - Smooth transitions (cards, modals)
- `duration-500`: 500ms - Slow, emphasized transitions

**Usage:**
```html
<button class="transition-all duration-200 hover:scale-105">
  Click me
</button>
```

### Common Transitions

**Shadow on Hover:**
```html
<div class="transition-shadow duration-300 hover:shadow-2xl">
  <!-- Card -->
</div>
```

**Color Change:**
```html
<button class="bg-green-500 hover:bg-green-600 transition-colors duration-200">
  CTA Button
</button>
```

**Scale on Hover:**
```html
<div class="transition-transform duration-200 hover:scale-105">
  <!-- Interactive element -->
</div>
```

**Blur Effect (Content Protection):**
```html
<div id="lesson-content-blur" class="transition-all duration-300 blur-md">
  <!-- Content becomes blurry when class applied -->
</div>
```

### Keyframe Animations (Custom)

**Fade In (Modal Appearance):**
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.modal-overlay {
  animation: fadeIn 300ms ease-in-out;
}
```

**Slide Up (Toast Notifications):**
```css
@keyframes slideUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
```

---

## Accessibility

### Color Contrast

**WCAG AA Compliance (Minimum):**
- Text on background: 4.5:1 ratio
- Large text (18px+ or 14px+ bold): 3:1 ratio

**Contrast-Safe Combinations:**
- ✅ `text-gray-900` on `bg-white` (21:1)
- ✅ `text-gray-700` on `bg-white` (12.6:1)
- ✅ `text-white` on `bg-green-600` (4.5:1)
- ✅ `text-white` on `bg-blue-600` (5.7:1)
- ⚠️ `text-gray-400` on `bg-white` (2.6:1 - Use for decorative only)

### Focus States

**Keyboard Navigation:**
- All interactive elements must have visible focus state
- Use Tailwind's `focus:ring` utilities

**Example:**
```html
<button class="focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
  Accessible Button
</button>
```

**Focus Ring Colors:**
- Primary actions: `focus:ring-green-500`
- Secondary actions: `focus:ring-blue-500`
- Destructive actions: `focus:ring-red-500`

### Screen Reader Support

**Aria Labels:**
```html
<button aria-label="Close modal" class="...">
  <svg><!-- X icon --></svg>
</button>
```

**Semantic HTML:**
- Use `<nav>`, `<main>`, `<article>`, `<aside>` for structure
- Use `<h1>` through `<h6>` in correct hierarchy
- Use `<button>` for actions, `<a>` for navigation

---

## Component-Specific Styles

### Buttons

**Primary CTA:**
```html
<button class="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 shadow">
  Start Free Course
</button>
```

**Secondary Button:**
```html
<button class="bg-white hover:bg-gray-50 text-gray-700 font-medium py-2 px-4 rounded-md border border-gray-300 transition-colors duration-200">
  View Details
</button>
```

**Destructive Action:**
```html
<button class="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200">
  Logout
</button>
```

### Cards

**Default Lesson Card:**
```html
<div class="bg-white rounded-2xl shadow hover:shadow-2xl transition-shadow duration-300 p-6 border border-transparent hover:border-green-300">
  <!-- Content -->
</div>
```

**Intro Card (Colored Background):**
```html
<div class="bg-gradient-to-br from-green-50 to-blue-50 rounded-xl p-6 mb-6 border border-green-200">
  <!-- Lesson intro content -->
</div>
```

### Badges

**Lesson Number:**
```html
<span class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 text-white font-bold text-lg">
  01
</span>
```

**"Most Popular" Badge:**
```html
<span class="bg-amber-500 text-white text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">
  Most Popular
</span>
```

**Status Badge:**
```html
<span class="bg-green-100 text-green-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
  Completed
</span>
```

---

## Iconography

**Icon Library:** Heroicons (optional) or inline SVG

**Icon Sizes:**
- Small: 16px (`w-4 h-4`)
- Medium: 20px (`w-5 h-5`)
- Large: 24px (`w-6 h-6`)
- Extra Large: 32px (`w-8 h-8`)

**Icon + Text Alignment:**
```html
<div class="flex items-center gap-2">
  <svg class="w-5 h-5 text-green-600"><!-- Icon --></svg>
  <span>Icon with text</span>
</div>
```

**Emojis as Icons:**
- Use native emojis for quick, colorful icons
- Examples: 🎯, 🚀, ✓, 👤, 🔒
- Accessible across all devices, no downloads needed

---

## Dark Mode (Future Consideration)

**Not Currently Implemented**

**If Implementing:**
- Use Tailwind's `dark:` variant
- Define dark mode color palette:
  - Background: `dark:bg-gray-900`
  - Text: `dark:text-gray-100`
  - Cards: `dark:bg-gray-800`

**Example:**
```html
<div class="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
  <!-- Content adapts to dark mode -->
</div>
```

---

## Design Principles

**1. Clarity Over Cleverness**
- Use straightforward layouts, clear labels
- Avoid overly creative UI that confuses users
- Prioritize usability over aesthetics

**2. Consistent Spacing**
- Use multiples of 4px for all spacing (Tailwind default)
- Maintain vertical rhythm with consistent margins
- Group related elements with proximity

**3. Visual Hierarchy**
- Largest/boldest = most important
- Use size, weight, color to guide attention
- One primary action per screen

**4. Mobile-First**
- Design for smallest screen first
- Enhance for larger screens (don't strip down)
- Touch targets minimum 44px × 44px

**5. Performance**
- Avoid heavy images, use optimization
- Lazy-load off-screen content
- Minimize animations (subtle, purposeful only)

**6. Brand Consistency**
- Green = brand color, primary actions
- Always use defined color palette (no random hex codes)
- Typography hierarchy must be consistent across pages

---

## File Locations

**Tailwind Configuration:**
- `/config/tailwind.config.js` - Custom theme overrides (if any)

**Custom CSS:**
- `/app/assets/stylesheets/application.tailwind.css` - Tailwind directives + custom styles

**Component Partials:**
- `/app/views/shared/_auth_button.html.erb` - Reusable auth button
- Other partials: Follow `_component_name.html.erb` convention

---

## Conclusion

This design system ensures visual consistency, accessibility, and brand cohesion across the Bali Food Delivery Master platform. All new components should reference these standards before implementation. When in doubt, prioritize usability and simplicity over complexity.
