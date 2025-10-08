# Responsive Design Guide

## Overview

This document outlines responsive design patterns, breakpoints, and mobile-first strategies for the Bali Food Delivery Master platform. All components must adapt gracefully across devices from 320px mobile phones to 4K desktop displays.

---

## Breakpoint System

### Tailwind CSS Breakpoints

**Default Breakpoints (Tailwind):**

```javascript
{
  'sm': '640px',   // Small tablets, large phones (landscape)
  'md': '768px',   // Tablets
  'lg': '1024px',  // Laptops, small desktops
  'xl': '1280px',  // Desktops
  '2xl': '1536px'  // Large desktops, 4K displays
}
```

**Mobile-First Philosophy:**
- Base styles apply to ALL screen sizes (default = mobile)
- Add breakpoint prefixes to override for larger screens
- Example: `text-sm md:text-base lg:text-lg` (scales up, not down)

---

### Viewport Size Categories

**Extra Small (XS): <640px**
- Devices: iPhone SE, small Android phones
- Orientation: Portrait
- Design: Single column, stacked layout
- Typography: Smaller headings, comfortable body text
- Navigation: Hamburger menu or simplified nav
- Touch targets: Minimum 44×44px

**Small (SM): 640px - 767px**
- Devices: Large phones (landscape), small tablets (portrait)
- Orientation: Landscape phones, portrait tablets
- Design: 1-2 column layouts, some side-by-side elements
- Typography: Slightly larger than mobile
- Navigation: Can accommodate more nav items

**Medium (MD): 768px - 1023px**
- Devices: Tablets (landscape), small laptops
- Orientation: Landscape tablets, small screens
- Design: 2-3 column layouts, sidebars start appearing
- Typography: Closer to desktop sizes
- Navigation: Full horizontal nav bar

**Large (LG): 1024px - 1279px**
- Devices: Laptops, small desktops
- Orientation: Landscape only
- Design: Multi-column, fixed sidebars, larger whitespace
- Typography: Full desktop sizes
- Navigation: Full nav + sidebars

**Extra Large (XL): 1280px - 1535px**
- Devices: Desktops, iMacs
- Design: Max-width containers prevent over-stretching
- Layout: Same as LG but with more padding/margins

**2X Large (2XL): ≥1536px**
- Devices: Large displays, 4K screens
- Design: Content width capped, generous whitespace
- Layout: No further scaling (UX diminishes on too-wide content)

---

## Layout Patterns

### Container Max-Widths

**Purpose:** Prevent content from stretching too wide on large screens

```html
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
  <!-- Content constrained to 1280px max, centered -->
</div>
```

**Breakpoint-Specific Max-Widths:**
- `max-w-7xl`: 1280px (default page container)
- `max-w-4xl`: 896px (article content, forms)
- `max-w-2xl`: 672px (narrow content, modals)

**Responsive Padding:**
- Mobile (`px-4`): 16px side padding
- Tablet (`sm:px-6`): 24px side padding
- Desktop (`lg:px-8`): 32px side padding

---

### Grid Layouts

**Lesson Cards (Homepage, Freecontent Page):**

```html
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
  <!-- Lesson cards -->
</div>
```

**Responsive Behavior:**
- Mobile (<640px): 1 column (stacked vertically)
- Tablet (640px+): 2 columns
- Desktop (1024px+): 3 columns
- Gap: 24px between cards (all sizes)

**Pricing Tiers:**

```html
<div class="grid grid-cols-1 md:grid-cols-3 gap-8">
  <!-- Tier cards -->
</div>
```

**Responsive Behavior:**
- Mobile/Small Tablet (<768px): Stacked (1 column)
- Tablet+ (768px+): Side-by-side (3 columns)
- Rationale: Pricing comparison needs side-by-side view (delay until MD)

---

### Flexbox Layouts

**Navigation Bar:**

