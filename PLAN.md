# Bookm — Updated Plan

An AI-tagged bookmarking service for tab hoarders. Save anything quickly; let an
LLM read the page, summarize it, and tag it; find it again later by searching
across tags, titles, and AI-generated summaries.

This document supersedes the original spec and folds in the review feedback.
The existing scaffold (TanStack Start + Drizzle + Better Auth + Biome) is the
starting point and stays.

---

## 1. Audience and positioning

The user is the person with 200+ tabs open across three windows who wants to
"close everything" without losing anything. Existing tools (Raindrop, Pinboard,
Linkding) cover bookmarking well, but require manual tagging, which is the
exact friction that causes hoarding in the first place. The wedge is:

- **Zero-effort save.** Paste / share / bulk-import; tags happen in the background.
- **Self-hostable, single binary + SQLite.** Friendly to the homelab crowd.
- **Handle invalid links** Log broken links and surface this info in the UI when bulk importing links.

## 2. Naming

Use the name "Bookm" (pronounced "bookmark" without the "ark") for now. It's short, quirky, and available as a domain.

## 3. MVP scope (two-week target)

The smallest thing that proves the tagging quality is good enough to use daily:

- Multi-user with Better Auth enabled from day one. First admin bootstrapped via
  `ADMIN_EMAIL` env var on startup (if users table is empty, that user is
  created with `is_admin=true`).
- Add bookmark by URL (paste in form).
- Bulk import from Netscape bookmark HTML (Chrome / Firefox / Safari export
  format).
- Server-side fetch + Readability extraction → cheap LLM call →
  `{summary, description, tags[], content_type, language, reading_time}`.
- SQLite + FTS5 search across title, summary, description, and tag names.
- List view with filters: tag, content type, date added. Archived and deleted
  bookmarks are hidden from the default view.
- Bookmarks are displayed as simple links grouped by tag. Starred bookmarks
  float to the top of each tag group. Description shown on hover — no cards,
  no images.
- Delete bookmark (soft delete via `deleted_at` timestamp). Hard purge is
  out of scope.

Everything else (extension, sharing, mobile) is post-MVP.

## 4. Core features (full vision)

- Add bookmark via: paste URL, browser extension, share-target PWA, bulk import
  (Netscape HTML, JSON, CSV).
- AI processing pipeline: fetch → extract → classify → tag → store.
- Search by full-text (FTS5) across title + summary + description + tag names,
  with filters for tag, content type, language, and date range.
- Tag management: rename, merge, delete, color. Deleting a tag moves affected
  bookmarks to "Untagged" — delete is never blocked.
- Export to Netscape HTML, JSON, CSV.
- Starred links to pin favorites to the main view.
- Multi-user with Better Auth, including OIDC for self-hosters who want to plug
  PocketID / Authelia / Authentik in.

## 5. AI tagging design

This is the whole product, so design it carefully.

**Controlled vocabulary, model can extend.** Keep a `tags` table per user. On each ingest, pass the user's top-N most-used tags into the system prompt and ask the model to reuse them where appropriate; only invent a new tag when none fit. Normalize on write: lowercase, kebab-case, singular, ASCII-fold. This prevents the `js / javascript / JS-language` drift problem.

**One LLM call per bookmark, structured output.** Use OpenRouter with `openrouter/free` as the default model (override with `OPENROUTER_DEFAULT_MODEL` env var). Force JSON schema output:

```ts
{
  title: string,            // cleaned-up title (strip site suffix)
  summary: string,          // one sentence
  description: string,      // 2–4 sentences, what's in the page
  tags: string[],           // 3–7, prefer existing
  content_type: "article" | "video" | "repo" | "docs" | "paper"
                | "tool" | "discussion" | "other",
  language: string,         // ISO 639-1
  reading_time_minutes: number | null
}
```

**Reduce tokens before calling.** Mozilla Readability (or `@mozilla/readability`
in JS) extracts main content, drops nav/footer/ads. Truncate to `EXTRACTION_MAX_CHARS` (default 8000 chars). For YouTube / GitHub / arXiv, use site-specific extractors (oEmbed, GitHub README, arXiv abstract API) and skip Readability entirely.

