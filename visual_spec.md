# Visual Design Spec

## 1. Global Visual System
The website features an elegant, airy, and premium editorial design language typical of modern lifestyle, beauty, or skincare brands. The layout is highly restrained, utilizing generous negative space to frame content. It relies on a high-contrast typographic system, a soft and warm color palette, and curated still-life imagery rather than complex UI components. The aesthetic is flat and clean, avoiding drop shadows in favor of subtle border lines and color blocking, with delicate background architectural details (faint grids) that add structural sophistication.

## 2. Global Layout and Rhythm
- **Container Strategy:** The site employs a centered, max-width container (likely 1200px–1440px) for all primary content, preventing layout stretching on ultrawide displays. 
- **Vertical Rhythm:** Spacing is exceptionally generous. Padding between major sections is roughly 120px to 160px on desktop, creating an unhurried, editorial pacing.
- **Grid Systems:** Content frequently aligns to 3-column or 4-column grids. Multi-column layouts consistently collapse to a single-column vertical stack on mobile viewports.
- **Alignment:** While text within specific components (like hero sections) is often left-aligned, global section headers frequently utilize center alignment to anchor the page rhythm.

## 3. Global Typography System
The site uses a strict two-family typographic system based on extreme scale and weight contrast.
- **Primary Display (Serif):** A high-contrast, elegant modern transitional or Didone Serif (similar to Playfair Display). It is used strictly for major section headlines, article titles, and large statistical numbers.
- **Body & Utility (Sans-Serif):** A clean, geometric Sans-serif (similar to Inter or Montserrat). It is used for body paragraphs, product titles, navigation links, and button labels.
- **Hierarchy & Emphasis:** Section kickers, categories, and metadata frequently use the Sans-serif transformed to `uppercase` with prominent `letter-spacing` (approx. 2px–3px). This creates a premium, deliberate secondary hierarchy.

## 4. Global Color, Surface, and Effects
- **Backgrounds:** The primary foundational page background is pure white (`#FFFFFF`).
- **Secondary Surfaces:** Product cards, benefit cards, and some image wrappers use a very subtle, warm cream/beige tint to separate them from the white background without needing drop shadows.
- **Text & UI:** Primary text, headings, and CTA buttons use a charcoal/off-black (e.g., `#1A1A1A`). Pure black is avoided to maintain optical softness.
- **Borders:** Thin, low-contrast 1px light grey lines are used sparingly for grid definition (e.g., Value Proposition cards, Hero background).
- **Depth:** No prominent box-shadows or glassmorphism effects are observed. Depth is implied through overlapping elements (e.g., a rotating badge overlapping an image).

## 5. Global Motion Language
The motion language is restrained, fluid, and product-focused. 
- **Entrance Animations:** Almost all sections, text blocks, and imagery enter the viewport via a scroll-triggered upward translation (approx. 20px–40px) paired with an opacity fade (0% to 100%).
- **Easing:** Entrances use a smooth `ease-out` (cubic-bezier) feel, lasting roughly 500ms–600ms per element. There are no bouncy or spring dynamics.
- **Continuous Loops (Time-based):** The site employs infinite micro-animations for specific UI accents (a rotating badge and a pulsing dot) that are independent of scroll position.
- **Hover States:** *Ambiguity Flag:* Because no cursor is present in the recording, hover states must be inferred. Standard premium UX conventions should apply: subtle opacity shifts on text links, slight background darkening on pill buttons, and potentially a very subtle scale up (1.02x) on product imagery.

## 6. Motion Adaptation Rules
- **Grid Stagger Limit:** When grids (Products, Articles, Categories) enter the viewport, items appear with a staggered delay (left-to-right, approx. 100ms apart). **Adaptation Constraint:** If the CMS outputs a large number of items (e.g., 12+), a linear stagger delay will cause the last items to appear too late, resulting in an empty screen. The stagger delay *must* be capped at a maximum value (e.g., 500ms total) or batched by row to ensure rapid visibility.
- **Responsive Motion:** On mobile, horizontal staggered reveals should adapt to vertical staggered reveals, but maintain the same delay capping rule to avoid excessive waiting as the user scrolls down.

## 7. Global Imagery and Iconography
- **Imagery Style:** Still-life photography, soft studio lighting, warm tonal grades, and organic textures. 
- **Framing & Masking:** Image containers vary deliberately. While many are standard rectangles with subtle rounded corners, the site also utilizes perfect circles and custom asymmetrical clip-paths.
- **Iconography:** System icons (cart, search) and illustrative icons (in the Benefits section) are strictly minimalist, thin-stroke SVG outlines matching the charcoal text color.

## 8. Persistent Interface Layers
- **Top Navigation:** The header is sticky. After a short scroll threshold, a solid white background ensures the navigation remains pinned to the top of the viewport, maintaining a high z-index over all scrollable content.

## 9. Section Inventory
1. **Global Navigation**
2. **Hero Block** (Split content + Badge)
3. **Circular Category Links**
4. **Product Grid** (Best Sellers)
5. **Value Propositions** (Key Benefits)
6. **Feature Split** (Image/Text with Pulsing Dot)
7. **Curated Product List**
8. **Recent Articles Grid**
9. **Social/Hashtag Image Grid**
10. **Global Footer**
11. **Secondary: 404 Error Page**
12. **Secondary: About/Story Page**
13. **Secondary: Article Index Page**
14. **Secondary: Article Detail Page**

## 10. Section-by-Section Detailed Spec

### Global Navigation
- **Layout:** Sticky top bar, flex container. Text-based brand logo aligned left, primary navigation links centered, utility icons (search, cart, mobile menu) aligned right.
- **Surface:** Solid white background, no bottom border or shadow observed (relies on white space).