```html
<nav class="flex justify-between items-center h-16 px-4">
  <div class="flex-shrink-0">Logo</div>
  <div>Auth Button</div>
</nav>
```

**Responsive Behavior:**
- All sizes: Horizontal flex, space-between
- Logo: Never shrinks (`flex-shrink-0`)
- Auth button: Adjusts size based on content

**Button Groups:**

```html
<div class="flex flex-col sm:flex-row gap-4">
  <button>Previous Lesson</button>
  <button>Next Lesson</button>
</div>
```

**Responsive Behavior:**
- Mobile (<640px): Vertical stack (`flex-col`)
- Tablet+ (640px+): Horizontal row (`sm:flex-row`)
- Gap: 16px between buttons (all sizes)

---

### Sidebar Layouts

**Desktop Sidebar + Main Content:**

```html
<div class="flex">
  <!-- Sidebar (Desktop Only) -->
  <aside class="hidden lg:block lg:w-64 lg:fixed lg:h-full">
    <!-- Lesson navigation -->
  </aside>

  <!-- Main Content -->
  <main class="w-full lg:ml-64">
    <!-- Lesson content -->
  </main>
</div>
```

**Responsive Behavior:**
- Mobile/Tablet (<1024px): Sidebar hidden, full-width content
- Desktop (1024px+): Fixed sidebar (64=256px), content offset by 256px

**Alternative: Mobile Dropdown:**

```html
<!-- Mobile Only -->
<details class="lg:hidden">
  <summary>All Lessons (3 of 12)</summary>
  <!-- Lesson list -->
</details>
```

---

## Typography Scaling

### Responsive Font Sizes

**Page Titles (H1):**

```html
<h1 class="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold">
  Master Bali Food Delivery
</h1>
```

**Scaling:**
- Mobile: 24px (`text-2xl`)
- Small tablet: 30px (`text-3xl`)
- Desktop: 36px (`text-4xl`)
- Large desktop: 48px (`text-5xl`)

**Section Headings (H2):**

```html
<h2 class="text-xl sm:text-2xl lg:text-3xl font-bold">
  Section Title
</h2>
```

**Scaling:**
- Mobile: 20px
- Tablet: 24px
- Desktop: 30px

**Body Text:**

```html
<p class="text-sm sm:text-base lg:text-lg leading-relaxed">
  Paragraph text scales for readability.
</p>
```

**Scaling:**
- Mobile: 14px (smaller screens need smaller text for readability)
- Tablet: 16px (default)
- Desktop: 18px (larger screens allow larger text)

**Why Scale Typography?**
- **Mobile:** Smaller screens need smaller text to fit content
- **Desktop:** Larger screens can use larger text for comfort (reading distance)
- **Readability:** ~60-80 characters per line is optimal (scales with font size)

---

### Line Height Adjustments

**Headings:**
```html
<h1 class="leading-tight sm:leading-snug">
  Tight on mobile, slightly looser on tablet+
</h1>
```

**Body Text:**
```html
<p class="leading-normal sm:leading-relaxed">
  Comfortable line height scales with text size
</p>
```

**Rationale:**
- Tighter leading on mobile conserves vertical space
- Relaxed leading on desktop improves readability

---

## Component Responsiveness

### Navigation

**Top Nav (All Sizes):**
- Sticky positioning: Always visible on scroll
- Logo: Scales with available space (never wraps)
- Auth button: Full button on tablet+, icon-only option for mobile (not implemented)

**Breadcrumb (Responsive):**

```html
<nav class="text-sm">
  <a href="/" class="hidden sm:inline">Home</a>
  <span class="hidden sm:inline">/</span>
  <a href="/freecontent">Free Content</a>
  <span>/</span>
  <span>Lesson 01</span>
</nav>
```

**Behavior:**
- Mobile: Shows only last 2 levels ("Free Content / Lesson 01")
- Tablet+: Shows full breadcrumb ("Home / Free Content / Lesson 01")

---

### Cards

**Lesson Cards:**

