---
name: Bookm
description: AI-tagged bookmarking for tab hoarders; quiet, dense, trustworthy.
---

# Design System: Bookm

## 1. Overview

**Creative North Star: "The Quiet Index"**

Bookm's interface is the index page of a well-set book: dense, scannable, typographically disciplined, and entirely in service of the content. The user's bookmarks and tags are the design; everything else recedes. References are iA Writer (radical text-first calm) and Linear (product-tool precision in spacing and states). The register is product: design serves the workflow of saving fast and finding reliably.

The system explicitly rejects image-led bookmarking (Raindrop / Pocket thumbnails, masonry grids, cards), unstyled-HTML datedness (Linkding / Pinboard), and AI-product clichés (sparkle icons, purple gradients, "magic" framing). The AI is a quiet librarian; its output appears as plain, honest facts.

**Key Characteristics:**

- Text-first and information-dense, with hierarchy carried by type scale and weight, not boxes.
- Restrained color: warm paper neutrals, one deep pine-green accent used sparingly.
- Flat surfaces, restrained motion: state changes only, no choreography.
- Honest states: pending, failed, and broken items shown plainly inline.

## 2. Colors

Warm paper-tinted neutrals with a single deep pine-green accent: a page, ink on it, and nothing else competing.

All values use OKLCH. Neutrals sit at hue 79 (warm paper); the accent at hue 135 (pine green). No pure black or white.

### Primary

- **Deep Pine** `oklch(0.3676 0.0839 135.53)`: the one accent. Links at active/focus, primary action, selected category in the rail. Hover darkens to `oklch(0.3088 0.0617 135.819503)`. Covers at most 10% of any screen.

### Neutral

| Token           | Value                       | Use                                              |
| --------------- | --------------------------- | ------------------------------------------------ |
| `paper`         | `oklch(0.9667 0.005 79.41)` | Page background                                  |
| `surface`       | `oklch(0.94 0.006 79.41)`   | Row hover, category rail active background            |
| `hairline`      | `oklch(0.89 0.007 79.41)`   | 1px section dividers (category groups only)           |
| `ink`           | `oklch(0.16 0.01 79.41)`    | Primary text, bookmark titles                    |
| `ink-secondary` | `oklch(0.47 0.009 79.41)`   | Domain, counts, category rail labels, section headers |
| `ink-muted`     | `oklch(0.64 0.007 79.41)`   | "processing…" and other inline status labels     |

### Named Rules

**The Ink Budget Rule.** The pine-green accent covers at most 10% of any screen. If a screen feels flat, the fix is typographic hierarchy, never more accent.

**The Tinted Page Rule.** Every neutral is tinted toward the warm paper hue (OKLCH chroma 0.005 to 0.01). Pure black and pure white are prohibited.

## 3. Typography

**Font family:** DM Sans (Google Fonts variable: `opsz,wght@9..40,300..700`). Single family throughout.

**Character:** One warm, highly readable humanist sans carries the entire UI. Hierarchy comes from scale and weight contrast (ratio of at least 1.25 between steps), never from a second voice. The effect is iA Writer's invisibility with Linear's precision.

### Hierarchy

| Role               | Size             | Weight  | Use                                                                                                    |
| ------------------ | ---------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| **Section header** | 11px / 0.6875rem | 600     | Category-group names. Uppercase, letter-spacing 0.10em, ink-secondary color.                                |
| **Body**           | 15px / 0.9375rem | 450–500 | Bookmark titles (the dominant text). Max measure 65–75ch.                                              |
| **Label**          | 12px / 0.75rem   | 400     | Domain, timestamps, counts, inline status ("processing…"). ink-secondary or ink-muted. Never shouting. |
| **Category rail**  | 13px / 0.8125rem | 400     | Category navigation items. ink-secondary at rest, ink at active/hover.                                      |

Line-height base: 1.5 on body → 22.5px unit. All vertical spacing is multiples of this unit.

### Named Rules

**The One Family Rule.** One typeface family, period. Differentiation through weight and size only.

**Loading strategy:** Preload the 400-weight regular woff2 only. Use `font-display: swap` with a calibrated fallback (`size-adjust`, `ascent-override`) to minimize layout shift.

## 4. Elevation

Flat by default. Depth is conveyed through background tint shifts and hairline borders, not shadows. Hover states may use a subtle background tint; tooltips and the inline edit form may carry one soft, low shadow as the sole exception, since they genuinely float above the page.