**Fallback for unfetchable pages.** If fetch fails or content is too thin
(paywall, login wall, JS-only SPA we can't render), tag from URL + title only
and mark `extraction_quality: "low"`. Surface this in the UI so the user can
re-process or fix manually.

**Cost guardrails.** Out of scope for now.

## 6. Data model (sketch)

```text
users (id, email, …)      -- from Better Auth
bookmarks (
  id,
  user_id,
  url,
  url_canonical,
  title,
  summary,
  description,
  content_type,
  language,
  reading_time_minutes,
  content,               -- Readability-extracted plain text; read by tag_bookmark
  extraction_quality,
  status,                 -- pending | processed | failed | broken
                         -- broken = URL unreachable at fetch time (4xx/5xx),
                         --   distinct from failed (job error). Set only during
                         --   fetch_and_extract. No auto-recheck; surfaced in
                         --   admin view for manual cleanup.
  starred,
  archived,
  deleted_at,              -- soft delete; null = active, set = deleted
  created_at,
  updated_at,
  processed_at,
)
tags (
  id,
  user_id,
  name,
  color
)
bookmark_tags (
  bookmark_id,
  tag_id
)
jobs (
  id,
  kind,
  payload_json,            -- Zod-validated discriminated union per kind
  status,                  -- pending | running | completed | failed
  attempts,
  claimed_at,              -- set atomically when worker claims the job
  next_run_at,
  last_error,
  created_at,
  updated_at
)
bookmarks_fts             -- FTS5 virtual table mirror
```

URL canonicalization on write: lowercase host, drop `www.`, drop fragment.
Dedupe by `(user_id, url_canonical)`.

## 7. UI design

**List view layout:**

- Bookmarks are displayed as plain links, grouped by tag. No cards, no images.
- Within each tag group, starred bookmarks float to the top; the rest are
  sorted by date added descending.
- A bookmark with multiple tags appears under each of its tag groups.
- A dedicated **"Untagged"** group sits at the bottom of the page, containing
  bookmarks with no tags yet (pending, failed, or simply untagged). Pending
  bookmarks show an inline "processing…" indicator.
- A dedicated **"Starred"** group does NOT exist at the top level — stars only
  affect sort order within each tag group.
- Hovering a bookmark link shows the AI-generated description as a tooltip.
  No detail page needed for MVP.

**Archived view (`/archived`):**

- Same grouped-by-tag layout, scoped to `archived = true AND deleted_at IS NULL`.
- An **"Empty archive"** button soft-deletes all archived bookmarks in one action.

**Inline actions per bookmark:**

Each bookmark in the list view has five inline icon actions:

1. **Star** — toggles `starred`; immediately re-sorts within the tag group.
2. **Archive** — sets `archived = true`; removes from main view.
3. **Delete** — sets `deleted_at`; removes from main view. No confirmation for MVP.
4. **Copy URL** — copies the canonical URL to clipboard.
5. **Edit (pencil)** — opens an inline edit form with two editable fields:
   - **Title** — free text input.
   - **Tags** — combobox with autocomplete from the user's existing tags.
     Typing filters existing tags; pressing Enter on a non-matching value
     creates a new tag. Summary and description are read-only (LLM output).

**Search:**

- Global by default: searches all bookmarks regardless of tag group.
- If a tag filter is active, search is scoped to that tag.
- FTS5 searches across title, summary, description, and tag names.
  Raw extracted `content` is not indexed in FTS5.

**Filters:**

- Tag (single select from existing tags).
- Content type (`article`, `video`, `repo`, `docs`, `paper`, `tool`,
  `discussion`, `other`).
- Date added (range picker or relative: today / this week / this month).

**Bulk import UX:**

- User uploads or pastes a Netscape HTML file.
- Folder names are imported as tags (normalized to lowercase kebab-case).
- Duplicate URLs (matched on `url_canonical`) are skipped.
- After import, a summary is shown: "Imported 47, skipped 12 duplicates,
  3 broken links detected."

## 8. Tech stack (revised)

| Layer              | Choice                                                | Notes                                                                                                                                                     |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime            | **Bun**                                               | Already scaffolded. Fine for app + workers in one process.                                                                                                |
| Framework          | **TanStack Start**                                    | Already scaffolded; pre-1.0, accept some churn.                                                                                                           |
| UI                 | **React + Tailwind + Shadcn UI**                      | Already scaffolded.                                                                                                                                       |
| DB                 | **SQLite (WAL) + Drizzle**                            | Already scaffolded. Add FTS5 virtual table.                                                                                                               |
| Auth               | **Better Auth**                                       | Already scaffolded. Email + OIDC plugin for self-hosters. PocketID becomes one of several OIDC providers, not a hard dependency.                          |
| Background jobs    | **In-process SQLite-backed queue**                    | A `jobs` table + a worker loop in the same Bun process. Persistence, retries, and visibility for free, no Redis. Drop in BullMQ only if scale demands it. |
| LLM                | **OpenRouter**                                        | Default to a cheap model; allow override per user. Optional Ollama base URL for fully local self-hosters.                                                 |
| Content extraction | **Readability (`@mozilla/readability` + `linkedom`)** | Plus site-specific extractors for YouTube / GitHub / arXiv / Reddit.                                                                                      |
| Lint / format      | **Biome**                                             | Already configured.                                                                                                                                       |
| Tests              | **Vitest**                                            | Already configured.                                                                                                                                       |
| Container          | **Docker + compose**                                  | App image; one named volume.                                                                                                                              |
| Extension          | **WXT**                                               | One codebase → Chrome / Firefox / Edge, MV3. (skip for now)                                                                                               |
| Mobile             | **PWA + Web Share Target API**                        | iOS Share Sheet works via the PWA. (skip for now)                                                                                                         |

Things explicitly cut from the original spec: BullMQ + Redis, hard PocketID dependency.

## 9. Architecture

Single Bun process runs the HTTP server (TanStack Start) and the job worker on
a timer loop. The worker pulls due rows from `jobs`, executes them with a
typed handler map, and writes back status. This keeps the deployment to one
container.

```text
┌─────────────────────── bun process ────────────────────────┐
│                                                            │
│   TanStack Start ────►  sqlite (drizzle)                   │
│        ▲                  ▲                                │
│        │                  │                                │
│        │            ┌─────┴───────┐                        │
│        └────────────│ job worker  │                        │
│                     │  (timer)    │                        │
│                     └──────┬──────┘                        │
│                            ▼                               │
│        Readability  ─►  OpenRouter  ─►  tags + summary     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Job worker design:**

- Each job handler is an `async` function. The worker runs up to N concurrent
  jobs via `Promise.all` with a semaphore (default `JOB_CONCURRENCY=3`).
- Jobs are claimed atomically:
  `UPDATE jobs SET status='running', claimed_at=unixepoch() WHERE id IN
(SELECT id FROM jobs WHERE status='pending' AND next_run_at <= unixepoch()
ORDER BY next_run_at LIMIT ?) RETURNING *`
- Bulk import jobs run in a separate slot capped at concurrency 1 to reduce
  tag invention races during cold-start.

Job kinds (initial set):

- `fetch_and_extract` — fetch URL, extract main text.
- `tag_bookmark` — call LLM, write summary/tags.

All handlers are idempotent: a re-run produces the same result for the same
input. Failures retry with exponential backoff up to N times, then go to
`status='failed'` and surface in the admin view.

Every handler checks `deleted_at IS NOT NULL` on the bookmark at the start and
exits early if true. Jobs for soft-deleted bookmarks are never explicitly
cancelled — they drain naturally.

**Tag normalization:** all tags are written as lowercase kebab-case. Before
inserting, normalize the string, then `INSERT OR IGNORE INTO tags (user_id,
name)` and resolve to the canonical row. This collapses `JavaScript`,
`javascript`, and `JS` to `javascript` regardless of which job writes first.

**Extraction content limit:** controlled by `EXTRACTION_MAX_CHARS` env var
(default `8000`). A per-model override map in config can raise or lower this
per model (e.g. `{ 'google/gemini-flash-1.5': 12000 }`). The env var is the
floor/default; the map overrides per model.

**Site-specific extractors (MVP):** YouTube (oEmbed) and GitHub (raw README).
URL pattern routing is wired for arXiv and Reddit too, but they fall back to
Readability until implemented post-MVP. `linkedom` is the sole DOM shim —
no `jsdom` fallback in production.

**URL canonicalization:** lowercase host, strip `www.`, drop URL fragment,
dedup by `(user_id, url_canonical)`. No tracking param stripping.

**Job payload types:** `payload_json` is a Zod-validated TypeScript
discriminated union — one variant per job `kind`. Every handler receives a
fully-typed payload; no `any`.

**Auth:** email + password only for MVP (no magic links, no OAuth). Better Auth
handles session management. Magic links and OIDC providers come in Phase 2.

**Registration:** controlled by `REGISTRATION_OPEN` env var (default `false`).
When false, only admin can create accounts via the `/admin` Users section.
When true, anyone can register via the sign-up page.

**Admin access:** `/admin` is a route in the main app, protected by an
`is_admin=true` session check. Linked from the user menu for admin users only.
On startup, if the users table is empty and `ADMIN_EMAIL` is set, that user is
created with `is_admin=true`.

**Per-user settings (profile page):**
- OpenRouter model slug (text input, free-form — not restricted to a known
  list). Overrides the server default for that user's jobs.
- OpenRouter base URL (optional — swap in an Ollama endpoint for local
  inference).

**Environment variables (complete list):**

| Variable                  | Default                    | Purpose                                        |
| ------------------------- | -------------------------- | ---------------------------------------------- |
| `DATABASE_URL`            | `./data/bookm.db`          | SQLite file path                               |
| `DATA_DIR`                | `./data` (dev) / `/data`   | Root for snapshot files                        |
| `ADMIN_EMAIL`             | —                          | Bootstraps first admin on empty DB             |
| `REGISTRATION_OPEN`       | `false`                    | Allow public sign-up                           |
| `OPENROUTER_API_KEY`      | —                          | Required for LLM calls                         |
| `OPENROUTER_DEFAULT_MODEL`| `openrouter/free`          | Default model for all users                    |
| `EXTRACTION_MAX_CHARS`    | `8000`                     | Max chars sent to LLM per bookmark             |
| `JOB_CONCURRENCY`         | `3`                        | Max concurrent jobs in the worker              |

## 10. Operational concerns

**Observability.** Structured JSON logs via `console.log`. `/healthz` for the
container.

**Admin UI (`/admin`).** Protected by `is_admin` session check. Linked from
the user menu for admin users only. Sections:

- **Jobs** — table of pending, running, and failed jobs with kind, bookmark
  URL, attempt count, last error, and a "Retry" button on failed rows.
- **Users** — list of all users with email, bookmark count, join date, and
  buttons to promote/demote admin.
- **Broken links** — list of bookmarks with `status='broken'` across all
  users, with URL, user, and date first seen broken.
- **Stats** — per-user bookmark counts and total job counts by status.

**Privacy.** Fetched pages never leave the user's instance for the LLM call
itself. Allow choosing the OpenRouter model per user; allow swapping in a
local Ollama URL.

**Rate limits.** Polite outbound fetches: per-host 1 RPS, custom user-agent.
`robots.txt` is not consulted — this is a personal tool fetching on behalf of
a specific user, not a crawler.

## 11. Phased roadmap

**Phase 0 — Foundations (in progress).** Scaffold, Drizzle schema, Better Auth
enabled, FTS5 wired, basic UI with empty states. Admin bootstrap via
`ADMIN_EMAIL` on first startup.

**Phase 1 — MVP.** Paste-URL + Netscape import → fetch → extract → LLM tag →
search/list/filter UI → Docker. Multi-user from day one.

**Phase 2 — Extension + OIDC.** OIDC plugin doc'd for self-hosters
(PocketID / Authelia / Authentik). WXT extension for Chrome + Firefox with
one-click save. PWA share target.

**Phase 3 — Quality of life.** Tag merge/rename/color, exporter, bulk operations, keyboard shortcuts.

**Phase 4 — Social / sharing.** Public lists with shareable URLs, opt-in
discoverable index, RSS feed per list.

**Phase 5 — Mobile + scale.** Native iOS / Android share extensions if the PWA
isn't enough, optional Postgres adapter, optional Redis-backed BullMQ for
people running this for a team.

## 12. Key decisions (record)

- **Default model.** `openrouter/free` via OpenRouter. Override with
  `OPENROUTER_DEFAULT_MODEL` env var. Re-evaluate quarterly.
- **Tag taxonomy seed.** Empty — vocabulary grows per user organically.
- **Sharing model.** Lists only — no per-bookmark public links. Bookmarks
  inherit visibility from their list(s). Post-MVP (Phase 4).
- **License.** MIT.
- **Auth method.** Email + password only for MVP. Magic links and OIDC in Phase 2.
- **Registration.** Closed by default (`REGISTRATION_OPEN=false`). Admin creates
  users via `/admin`.
- **Read/unread tracking.** Not implemented — removed from scope entirely.
- **Link rechecking.** Not implemented — no auto-recheck of URLs.
- **Cost guardrails.** Out of scope.
- **robots.txt.** Ignored — personal tool, not a crawler.
- **Wayback Machine archiving.** Out of scope.
- **Tag hierarchy.** Out of scope.
- **OG images.** Out of scope.
- **Tracking param stripping.** Out of scope.

## 13. Out of scope (for now)

- Browser sync replacement. This is not a Chrome Sync clone; it's a save-and-
  search tool.
- A team / org tier. Single-user and self-host first; team comes only after
  the single-user product is genuinely good.