```html
<div class="p-4 sm:p-6 lg:p-8">
  <h3 class="text-lg sm:text-xl mb-3">Card Title</h3>
  <p class="text-sm sm:text-base">Description</p>
</div>
```

**Responsive Padding:**
- Mobile: 16px padding (compact)
- Tablet: 24px padding (more breathing room)
- Desktop: 32px padding (generous whitespace)

**Responsive Typography:**
- Title: 18px → 20px (scales slightly)
- Description: 14px → 16px

**Touch Targets (Mobile):**
- Entire card is clickable
- Minimum 44×44px touch area (natural card size exceeds this)

---

### Modals

**Auth Modal:**

```html
<div class="fixed inset-0 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl max-w-md w-full mx-4 p-6 sm:p-8">
    <!-- Modal content -->
  </div>
</div>
```

**Responsive Behavior:**
- Mobile: 16px margin on sides (`mx-4`), 24px padding inside (`p-6`)
- Tablet+: Same margins, 32px padding inside (`sm:p-8`)
- Max-width: 448px (`max-w-md`) prevents over-stretching

**Close Button:**
- Desktop: Top-right corner, small X icon
- Mobile: Larger touch target (minimum 44×44px including padding)

---

### Forms (Future)

**Input Fields:**

```html
<input class="w-full px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base rounded-lg">
```

**Responsive Behavior:**
- Mobile: Smaller padding, smaller text (easier to tap on small screens)
- Tablet+: Larger padding, standard text size

**Form Layout:**

```html
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <input placeholder="First Name">
  <input placeholder="Last Name">
</div>
```

**Behavior:**
- Mobile: Stacked (1 column)
- Tablet+: Side-by-side (2 columns)

---

## Images & Media

### Responsive Images

**Hero Images:**

```html
<img
  src="/images/hero-mobile.jpg"
  srcset="
    /images/hero-mobile.jpg 640w,
    /images/hero-tablet.jpg 1024w,
    /images/hero-desktop.jpg 1920w
  "
  sizes="(max-width: 640px) 640px, (max-width: 1024px) 1024px, 1920px"
  alt="Bali food delivery"
  class="w-full h-auto"
>
```

**Benefits:**
- Loads appropriate image size for device (faster on mobile)
- Higher resolution on desktop (better quality)
- Automatic selection based on viewport width

**Object Fit (Cropping):**

```html
<img
  src="/images/lesson-thumbnail.jpg"
  class="w-full h-48 object-cover rounded-lg"
  alt="Lesson thumbnail"
>
```

**Behavior:**
- Fixed height (48=192px)
- Crops image to fill container (`object-cover`)
- Maintains aspect ratio (no distortion)

---

### Video Embeds

**Responsive Video Container:**

```html
<div class="relative pb-[56.25%] h-0 overflow-hidden">
  <!-- 56.25% = 16:9 aspect ratio -->
  <iframe
    class="absolute top-0 left-0 w-full h-full"
    src="https://player.vimeo.com/video/..."
  ></iframe>
</div>
```

**Behavior:**
- Maintains 16:9 aspect ratio on all screen sizes
- Scales width to container (100%)
- Height adjusts automatically

---

## Touch & Interaction

### Touch Targets (Mobile)

**Minimum Size:**
- Apple: 44×44px
- Android: 48×48px
- **Our Standard:** 44×44px minimum (accommodates both platforms)

**Button Sizing:**

```html
<!-- Desktop: Compact -->
<button class="py-2 px-4 sm:py-3 sm:px-6">
  Click Me
</button>
```

**Mobile Behavior:**
- Smaller padding on mobile (fits more buttons in nav)
- Still exceeds 44px height with text + padding

**Link Spacing:**

```html
<nav class="space-y-2 sm:space-y-1">
  <!-- Mobile: 8px vertical spacing (easier to tap) -->
  <!-- Desktop: 4px spacing (compact list) -->
</nav>
```

---