### Hero Block
- **Layout (Desktop):** Approx. 40/60 horizontal split. Left side contains vertically centered text (Headline, Subhead, CTA). Right side contains a large stylized image.
- **Background Detail:** The background behind the image features a very faint architectural grid composed of 1px grey squares, punctuated by small '+' marks at the intersections.
- **Image Masking:** The primary image does not use standard border-radius. It utilizes an asymmetrical mask: straight left and bottom edges, with a large, sweeping rounded curve exclusively on the top-right corner.
- **Floating Badge:** A circular SVG text badge sits partially overlapping the left edge of the image container and the negative space of the text column.
- **Responsive:** On mobile, this stacks vertically: Text block -> Rotating Badge (centered) -> Image. The image mask adapts to a standard symmetrical arch (rounded top, straight bottom).

#### Motion pattern: Hero Badge Rotation
- **Role:** Adds continuous subtle visual interest to the primary viewport.
- **Observed behavior:** The circular text badge rotates continuously around its center point.
- **Trigger:** Time-based (loads immediately, loops infinitely).
- **Motion family:** Continuous / looping.
- **Easing feel:** Linear (no easing, constant speed).
- **Duration band:** Slow (approx. 10-15 seconds per full rotation).

### Circular Category Links
- **Layout:** Horizontal row of 4–5 items. 
- **Treatment:** Perfect circle image containers with centered, Sans-serif text labels placed below.

### Product Grids (e.g., Best Sellers)
- **Layout:** 4-column grid (desktop), collapsing to 2-column or 1-column (mobile).
- **Card Anatomy:** 
  - Image Wrapper: Portrait-oriented rectangle, warm cream background, rounded corners. Product image floats centered within.
  - Data Row 1: Uses `justify-content: space-between`. Product Title (left, Sans) and Price (right, Sans).
  - Data Row 2: Category label (left, smaller, lighter grey Sans-serif) positioned directly under the Title.

### Value Propositions (Our Key Benefits)
- **Layout:** 3-column grid.
- **Card Anatomy:** 1px light grey border, subtle rounded corners, transparent background (or very faint cream). Content stacks vertically: top-aligned thin-stroke icon, bold Sans-serif title, regular body text.

### Feature Split (Make You Look...)
- **Layout:** 50/50 alternating flex block. Image on one side, vertically centered text stack on the other.
- **Distinctive Element:** The image features a persistent "pulsing dot" UI element positioned arbitrarily over the subject matter.

#### Motion pattern: Pulsing UI Dot
- **Role:** Draws the eye, suggests interactivity or highlights a product feature.
- **Sequence structure:** A solid white central core surrounded by an expanding, semi-transparent white ring.
- **Observed behavior:** The outer ring scales up from the center while simultaneously fading out to 0% opacity, then repeats.
- **Trigger:** Time-based loop.
- **Motion family:** Continuous / Feedback indicator.
- **Easing feel:** Ease-out for the expanding ring.
- **Duration band:** Approx. 1500ms per pulse cycle.

### Recent Articles / Social Grid
- **Layout:** Standard 4-column (Articles) or 3-column (Social) image grids.
- **Article Card:** 3:2 or 16:9 image wrapper, date label with small icon, Serif title below.

### About/Story Page
- **Hero:** Large full-width image.
- **Stats Block:** A 2x2 grid of large Serif numbers paired with small uppercase Sans-serif labels.

### Article Detail Page
- **Layout:** Narrow, reading-optimized single column. Text width is constrained to roughly 65–70 characters for optimal legibility.
- **Hero Image:** Full-width image spanning the top of the article, utilizing rounded corners on all sides.

## 11. Reusable Patterns and Motifs
- **Section Headers:** Appear in two strict variants:
  1. *Centered:* Small uppercase tracking kicker centered above a large Serif headline.
  2. *Split axis:* Large Serif headline aligned left, with a solid pill button ("Show More") aligned right on the same horizontal axis.
- **Pill Buttons:** Primary CTAs are universally rendered as fully rounded "pill" shapes, solid charcoal background, with white Sans-serif text. Occasionally accompanied by a right-facing arrow icon.

## 12. Essential Traits to Preserve
- The extreme size contrast between the Serif display headings and the Sans-serif body copy.
- The asymmetrical clipping mask on the desktop Hero image.
- The warm cream backgrounds used for product card image wrappers.
- The specific horizontal layout of the Product Card text (Title and Price on the same baseline, not stacked).
- The wide letter-spacing on all uppercase labels and kickers.

## 13. Build Guardrails and Anti-Simplification Warnings
- **Do not flatten the Hero Mask:** A coding LLM may attempt to apply standard `border-radius` to the desktop hero image. This is incorrect. Use `clip-path` or an SVG mask to achieve the straight-left / curved-top-right asymmetry.
- **Do not omit the background architectural grid:** The 1px grid lines and '+' intersection marks in the Hero section are vital to the brand's editorial feel. Implement via CSS background patterns or absolutely positioned SVG overlays.
- **Do not use a simple flex-column stack for Product Cards:** Ensure the Title and Price utilize `display: flex; justify-content: space-between` on the first text row.
- **Do not let continuous animations stall:** Ensure the CSS keyframes for the rotating hero badge and the pulsing feature dot are set to `infinite`.
- **Do not scale staggered scroll delays infinitely:** Implement a cap on stagger delays (e.g., maximum 500ms offset) so users do not have to wait for long lists to load.

## 14. Redaction and Abstraction Notes
- Literal brand names, specific product titles, pricing data, and exact blog post titles observed in the source video have been abstracted into generic component descriptions (e.g., "Product Title," "Serif Title") to prevent copying of identifiable source content.
- Dummy UI imagery (e.g., the pulsing dot) is described by its structural behavior rather than its literal context.