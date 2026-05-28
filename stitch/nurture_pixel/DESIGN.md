---
name: Nurture Pixel
colors:
  surface: '#fef9ed'
  surface-dim: '#dedace'
  surface-bright: '#fef9ed'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f8f3e7'
  surface-container: '#f2ede2'
  surface-container-high: '#ede8dc'
  surface-container-highest: '#e7e2d6'
  on-surface: '#1d1c15'
  on-surface-variant: '#4e4634'
  inverse-surface: '#323029'
  inverse-on-surface: '#f5f0e4'
  outline: '#807661'
  outline-variant: '#d2c5ad'
  surface-tint: '#775a00'
  primary: '#775a00'
  on-primary: '#ffffff'
  primary-container: '#e6b325'
  on-primary-container: '#5e4700'
  inverse-primary: '#f3bf32'
  secondary: '#47672c'
  on-secondary: '#ffffff'
  secondary-container: '#c7efa4'
  on-secondary-container: '#4c6d31'
  tertiary: '#885120'
  on-tertiary: '#ffffff'
  tertiary-container: '#f3ab72'
  on-tertiary-container: '#703e0d'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdf99'
  primary-fixed-dim: '#f3bf32'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5a4300'
  secondary-fixed: '#c7efa4'
  secondary-fixed-dim: '#acd28a'
  on-secondary-fixed: '#0c2000'
  on-secondary-fixed-variant: '#304f16'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77f'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6c3a0a'
  background: '#fef9ed'
  on-background: '#1d1c15'
  surface-variant: '#e7e2d6'
typography:
  headline-lg:
    fontFamily: Space Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Mono
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-sm:
    fontFamily: Space Mono
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.2'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Space Mono
    fontSize: 14px
    fontWeight: '700'
    lineHeight: '1.0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1200px
---

## Brand & Style

This design system is built on the concept of "Digital Organicism"—merging the structured, nostalgic charm of 16-bit pixel art with the warmth of a child’s playroom. The intent is to evoke a sense of steady, incremental growth, mirroring the development of a child through a medium that feels both tactile and timeless.

The aesthetic direction is a refined **Retro-Tactile** approach. It avoids the harshness of traditional brutalism by using rounded "pixel blocks" and a soft, earthy palette. The goal is to create a safe, low-stimulation environment that encourages parent-child bonding without the anxiety of modern high-fidelity interfaces. The interface should feel "built," not just rendered, suggesting craftsmanship and care.

## Colors

The palette is strictly limited to earthy, sun-drenched tones to ensure a grounded emotional response. 

- **Primary (Sunbeam):** A warm, saturated yellow used for interactive elements and milestones.
- **Secondary (Sprout):** A soft, muted green for growth tracking and positive states.
- **Tertiary (Bark):** A rich woody brown used for structural elements, borders, and depth.
- **Neutral (Parchment):** An off-white, warm-leaning background color that reduces eye strain compared to pure white.

Absolutely no cool tones (blue/purple) are permitted, ensuring the UI feels "warm to the touch" at all times.

## Typography

The typographic strategy balances "The Machine" and "The Human." 

**Space Mono** is utilized for headers and labels to mimic the monospaced constraints of vintage computing, providing the "pixel" character required for the brand identity. It should be used sparingly for impact.

**Be Vietnam Pro** serves as the primary workhorse for content. Its contemporary, friendly humanist shapes provide the necessary legibility for long-form parenting tips and data entry, ensuring the app remains accessible and professional despite its playful aesthetic.

## Layout & Spacing

This design system employs a **Strict 8px Grid**. Every element—from padding to icon size—must be a multiple of 8. This maintains the "blocky" integrity of the pixel art style.

The layout uses a **Fixed-Width Fluid Hybrid** model:
- **Mobile:** 4-column grid with 16px margins. Content is primarily stacked in cards.
- **Desktop:** 12-column grid with a maximum container width of 1200px. 

Horizontal spacing (gutters) should be kept wide (24px+) to prevent the pixelated elements from feeling cluttered. Alignment should always be "hard"—avoid center-aligning body text; keep it left-aligned to respect the grid's vertical rhythm.

## Elevation & Depth

Depth is conveyed through **Hard-Shadow Block Layering** rather than blurs or gradients. 

1.  **Low Elevation:** Elements feature a 2px solid border in a darker shade of the surface color.
2.  **Raised Elevation:** Elements feature a 4px solid "drop-shadow" offset (bottom and right only) using the Tertiary (Bark) color at 20% opacity.
3.  **Active States:** Interactive elements "sink" when pressed, removing the drop-shadow and shifting the element 2px down and to the right.

This creates a tactile, "button-press" feeling reminiscent of classic game cartridges. No blurs or transparency effects are used, maintaining the crispness of the pixel aesthetic.

## Shapes

The shape language is defined by "Rounded Pixels." While traditional pixel art is sharp, this system uses a consistent **4px (0.25rem) corner radius** on all blocks. This softens the digital aesthetic, making it feel safer and more appropriate for a child-focused product.

Avoid large-scale organic curves. All shapes should be derived from squares and rectangles. If a "circle" is required (e.g., for an avatar), it should be rendered as an octagon or a heavily stepped pixel-circle.

## Components

### Pixelated Buttons
Buttons must have a "double-border" effect: a 2px inner light highlight and a 2px outer dark shadow. This gives them a chunky, 3D look. Text within buttons should always be in the `label-md` style.

### Card-Based Displays
Cards are the primary container. They should use the Neutral background with a 2px Tertiary border. For "featured" growth cards, use a Secondary (Green) border to signify vitality.

### Input Fields
Inputs are rectangular with a 2px "inset" shadow effect (solid color #D9D2C2) to appear carved into the UI. Use `body-md` for user entry.

### Low-Fidelity Icons
Icons must be designed on a 16x16 or 24x24 pixel grid. Stroke weights should be a consistent 2px. Avoid diagonal lines where possible; use "steps" to create the illusion of curves.

### Progress Bars
Progress is tracked using discrete blocks rather than a smooth fill. Each block represents a 10% increment, reinforcing the concept of building a child's future "one block at a time."