### Hover States (Desktop Only)

**Hover Effects Should Not Affect Mobile:**

```html
<button class="bg-green-500 hover:bg-green-600 active:bg-green-700">
  CTA Button
</button>
```

**Behavior:**
- Desktop: Hover changes background to green-600
- Mobile: No hover (touch has no hover state)
- Mobile: Active (pressed) state changes to green-700

**Tailwind Modifiers:**
- `hover:` - Desktop hover (ignored on touch devices)
- `active:` - Pressed state (works on touch devices)
- `focus:` - Keyboard focus (accessibility, all devices)

---

### Scroll Behavior

**Sticky Navigation:**

```html
<nav class="sticky top-0 z-50">
  <!-- Stays at top on scroll -->
</nav>
```

**Mobile Considerations:**
- Sticky elements reduce viewport height
- Keep sticky nav thin (<64px) to preserve content area

**Smooth Scrolling:**

```css
html {
  scroll-behavior: smooth;
}
```

**Benefits:**
- Anchor links scroll smoothly (better UX)
- Works on all devices (mobile + desktop)

---

## Performance Optimization

### Mobile-Specific Optimizations

**1. Image Lazy Loading:**

```html
<img src="/images/lesson.jpg" loading="lazy" alt="Lesson image">
```

**Behavior:**
- Images below fold don't load until user scrolls near them
- Saves bandwidth on mobile (critical for 3G/4G users)

**2. Reduce Animation on Mobile:**

```html
<div class="transition-transform duration-300 sm:hover:scale-105">
  <!-- No scale animation on mobile (performance + no hover) -->
</div>
```

**3. Conditional Loading:**

```javascript
// Load heavy components only on desktop
if (window.innerWidth >= 1024) {
  // Load desktop-only features
}
```

---

### Font Loading

**System Fonts (Current):**
- No web font loading (uses system fonts)
- Instant text rendering (no FOIT/FOUT)
- Optimal for mobile performance

**If Using Web Fonts (Future):**
```css
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap; /* Show system font until custom font loads */
}
```

---

## Testing Strategy

### Device Testing Matrix

**Phones (Portrait):**
- iPhone SE (375×667px) - Smallest modern iPhone
- iPhone 14 (390×844px) - Standard iPhone
- iPhone 14 Pro Max (428×926px) - Large iPhone
- Samsung Galaxy S21 (360×800px) - Standard Android
- Pixel 5 (393×851px) - Google device

**Tablets (Portrait & Landscape):**
- iPad Mini (768×1024px)
- iPad Pro 11" (834×1194px)
- iPad Pro 12.9" (1024×1366px)

**Desktops:**
- 13" Laptop (1280×800px)
- 15" Laptop (1920×1080px)
- 27" Desktop (2560×1440px)
- 4K Display (3840×2160px)

---

### Browser DevTools Testing

**Chrome DevTools:**
1. Open DevTools (F12)
2. Click "Toggle device toolbar" (Ctrl+Shift+M)
3. Select device from preset list OR set custom dimensions
4. Test responsive features:
   - Navigation collapse/expand
   - Grid layouts (1/2/3 columns)
   - Typography scaling
   - Touch target sizes
   - Sidebar show/hide

**Responsive Design Mode (Firefox):**
- Similar to Chrome, with additional rotation simulation
- Test landscape vs. portrait orientations

---

### Manual Testing Checklist

**Mobile (Portrait):**
- [ ] All text readable without zoom
- [ ] Buttons large enough to tap (44×44px)
- [ ] No horizontal scrolling (content fits screen width)
- [ ] Navigation accessible (breadcrumb truncated, sidebar hidden)
- [ ] Cards stack vertically (1 column grid)
- [ ] Modal fills screen appropriately (16px margins)
- [ ] Forms single-column (stacked fields)

**Tablet (Landscape):**
- [ ] 2-column grid for lesson cards
- [ ] Sidebar still hidden (appears at 1024px)
- [ ] Typography larger than mobile but smaller than desktop
- [ ] Navigation full-width, no collapse