### Named Rules

**The Flat Page Rule.** Surfaces are flat at rest. A shadow is permitted only on elements that are literally layered over content (tooltip, popover, combobox menu).

## 5. Main View Layout

**Theme scene:** A person in a quiet room in the evening, browser closed, scanning a printed index with a cup of coffee nearby, looking for a specific article they saved three weeks ago. Light mode. Ambient warmth. Paper quality.

**Color strategy:** Restrained. Warm paper neutrals carry the surface; the pine-green accent appears only on the active/selected category in the rail and on focused/hovered link text.

**Anchor references:** iA Writer (radical text-first density), Linear issue list (precise row spacing, hover-reveal actions), Pelican Books index (typographic hierarchy through weight, no chrome).

### Two-column grid

At viewport ≥960px: a 180px sticky left rail for category navigation and a fluid main column for the grouped list. Below 960px the rail collapses to a horizontal scroll strip above the list.

### Category rail (left)

Plain vertical list of category names with counts. Sticky. Items: 13px, ink-secondary at rest; ink + surface background at active. "All bookmarks" at top, "Uncategorized (n)" at bottom. Empty categories stay visible with a 0 count (the list is curated; the AI picks from it). No icons, no colors, no indentation.

### Bookmark list (right)

Structure per category section:

1. **Section header:** category name, 11px, 600 weight, uppercase, tracking-wide, ink-secondary. Followed by a 1px hairline.
2. **Bookmark rows:** one row per bookmark. Title (15px body link, ink) + domain (12px label, ink-secondary) + tags (12px, ink-muted, `·`-separated) + inline action cluster (star, archive, edit). Tags and actions are hidden at rest (`opacity: 0`), revealed on row hover or focus (`opacity: 1`), always visible on touch devices. No layout shift on reveal.
3. **Section gap:** 2rem between category groups.

Starred bookmarks sort to the top of each category group. Each bookmark appears exactly once — a bookmark has at most one category (tags remain many-per-bookmark and live in the row, not the rail).

**"Uncategorized" group** sits at the bottom of the list. Contains bookmarks in `pending`/`failed` states or that the AI could not file.

### AI processing states (inline, per row)

| Status      | What the user sees                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| `pending`   | Title (or URL if no title yet), then `processing` in ink-muted at the label tier                       |
| `processed` | Normal row                                                                                             |
| `failed`    | Title (or URL), then `extraction failed` in ink-muted. Edit affordance always visible (not hover-only) |
| `broken`    | Title (or URL), then `broken link` in ink-muted. Edit affordance always visible                        |

### Inline edit

Clicking the edit icon expands the row in-place: title input + tag combobox (autocomplete from the user's existing tags) + category select (the user's categories, plus "Uncategorized"). Save/cancel inline. No modal, no page transition. Collapsing with unsaved changes prompts once to discard.

### Copy (resolved)

| Element              | Text                                             |
| -------------------- | ------------------------------------------------ |
| Processing label     | `processing`                                     |
| Failure label        | `extraction failed`                              |
| Broken link label    | `broken link`                                    |
| Manual tag CTA       | `tag manually`                                   |
| Empty state headline | `Nothing saved yet.`                             |
| Empty state body     | `Paste a URL above to save your first bookmark.` |
| Archive undo         | `Archived. Undo` (undo is a plain text link)     |

## 6. Do's and Don'ts

### Do:

- **Do** render bookmarks as plain links grouped by category: no cards, no images, no thumbnails.
- **Do** show pending, failed, and broken states inline as calm plain-text facts.
- **Do** keep all inline actions (star, archive, delete, copy, edit) immediate and undramatic; state changes only, no celebratory motion.
- **Do** give every hover-only affordance (the description tooltip) a keyboard-focus equivalent, at WCAG 2.1 AA contrast.

### Don't:

- **Don't** imitate Raindrop or Pocket: no image-heavy visual bookmarking, no thumbnails, no masonry grids, no cards.
- **Don't** fall into Linkding or Pinboard's unstyled-HTML datedness; minimal must still look deliberately designed.
- **Don't** use AI-product clichés: no sparkle icons, no purple gradients, no "magic" framing around tagging.
- **Don't** use gradient text, side-stripe borders thicker than 1px, glassmorphism, or modals where inline editing works.
- **Don't** exceed the Ink Budget: if more than ~10% of a screen is accent-colored, remove color, not content.
