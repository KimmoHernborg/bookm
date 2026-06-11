<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->
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
- Restrained color: warm paper neutrals, one deep ink-blue accent used sparingly.
- Flat surfaces, restrained motion: state changes only, no choreography.
- Honest states: pending, failed, and broken items shown plainly inline.

## 2. Colors

Warm paper-tinted neutrals with a single deep ink-blue accent: a page, ink on it, and nothing else competing.

### Primary
- **Deep Ink Blue** [to be resolved during implementation]: the one accent. Links in their active or focused states, the primary action, selected filter states. Its rarity is what makes it legible.

### Neutral
- **Paper** [to be resolved during implementation]: the page background. Warm-tinted, never pure white (no `#fff`); chroma tinted toward the ink hue.
- **Reading Ink** [to be resolved during implementation]: body text. Warm near-black, never pure `#000`.
- **Margin Gray** [to be resolved during implementation]: metadata, counts, timestamps, secondary text.
- **Hairline** [to be resolved during implementation]: 1px dividers between tag groups; the only structural lines on the page.

### Named Rules
**The Ink Budget Rule.** The ink-blue accent covers at most 10% of any screen. If a screen feels flat, the fix is typographic hierarchy, never more accent.

**The Tinted Page Rule.** Every neutral is tinted toward the ink hue (OKLCH chroma 0.005 to 0.01). Pure black and pure white are prohibited.

## 3. Typography

**Display Font:** [font pairing to be chosen at implementation]
**Body Font:** same family as display; single humanist sans throughout.

**Character:** One warm, highly readable humanist sans carries the entire UI. Hierarchy comes from scale and weight contrast (ratio of at least 1.25 between steps), never from a second voice. The effect is iA Writer's invisibility with Linear's precision.

### Hierarchy
- **Headline** [to be resolved]: tag-group names. The strongest weight on the page.
- **Body** [to be resolved]: bookmark titles, the dominant text. Max measure 65 to 75ch.
- **Label** [to be resolved]: metadata, counts, inline status indicators ("processing…"). Smaller and lighter, never shouting.

### Named Rules
**The One Family Rule.** One typeface family, period. Differentiation through weight and size only.

## 4. Elevation

Flat by default. Depth is conveyed through background tint shifts and hairline borders, not shadows. Hover states may use a subtle background tint; tooltips and the inline edit form may carry one soft, low shadow as the sole exception, since they genuinely float above the page.

### Named Rules
**The Flat Page Rule.** Surfaces are flat at rest. A shadow is permitted only on elements that are literally layered over content (tooltip, popover, combobox menu).

## 6. Do's and Don'ts

### Do:
- **Do** render bookmarks as plain links grouped by tag: no cards, no images, no thumbnails.
- **Do** show pending, failed, and broken states inline as calm plain-text facts.
- **Do** keep all inline actions (star, archive, delete, copy, edit) immediate and undramatic; state changes only, no celebratory motion.
- **Do** give every hover-only affordance (the description tooltip) a keyboard-focus equivalent, at WCAG 2.1 AA contrast.

### Don't:
- **Don't** imitate Raindrop or Pocket: no image-heavy visual bookmarking, no thumbnails, no masonry grids, no cards.
- **Don't** fall into Linkding or Pinboard's unstyled-HTML datedness; minimal must still look deliberately designed.
- **Don't** use AI-product clichés: no sparkle icons, no purple gradients, no "magic" framing around tagging.
- **Don't** use gradient text, side-stripe borders thicker than 1px, glassmorphism, or modals where inline editing works.
- **Don't** exceed the Ink Budget: if more than ~10% of a screen is accent-colored, remove color, not content.
