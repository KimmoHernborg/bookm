# Product

## Register

product

## Users

Tab hoarders: people with 200+ tabs open across three windows who want to "close everything" without losing anything. Heavily overlapping with the self-hosting / homelab crowd (single binary + SQLite, OIDC-friendly). Two usage contexts:

- **Saving**: mid-browse, in a hurry, zero patience for forms. Paste a URL or bulk-import an export file and move on. Tagging is the friction that caused hoarding in the first place; it must happen in the background.
- **Finding**: later, deliberate. Searching across tags, titles, and AI-generated summaries to re-find something half-remembered.

## Product Purpose

Bookm is an AI-tagged bookmarking service. Save anything instantly; an LLM reads the page, summarizes it, and tags it; find it again by full-text search and tag browsing. Success looks like daily use: tagging quality good enough that the user never feels the need to tag manually, and search reliable enough that saving feels safe instead of like throwing things into a void.

## Brand Personality

Calm utility. Three words: **quiet, dense, trustworthy**. The tool disappears; the user's bookmarks are the interface. Text-first and information-dense, but refined, the way a well-set book page is dense without being noisy. No urgency, no gamification, no celebration moments. The emotional goal is relief: "everything is saved, findable, and off my mind."

## Anti-references

- **Raindrop / Pocket**: image-heavy visual bookmarking with thumbnails, masonry grids, and cards. Bookm renders plain links grouped by tag, no cards, no images (per PLAN.md).
- **Linkding / Pinboard datedness**: unstyled-HTML brutalism. Minimal is the goal, but it must still feel deliberately designed, with real typographic and spacing decisions.
- **AI-product clichés**: sparkle icons, purple gradients, "magic" framing around the tagging. The AI is a quiet librarian, not a feature to be marketed inside the product.

## Design Principles

1. **The bookmarks are the interface.** Chrome recedes; the user's saved links and tags carry the visual weight. Every pixel of UI furniture must justify itself against a line of content it displaces.
2. **Density with dignity.** Many links per screen, but set with typographic care: clear hierarchy through scale and weight, comfortable measure, deliberate rhythm between tag groups.
3. **Zero effort, visibly honored.** Saving and finding must feel instant. Anything the AI can do, the user never does; anything still in progress shows a calm inline indicator, never a blocking state.
4. **Honest states build trust.** Pending, failed, broken, and low-quality extractions are shown plainly as facts, not hidden or dressed up. Trust in the AI tagging comes from transparency, not polish.
5. **Quiet hands, fast feet.** Interactions (star, archive, edit, copy) are inline, immediate, and undramatic. No modals where inline works, no confirmation theater, no celebratory motion.

## Accessibility & Inclusion

WCAG 2.1 AA as the working baseline: AA contrast on all text, full keyboard operability for every inline action and the edit combobox, visible focus states, `prefers-reduced-motion` respected. Hover-only affordances (the description tooltip) need keyboard/focus equivalents.