**Desktop (1024px+):**
- [ ] Sidebar visible and fixed
- [ ] 3-column grid for lesson cards
- [ ] Max-width container prevents over-stretching
- [ ] Typography at full size
- [ ] Hover effects working (cards, buttons)

**4K/Large Displays:**
- [ ] Content doesn't stretch beyond max-w-7xl (1280px)
- [ ] Generous whitespace on sides (not awkwardly stretched)
- [ ] Images don't pixelate (high-res versions loaded)

---

## Accessibility on Mobile

### Font Sizing

**User Zoom:**
- Allow users to zoom text (don't set `user-scalable=no`)
- Use relative units (rem, em) not fixed pixels
- Test with browser zoom at 200% (WCAG requirement)

**Current Viewport Meta:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**Do NOT use:**
```html
<!-- ❌ Bad: Prevents user zoom -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

---

### Touch Gestures

**Swipe Navigation (Not Implemented):**
- Could add swipe left/right to navigate between lessons on mobile
- Requires JavaScript touch event listeners

**Tap vs. Click:**
- Use `click` event (works on touch + mouse)
- Avoid `mousedown`/`mouseup` (desktop-only)

---

## Dark Mode (Future Consideration)

**Mobile Priority:**
- Dark mode more important on mobile (battery life, eye strain)
- OLED screens benefit from dark backgrounds

**Responsive Dark Mode:**
```html
<div class="bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
  <!-- Adapts based on system preference (prefers-color-scheme) -->
</div>
```

**Media Query:**
```css
@media (prefers-color-scheme: dark) {
  /* Dark mode styles */
}
```

---

## Common Responsive Patterns

### Show/Hide Elements

**Hide on Mobile, Show on Desktop:**
```html
<div class="hidden lg:block">Desktop Only</div>
```

**Show on Mobile, Hide on Desktop:**
```html
<div class="lg:hidden">Mobile Only</div>
```

**Conditionally Render:**
```html
<div class="block sm:hidden">Mobile Version</div>
<div class="hidden sm:block">Desktop Version</div>
```

---

### Responsive Spacing

**Margin/Padding:**
```html
<div class="p-4 sm:p-6 lg:p-8 mb-6 sm:mb-8 lg:mb-12">
  <!-- Padding and margin increase on larger screens -->
</div>
```

**Gap (Grid/Flex):**
```html
<div class="grid gap-4 sm:gap-6 lg:gap-8">
  <!-- Gap between grid items scales with viewport -->
</div>
```

---

### Responsive Alignment

**Text Alignment:**
```html
<h1 class="text-center sm:text-left">
  <!-- Centered on mobile, left-aligned on tablet+ -->
</h1>
```

**Flexbox Alignment:**
```html
<div class="flex flex-col sm:flex-row items-center sm:items-start">
  <!-- Centered column on mobile, left-aligned row on tablet+ -->
</div>
```

---

## Conclusion

Responsive design is not an afterthought - it's baked into every component from the start. With 60%+ of users on mobile devices (especially in Bali's expat/tourist community), mobile experience is prioritized equally with desktop.

**Key Principles:**
1. **Mobile-first:** Design for smallest screen, enhance for larger
2. **Touch-friendly:** 44×44px minimum tap targets
3. **Performance:** Lazy load, optimize images, minimize animations
4. **Flexibility:** Components adapt, don't break at edge cases
5. **Testing:** Test on real devices, not just emulators

**Breakpoint Strategy:**
- **Mobile (<640px):** Single column, stacked, compact
- **Tablet (640-1023px):** 2 columns, some sidebars, medium spacing
- **Desktop (1024px+):** Multi-column, fixed sidebars, generous whitespace
- **Large (1280px+):** Max-width containers, no further scaling

All new components must be tested across all breakpoints before deployment. Responsive design is a feature, not a bug fix.
